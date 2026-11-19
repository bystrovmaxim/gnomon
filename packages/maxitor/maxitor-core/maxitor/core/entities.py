# packages/maxitor/maxitor-core/maxitor/core/entities.py
"""
The core's entities, one table each in the schema of its domain (specs/072-maxitor-core/data-model.md).

All entities live in one module because ``Inverse`` names the partner class.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from maxitor.core.domains import OrganizationDomain, PlatformDomain
from pydantic import Field

from aoa.action_machine.domain import (
    AssociationMany,
    AssociationOne,
    BaseCoreEntity,
    BaseEnumEntity,
    BaseStateEntity,
    CompositeMany,
    Inverse,
    Lifecycle,
    NoInverse,
    value,
)
from aoa.action_machine.intents.entity import entity

# ════════════════════════════════════════════════════════════════════════════
# Entities of the domain platform
# ════════════════════════════════════════════════════════════════════════════


@entity(description="A person in Maxitor: a name and an email; the email is the login", domain=PlatformDomain)
class AccountCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One person in Maxitor; the subject of a session.
    CONTRACT: Exists only after its person accepted the privacy policy on the consent step. Has one or more
        sign-ins and a user in each organization it works in.
    INVARIANTS: Never joined with another account by a matching email. Its last sign-in cannot be removed.
    AI-CORE-END
    """

    id: str = Field(description="Account id")
    name: str = Field(description="The person's name, from the provider or typed on the consent step")
    email: str = Field(description="The email the first sign-in gave, in lower case")
    policy_version: int = Field(description="The version of the privacy policy the person accepted last")
    policy_accepted_at: datetime = Field(description="When that version was accepted")
    policy_accepted_ip: str = Field(description="The IP address the acceptance came from")

    sign_ins: Annotated[
        CompositeMany[SignInCoreEntity],
        Inverse(SignInCoreEntity, "account"),
    ] = Field(description="The ways the account gets in; at least one")

    users: Annotated[
        AssociationMany[UserCoreEntity],
        Inverse(UserCoreEntity, "account"),
    ] = Field(description="The account's place in each organization it works in")

    created_at: datetime = Field(description="When the account was created")
    updated_at: datetime | None = Field(default=None, description="When the account last changed; empty if never")


@entity(description="The ways in Maxitor offers", domain=PlatformDomain)
class SignInProviderEnumEntity(BaseEnumEntity):
    """The dictionary of ways in. Email, Yandex ID and Mail.ru ID work everywhere; the rest outside Russia."""

    EMAIL = value(code="email", display_name="A code by email")
    YANDEX = value(code="yandex", display_name="Yandex ID")
    MAILRU = value(code="mailru", display_name="Mail.ru ID")
    GOOGLE = value(code="google", display_name="Google")
    GITHUB = value(code="github", display_name="GitHub")
    FACEBOOK = value(code="facebook", display_name="Facebook")


