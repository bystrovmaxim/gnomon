# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/upload_private_plugin_action.py
"""
UploadPrivatePluginAction — an administrator uploads a private plugin's wheel itself.

::

    POST /api/v1/plugins/private/upload   {code, file_name, content_base64}   {version_id, sha256, purl, state: "draft"}
                                          | 413 too_large | 422 not_a_wheel

For a closed repository, a CI artifact or any other source: Maxitor needs no access to anything (FR-013). Its
SHA-256 is computed here and shown; the wheel goes to the store once under it, and the plugin is named
``pkg:generic/<name>@<version>?checksum=sha256:<hash>``. The adapter takes no multipart, so the file comes as base64.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
from typing import cast

from maxitor.core.plugins.actions.add_private_plugin_action import PrivateAddedResult
from maxitor.core.plugins.actions.administrator import administered, administrator_verdict
from maxitor.core.plugins.actions.private_plugin import (
    PrivatePluginRefusedError,
    WheelTooLargeRefusedError,
    add_waiting,
    refuse,
    version_of,
)
from maxitor.core.plugins.events import PrivatePluginAddedEvent, PrivatePluginRefusedEvent
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from maxitor.core.plugins.storage.wheel_storage import WHEELS_CONNECTION_KEY, WheelStorage
from maxitor.core.plugins.wheel import WheelRefusedError, read_wheel
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
from aoa.action_machine.model import BaseAction, BaseParams, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox

#: The longest base64 a 50 MB wheel makes, with room for padding.
MAX_BASE64 = (50 * 1024 * 1024 + 2) // 3 * 4


class UploadParams(BaseParams):
    """The uploaded file."""

    code: str = Field(min_length=1, max_length=200, description="The organization's address code")
    file_name: str = Field(min_length=1, max_length=255, description="The file's name as it was chosen")
    content_base64: str = Field(min_length=1, max_length=MAX_BASE64, description="The file's bytes in base64")


@meta(description="Upload a private plugin's wheel into the organization's marketplace", domain=PluginsDomain)
@check_roles(AccountRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
@connection(WheelStorage, key=WHEELS_CONNECTION_KEY, description="The wheels Maxitor keeps, by SHA-256")
class UploadPrivatePluginAction(BaseAction[UploadParams, PrivateAddedResult]):
    """
    AI-CORE-BEGIN
    ROLE: Take an uploaded wheel into the organization's marketplace, waiting for its check.
    CONTRACT: 413 too_large past the store's limit; 422 not_a_wheel for a file that does not read as a wheel;
        otherwise the wheel kept by its hash and a draft version owned by the organization.
    INVARIANTS: The file is only read as a zip, never run.
    AI-CORE-END
    """

    @access_decide("Let through only an active administrator of the organization")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(
        self, params: UploadParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """The same refusal as for a made-up address."""
        _ = box
        return await administrator_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Decode and read the file, keep it by its hash, add the waiting plugin and its draft version")
    @context_requires(Ctx.User.user_id)
    @emits(PrivatePluginAddedEvent, PrivatePluginRefusedEvent)
    async def upload_summary(
        self, params: UploadParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> PrivateAddedResult:
        """The size before decoding, the wheel's form before storing."""
        _ = state
        account_id = str(ctx.get(Ctx.User.user_id))
        organization = await administered(connections, params.code, account_id)
        store = cast(WheelStorage, connections[WHEELS_CONNECTION_KEY])
        if len(params.content_base64) > (store.max_bytes + 2) // 3 * 4:
            raise await refuse(
                box, organization["id"], account_id, "too_large", WheelTooLargeRefusedError, limit=store.max_bytes
            )
        try:
            data = base64.b64decode(params.content_base64, validate=True)
        except (binascii.Error, ValueError):
            raise await refuse(box, organization["id"], account_id, "not_a_wheel", PrivatePluginRefusedError) from None
        if len(data) > store.max_bytes:
            raise await refuse(
                box, organization["id"], account_id, "too_large", WheelTooLargeRefusedError, limit=store.max_bytes
            )
        try:
            contents = read_wheel(data)
        except WheelRefusedError:
            raise await refuse(box, organization["id"], account_id, "not_a_wheel", PrivatePluginRefusedError) from None
        sha256 = hashlib.sha256(data).hexdigest()
        store.put(data, sha256)
        name = contents.dist_name or params.file_name.split("-")[0]
        version = version_of(contents.dist_version)
        purl = PackageURL(type="generic", name=name, version=version, qualifiers={"checksum": f"sha256:{sha256}"}).to_string()
        version_id = await add_waiting(
            connections,
            box,
            organization,
            account_id,
            title=name,
            version=version,
            purl=purl,
            sha256=sha256,
            uploaded=True,
            operation=type(self).__name__,
        )
        return PrivateAddedResult(version_id=version_id, sha256=sha256, purl=purl, state="draft")
