# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/pass_request_action.py
"""
PassRequestAction — the gateway's question for every request to a plugin: may it pass, and where to.

::

    POST /api/v1/gateway/pass   {plugin, organization, kind}   (the session cookie)
        an active user of the organization, the plugin enabled there ──► its process's inner address and the
                                                                         person's roles in the core there
        anything else ──► 404, the same as for an organization that does not exist
        enabled, but its process does not accept ──► 502 not_running

Only the core's own application asks: its gateway refuses this address from outside the site. The roles come from
the core's tables, never from the request: ``member`` for every active user, ``administrator`` added for the
organization's administrator.
"""

from __future__ import annotations

from typing import Literal, cast

from maxitor.core.errors import PluginNotRunningError
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from maxitor.core.roles import AccountRole
from pydantic import Field

from aoa.action_machine.context.context_view import ContextView
from aoa.action_machine.context.ctx_constants import Ctx
from aoa.action_machine.exceptions.access_denied import AccessDenied
from aoa.action_machine.intents.access_control import FORBIDDEN_OBJECT, Allowed, Verdict
from aoa.action_machine.intents.access_decide import access_decide
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.context_requires import context_requires
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox

#: A plugin's name in an address, as its passport allows it.
PLUGIN_NAME = r"^[a-z][a-z0-9_]{0,30}$"
#: An organization's address code.
ORGANIZATION_CODE = r"^[a-z0-9][a-z0-9-]{0,62}$"


class PassParams(BaseParams):
    """The request the gateway asks about."""

    plugin: str = Field(pattern=PLUGIN_NAME, description="The plugin's name, the segment after /p/")
    organization: str = Field(pattern=ORGANIZATION_CODE, description="The organization's address code from the path")
    kind: Literal["backend", "frontend"] = Field(description="backend for /p/<name>/api/**, frontend otherwise")


class PassResult(BaseResult):
    """Where the request goes and as whom."""

    address: str = Field(description="The process's inner address, http://127.0.0.1:<port>")
    passport_id: str = Field(description="The plugin's id from its passport, the token's audience")
    organization: str = Field(description="The organization's address code")
    roles: list[str] = Field(description="The person's roles in the core there: member, and administrator")


def roles_of(is_admin: bool) -> list[str]:
    """The core's roles a user carries into a plugin."""
    return ["member", "administrator"] if is_admin else ["member"]


@meta(description="Decide whether a request may pass to a plugin and give its inner address", domain=PluginsDomain)
@check_roles(AccountRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
class PassRequestAction(BaseAction[PassParams, PassResult]):
    """
    AI-CORE-BEGIN
    ROLE: The gateway's decision for one request to a plugin.
    CONTRACT: Only an active user of the organization, for a plugin enabled there; the same refusal for any other
        case; the address only while the process accepts.
    INVARIANTS: The roles are read from the core's tables; nothing of the request decides them.
    AI-CORE-END
    """

    @access_decide("Let through only an active user of the organization, for a plugin enabled there")
    @context_requires(Ctx.User.user_id)
    async def member_access_decide(
        self, params: PassParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """The same refusal as for a made-up address."""
        _ = box
        store = cast(PluginsStorage, connections[PLUGINS_CONNECTION_KEY])
        target = await store.pass_target(params.organization, str(ctx.get(Ctx.User.user_id)), params.plugin, params.kind)
        return Allowed() if target is not None else FORBIDDEN_OBJECT

    @summary_aspect("Read the target again and answer its address and the person's roles")
    @context_requires(Ctx.User.user_id)
    async def pass_summary(
        self, params: PassParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> PassResult:
        """The membership or the plugin may end between the decision and here: read again."""
        _ = (state, box)
        store = cast(PluginsStorage, connections[PLUGINS_CONNECTION_KEY])
        target = await store.pass_target(params.organization, str(ctx.get(Ctx.User.user_id)), params.plugin, params.kind)
        if target is None:
            raise AccessDenied(FORBIDDEN_OBJECT)
        if not target["address"]:
            raise PluginNotRunningError("not_running")
        return PassResult(
            address=str(target["address"]),
            passport_id=str(target["passport_id"]),
            organization=params.organization,
            roles=roles_of(bool(target["is_admin"])),
        )
