# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/add_private_plugin_action.py
"""
AddPrivatePluginAction — an administrator adds a private plugin by its release's Package URL and its SHA-256.

::

    POST /api/v1/plugins/private   {code, purl, sha256}   {version_id, state: "draft"} | 422 with the reason

A private plugin comes from GitHub or GitLab, its wheel named by ``?file=``; a PyPI package is the public
marketplace's (FR-012). The release must download without signing in; a closed repository goes by uploading the wheel.
The installer checks the version on its next round (FR-009a).
"""

from __future__ import annotations

import re

from maxitor.core.plugins.actions.administrator import administered, administrator_verdict
from maxitor.core.plugins.actions.private_plugin import PrivatePluginRefusedError, add_waiting, refuse, version_of
from maxitor.core.plugins.events import PrivatePluginAddedEvent, PrivatePluginRefusedEvent
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from maxitor.core.roles import AccountRole
from packageurl import PackageURL
from pydantic import Field

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
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox

_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class AddPrivateParams(BaseParams):
    """The dialog's release address and hash."""

    code: str = Field(min_length=1, max_length=200, description="The organization's address code")
    purl: str = Field(min_length=1, max_length=500, description="The release's Package URL, pkg:github/… or pkg:gitlab/…")
    sha256: str = Field(min_length=1, max_length=200, description="The wheel's SHA-256")


class PrivateAddedResult(BaseResult):
    """The version waiting for its check."""

    version_id: str = Field(description="The version added")
    sha256: str = Field(description="The wheel's SHA-256")
    purl: str = Field(description="The version's source")
    state: str = Field(description="draft: the installer checks it on its next round")


@meta(description="Add a private plugin of the organization by its release's address and hash", domain=PluginsDomain)
@check_roles(AccountRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
class AddPrivatePluginAction(BaseAction[AddPrivateParams, PrivateAddedResult]):
    """
    AI-CORE-BEGIN
    ROLE: Take a private plugin's release into the organization's marketplace, waiting for its check.
    CONTRACT: 422 pypi_is_public, not_a_purl, no_file or sha256_form; otherwise a draft version owned by the
        organization.
    AI-CORE-END
    """

    @access_decide("Let through only an active administrator of the organization")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(
        self, params: AddPrivateParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """The same refusal as for a made-up address."""
        _ = box
        return await administrator_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Check the address and the hash, then add the waiting plugin and its draft version")
    @context_requires(Ctx.User.user_id)
    @emits(PrivatePluginAddedEvent, PrivatePluginRefusedEvent)
    async def add_summary(
        self, params: AddPrivateParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> PrivateAddedResult:
        """The address's form first, then the hash's, then one change."""
        _ = state
        account_id = str(ctx.get(Ctx.User.user_id))
        organization = await administered(connections, params.code, account_id)
        try:
            parsed = PackageURL.from_string(params.purl.strip())
        except ValueError:
            raise await refuse(box, organization["id"], account_id, "not_a_purl", PrivatePluginRefusedError) from None
        if parsed.type == "pypi":
            raise await refuse(box, organization["id"], account_id, "pypi_is_public", PrivatePluginRefusedError)
        if parsed.type not in ("github", "gitlab") or not parsed.version:
            raise await refuse(box, organization["id"], account_id, "not_a_purl", PrivatePluginRefusedError)
        wheel = str((parsed.qualifiers or {}).get("file") or "")
        if not wheel.endswith(".whl"):
            raise await refuse(box, organization["id"], account_id, "no_file", PrivatePluginRefusedError)
        sha256 = params.sha256.strip().lower()
        if not _SHA256.match(sha256):
            raise await refuse(
                box, organization["id"], account_id, "sha256_form", PrivatePluginRefusedError, length=len(sha256)
            )
        purl = parsed.to_string()
        version_id = await add_waiting(
            connections,
            box,
            organization,
            account_id,
            title=parsed.name,
            version=version_of(parsed.version),
            purl=purl,
            sha256=sha256,
            uploaded=False,
            operation=type(self).__name__,
        )
        return PrivateAddedResult(version_id=version_id, sha256=sha256, purl=purl, state="draft")
