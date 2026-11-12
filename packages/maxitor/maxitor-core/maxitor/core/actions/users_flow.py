# packages/maxitor/maxitor-core/maxitor/core/actions/users_flow.py
"""
The steps the actions on users share: a user as the contracts answer it, and the rule of the last active
administrator, decided inside the transaction that holds the organization's lock.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from maxitor.core.actions.invitations_flow import PersonSchema, person
from maxitor.core.errors import ConflictError
from maxitor.core.events import AdministratorChangedEvent, LastAdministratorKeptEvent, UserStateChangedEvent
from maxitor.core.storage.core_storage import CoreStorage
from pydantic import Field

from aoa.action_machine.logging import Channel
from aoa.action_machine.model.base_schema import BaseSchema
from aoa.action_machine.runtime.tools_box import ToolsBox

#: The events the steps of this module may write; a method that uses them declares these.
USER_FLOW_EVENTS = (UserStateChangedEvent, AdministratorChangedEvent, LastAdministratorKeptEvent)


class UserSchema(BaseSchema):
    """A user of the organization as Settings → Users shows them (contracts/actions.md)."""

    id: str = Field(description="The user")
    account_id: str = Field(description="The account behind the user")
    name: str = Field(description="The user's name in the organization")
    email: str = Field(description="The account's email")
    is_admin: bool = Field(description="Whether the user administers the organization")
    state: str = Field(description="active, blocked or removed")
    appeared: str = Field(description="registered — the organization's first administrator — or invited")
    invited_by: PersonSchema | None = Field(description="The user who invited them; empty for the first administrator")
    created_at: datetime = Field(description="When the user was created")
    changed_at: datetime = Field(description="When the user last changed; the creation when never")
    changed_by: PersonSchema | None = Field(description="The user who changed them last, when known")
    last_sign_in_at: datetime | None = Field(description="When the account last signed in; empty if never")


def user_schema(row: dict[str, Any]) -> UserSchema:
    """One user's row as the contracts answer it."""
    return UserSchema(
        id=str(row["id"]),
        account_id=str(row["account_id"]),
        name=str(row["name"]),
        email=str(row["email"]),
        is_admin=bool(row["is_admin"]),
        state=str(row["status"]),
        appeared="invited" if row.get("invited_by") else "registered",
        invited_by=person(row, "invited_by"),
        created_at=row["created_at"],
        changed_at=row["updated_at"] or row["created_at"],
        changed_by=person(row, "changed_by"),
        last_sign_in_at=row.get("last_sign_in_at"),
    )


async def keep_last_administrator(
    box: ToolsBox, store: CoreStorage, organization_id: str, target: dict[str, Any], by_user_id: str
) -> None:
    """
    Refuse a change that would leave the organization without an active administrator.

    Runs inside a transaction that holds the organization's lock, so two administrators acting at once are counted
    one after the other and exactly one of two simultaneous step-downs is refused.
    """
    if not (target["is_admin"] and target["status"] == "active"):
        return
    if await store.active_administrators(organization_id) > 1:
        return
    await box.warning(
        Channel.business,
        "The last administrator {%var.user_id} of {%var.organization_id} kept",
        LastAdministratorKeptEvent(organization_id=organization_id, user_id=str(target["id"]), by_user_id=by_user_id),
    )
    raise ConflictError("last_administrator")
