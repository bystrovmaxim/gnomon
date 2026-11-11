# packages/maxitor/tools/plugin-runner/maxitor/plugin_runner/loop.py
"""
The runner's loop: on start and then every period, keep every version some organization runs running, and stop
the rest.

::

    TakeUpRunningAction ──► for each version to run: RunVersionAction
                        └─► for each version running or recorded but no longer wanted: StopVersionAction
    the database refuses the connection ──► the round is skipped; the next one tries again

Every step is an action of the domain plugins run by the machine with the runner's own context; there is no route.
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

from maxitor.core.plugins.actions.run_version_action import RunVersionAction, RunVersionParams
from maxitor.core.plugins.actions.stop_version_action import StopVersionAction, StopVersionParams
from maxitor.core.plugins.actions.take_up_running_action import TakeUpRunningAction, TakeUpRunningParams
from maxitor.core.plugins.plugin_processes import PROCESSES_CONNECTION_KEY, PluginProcessesController
from maxitor.core.plugins.runner_role import RunnerRole

from aoa.action_machine.context.context import Context
from aoa.action_machine.context.user_info import UserInfo
from aoa.action_machine.exceptions.handle_error import HandleError
from aoa.action_machine.resources.connection_scope import connection_scope
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine

#: The context every runner action runs in: the runner, never a person.
RUNNER = Context(user=UserInfo(user_id="plugin-runner", roles=(RunnerRole,)))


def declared(action: type[Any], connections: Mapping[str, Any]) -> dict[str, Any]:
    """The connections an action declares, out of all the runner has."""
    return {info.key: connections[info.key] for info in getattr(action, "_connection_info", [])}


async def run_action(machine: ActionProductMachine, connections: Mapping[str, Any], action: Any, params: Any) -> Any:
    """Run one action with the connections it declares, each opened for this call and closed after it."""
    async with connection_scope(declared(type(action), connections)) as resolved:
        return await machine.run(RUNNER, action, params, resolved)


async def one_round(
    machine: ActionProductMachine, connections: Mapping[str, Any], known: dict[str, tuple[str, str]], *, started: bool
) -> set[str]:
    """Keep the wanted versions running and stop the others; answer the versions wanted now."""
    queue = await run_action(machine, connections, TakeUpRunningAction(), TakeUpRunningParams(started=started))
    wanted = {version.version_id for version in queue.versions}
    for version in queue.versions:
        known[version.version_id] = (version.passport_id, version.version)
        await run_action(machine, connections, RunVersionAction(), RunVersionParams(**version.model_dump()))
    processes: PluginProcessesController = connections[PROCESSES_CONNECTION_KEY]
    for version_id in sorted((processes.running_versions() | set(queue.recorded)) - wanted):
        passport_id, version = known.pop(version_id, ("", ""))
        await run_action(
            machine,
            connections,
            StopVersionAction(),
            StopVersionParams(version_id=version_id, passport_id=passport_id, version=version),
        )
    return wanted


async def run_forever(machine: ActionProductMachine, connections: Mapping[str, Any], period_seconds: float) -> None:
    """Round after round, ``period_seconds`` apart, until the process is stopped; then end every plugin process."""
    started = True
    known: dict[str, tuple[str, str]] = {}
    processes: PluginProcessesController = connections[PROCESSES_CONNECTION_KEY]
    try:
        while True:
            try:
                await one_round(machine, connections, known, started=started)
                started = False
            except HandleError:
                # The storage could not be opened: nothing changed, and the next round tries again, still as a start.
                pass
            await asyncio.sleep(period_seconds)
    finally:
        await processes.stop_all()
