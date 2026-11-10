# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/private_plugin.py
"""
What adding a private plugin by a release's address and by uploading its wheel share: the plugin that waits for its
version's check, owned by the organization, and the version in draft.

The waiting plugin is named after its version (``pending.<version id>``) until the installer's check gives it the
passport's id and name — or moves the version under the organization's plugin that already has that id.
"""

from __future__ import annotations

import re
import uuid

from maxitor.core.errors import CoreRefusalError
from maxitor.core.plugins.events import PrivatePluginAddedEvent, PrivatePluginRefusedEvent
from maxitor.core.plugins.storage.plugins_storage import PluginsStorage

from aoa.action_machine.logging import Channel
from aoa.action_machine.runtime.tools_box import ToolsBox

_VERSION = re.compile(r"^v?([0-9]+\.[0-9]+\.[0-9]+)$")


class PrivatePluginRefusedError(CoreRefusalError):
    """The dialog's address, hash or file is refused."""

    status = 422


class WheelTooLargeRefusedError(CoreRefusalError):
    """The uploaded file is more than a wheel may be."""

    status = 413


def version_of(text: str | None) -> str:
    """``x.y.z`` from a release's tag or a wheel's version; ``0.0.0`` until the check reads the passport."""
    found = _VERSION.match(text or "")
    return found.group(1) if found else "0.0.0"


async def refuse(
    box: ToolsBox, organization_id: str, account_id: str, reason: str, error: type[CoreRefusalError], **details: object
) -> CoreRefusalError:
    """Write the refusal as an event and answer the refusal to raise."""
    await box.warning(
        Channel.business,
        "A private plugin refused in {%var.organization_id}: {%var.reason}",
        PrivatePluginRefusedEvent(organization_id=organization_id, account_id=account_id, reason=reason),
    )
    return error(reason, **details)


async def add_waiting(
    store: PluginsStorage,
    owner_id: str | None,
    author: str | None,
    *,
    title: str,
    version: str,
    purl: str,
    sha256: str,
    operation: str,
) -> str:
    """A waiting plugin — the organization's, or public with no owner — and its draft version; answer the version's id."""
    plugin_id, version_id = str(uuid.uuid4()), str(uuid.uuid4())

    async def work() -> None:
        changed = await store.plugin_lock(plugin_id)
        await store.insert(
            "plugin",
            {
                "id": plugin_id,
                "passport_id": f"pending.{version_id}",
                "name": "pending_" + version_id.replace("-", "")[:24],
                "title": title[:200],
                "description": "",
                "owner_organization_id": owner_id,
                "state": "listed",
                "created_at": changed,
                "updated_at": None,
            },
            changed,
            author,
            operation,
        )
        await store.insert(
            "plugin_version",
            {
                "id": version_id,
                "plugin_id": plugin_id,
                "version": version,
                "purl": purl,
                "sha256": sha256,
                "core_range": None,
                "state": "draft",
                "reason": None,
                "schema_name": None,
                "database_user": None,
                "deployed_at": None,
                "checked_at": None,
                "created_at": changed,
                "updated_at": None,
            },
            changed,
            author,
            operation,
        )

    await store.in_transaction(work)
    return version_id


async def added(box: ToolsBox, organization_id: str, account_id: str, version_id: str, purl: str, sha256: str, *, uploaded: bool) -> None:
    """Write that a private plugin was added."""
    await box.info(
        Channel.business,
        "A private plugin {%var.purl} added in {%var.organization_id}, waiting for its check",
        PrivatePluginAddedEvent(
            organization_id=organization_id,
            account_id=account_id,
            version_id=version_id,
            purl=purl,
            sha256=sha256,
            uploaded=uploaded,
        ),
    )