@entity(description="One way an account gets in: a code by email or one provider's account", domain=PlatformDomain)
class SignInCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: Proof that a person owns an email or a provider account, tied to one Maxitor account.
    CONTRACT: Added on the consent step or by linking while signed in, under the region rule: Google, GitHub and
        Facebook only from outside Russia. Used from Russia, those three are refused even when they exist.
    INVARIANTS: A provider and its id give at most one sign-in across all accounts. Only an email sign-in has a
        password hash, and it is never written to a log, an error, an event or a repr.
    AI-CORE-END
    """

    id: str = Field(description="Sign-in id")
    provider: Annotated[AssociationOne[SignInProviderEnumEntity], NoInverse()] = Field(
        description="The way in: email, yandex, mailru, google, github or facebook",
    )
    provider_subject: str = Field(
        description="The provider's own id of the person; for email, the address in lower case",
    )
    email: str | None = Field(default=None, description="The email the provider gave; empty if it gave none")
    password_hash: str | None = Field(
        default=None,
        description="The Argon2id hash of the password, only for provider email; the password itself is never stored",
    )
    password_changed_at: datetime | None = Field(
        default=None,
        description="When the password was last set; a session token issued before it is not renewed",
    )

    account: Annotated[
        AssociationOne[AccountCoreEntity],
        Inverse(AccountCoreEntity, "sign_ins"),
    ] = Field(description="The account this way in belongs to")

    added_country: str | None = Field(
        default=None, description="The country of the IP it was added from, ISO 3166-1 alpha-2; empty if unknown"
    )
    added_ip: str = Field(description="The IP address it was added from")
    added_at: datetime = Field(description="When it was added")
    last_used_at: datetime | None = Field(default=None, description="When it last signed the account in")


@entity(description="What a one-time code is for", domain=PlatformDomain)
class SignInCodePurposeEnumEntity(BaseEnumEntity):
    """The dictionary of code purposes: confirming an email at sign-up, or resetting a password."""

    CONFIRM_EMAIL = value(code="confirm_email", display_name="Confirm the email")
    RESET_PASSWORD = value(code="reset_password", display_name="Reset the password")


@entity(description="A one-time code sent to an email; lives ten minutes", domain=PlatformDomain)
class SignInCodeCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: The pending proof that a person reads an email: to confirm it at sign-up or to reset its password.
    CONTRACT: Six digits, kept only as a hash; good for ten minutes and five tries; ended by a new code for the
        same address or by its use.
    INVARIANTS: Not versioned and tied to no account: the address may have none yet. At most one per address and purpose.
    AI-CORE-END
    """

    id: str = Field(description="Code id")
    purpose: Annotated[AssociationOne[SignInCodePurposeEnumEntity], NoInverse()] = Field(
        description="What the code is for: confirm_email or reset_password",
    )
    email: str = Field(description="The address the code was sent to, in lower case")
    code_hash: str = Field(description="The hash of the six-digit code; the code itself is never stored")
    password_hash: str | None = Field(
        default=None,
        description="For confirm_email: the hash of the password chosen at sign-up, moved to the sign-in on consent",
    )
    wrong_tries: int = Field(default=0, description="How many wrong codes were entered; the fifth deletes it")
    requested_country: str | None = Field(
        default=None, description="The country of the IP that asked for it; empty if unknown"
    )
    requested_ip: str = Field(description="The IP address that asked for it")
    created_at: datetime = Field(description="When it was sent")
    expires_at: datetime = Field(description="When it stops working: ten minutes after sending")


@entity(description="A wrong password entered; kept fifteen minutes to count the limit", domain=PlatformDomain)
class SignInAttemptCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One wrong password, counted against the address's and the IP's limits.
    CONTRACT: Written by the sign-in action on a wrong email or password; pruned by it after fifteen minutes.
    INVARIANTS: Not versioned; names no account, so a wrong address leaves the same trace as a right one.
    AI-CORE-END
    """

    id: str = Field(description="Attempt id")
    email: str = Field(description="The address entered, in lower case")
    ip: str = Field(description="The IP address the attempt came from")
    at: datetime = Field(description="When the attempt was made")


# ════════════════════════════════════════════════════════════════════════════
# Entities of the domain organization
# ════════════════════════════════════════════════════════════════════════════


@entity(description="Who may invite into an organization", domain=OrganizationDomain)
class WhoMayInviteEnumEntity(BaseEnumEntity):
    """The dictionary of the setting: any user of the organization, or its administrators only."""

    ANY_USER = value(code="any_user", display_name="Any user of the organization")
    ADMINISTRATORS = value(code="administrators", display_name="Administrators only")


@entity(description="A tenant of Maxitor: its people and its work at /w/<code>", domain=OrganizationDomain)
class OrganizationCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: The tenant every other piece of data belongs to.
    CONTRACT: Created together with its first user, its administrator, in one change, letting any user invite.
        Its users, invitations and boundaries belong to it (composition).
    INVARIANTS: Its code is unique across Maxitor and never changes. Organizations never see each other's data.
        It always keeps at least one active administrator.
    AI-CORE-END
    """

    id: str = Field(description="Organization id")
    name: str = Field(description="The organization's name, for example the studio's name")
    code: str = Field(
        description="The address code: lower-case ASCII letters, digits and hyphens, 2–63, not reserved, unique",
    )
    who_may_invite: Annotated[AssociationOne[WhoMayInviteEnumEntity], NoInverse()] = Field(
        description="Who may invite: any user of the organization, or administrators only; any user at registration",
    )

    users: Annotated[
        CompositeMany[UserCoreEntity],
        Inverse(UserCoreEntity, "organization"),
    ] = Field(description="The organization's users")

    invitations: Annotated[
        CompositeMany[InvitationCoreEntity],
        Inverse(InvitationCoreEntity, "organization"),
    ] = Field(description="The organization's invitations, whatever became of them")

    boundaries: Annotated[
        CompositeMany[BoundaryCoreEntity],
        Inverse(BoundaryCoreEntity, "organization"),
    ] = Field(description="The boundaries the organization works in")

    created_at: datetime = Field(description="When the organization was registered")
    updated_at: datetime | None = Field(default=None, description="When it last changed; empty if never")


