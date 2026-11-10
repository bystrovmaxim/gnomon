# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/enable_plugin_action.py
"""
EnablePluginAction — an administrator enables a disabled plugin; its sections come back with all their data.

::

    POST /api/v1/plugins/enable  {code, passport_id} {state: "enabled"} | 409 not_disabled | 409 dependency_disabled
"""

from __future__ import annotations

from maxitor.core.errors import ConflictError
from maxitor.core.plugins.actions.administrator import administered, administrator_verdict, plugins
from maxitor.core.plugins.actions.change_plugin_state import live_row, move
from maxitor.core.plugins.actions.request_install_action import PluginParams, PluginStateResult
from maxitor.core.plugins.events import PluginEnabledEvent
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


@meta(description="Enable a disabled plugin of the organization", domain=PluginsDomain)
@check_roles(AccountRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
class EnablePluginAction(BaseAction[PluginParams, PluginStateResult]):
    """
    AI-CORE-BEGIN
    ROLE: Bring a disabled plugin back into the organization's tree.
    CONTRACT: 404 for a plugin the organization does not run; 409 not_disabled in another state, 409 dependency_disabled while a plugin it needs is disabled.
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

    @summary_aspect("Refuse while a plugin it needs is disabled, then move it to enabled")
    @context_requires(Ctx.User.user_id)
    @emits(PluginEnabledEvent)
    async def enable_summary(
        self, params: PluginParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> PluginStateResult:
        """Its dependencies must be enabled: a plugin never runs without what it needs."""
        _ = state
        account_id = str(ctx.get(Ctx.User.user_id))
        organization = await administered(connections, params.code, account_id)
        row = await live_row(connections, organization["id"], params.passport_id, "disabled")
        states = await plugins(connections).live_states(organization["id"])
        needed = await plugins(connections).dependencies([row["version_id"]])
        disabled = [d["passport_id"] for d in needed if states.get(d["passport_id"]) != "enabled"]
        if disabled:
            raise ConflictError("dependency_disabled", dependencies=disabled)
        await move(connections, organization["id"], row["row_id"], "enabled", account_id, type(self).__name__)
        await box.info(
            Channel.business,
            "{%var.passport_id} enabled in {%var.organization_id}",
            PluginEnabledEvent(organization_id=organization["id"], passport_id=params.passport_id, account_id=account_id),
        )
        return PluginStateResult(state="enabled")
