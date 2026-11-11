# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/service_token_action.py
"""
ServiceTokenAction — a plugin works with no person behind it: its service key gives it a token for itself.

::

    POST /api/v1/gateway/service-token   {service_key, organization}
        the key of the version enabled in the organization ──► a token for the plugin: sub plugin:<id>, roles [service]
        any other key or organization                       ──► 401

The key is written on deployment into the version's environment file only; the core keeps its SHA-256.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import cast

from maxitor.core.errors import SignInRefusedError
from maxitor.core.plugins.actions.pass_request_action import ORGANIZATION_CODE
from maxitor.core.plugins.plugin_tokens import PLUGIN_TOKENS_CONNECTION_KEY, PluginTokensController
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from pydantic import Field, SecretStr

from aoa.action_machine.auth import GuestRole
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class ServiceParams(BaseParams):
    """The plugin's key and the organization it works for."""

    service_key: SecretStr = Field(min_length=1, max_length=200, description="The version's service key")
    organization: str = Field(pattern=ORGANIZATION_CODE, description="The organization's address code")


class ServiceResult(BaseResult):
    """The plugin's own token."""

    token: str = Field(description="A token for the plugin itself with the role service")


@meta(description="Give a plugin a token for itself by its service key", domain=PluginsDomain)
@check_roles(GuestRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
@connection(PluginTokensController, key=PLUGIN_TOKENS_CONNECTION_KEY, description="The core's signing key")
class ServiceTokenAction(BaseAction[ServiceParams, ServiceResult]):
    """
    AI-CORE-BEGIN
    ROLE: Let a plugin act with no person.
    CONTRACT: Only the key of the version enabled in the organization; the token names the plugin, not a person.
    INVARIANTS: The key is compared by its hash and never stored or shown.
    AI-CORE-END
    """

    @summary_aspect("Find the version by its key's hash and issue the plugin's own token")
    async def service_summary(
        self, params: ServiceParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> ServiceResult:
        """One reading, one signature."""
        _ = (state, box)
        key_hash = hashlib.sha256(params.service_key.get_secret_value().encode("utf-8")).hexdigest()
        store = cast(PluginsStorage, connections[PLUGINS_CONNECTION_KEY])
        target = await store.service_target(key_hash, params.organization)
        if target is None:
            raise SignInRefusedError("unauthorized")
        passport_id = str(target["passport_id"])
        tokens = cast(PluginTokensController, connections[PLUGIN_TOKENS_CONNECTION_KEY])
        token = tokens.issue(passport_id, f"plugin:{passport_id}", None, params.organization, ["service"], datetime.now(UTC))
        return ServiceResult(token=token)
