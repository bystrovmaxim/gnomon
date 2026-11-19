# packages/maxitor/maxitor-core/maxitor/core/actions/invitation_choice.py
"""
The invited person's side: ListAccountInvitationsAction, AcceptInvitationAction, DeclineInvitationAction.

::

    GET  /api/v1/invitations                    the invitations still sent to the account's confirmed emails
    POST /api/v1/invitations/accept             {invitation_id}: a new active user of the account in the organization
    POST /api/v1/invitations/decline            {invitation_id}

An invitation is seen, accepted or declined only by an account whose confirmed emails — its own and those of its
ways in, in lower case — include the invitation's; anyone else is refused as for an invitation that does not exist.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from maxitor.core.actions.common import now, storage, tokens
from maxitor.core.actions.invitations_flow import INVITATION_FLOW_EVENTS, expire_due, state_of
from maxitor.core.domains import OrganizationDomain
from maxitor.core.errors import ConflictError, NotAllowedError, SignInRefusedError
from maxitor.core.events import InvitationAcceptedEvent, InvitationDeclinedEvent
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
from aoa.action_machine.model.base_schema import BaseSchema
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class NoParams(BaseParams):
    """Nothing: the account comes from the session."""


class ChoiceParams(BaseParams):
    """One invitation, from the address."""

    invitation_id: str = Field(min_length=1, max_length=64, description="The invitation")


class OrganizationNameSchema(BaseSchema):
    """The organization that invites."""

    code: str = Field(description="The address code")
    name: str = Field(description="The organization's name")


class WaitingInvitationSchema(BaseSchema):
    """An invitation as the invited person sees it."""

    id: str = Field(description="The invitation")
    organization: OrganizationNameSchema = Field(description="The organization that invites")
    invited_by_name: str = Field(description="Who invites")
    is_admin: bool = Field(description="Whether accepting makes an administrator")
    sent_at: datetime = Field(description="When it was sent")
    expires_at: datetime = Field(description="Until when it waits")


class WaitingResult(BaseResult):
    """The invitations waiting for the account."""

    invitations: list[WaitingInvitationSchema] = Field(description="Oldest first")


class AcceptedResult(BaseResult):
    """The organization the account is now a user of."""

    code: str = Field(description="The address code; the organization opens at /w/<code>")


class DeclinedResult(BaseResult):
    """The invitation declined."""

    declined: bool = Field(description="Always true")


async def waiting_for(store: CoreStorage, account_id: str, at: datetime) -> list[dict[str, Any]]:
    """The invitations still sent to the account's confirmed emails and not past their time."""
    emails = await store.confirmed_emails(account_id)
    if not emails:
        return []
    return [row for row in await store.invitations_for_emails(emails) if state_of(row, at) == "sent"]


