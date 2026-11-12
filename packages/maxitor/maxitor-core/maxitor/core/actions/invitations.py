# packages/maxitor/maxitor-core/maxitor/core/actions/invitations.py
"""
An organization's invitations: SendInvitationAction, ResendInvitationAction, WithdrawInvitationAction,
ListMyInvitationsAction.

::

    POST /api/v1/organizations/invitations            {code, email, is_admin} → the invitation
    POST /api/v1/organizations/invitations/resend     {code, invitation_id}: the letter again, by the inviter or an administrator
    POST /api/v1/organizations/invitations/withdraw   {code, invitation_id}: by an administrator
    GET  /api/v1/organizations/{code}/invitations/mine                       the ones the user sent

Every address admits an active user of the organization and refuses anyone else as an organization that does not
exist. The checks of an invitation run under the organization's lock: the setting and the mark as they are at that
moment, the user already there, the invitation still sent, the limits; the letter goes before the row is written, so
a letter that does not go leaves nothing behind.
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from maxitor.core.actions.common import mail, normal_email, now, storage, tokens
from maxitor.core.actions.invitations_flow import (
    INVITATION_FLOW_EVENTS,
    InvitationSchema,
    check_invitation_limits,
    expire_due,
    invitation_schema,
    send_letter,
    state_of,
)
from maxitor.core.codes import mask
from maxitor.core.domains import OrganizationDomain
from maxitor.core.errors import ConflictError, NotAllowedError
from maxitor.core.events import (
    InvitationLetterSentAgainEvent,
    InvitationRefusedEvent,
    InvitationSentEvent,
    InvitationWithdrawnEvent,
)
from maxitor.core.gateways.mail import MAIL_CONNECTION_KEY, MailGateway
from maxitor.core.roles import AccountRole
from maxitor.core.storage.core_storage import CORE_CONNECTION_KEY, CoreStorage, UniqueRowError
from maxitor.core.tokens import TOKENS_CONNECTION_KEY, SessionTokensController
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
from aoa.action_machine.intents.emits import emits
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging import Channel
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class OrganizationParams(BaseParams):
    """The organization's address code, from the address."""

    code: str = Field(min_length=1, max_length=200, description="The address code")


class SendParams(OrganizationParams):
    """The invitation form."""

    email: str = Field(min_length=3, max_length=254, description="The email to invite")
    is_admin: bool = Field(default=False, description="Whether accepting makes an administrator; administrators only")


class InvitationParams(OrganizationParams):
    """One invitation of the organization, from the address."""

    invitation_id: str = Field(min_length=1, max_length=64, description="The invitation")


class InvitationResult(BaseResult):
    """The invitation as it is now."""

    invitation: InvitationSchema = Field(description="The invitation")


class InvitationsResult(BaseResult):
    """Invitations, newest first."""

    invitations: list[InvitationSchema] = Field(description="The invitations")


async def member_verdict(connections: Connections, code: str, account_id: str) -> Verdict:
    """``Allowed`` for an active user of the organization; the same refusal as for a made-up address otherwise."""
    return Allowed() if await storage(connections).organization_for(code, account_id) is not None else FORBIDDEN_OBJECT


async def member(connections: Connections, code: str, account_id: str) -> dict[str, Any]:
    """The organization and the account's active user in it, read again in the main step."""
    found = await storage(connections).organization_for(code, account_id)
    if found is None:
        raise AccessDenied(FORBIDDEN_OBJECT)
    return found