class UserStateEntity(BaseStateEntity):
    """A user's state in the organization: active or blocked; removed is the lifecycle's terminal state only."""

    sort_order: int = Field(default=0, description="Display order of the states")

    ACTIVE = value(code="active", display_name="Active", sort_order=1)
    BLOCKED = value(code="blocked", display_name="Blocked", sort_order=2)
    REMOVED = value(code="removed", display_name="Removed", sort_order=3)


class UserLifecycle(Lifecycle[UserStateEntity]):
    """
    A user appears active — as the first administrator who registered the organization, or by accepting an
    invitation — and is blocked and unblocked from then on; a user is never removed. Removed is the terminal state
    that AOA requires to be reachable in the declared graph; no application action takes that edge.
    """

    _template = (
        Lifecycle()
        .state(UserStateEntity.ACTIVE)
        .to(UserStateEntity.BLOCKED)
        .initial()
        .state(UserStateEntity.BLOCKED)
        .to(UserStateEntity.ACTIVE, UserStateEntity.REMOVED)
        .intermediate()
        .state(UserStateEntity.REMOVED)
        .final()
    )


@entity(description="An account's place in exactly one organization", domain=OrganizationDomain)
class UserCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: Who an account is inside one organization; actions work for the user of the organization of the address.
    CONTRACT: Belongs to exactly one organization and one account. An organization's administrator manages only
        their organization's users; blocking a user changes nothing in another organization. A blocked user cannot
        enter the organization from their next request on.
    INVARIANTS: An organization and an account give at most one user, and it is never removed: plugins refer to a
        user by the account (``core.user (organization_id, account_id)``). An organization keeps at least one
        active administrator: the last one cannot be blocked or lose the mark.
    AI-CORE-END
    """

    id: str = Field(description="User id")
    name: str = Field(description="The user's name in this organization")
    job_title: str | None = Field(default=None, max_length=160, description="Job title in this organization, independent of permissions")
    is_admin: bool = Field(default=False, description="Administrates the organization")
    status: UserLifecycle = Field(description="The user's state: active or blocked")

    organization: Annotated[
        AssociationOne[OrganizationCoreEntity],
        Inverse(OrganizationCoreEntity, "users"),
    ] = Field(description="The organization the user belongs to")

    account: Annotated[
        AssociationOne[AccountCoreEntity],
        Inverse(AccountCoreEntity, "users"),
    ] = Field(description="The account behind the user")

    invitations_sent: Annotated[
        AssociationMany[InvitationCoreEntity],
        Inverse(InvitationCoreEntity, "invited_by"),
    ] = Field(description="The invitations this user sent")

    boundaries: Annotated[
        AssociationMany[BoundaryCoreEntity],
        Inverse(BoundaryCoreEntity, "users"),
    ] = Field(description="The boundaries the user works in")

    created_at: datetime = Field(description="When the user was created")
    updated_at: datetime | None = Field(default=None, description="When the user last changed; empty if never")


class InvitationStateEntity(BaseStateEntity):
    """An invitation's state: sent, then accepted, declined, withdrawn or expired."""

    sort_order: int = Field(default=0, description="Display order of the states")

    SENT = value(code="sent", display_name="Sent", sort_order=1)
    ACCEPTED = value(code="accepted", display_name="Accepted", sort_order=2)
    DECLINED = value(code="declined", display_name="Declined", sort_order=3)
    WITHDRAWN = value(code="withdrawn", display_name="Withdrawn", sort_order=4)
    EXPIRED = value(code="expired", display_name="Expired", sort_order=5)


