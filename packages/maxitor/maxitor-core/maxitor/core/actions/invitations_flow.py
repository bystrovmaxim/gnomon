# packages/maxitor/maxitor-core/maxitor/core/actions/invitations_flow.py
"""
The steps the actions on invitations share: the limits, the letter, the state an invitation is answered in, and the
expiry written when an invitation past its time is next touched.

Each step writes its events through the calling method's box, which declares them in its ``@emits``.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from maxitor.core.codes import (
    INVITATION_DAY,
    INVITATION_LETTERS_PER_ADDRESS_HOUR,
    INVITATION_LETTERS_PER_ADDRESS_MINUTE,
    INVITATIONS_PER_INVITER_HOUR,
    INVITATIONS_PER_ORGANIZATION_DAY,
    KEPT_FOR_COUNTING,
    mask,
)
from maxitor.core.errors import LimitReachedError, MailNotSentError
from maxitor.core.events import InvitationExpiredEvent, InvitationLimitReachedEvent, LetterNotSentEvent
from maxitor.core.gateways.mail import MailGateway, MailNotDeliveredError
from maxitor.core.storage.core_storage import CoreStorage
from pydantic import Field

from aoa.action_machine.logging import Channel
from aoa.action_machine.model.base_schema import BaseSchema
from aoa.action_machine.runtime.tools_box import ToolsBox

#: The events the steps of this module may write; a method that uses them declares these.
INVITATION_FLOW_EVENTS = (InvitationExpiredEvent, InvitationLimitReachedEvent, LetterNotSentEvent)


class PersonSchema(BaseSchema):
    """A user named in an answer."""

    id: str = Field(description="The user")
    name: str = Field(description="The user's name in the organization")


class InvitationSchema(BaseSchema):
    """An invitation as the organization keeps it (contracts/actions.md)."""

    id: str = Field(description="The invitation")
    email: str = Field(description="The email it was sent to")
    is_admin: bool = Field(description="Whether accepting makes an administrator")
    state: str = Field(description="sent, accepted, declined, withdrawn or expired")
    invited_by: PersonSchema = Field(description="The user who sent it")
    sent_at: datetime = Field(description="When its first letter was sent")
    letter_sent_at: datetime = Field(description="When its last letter was sent")
    expires_at: datetime = Field(description="When it expires")
    decided_at: datetime | None = Field(description="When it left the state sent; empty while sent")
    decided_by: PersonSchema | None = Field(description="The administrator who withdrew it or switched the setting")
    by_setting: bool = Field(description="Whether the setting Who may invite withdrew it")
    accepted_user: PersonSchema | None = Field(description="The user accepting it made")


def person(row: dict[str, Any], prefix: str) -> PersonSchema | None:
    """The person ``prefix`` names in a row: its id and name columns, or ``None``."""
    user_id = row.get(prefix)
    return None if not user_id else PersonSchema(id=str(user_id), name=str(row.get(f"{prefix}_name") or ""))


def state_of(row: dict[str, Any], at: datetime) -> str:
    """The state an invitation is answered in: a sent one past its time is expired."""
    if row["status"] == "sent" and row["expires_at"] <= at:
        return "expired"
    return str(row["status"])


def invitation_schema(row: dict[str, Any], at: datetime) -> InvitationSchema:
    """One invitation's row as the contracts answer it."""
    expired = row["status"] == "sent" and row["expires_at"] <= at
    return InvitationSchema(
        id=str(row["id"]),
        email=str(row["email"]),
        is_admin=bool(row["is_admin"]),
        state=state_of(row, at),
        invited_by=PersonSchema(id=str(row["invited_by"]), name=str(row["invited_by_name"])),
        sent_at=row["sent_at"],
        letter_sent_at=row["letter_sent_at"],
        expires_at=row["expires_at"],
        decided_at=row["expires_at"] if expired else row["decided_at"],
        decided_by=person(row, "decided_by"),
        by_setting=bool(row["by_setting"]),
        accepted_user=(
            PersonSchema(id=str(row["accepted_user_id"]), name=str(row.get("accepted_user_name") or ""))
            if row.get("accepted_user_id")
            else None
        ),
    )