@meta(description="Invite an email into the organization: the setting, the mark, the limits, then the letter", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(MailGateway, key=MAIL_CONNECTION_KEY, description="The mail")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The invitation's days")
class SendInvitationAction(BaseAction[SendParams, InvitationResult]):
    """
    AI-CORE-BEGIN
    ROLE: Create an invitation and send its letter.
    CONTRACT: Refuses by the setting (403 ``administrators_only``), by the mark from an ordinary user (403
        ``administrator_mark``), for an email that is an active or blocked user's (409 ``already_user``) or has an
        invitation still sent (409 ``already_invited``), past a limit (429 ``too_many_invitations``) and when the
        letter does not go (503); otherwise the invitation is sent and its letter handed to the mail.
    INVARIANTS: The checks run under the organization's lock, as the setting and the users are at that moment; the
        database's one-sent-per-email rule decides a race.
    AI-CORE-END
    """

    @access_decide("Let through only an active user of the organization, alike for a code that does not exist")
    @context_requires(Ctx.User.user_id)
    async def member_access_decide(
        self, params: SendParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """An active user of the account in the organization of the address."""
        _ = box
        return await member_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Check the setting, the mark, the person and the limits, send the letter, write the invitation")
    @context_requires(Ctx.User.user_id)
    @emits(InvitationSentEvent, InvitationRefusedEvent, *INVITATION_FLOW_EVENTS)
    async def send_summary(
        self, params: SendParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> InvitationResult:
        """One change: the invitation and its version, after the letter went."""
        _ = state
        store, letters, keys, account_id, at = storage(connections), mail(connections), tokens(connections), str(ctx.get(Ctx.User.user_id)), now()
        found = await member(connections, params.code, account_id)
        organization_id, user_id, email = found["id"], found["user_id"], normal_email(params.email)
        invitation_id, operation = str(uuid.uuid4()), type(self).__name__

        async def refused(reason: str) -> None:
            await box.warning(
                Channel.security,
                "Invitation to {%var.email_masked} refused: {%var.reason}",
                InvitationRefusedEvent(organization_id=organization_id, user_id=user_id, email_masked=mask(email), reason=reason),
            )

        async def work() -> None:
            changed_at = await store.organization_lock(organization_id)
            organization, inviter = await store.organization(organization_id), await store.user(organization_id, user_id)
            if organization is None or inviter is None or inviter["status"] != "active":
                raise AccessDenied(FORBIDDEN_OBJECT)
            if organization["who_may_invite"] == "administrators" and not inviter["is_admin"]:
                await refused("administrators_only")
                raise NotAllowedError("administrators_only")
            if params.is_admin and not inviter["is_admin"]:
                await refused("administrator_mark")
                raise NotAllowedError("administrator_mark")
            await expire_due(box, store, organization_id, at, changed_at, operation)
            already = await store.user_by_email(organization_id, email)
            if already is not None:
                await refused("already_user")
                raise ConflictError("already_user", name=already["name"], state=already["status"], user_id=already["id"])
            pending = await store.sent_invitation(organization_id, email)
            if pending is not None:
                await refused("already_invited")
                raise ConflictError("already_invited", invitation_id=pending["id"])
            await check_invitation_limits(
                box, store, organization_id=organization_id, user_id=user_id, email=email, at=at, new_invitation=True
            )
            expires_at = changed_at + timedelta(days=keys.invitation_days)
            await send_letter(
                box,
                letters,
                store,
                organization_id=organization_id,
                organization_name=organization["name"],
                invitation_id=invitation_id,
                email=email,
                inviter_name=inviter["name"],
                inviter_email=inviter["email"],
                is_admin=params.is_admin,
                expires_at=expires_at,
                at=changed_at,
            )
            try:
                await store.insert(
                    "invitation",
                    {
                        "organization_id": organization_id,
                        "id": invitation_id,
                        "email": email,
                        "invited_by": user_id,
                        "is_admin": params.is_admin,
                        "status": "sent",
                        "sent_at": changed_at,
                        "letter_sent_at": changed_at,
                        "expires_at": expires_at,
                        "decided_at": None,
                        "decided_by": None,
                        "by_setting": False,
                        "accepted_user_id": None,
                        "created_at": changed_at,
                        "updated_at": None,
                    },
                    changed_at,
                    account_id,
                    operation,
                )
            except UniqueRowError as error:
                if error.constraint != "invitation_one_sent":
                    raise
                await refused("already_invited")
                raise ConflictError("already_invited", moment=True) from None

        await store.in_transaction(work)
        await box.info(
            Channel.business,
            "Invitation {%var.invitation_id} sent to {%var.email_masked}",
            InvitationSentEvent(
                organization_id=organization_id,
                invitation_id=invitation_id,
                user_id=user_id,
                email_masked=mask(email),
                is_admin=params.is_admin,
            ),
        )
        row = await store.invitation(invitation_id)
        assert row is not None
        return InvitationResult(invitation=invitation_schema(row, at))


@meta(description="Send the letter of an invitation still sent again", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(MailGateway, key=MAIL_CONNECTION_KEY, description="The mail")
class ResendInvitationAction(BaseAction[InvitationParams, InvitationResult]):
    """
    AI-CORE-BEGIN
    ROLE: The same letter to the same address, while the invitation is sent.
    CONTRACT: For the inviter or an administrator; an invitation not sent — accepted, declined, withdrawn or past
        its time — is refused (409 ``not_sent``); the address's limits of letters hold (429).
    AI-CORE-END
    """

    @access_decide("Let through only an active user of the organization, alike for a code that does not exist")
    @context_requires(Ctx.User.user_id)
    async def member_access_decide(
        self, params: InvitationParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """An active user of the account in the organization of the address."""
        _ = box
        return await member_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Check the invitation and the limits, send the letter again")
    @context_requires(Ctx.User.user_id)
    @emits(InvitationLetterSentAgainEvent, *INVITATION_FLOW_EVENTS)
    async def resend_summary(
        self, params: InvitationParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> InvitationResult:
        """The letter goes, then the invitation's last letter time moves."""
        _ = state
        store, letters, account_id, at = storage(connections), mail(connections), str(ctx.get(Ctx.User.user_id)), now()
        found = await member(connections, params.code, account_id)
        organization_id, user_id, operation = found["id"], found["user_id"], type(self).__name__

        async def work() -> dict[str, Any]:
            changed_at = await store.organization_lock(organization_id)
            row = await store.invitation(params.invitation_id)
            if row is None or row["organization_id"] != organization_id:
                raise AccessDenied(FORBIDDEN_OBJECT)
            if row["invited_by"] != user_id and not found["is_admin"]:
                raise AccessDenied(FORBIDDEN_OBJECT)
            await expire_due(box, store, organization_id, at, changed_at, operation)
            if state_of(row, at) != "sent":
                raise ConflictError("not_sent", state=state_of(row, at))
            await check_invitation_limits(
                box, store, organization_id=organization_id, user_id=user_id, email=row["email"], at=at, new_invitation=False
            )
            inviter = await store.user(organization_id, row["invited_by"])
            await send_letter(
                box,
                letters,
                store,
                organization_id=organization_id,
                organization_name=row["organization_name"],
                invitation_id=row["id"],
                email=row["email"],
                inviter_name=row["invited_by_name"],
                inviter_email=str(inviter["email"]) if inviter else "",
                is_admin=bool(row["is_admin"]),
                expires_at=row["expires_at"],
                at=changed_at,
            )
            await store.update(
                "invitation",
                {"organization_id": organization_id, "id": row["id"]},
                {"letter_sent_at": changed_at, "updated_at": changed_at},
                changed_at,
                account_id,
                operation,
            )
            return row

        row = await store.in_transaction(work)
        await box.info(
            Channel.business,
            "Invitation {%var.invitation_id} letter sent again to {%var.email_masked}",
            InvitationLetterSentAgainEvent(
                organization_id=organization_id, invitation_id=row["id"], user_id=user_id, email_masked=mask(row["email"])
            ),
        )
        fresh = await store.invitation(row["id"])
        assert fresh is not None
        return InvitationResult(invitation=invitation_schema(fresh, at))


@meta(description="Withdraw an invitation still sent", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class WithdrawInvitationAction(BaseAction[InvitationParams, InvitationResult]):
    """
    AI-CORE-BEGIN
    ROLE: An administrator takes an invitation back.
    CONTRACT: Only an administrator; an invitation not sent is refused (409 ``not_sent``); otherwise it is
        withdrawn with who and when, under the organization's lock.
    AI-CORE-END
    """

    @access_decide("Let through only an active administrator of the organization, alike for a code that does not exist")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(
        self, params: InvitationParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """An active administrator of the account in the organization of the address."""
        _ = box
        found = await storage(connections).organization_for(params.code, str(ctx.get(Ctx.User.user_id)))
        return Allowed() if found is not None and found["is_admin"] else FORBIDDEN_OBJECT

    @summary_aspect("Withdraw the invitation under the organization's lock")
    @context_requires(Ctx.User.user_id)
    @emits(InvitationWithdrawnEvent, *INVITATION_FLOW_EVENTS)
    async def withdraw_summary(
        self, params: InvitationParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> InvitationResult:
        """One change of the invitation."""
        _ = state
        store, account_id, at = storage(connections), str(ctx.get(Ctx.User.user_id)), now()
        found = await member(connections, params.code, account_id)
        if not found["is_admin"]:
            raise AccessDenied(FORBIDDEN_OBJECT)
        organization_id, user_id, operation = found["id"], found["user_id"], type(self).__name__

        async def work() -> dict[str, Any]:
            changed_at = await store.organization_lock(organization_id)
            row = await store.invitation(params.invitation_id)
            if row is None or row["organization_id"] != organization_id:
                raise AccessDenied(FORBIDDEN_OBJECT)
            await expire_due(box, store, organization_id, at, changed_at, operation)
            if state_of(row, at) != "sent":
                raise ConflictError("not_sent", state=state_of(row, at))
            await store.update(
                "invitation",
                {"organization_id": organization_id, "id": row["id"]},
                {"status": "withdrawn", "decided_at": changed_at, "decided_by": user_id, "updated_at": changed_at},
                changed_at,
                account_id,
                operation,
            )
            return row

        row = await store.in_transaction(work)
        await box.info(
            Channel.business,
            "Invitation {%var.invitation_id} withdrawn by {%var.user_id}",
            InvitationWithdrawnEvent(organization_id=organization_id, invitation_id=row["id"], user_id=user_id, by_setting=False),
        )
        fresh = await store.invitation(row["id"])
        assert fresh is not None
        return InvitationResult(invitation=invitation_schema(fresh, at))


@meta(description="List the invitations the user sent", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class ListMyInvitationsAction(BaseAction[OrganizationParams, InvitationsResult]):
    """
    AI-CORE-BEGIN
    ROLE: What an ordinary user sees under the invitation form: their own invitations and their states.
    AI-CORE-END
    """

    @access_decide("Let through only an active user of the organization, alike for a code that does not exist")
    @context_requires(Ctx.User.user_id)
    async def member_access_decide(
        self, params: OrganizationParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """An active user of the account in the organization of the address."""
        _ = box
        return await member_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Read the invitations the user sent")
    @context_requires(Ctx.User.user_id)
    async def mine_summary(
        self, params: OrganizationParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> InvitationsResult:
        """Newest first; a sent one past its time is answered expired."""
        _ = (state, box)
        at = now()
        found = await member(connections, params.code, str(ctx.get(Ctx.User.user_id)))
        rows = await storage(connections).invitations_by(found["id"], found["user_id"])
        return InvitationsResult(invitations=[invitation_schema(row, at) for row in rows])
