# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/disable_plugin_action.py
"""
DisablePluginAction — an administrator disables a plugin; its sections leave the tree, its data stays (FR-017).

::

    POST /api/v1/plugins/disable  {code, passport_id} {state: "disabled"} | 409 not_enabled | 409 needed_by
"""

from __future__ import annotations

from maxitor.core.errors import ConflictError
from maxitor.core.plugins.actions.administrator import administered, administrator_verdict, plugins
from maxitor.core.plugins.actions.change_plugin_state import live_row, move
from maxitor.core.plugins.actions.request_install_action import PluginParams, PluginStateResult
from maxitor.core.plugins.events import DisableRefusedEvent, PluginDisabledEvent
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


@meta(description="Disable an enabled plugin of the organization", domain=PluginsDomain)
@check_roles(AccountRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
class DisablePluginAction(BaseAction[PluginParams, PluginStateResult]):
    """
    AI-CORE-BEGIN
    ROLE: Take a plugin out of the organization's tree without touching its data.
    CONTRACT: 404 for a plugin the organization does not run; 409 not_enabled in another state, 409 needed_by naming every enabled plugin that needs it.
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

    @summary_aspect("Refuse while an enabled plugin needs it, then move it to disabled")
    @context_requires(Ctx.User.user_id)
    @emits(DisableRefusedEvent, PluginDisabledEvent)
    async def disable_summary(
        self, params: PluginParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> PluginStateResult:
        """Every enabled plugin that needs it is named in the refusal."""
        _ = state
        account_id = str(ctx.get(Ctx.User.user_id))
        organization = await administered(connections, params.code, account_id)
        row = await live_row(connections, organization["id"], params.passport_id, "enabled")
        dependents = await plugins(connections).enabled_dependents(organization["id"], params.passport_id)
        if dependents:
            names = [d["passport_id"] for d in dependents]
            await box.warning(
                Channel.business,
                "Disabling {%var.passport_id} refused in {%var.organization_id}: needed by {%var.dependents}",
                DisableRefusedEvent(
                    organization_id=organization["id"], passport_id=params.passport_id, account_id=account_id, dependents=names
                ),
            )
            raise ConflictError("needed_by", dependents=[{"passport_id": d["passport_id"], "title": d["title"]} for d in dependents])
        await move(connections, organization["id"], row["row_id"], "disabled", account_id, type(self).__name__)
        await box.info(
            Channel.business,
            "{%var.passport_id} disabled in {%var.organization_id}",
            PluginDisabledEvent(organization_id=organization["id"], passport_id=params.passport_id, account_id=account_id),
        )
        return PluginStateResult(state="disabled")
