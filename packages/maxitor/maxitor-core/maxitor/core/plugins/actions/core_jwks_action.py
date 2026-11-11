# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/core_jwks_action.py
"""
CoreJwksAction — the core's public key as a JSON Web Key Set, by which every plugin checks the tokens it receives.

::

    GET /api/v1/jwks   {"keys": [{"kty": "OKP", "crv": "Ed25519", "x": ..., "kid": ..., "use": "sig", "alg": "EdDSA"}]}
"""

from __future__ import annotations

from typing import cast

from maxitor.core.plugins.plugin_tokens import PLUGIN_TOKENS_CONNECTION_KEY, PluginTokensController
from maxitor.core.plugins.plugins_domain import PluginsDomain
from pydantic import Field

from aoa.action_machine.auth import GuestRole
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.model.base_schema import BaseSchema
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class JwksParams(BaseParams):
    """Nothing: the key set is the same for everyone."""


class KeySchema(BaseSchema):
    """One public key."""

    kty: str = Field(description="OKP")
    crv: str = Field(description="Ed25519")
    x: str = Field(description="The public key, base64url")
    kid: str = Field(description="The key's RFC 7638 thumbprint")
    use: str = Field(description="sig")
    alg: str = Field(description="EdDSA")


class JwksResult(BaseResult):
    """The key set."""

    # "keys" is the JWKS member's name; a result's own attribute of that name is taken, so the field is named apart.
    signing_keys: list[KeySchema] = Field(serialization_alias="keys", description="The core's signing keys, public halves")


@meta(description="Publish the core's public key by which plugins check their tokens", domain=PluginsDomain)
@check_roles(GuestRole)
@connection(PluginTokensController, key=PLUGIN_TOKENS_CONNECTION_KEY, description="The core's signing key")
class CoreJwksAction(BaseAction[JwksParams, JwksResult]):
    """
    AI-CORE-BEGIN
    ROLE: Answer the JWKS.
    CONTRACT: Open to anyone: a public key is public.
    AI-CORE-END
    """

    @summary_aspect("Answer the public key")
    async def jwks_summary(
        self, params: JwksParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> JwksResult:
        """One reading of the controller."""
        _ = (params, state, box)
        tokens = cast(PluginTokensController, connections[PLUGIN_TOKENS_CONNECTION_KEY])
        return JwksResult(signing_keys=[KeySchema(**key) for key in tokens.jwks()["keys"]])
