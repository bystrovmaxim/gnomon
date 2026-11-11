# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/take_up_running_action.py
"""
TakeUpRunningAction — the runner's round: the deployed versions enabled in at least one organization.

The runner calls it when it starts and then every round, and keeps each version running in a call of its own. On
start it forgets every process row a stopped runner left: those processes ended with it.
"""

from __future__ import annotations

from typing import cast

from maxitor.core.plugins.events import RunnerStartedEvent
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
from aoa.action_machine.model.base_schema import BaseSchema
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class TakeUpRunningParams(BaseParams):
    """Whether the runner has just started."""

    started: bool = Field(default=False, description="True on the runner's first call after it started")


class RunnableSchema(BaseSchema):
    """A deployed version some organization has enabled."""

    version_id: str = Field(description="The version")
    version: str = Field(description="The version, x.y.z")
    sha256: str = Field(description="Its wheel's SHA-256 in the wheel store")
    schema_name: str = Field(description="Its schema, which names its runtime folder")
    passport_id: str = Field(description="The plugin's id from its passport")
    name: str = Field(description="The plugin's name")


class TakeUpRunningResult(BaseResult):
    """The runner's work for this round."""

    versions: list[RunnableSchema] = Field(description="The versions to keep running")
    recorded: list[str] = Field(description="The versions that still have process rows")


@meta(description="List the versions the runner keeps running", domain=PluginsDomain)
@check_roles(RunnerRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
class TakeUpRunningAction(BaseAction[TakeUpRunningParams, TakeUpRunningResult]):
    """
    AI-CORE-BEGIN
    ROLE: Give the runner its round of work.
    CONTRACT: Answers every deployed version enabled somewhere and the versions with process rows; on start forgets
        the rows a stopped runner left and says how many versions it found.
    AI-CORE-END
    """

    @summary_aspect("Read the versions to run; on start forget the rows a stopped runner left")
    @emits(RunnerStartedEvent)
    async def take_up_summary(
        self, params: TakeUpRunningParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> TakeUpRunningResult:
        """One reading of the versions and one of the rows; on start one deletion and the event."""
        _ = state
        store = cast(PluginsStorage, connections[PLUGINS_CONNECTION_KEY])
        if params.started:
            await store.forget_processes()
        versions = [RunnableSchema(**row) for row in await store.runnable_versions()]
        recorded = sorted({row["version_id"] for row in await store.processes()})
        if params.started:
            await box.info(
                Channel.business,
                "The runner started: {%var.versions} versions to run",
                RunnerStartedEvent(versions=len(versions)),
            )
        return TakeUpRunningResult(versions=versions, recorded=recorded)
