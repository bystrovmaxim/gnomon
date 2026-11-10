# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/change_plugin_state.py
"""What retrying, dropping, disabling and enabling share: find the organization's row, move it to another state."""

from __future__ import annotations

from typing import Any

from maxitor.core.errors import ConflictError, OrganizationNotFoundError
from maxitor.core.plugins.actions.administrator import plugins

from aoa.action_machine.resources import Connections


async def live_row(connections: Connections, organization_id: str, passport_id: str, expected: str) -> dict[str, Any]:
    """The organization's row of ``passport_id``; 404 when there is none, 409 ``not_<expected>`` in another state."""
    found = await plugins(connections).plugin_for(organization_id, passport_id)
    if found is None or found["row_id"] is None:
        raise OrganizationNotFoundError("not_found")
    if found["row_state"] != expected:
        raise ConflictError(f"not_{expected}", state=found["row_state"])
    return found


async def move(
    connections: Connections, organization_id: str, row_id: str, state: str, author: str, operation: str
) -> None:
    """Move the row to ``state`` in one change under the organization's lock."""
    store = plugins(connections)

    async def work() -> None:
        changed = await store.organization_lock(organization_id)
        await store.update(
            "organization_plugin",
            {"organization_id": organization_id, "id": row_id},
            {"state": state, "reason": None, "updated_at": changed},
            changed,
            author,
            operation,
        )

    await store.in_transaction(work)
