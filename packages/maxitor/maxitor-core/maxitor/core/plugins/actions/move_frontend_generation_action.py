# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/move_frontend_generation_action.py
"""
MoveFrontendGenerationAction — the installer's upgrade round: every enabled version gets a build for the running
core version, and the site moves to those builds only once all of them are built.

::

    no generation yet           ──► the running core version is served
    every enabled version built ──► serving := the running core version, in one transaction ──► moved
    otherwise                   ──► the target is the running core version; the versions to build are answered,
                                    and the site keeps serving the builds it serves

A failed build holds the move; it is built again after an hour, or no longer waited for once its version is disabled
everywhere. The builds themselves are BuildFrontendAction's, one at a time, outside this action.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal, cast

from maxitor.core.plugins.events import FrontendGenerationMovedEvent
from maxitor.core.plugins.frontend_builder import core_version
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage
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

#: How long a failed build holds the move before it is built again.
RETRY_FAILED = timedelta(hours=1)


class MoveParams(BaseParams):
    """The upgrade round takes nothing: the running core version is the installer's own."""


class MoveResult(BaseResult):
    """Where the upgrade stands after the call."""

    state: Literal["serving", "waiting", "moved"] = Field(
        description="serving the running core version's builds; waiting for builds; moved to them now"
    )
    to_build: list[str] = Field(description="The enabled versions to build for the running core version, oldest first")


def to_build(builds: dict[str, dict[str, Any] | None], now: datetime) -> list[str]:
    """The versions with no build for the core version, or with a failed one older than the retry."""
    return [
        version_id
        for version_id, build in builds.items()
        if build is None or (build["state"] == "failed" and build["finished_at"] is not None and now - build["finished_at"] >= RETRY_FAILED)
    ]


@meta(description="Move the site to the frontend builds of the running core version once every enabled one is built", domain=PluginsDomain)
@check_roles(InstallerRole)
@connection(DeployStorage, key=DEPLOY_CONNECTION_KEY, description="The schema plugins, as maxitor_installer")
class MoveFrontendGenerationAction(BaseAction[MoveParams, MoveResult]):
    """
    AI-CORE-BEGIN
    ROLE: Decide whether the site moves to the running core version's builds, and what is left to build first.
    CONTRACT: Moves only when every enabled deployed version has a built build for the running core version; the
        move sets the serving version for all at once; otherwise answers the versions to build.
    INVARIANTS: The site serves the builds of one core version; a missing or failed build never moves it.
    AI-CORE-END
    """

    @summary_aspect("Answer the builds the running core version lacks, or move the site to its builds")
    @emits(FrontendGenerationMovedEvent)
    async def move_summary(self, params: MoveParams, state: BaseState, box: ToolsBox, connections: Connections) -> MoveResult:
        """Read the generation and the builds; move in one transaction when nothing is missing."""
        _ = params, state
        store = cast(DeployStorage, connections[DEPLOY_CONNECTION_KEY])
        core, now = core_version(), datetime.now(UTC)
        generation = await store.generation()
        if generation is None:
            await store.put_generation(core, None, now)
            generation = {"serving_core_version": core, "target_core_version": None, "moved_at": now}
        serving = str(generation["serving_core_version"])
        target = None if serving == core else core
        if generation["target_core_version"] != target:
            await store.put_generation(serving, target, generation["moved_at"])
        versions = [row["version_id"] for row in await store.runnable_versions()]
        builds = {version_id: await store.build(version_id, core) for version_id in versions}
        missing = to_build(builds, now)
        if serving == core:
            return MoveResult(state="serving", to_build=missing)
        if missing or any(build is None or build["state"] != "built" for build in builds.values()):
            return MoveResult(state="waiting", to_build=missing)

        async def move() -> bool:
            await store.generation_lock()
            current = await store.generation()
            if current is not None and current["serving_core_version"] == core:
                return False
            await store.put_generation(core, None, now)
            return True

        if await store.in_transaction(move):
            await box.info(
                Channel.business,
                "The site moved from the frontends built for the core {%var.moved_from} to those built for {%var.moved_to}",
                FrontendGenerationMovedEvent(moved_from=serving, moved_to=core, versions=len(versions)),
            )
        return MoveResult(state="moved", to_build=[])