@meta(description="List the invitations waiting for the signed-in account", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class ListAccountInvitationsAction(BaseAction[NoParams, WaitingResult]):
    """
    AI-CORE-BEGIN
    ROLE: What the screen of choosing an organization shows above the organizations.
    CONTRACT: Only invitations whose email is one of the account's confirmed emails, still sent and in time.
    AI-CORE-END
    """

    @summary_aspect("Read the invitations to the account's confirmed emails")
    @context_requires(Ctx.User.user_id)
    async def waiting_summary(
        self, params: NoParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> WaitingResult:
        """Oldest first."""
        _ = (params, state, box)
        rows = await waiting_for(storage(connections), str(ctx.get(Ctx.User.user_id)), now())
        return WaitingResult(
            invitations=[
                WaitingInvitationSchema(
                    id=str(row["id"]),
                    organization=OrganizationNameSchema(code=row["organization_code"], name=row["organization_name"]),
                    invited_by_name=str(row["invited_by_name"]),
                    is_admin=bool(row["is_admin"]),
                    sent_at=row["sent_at"],
                    expires_at=row["expires_at"],
                )
                for row in rows
            ]
        )


async def own_invitation_verdict(connections: Connections, invitation_id: str, account_id: str) -> Verdict:
    """``Allowed`` when the invitation is sent, in time and to one of the account's confirmed emails."""
    store = storage(connections)
    row = await store.invitation(invitation_id)
    if row is None or state_of(row, now()) != "sent":
        return FORBIDDEN_OBJECT
    return Allowed() if row["email"] in await store.confirmed_emails(account_id) else FORBIDDEN_OBJECT


@meta(description="Accept an invitation: the account's active user in the organization", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The current policy version")
class AcceptInvitationAction(BaseAction[ChoiceParams, AcceptedResult]):
    """
    AI-CORE-BEGIN
    ROLE: The invited person comes in.
    CONTRACT: Refuses an invitation the account's emails do not match or that is not sent (404), an account that
        has not accepted the current privacy policy (403 ``policy``) and one that already has a user in the
        organization (409 ``already_user``); otherwise, under the organization's lock, creates the user — an
        administrator when the invitation says so, named as the account — and marks the invitation accepted.
    INVARIANTS: An organization and an account give at most one user; the unique key decides two accepts at once.
    AI-CORE-END
    """

    @access_decide("Let through only the account whose confirmed email the invitation names, while it is sent")
    @context_requires(Ctx.User.user_id)
    async def own_access_decide(
        self, params: ChoiceParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """The invitation's email among the account's confirmed emails."""
        _ = box
        return await own_invitation_verdict(connections, params.invitation_id, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Check the policy, then create the user and mark the invitation accepted under the lock")
    @context_requires(Ctx.User.user_id)
    @emits(InvitationAcceptedEvent, *INVITATION_FLOW_EVENTS)
    async def accept_summary(
        self, params: ChoiceParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> AcceptedResult:
        """One change: the user, the invitation, their versions."""
        _ = state
        store, keys, account_id, at = storage(connections), tokens(connections), str(ctx.get(Ctx.User.user_id)), now()
        account = await store.account(account_id)
        if account is None:
            raise SignInRefusedError("expired")
        if account["policy_version"] < keys.policy_version:
            raise NotAllowedError("policy")
        row = await store.invitation(params.invitation_id)
        if row is None or row["email"] not in await store.confirmed_emails(account_id):
            raise AccessDenied(FORBIDDEN_OBJECT)
        organization_id, operation = row["organization_id"], type(self).__name__

        async def work() -> tuple[dict[str, Any], str]:
            changed_at = await store.organization_lock(organization_id)
            fresh = await store.invitation(params.invitation_id)
            if fresh is None:
                raise AccessDenied(FORBIDDEN_OBJECT)
            await expire_due(box, store, organization_id, at, changed_at, operation)
            if state_of(fresh, at) != "sent":
                raise AccessDenied(FORBIDDEN_OBJECT)
            if await store.user_of_account(organization_id, account_id) is not None:
                raise ConflictError("already_user")
            user_id = str(uuid.uuid4())
            try:
                await store.insert(
                    '"user"',
                    {
                        "organization_id": organization_id,
                        "id": user_id,
                        "account_id": account_id,
                        "name": account["name"],
                        "is_admin": bool(fresh["is_admin"]),
                        "job_title": fresh.get("job_title"),
                        "status": "active",
                        "created_at": changed_at,
                        "updated_at": None,
                    },
                    changed_at,
                    account_id,
                    operation,
                )
            except UniqueRowError as error:
                if error.constraint != "user_once_per_account":
                    raise
                raise ConflictError("already_user") from None
            await store.update(
                "invitation",
                {"organization_id": organization_id, "id": fresh["id"]},
                {"status": "accepted", "decided_at": changed_at, "accepted_user_id": user_id, "updated_at": changed_at},
                changed_at,
                account_id,
                operation,
            )
            return fresh, user_id

        accepted, user_id = await store.in_transaction(work)
        await box.info(
            Channel.business,
            "Invitation {%var.invitation_id} accepted by {%var.account_id}",
            InvitationAcceptedEvent(
                organization_id=organization_id,
                invitation_id=accepted["id"],
                account_id=account_id,
                user_id=user_id,
                is_admin=bool(accepted["is_admin"]),
            ),
        )
        return AcceptedResult(code=accepted["organization_code"])


@meta(description="Decline an invitation", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class DeclineInvitationAction(BaseAction[ChoiceParams, DeclinedResult]):
    """
    AI-CORE-BEGIN
    ROLE: The invited person says no.
    CONTRACT: The same refusal as accepting for an invitation that is not theirs or not sent; otherwise the
        invitation is declined under the organization's lock, and the account has no user there.
    AI-CORE-END
    """

    @access_decide("Let through only the account whose confirmed email the invitation names, while it is sent")
    @context_requires(Ctx.User.user_id)
    async def own_access_decide(
        self, params: ChoiceParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """The invitation's email among the account's confirmed emails."""
        _ = box
        return await own_invitation_verdict(connections, params.invitation_id, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Mark the invitation declined under the lock")
    @context_requires(Ctx.User.user_id)
    @emits(InvitationDeclinedEvent, *INVITATION_FLOW_EVENTS)
    async def decline_summary(
        self, params: ChoiceParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> DeclinedResult:
        """One change of the invitation."""
        _ = state
        store, account_id, at = storage(connections), str(ctx.get(Ctx.User.user_id)), now()
        row = await store.invitation(params.invitation_id)
        if row is None or row["email"] not in await store.confirmed_emails(account_id):
            raise AccessDenied(FORBIDDEN_OBJECT)
        organization_id, operation = row["organization_id"], type(self).__name__

        async def work() -> None:
            changed_at = await store.organization_lock(organization_id)
            fresh = await store.invitation(params.invitation_id)
            if fresh is None:
                raise AccessDenied(FORBIDDEN_OBJECT)
            await expire_due(box, store, organization_id, at, changed_at, operation)
            if state_of(fresh, at) != "sent":
                raise AccessDenied(FORBIDDEN_OBJECT)
            await store.update(
                "invitation",
                {"organization_id": organization_id, "id": fresh["id"]},
                {"status": "declined", "decided_at": changed_at, "updated_at": changed_at},
                changed_at,
                account_id,
                operation,
            )

        await store.in_transaction(work)
        await box.info(
            Channel.business,
            "Invitation {%var.invitation_id} declined by {%var.account_id}",
            InvitationDeclinedEvent(organization_id=organization_id, invitation_id=row["id"], account_id=account_id),
        )
        return DeclinedResult(declined=True)
