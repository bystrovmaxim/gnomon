# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/drop_failed_install_action.py
"""
DropFailedInstallAction — an administrator drops a failed install; nothing of the organization had been written, so nothing is deleted.

::

    POST /api/v1/plugins/drop  {code, passport_id} {state: "removed"} | 409 not_failed
"""

from __future__ import annotations

from maxitor.core.plugins.actions.administrator import administered, administrator_verdict
from maxitor.core.plugins.actions.change_plugin_state import live_row, move
from maxitor.core.plugins.actions.request_install_action import PluginParams, PluginStateResult
from maxitor.core.plugins.events import FailedInstallDroppedEvent
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from maxitor.core.roles import AccountRole

from aoa.action_machine.context.context_view import ContextView
from aoa.action_machine.context.ctx_constants import Ctx
from aoa.action_machine.intents.access_control import Verdict
from aoa.action_machine.intents.access_decide import access_decide
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.context_requires import context_requires
from aoa.action_machine.intents.emits import emits
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging import Channel
from aoa.action_machine.model import BaseAction, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


@meta(description="Drop a failed install of a plugin", domain=PluginsDomain)
@check_roles(AccountRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
class DropFailedInstallAction(BaseAction[PluginParams, PluginStateResult]):
    """
    AI-CORE-BEGIN
    ROLE: End a failed install; the row stays in the history.
    CONTRACT: 404 for a plugin the organization does not run; 409 not_failed in another state.
    AI-CORE-END
    """

    @access_decide("Let through only an active administrator of the organization")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(
        self, params: PluginParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """The same refusal as for a made-up address."""
        _ = box
        return await administrator_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Move a failed install to removed")
    @context_requires(Ctx.User.user_id)
    @emits(FailedInstallDroppedEvent)
    async def drop_summary(
        self, params: PluginParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> PluginStateResult:
        """One change; the plugin returns to the marketplace."""
        _ = state
        account_id = str(ctx.get(Ctx.User.user_id))
        organization = await administered(connections, params.code, account_id)
        row = await live_row(connections, organization["id"], params.passport_id, "failed")
        await move(connections, organization["id"], row["row_id"], "removed", account_id, type(self).__name__)
        await box.info(
            Channel.business,
            "Failed install of {%var.passport_id} dropped in {%var.organization_id}",
            FailedInstallDroppedEvent(organization_id=organization["id"], passport_id=params.passport_id, account_id=account_id),
        )
        return PluginStateResult(state="removed")