async def expire_due(
    box: ToolsBox, store: CoreStorage, organization_id: str, at: datetime, changed_at: datetime, operation: str
) -> list[str]:
    """
    Write the state expired on every invitation of the organization still sent past its time; answer their ids.

    Runs inside a transaction that holds the organization's lock.
    """
    expired: list[str] = []
    for row in await store.invitations_of_organization(organization_id):
        if row["status"] != "sent" or row["expires_at"] > at:
            continue
        await store.update(
            "invitation",
            {"organization_id": organization_id, "id": row["id"]},
            {"status": "expired", "decided_at": row["expires_at"], "updated_at": changed_at},
            changed_at,
            None,
            operation,
        )
        await box.info(
            Channel.business,
            "Invitation {%var.invitation_id} expired",
            InvitationExpiredEvent(organization_id=organization_id, invitation_id=str(row["id"])),
        )
        expired.append(str(row["id"]))
    return expired


async def check_invitation_limits(
    box: ToolsBox,
    store: CoreStorage,
    *,
    organization_id: str,
    user_id: str,
    email: str,
    at: datetime,
    new_invitation: bool,
) -> None:
    """
    Refuse past a limit: one letter a minute and ten an hour to one address; for a new invitation also thirty an
    hour per inviter and a hundred a day per organization.
    """
    await store.prune_letters(at - KEPT_FOR_COUNTING)
    minute, hour = await store.letter_counts(email, at - timedelta(minutes=1), at - KEPT_FOR_COUNTING)
    reached = [
        (minute >= INVITATION_LETTERS_PER_ADDRESS_MINUTE, "address per minute", at + timedelta(minutes=1)),
        (hour >= INVITATION_LETTERS_PER_ADDRESS_HOUR, "address per hour", at + KEPT_FOR_COUNTING),
    ]
    if new_invitation:
        inviter_hour, organization_day = await store.invitation_counts(
            organization_id, user_id, at - KEPT_FOR_COUNTING, at - INVITATION_DAY
        )
        reached += [
            (inviter_hour >= INVITATIONS_PER_INVITER_HOUR, "inviter per hour", at + KEPT_FOR_COUNTING),
            (organization_day >= INVITATIONS_PER_ORGANIZATION_DAY, "organization per day", at + INVITATION_DAY),
        ]
    for over, limit, until in reached:
        if not over:
            continue
        await box.warning(
            Channel.security,
            "Invitations limit {%var.limit} for {%var.email_masked}",
            InvitationLimitReachedEvent(
                organization_id=organization_id, user_id=user_id, email_masked=mask(email), limit=limit
            ),
        )
        raise LimitReachedError("too_many_invitations", limit=limit, until=until)


async def send_letter(
    box: ToolsBox,
    mail: MailGateway,
    store: CoreStorage,
    *,
    organization_id: str,
    organization_name: str,
    invitation_id: str,
    email: str,
    inviter_name: str,
    inviter_email: str,
    is_admin: bool,
    expires_at: datetime,
    at: datetime,
) -> None:
    """Hand the letter to the mail and record it for the limits; a letter that does not go is a refusal (503)."""
    try:
        await mail.send_invitation(email, organization_name, inviter_name, inviter_email, is_admin, expires_at)
    except MailNotDeliveredError as error:
        await box.critical(
            Channel.security,
            "Letter to {%var.email_masked} not sent",
            LetterNotSentEvent(email_masked=mask(email), reason=error.reason),
        )
        raise MailNotSentError("mail_not_sent") from None
    await store.new_letter(
        {
            "id": str(uuid.uuid4()),
            "organization_id": organization_id,
            "invitation_id": invitation_id,
            "email": email,
            "sent_at": at,
        }
    )
