# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/report_connection_refused_action.py
"""
ReportConnectionRefusedAction — the installer says the database refused its connection (FR-005a).

The installer's round could not open its storage; nothing was taken up, and the next round tries again. The event
carries what the database answered, never the connection string.
"""

from __future__ import annotations

from maxitor.core.plugins.events import InstallerConnectionRefusedEvent
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.plugins_domain import PluginsDomain
from pydantic import Field

from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.emits import emits
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging import Channel
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class RefusedParams(BaseParams):
    """What the database answered."""

    reason: str = Field(max_length=500, description="The database's answer, without the connection string")


class RefusedResult(BaseResult):
    """Nothing but that it was written."""

    written: bool = Field(description="Always true")


@meta(description="Write that the database refused the installer's connection", domain=PluginsDomain)
@check_roles(InstallerRole)
class ReportConnectionRefusedAction(BaseAction[RefusedParams, RefusedResult]):
    """
    AI-CORE-BEGIN
    ROLE: Turn a refused connection into the domain's critical event.
    AI-CORE-END
    """

    @summary_aspect("Write the critical event")
    @emits(InstallerConnectionRefusedEvent)
    async def report_summary(
        self, params: RefusedParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> RefusedResult:
        """One line."""
        _ = (state, connections)
        await box.critical(
            Channel.business,
            "The database refused the installer's connection: {%var.reason}",
            InstallerConnectionRefusedEvent(reason=params.reason),
        )
        return RefusedResult(written=True)