class InvitationLifecycle(Lifecycle[InvitationStateEntity]):
    """
    An invitation is created sent and leaves that state once: accepted or declined by the invited account,
    withdrawn by an administrator or by the setting "Who may invite", or expired by its time.
    """

    _template = (
        Lifecycle()
        .state(InvitationStateEntity.SENT)
        .to(
            InvitationStateEntity.ACCEPTED,
            InvitationStateEntity.DECLINED,
            InvitationStateEntity.WITHDRAWN,
            InvitationStateEntity.EXPIRED,
        )
        .initial()
        .state(InvitationStateEntity.ACCEPTED)
        .final()
        .state(InvitationStateEntity.DECLINED)
        .final()
        .state(InvitationStateEntity.WITHDRAWN)
        .final()
        .state(InvitationStateEntity.EXPIRED)
        .final()
    )


@entity(description="An organization's offer to one email to become its user", domain=OrganizationDomain)
class InvitationCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: The only way into an organization after its registration: no user exists until it is accepted.
    CONTRACT: Sent by an active user the setting allows — with the administrator mark only by an administrator —
        to an email that is not an active or blocked user's and has no invitation still sent; its letter holds no
        link. Accepted or declined by an account whose confirmed email it names; withdrawn by an administrator or
        by the setting; expired after MAXITOR_INVITATION_DAYS days.
    INVARIANTS: At most one invitation still sent per organization and email. Its email is in lower case. It
        leaves the state sent exactly once.
    AI-CORE-END
    """

    id: str = Field(description="Invitation id, unique across Maxitor")
    email: str = Field(description="The email it was sent to, in lower case")
    job_title: str | None = Field(default=None, max_length=160, description="Offered job title, copied to the user on acceptance")
    is_admin: bool = Field(default=False, description="Whether accepting makes an administrator")
    status: InvitationLifecycle = Field(description="Its state: sent, accepted, declined, withdrawn or expired")
    sent_at: datetime = Field(description="When its first letter was sent")
    letter_sent_at: datetime = Field(description="When its last letter was sent")
    expires_at: datetime = Field(description="When it expires: sent_at plus MAXITOR_INVITATION_DAYS days")
    decided_at: datetime | None = Field(default=None, description="When it left the state sent; empty while sent")
    by_setting: bool = Field(default=False, description="Whether the setting Who may invite withdrew it")

    organization: Annotated[
        AssociationOne[OrganizationCoreEntity],
        Inverse(OrganizationCoreEntity, "invitations"),
    ] = Field(description="The organization that invites")

    invited_by: Annotated[
        AssociationOne[UserCoreEntity],
        Inverse(UserCoreEntity, "invitations_sent"),
    ] = Field(description="The user who sent it")

    decided_by: Annotated[AssociationOne[UserCoreEntity] | None, NoInverse()] = Field(
        default=None,
        description="The administrator who withdrew it, or who switched the setting; empty when the account or the time decided",
    )

    accepted_user: Annotated[AssociationOne[UserCoreEntity] | None, NoInverse()] = Field(
        default=None, description="The user accepting it made; empty unless accepted"
    )

    created_at: datetime = Field(description="When it was created")
    updated_at: datetime | None = Field(default=None, description="When it last changed; empty if never")


@entity(
    description="All of ours that serves one end-to-end business process; spec 059's enterprise",
    domain=OrganizationDomain,
)
class BoundaryCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: The frame the plugins' map and landscape will live in (bystrovmaxim/gnomon#64 renames it from enterprise).
    CONTRACT: Belongs to exactly one organization; its users are the users who work in it.
    INVARIANTS: Only its identity and its people are the core's; what lies inside it belongs to plugins.
    AI-CORE-END
    """

    id: str = Field(description="Boundary id")
    name: str = Field(description="The boundary's name")

    organization: Annotated[
        AssociationOne[OrganizationCoreEntity],
        Inverse(OrganizationCoreEntity, "boundaries"),
    ] = Field(description="The organization the boundary belongs to")

    users: Annotated[
        AssociationMany[UserCoreEntity],
        Inverse(UserCoreEntity, "boundaries"),
    ] = Field(description="The users who work in the boundary")

    created_at: datetime = Field(description="When the boundary was created")
    updated_at: datetime | None = Field(default=None, description="When it last changed; empty if never")


# Relations name classes declared later in the module; resolve them now.
AccountCoreEntity.model_rebuild()
SignInCoreEntity.model_rebuild()
SignInCodeCoreEntity.model_rebuild()
OrganizationCoreEntity.model_rebuild()
UserCoreEntity.model_rebuild()
InvitationCoreEntity.model_rebuild()
BoundaryCoreEntity.model_rebuild()
