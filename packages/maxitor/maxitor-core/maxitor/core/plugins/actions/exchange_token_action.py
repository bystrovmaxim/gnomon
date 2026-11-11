# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/exchange_token_action.py
"""
ExchangeTokenAction — a plugin calls a plugin it depends on: the gateway exchanges the caller's token for the callee.

::

    POST /api/v1/gateway/exchange   {token, plugin, organization, kind}
        a token this core signed, for the same organization       ──┐
        the callee a direct dependency of the caller's version      ├─► a token for the callee: same person, session,
        enabled there, and the callee enabled there too           ──┘   organization and roles; the callee's address
        a token that fails, or another organization ──► 401
        not a dependency, or not enabled            ──► 404
        not running                                 ──► 502

Only the core's own application asks: its gateway refuses this address from outside the site. A dependency of a
dependency is out of reach, as the plugin concept says.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal, cast

from maxitor.core.errors import OrganizationNotFoundError, PluginNotRunningError, SignInRefusedError
from maxitor.core.plugins.actions.pass_request_action import ORGANIZATION_CODE, PLUGIN_NAME
from maxitor.core.plugins.plugin_tokens import PLUGIN_TOKENS_CONNECTION_KEY, PluginTokensController
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from pydantic import Field

from aoa.action_machine.auth import GuestRole
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class ExchangeParams(BaseParams):
    """The caller's token and the request it makes."""

    token: str = Field(min_length=1, max_length=4096, description="The token the core issued for the caller")
    plugin: str = Field(pattern=PLUGIN_NAME, description="The callee's name, the segment after /p/")
    organization: str = Field(pattern=ORGANIZATION_CODE, description="The organization's address code from the path")
    kind: Literal["backend", "frontend"] = Field(description="backend for /p/<name>/api/**, frontend otherwise")


class ExchangeResult(BaseResult):
    """The callee's token and where it listens."""

    token: str = Field(description="A token for the callee with the caller's person, organization and roles")
    address: str = Field(description="The callee's inner address")


@meta(description="Exchange a plugin's token for a plugin it depends on", domain=PluginsDomain)
@check_roles(GuestRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
@connection(PluginTokensController, key=PLUGIN_TOKENS_CONNECTION_KEY, description="The core's signing key")
class ExchangeTokenAction(BaseAction[ExchangeParams, ExchangeResult]):
    """
    AI-CORE-BEGIN
    ROLE: Let a plugin call a direct dependency on behalf of the same person.
    CONTRACT: Only a token this core signed, for the organization of the request; only to a direct dependency of the
        caller's version enabled there; the new token keeps the person, session, organization and roles.
    INVARIANTS: The caller is the token's audience, never a field of the request.
    AI-CORE-END
    """

    @summary_aspect("Read the caller's token, check the dependency, issue the callee's token")
    async def exchange_summary(
        self, params: ExchangeParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> ExchangeResult:
        """One check of the token, one reading, one signature."""
        _ = (state, box)
        tokens = cast(PluginTokensController, connections[PLUGIN_TOKENS_CONNECTION_KEY])
        claims = tokens.read(params.token)
        if claims is None or claims["org"] != params.organization:
            raise SignInRefusedError("unauthorized")
        store = cast(PluginsStorage, connections[PLUGINS_CONNECTION_KEY])
        target = await store.exchange_target(params.organization, str(claims["aud"]), params.plugin, params.kind)
        if target is None:
            raise OrganizationNotFoundError("not_found")
        if not target["address"]:
            raise PluginNotRunningError("not_running")
        token = tokens.issue(
            str(target["passport_id"]),
            str(claims["sub"]),
            str(claims["sid"]),
            params.organization,
            list(claims["roles"]),
            datetime.now(UTC),
        )
        return ExchangeResult(token=token, address=str(target["address"]))
