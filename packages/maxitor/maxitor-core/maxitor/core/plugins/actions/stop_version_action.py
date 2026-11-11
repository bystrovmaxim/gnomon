# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/stop_version_action.py
"""
StopVersionAction — a version no organization runs any more: its processes end and their rows go.
"""

from __future__ import annotations

from typing import cast

from maxitor.core.plugins.events import ProcessStoppedEvent
from maxitor.core.plugins.plugin_processes import PROCESSES_CONNECTION_KEY, PluginProcessesController
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


class StopVersionParams(BaseParams):
    """The version to stop and how the event names it."""

    version_id: str = Field(description="The version")
    passport_id: str = Field(default="", description="The plugin's id from its passport, when the runner knows it")
    version: str = Field(default="", description="The version, x.y.z, when the runner knows it")


class StopVersionResult(BaseResult):
    """Nothing but that it was done."""

    stopped: bool = Field(description="Always true")


@meta(description="Stop the processes of a version no organization runs and forget their rows", domain=PluginsDomain)
@check_roles(RunnerRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
@connection(PluginProcessesController, key=PROCESSES_CONNECTION_KEY, description="The plugin processes on this host")
class StopVersionAction(BaseAction[StopVersionParams, StopVersionResult]):
    """
    AI-CORE-BEGIN
    ROLE: End a version's processes.
    CONTRACT: Ends both processes if they run, deletes the version's rows, writes the event.
    AI-CORE-END
    """

    @summary_aspect("End the processes and forget their rows")
    @emits(ProcessStoppedEvent)
    async def stop_summary(
        self, params: StopVersionParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> StopVersionResult:
        """Two steps and the event."""
        _ = state
        await cast(PluginProcessesController, connections[PROCESSES_CONNECTION_KEY]).stop(params.version_id)
        await cast(PluginsStorage, connections[PLUGINS_CONNECTION_KEY]).forget_processes(params.version_id)
        await box.info(
            Channel.business,
            "Version {%var.passport_id} {%var.version} stopped: no organization runs it",
            ProcessStoppedEvent(passport_id=params.passport_id, version=params.version),
        )
        return StopVersionResult(stopped=True)
