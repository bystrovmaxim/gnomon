# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/run_version_action.py
"""
RunVersionAction — keep one version's backend and frontend containers running, and record where they answer.

::

    the images ──► built once from the wheel; a failure waits for the next round
    for backend, then frontend (when the wheel carries its build):
        running                      ──► nothing; after a minute of running, its failures are forgotten
        exited since the last round  ──► removed; the row loses its address, the next start waits 5 s · 2^(n-1), ≤ 5 min
        waiting or never started     ──► started once its pause is over; its address recorded once it answers
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from maxitor.core.plugins.events import EnvironmentFailedEvent, ProcessExitedEvent, ProcessStartedEvent
from maxitor.core.plugins.plugin_processes import (
    PROCESSES_CONNECTION_KEY,
    EnvironmentInstallError,
    PluginProcessesController,
)
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.runner_role import RunnerRole
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from pydantic import Field

from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.emits import emits
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging import Channel
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox

#: The first pause after a failure; it doubles with each failure in a row.
FIRST_PAUSE = timedelta(seconds=5)
#: The longest pause between two starts.
LONGEST_PAUSE = timedelta(minutes=5)
#: How long a process runs before its failures are forgotten.
STEADY = timedelta(minutes=1)


def pause_after(failures: int) -> timedelta:
    """The pause before the next start after ``failures`` failures in a row."""
    pause: timedelta = FIRST_PAUSE * (2 ** max(failures - 1, 0))
    return min(pause, LONGEST_PAUSE)


class RunVersionParams(BaseParams):
    """The version to keep running, as the round found it."""

    version_id: str = Field(description="The version")
    version: str = Field(description="The version, x.y.z")
    sha256: str = Field(description="Its wheel's SHA-256 in the wheel store")
    schema_name: str = Field(description="Its schema, which names its runtime folder")
    passport_id: str = Field(description="The plugin's id from its passport")
    name: str = Field(description="The plugin's name")


class RunVersionResult(BaseResult):
    """What runs after the call."""

    running: list[str] = Field(description="The kinds that accept now: backend, frontend")


async def _keep(
    params: RunVersionParams,
    kind: str,
    image: str,
    row: dict[str, Any] | None,
    store: PluginsStorage,
    processes: PluginProcessesController,
    box: ToolsBox,
) -> str | None:
    """One kind's step; answers its address while it answers."""
    now = datetime.now(UTC)
    code = await processes.exit_code(params.version_id, kind)
    failures = int(row["failures"]) if row else 0
    if code is None and row is not None and row["address"]:
        if failures and row["started_at"] is not None and now - row["started_at"] >= STEADY:
            await store.put_process({**row, "version_id": params.version_id, "failures": 0, "updated_at": now})
        return str(row["address"])
    if code is not None and code != -1:
        await processes.stop_one(params.version_id, kind)
        await _failed(params, kind, f"exited {code}", failures + 1, row, store, box, now)
        return None
    if row is not None and row["next_start_at"] is not None and row["next_start_at"] > now:
        return None
    try:
        started = await processes.start(params.version_id, kind, params.schema_name, image)
    except (RuntimeError, OSError) as error:
        await _failed(params, kind, str(error) or "not_started", failures + 1, row, store, box, now)
        return None
    await store.put_process(
        {
            "id": row["id"] if row else str(uuid.uuid4()),
            "version_id": params.version_id,
            "kind": kind,
            "address": started.address,
            "container": started.container,
            "started_at": now,
            "failures": failures,
            "next_start_at": None,
            "updated_at": now,
        }
    )
    await box.info(
        Channel.business,
        "The {%var.kind} of {%var.passport_id} {%var.version} accepts at {%var.address}",
        ProcessStartedEvent(passport_id=params.passport_id, version=params.version, kind=kind, address=started.address),
    )
    return started.address

async def _failed(
    params: RunVersionParams,
    kind: str,
    reason: str,
    failures: int,
    row: dict[str, Any] | None,
    store: PluginsStorage,
    box: ToolsBox,
    now: datetime,
) -> None:
    """Write the failure: the row without an address, its next start after the pause, and the warning."""
    await store.put_process(
        {
            "id": row["id"] if row else str(uuid.uuid4()),
            "version_id": params.version_id,
            "kind": kind,
            "address": None,
            "container": None,
            "started_at": None,
            "failures": failures,
            "next_start_at": now + pause_after(failures),
            "updated_at": now,
        }
    )
    await box.warning(
        Channel.business,
        "The {%var.kind} of {%var.passport_id} {%var.version} stopped ({%var.reason}), failure {%var.failures}",
        ProcessExitedEvent(
            passport_id=params.passport_id, version=params.version, kind=kind, reason=reason[:200], failures=failures
        ),
    )


@meta(description="Keep a version's backend and frontend running and record their inner addresses", domain=PluginsDomain)
@check_roles(RunnerRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
@connection(PluginProcessesController, key=PROCESSES_CONNECTION_KEY, description="The plugin processes on this host")
class RunVersionAction(BaseAction[RunVersionParams, RunVersionResult]):
    """
    AI-CORE-BEGIN
    ROLE: Start what is missing, notice what exited, and keep the rows the gateway reads.
    CONTRACT: The images first; then each kind: left alone while it runs, restarted after its pause once it
        exited, started when it never ran; a row has an address only while its process accepts.
    INVARIANTS: Never starts a frontend the wheel does not carry; a failure is an event, never an exception.
    AI-CORE-END
    """

    @summary_aspect("Build the images, then keep each container running")
    @emits(EnvironmentFailedEvent, ProcessStartedEvent, ProcessExitedEvent)
    async def run_summary(
        self, params: RunVersionParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> RunVersionResult:
        """The images, then the backend and the frontend in turn."""
        _ = state
        store = cast(PluginsStorage, connections[PLUGINS_CONNECTION_KEY])
        processes = cast(PluginProcessesController, connections[PROCESSES_CONNECTION_KEY])
        try:
            plan = processes.plan(params.sha256)
            images = await processes.ensure_images(params.schema_name, params.sha256, plan)
        except EnvironmentInstallError as error:
            await box.critical(
                Channel.business,
                "The images of {%var.passport_id} {%var.version} could not be built: {%var.reason}",
                EnvironmentFailedEvent(passport_id=params.passport_id, version=params.version, reason=error.reason),
            )
            return RunVersionResult(running=[])
        rows = {row["kind"]: row for row in await store.processes() if row["version_id"] == params.version_id}
        wanted = {"backend": images.backend, **({"frontend": images.frontend} if images.frontend else {})}
        running: list[str] = []
        for kind, image in wanted.items():
            if await _keep(params, kind, image, rows.get(kind), store, processes, box) is not None:
                running.append(kind)
        return RunVersionResult(running=running)
