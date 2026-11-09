# specs/072-maxitor-core/model/core_model.py
"""
The data model of Maxitor's core for bystrovmaxim/gnomon#73, written as AOA entities, events and one storage.

The model is the plan of the code: every entity here becomes a table of the same name, every domain a
schema of the same name, every event a line the core may write. It lives inside the specification while
it is a design; the code is compared with its graph once built.

::

    PlatformDomain — the system's data outside any organization          schema ``platform``
        AccountCoreEntity                         table account          one person; the email is the login
            ├── sign_ins: SignInCoreEntity *         table sign_in       the ways the account gets in (composition)
            │       └── provider: SignInProviderEnumEntity              email (with a password), yandex, mailru, google, github, facebook
            └── users: UserCoreEntity *              (organization)     the account's place in each organization
        SignInCodeCoreEntity                      table sign_in_code     a one-time code sent to an email; not versioned
        SignInAttemptCoreEntity                   table sign_in_attempt  a wrong password, counted fifteen minutes; not versioned
            └── purpose: SignInCodePurposeEnumEntity                    confirm_email, reset_password

    OrganizationDomain — organizations and their people                  schema ``organization``
        OrganizationCoreEntity                    table organization     a tenant at /w/<code>
            ├── users: UserCoreEntity *              table user          its people (composition)
            └── boundaries: BoundaryCoreEntity *     table boundary      spec 059's enterprises, renamed (composition)
        UserCoreEntity * ── boundaries ── * BoundaryCoreEntity           the boundaries a user works in
        UserCoreEntity * ── account ── 1 AccountCoreEntity               the person behind the user

    CoreStorage — one PostgreSQL database, written as the role maxitor_core, keeps both schemas.

Every table of the domain ``organization`` and the table ``account`` have a version table beside them
(``<table>_versions``) as versioned storage lays it out; version tables are storage, not entities, and are
not drawn here. ``sign_in_code`` is not versioned: a code lives ten minutes and is deleted once used,
expired or exhausted.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import Field

from aoa.action_machine.domain import (
    AssociationMany,
    AssociationOne,
    BaseCoreEntity,
    BaseDomain,
    BaseEnumEntity,
    BaseStateEntity,
    CompositeMany,
    Inverse,
    Lifecycle,
    NoInverse,
    value,
)
from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.entity import entity
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.model.base_event import BaseEvent
from aoa.action_machine.resources.postgres import PostgresStorage

# ════════════════════════════════════════════════════════════════════════════
# Events of the domain platform
# ════════════════════════════════════════════════════════════════════════════


class AccountCreatedEvent(BaseEvent):
    """A new person accepted the privacy policy and their account was created (info)."""

    account_id: str = Field(description="The account created")
    provider: str = Field(description="The way in it was created by: email, yandex, mailru, google, github, facebook")
    country: str = Field(description="The country of the request's IP, ISO 3166-1 alpha-2")
    policy_version: int = Field(description="The version of the privacy policy accepted")


class PolicyAcceptedAgainEvent(BaseEvent):
    """An existing account accepted a new version of the privacy policy at sign-in (info)."""

    account_id: str = Field(description="The account")
    policy_version: int = Field(description="The version accepted")


class SignedInEvent(BaseEvent):
    """An account's session began (info)."""

    account_id: str = Field(description="The account signed in")
    provider: str = Field(description="The way in used")
    country: str = Field(description="The country of the request's IP")


class SignedOutEvent(BaseEvent):
    """An account's session ended by signing out (info)."""

    account_id: str = Field(description="The account signed out")


class SignInLinkedEvent(BaseEvent):
    """A signed-in account added a way in (info)."""

    account_id: str = Field(description="The account")
    provider: str = Field(description="The way in added")
    country: str = Field(description="The country of the request's IP")


class SignInUnlinkedEvent(BaseEvent):
    """A signed-in account removed a way in (info)."""

    account_id: str = Field(description="The account")
    provider: str = Field(description="The way in removed")


class CodeSentEvent(BaseEvent):
    """A one-time code was handed to the mail (info)."""

    email_masked: str = Field(description="The address, masked: a***@yandex.ru")
    country: str = Field(description="The country of the request's IP")


class ProviderRefusedForRegionEvent(BaseEvent):
    """A provider not allowed in the request's region was started or answered (warning)."""

    provider: str = Field(description="The provider refused")
    country: str = Field(description="The country of the request's IP")
    account_id: str | None = Field(default=None, description="The account the sign-in belongs to, when there is one")


class ProviderAnswerRejectedEvent(BaseEvent):
    """A provider's answer did not check: its state, code or PKCE verifier (warning)."""

    provider: str = Field(description="The provider whose answer was rejected")
    country: str = Field(description="The country of the request's IP")
    reason: str = Field(description="What did not check: state, code or verifier")


class WrongCodeEvent(BaseEvent):
    """A wrong one-time code was entered (warning)."""

    email_masked: str = Field(description="The address, masked")
    tries_left: int = Field(description="How many tries the code has left")


class CodeTriesUsedUpEvent(BaseEvent):
    """A code was wrong five times and was deleted (warning)."""

    email_masked: str = Field(description="The address, masked")


class CodeLimitReachedEvent(BaseEvent):
    """An address or an IP asked for more codes than allowed (warning)."""

    email_masked: str = Field(description="The address, masked")
    country: str = Field(description="The country of the request's IP")
    limit: str = Field(description="Which limit: address per minute, address per hour, IP per hour")


class WrongPasswordEvent(BaseEvent):
    """A wrong email or password was entered (warning)."""

    email_masked: str = Field(description="The address entered, masked")
    country: str = Field(description="The country of the request's IP")


class PasswordLimitReachedEvent(BaseEvent):
    """An address or an IP entered more wrong passwords than allowed (warning)."""

    email_masked: str = Field(description="The address, masked")
    country: str = Field(description="The country of the request's IP")
    limit: str = Field(description="Which limit: address per fifteen minutes or IP per fifteen minutes")


class PasswordResetRequestedEvent(BaseEvent):
    """A reset code was asked for an address that has a password (info)."""

    email_masked: str = Field(description="The address, masked")
    country: str = Field(description="The country of the request's IP")


class PasswordChangedEvent(BaseEvent):
    """An account's password was replaced by a reset (info)."""

    account_id: str = Field(description="The account whose password changed")
    country: str = Field(description="The country of the request's IP")


class LinkRefusedEvent(BaseEvent):
    """A way in could not be linked: it already signs in another account (warning)."""

    account_id: str = Field(description="The account that tried to link it")
    provider: str = Field(description="The way in refused")


class LetterNotSentEvent(BaseEvent):
    """The mail gateway could not send a letter: a code or a password changed (critical)."""

    email_masked: str = Field(description="The address, masked")
    reason: str = Field(description="What the mail service answered, or that it did not answer")


# ════════════════════════════════════════════════════════════════════════════
# Events of the domain organization
# ════════════════════════════════════════════════════════════════════════════


class OrganizationRegisteredEvent(BaseEvent):
    """An organization and its first user, its administrator, were created (info)."""

    organization_id: str = Field(description="The organization")
    code: str = Field(description="Its address code")
    account_id: str = Field(description="The account that registered it")


class AddressCodeLostRaceEvent(BaseEvent):
    """Two registrations asked for one free code at once; this one lost (warning)."""

    code: str = Field(description="The address code taken a moment before")
    account_id: str = Field(description="The account that lost the race")


class ForeignOrganizationRefusedEvent(BaseEvent):
    """An account asked for an organization it has no active user in (warning)."""

    code: str = Field(description="The address code asked for")
    account_id: str = Field(description="The account that asked")


# ════════════════════════════════════════════════════════════════════════════
# Domains
# ════════════════════════════════════════════════════════════════════════════


class PlatformDomain(BaseDomain):
    """The system's data outside any organization: accounts, their ways in and one-time codes."""

    name = "platform"
    description = "Accounts, the ways they sign in and one-time codes; nothing here belongs to one organization"
    events = (
        AccountCreatedEvent,
        PolicyAcceptedAgainEvent,
        SignedInEvent,
        SignedOutEvent,
        SignInLinkedEvent,
        SignInUnlinkedEvent,
        CodeSentEvent,
        ProviderRefusedForRegionEvent,
        ProviderAnswerRejectedEvent,
        WrongCodeEvent,
        CodeTriesUsedUpEvent,
        CodeLimitReachedEvent,
        WrongPasswordEvent,
        PasswordLimitReachedEvent,
        PasswordResetRequestedEvent,
        PasswordChangedEvent,
        LinkRefusedEvent,
        LetterNotSentEvent,
    )


class OrganizationDomain(BaseDomain):
    """Organizations, their users and the boundaries they work in; reserved for the core."""

    name = "organization"
    description = "Organizations as tenants, their users and boundaries"
    events = (
        OrganizationRegisteredEvent,
        AddressCodeLostRaceEvent,
        ForeignOrganizationRefusedEvent,
    )


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

    added_country: str = Field(description="The country of the IP it was added from, ISO 3166-1 alpha-2")
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
    requested_country: str = Field(description="The country of the IP that asked for it")
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


@entity(description="A tenant of Maxitor: its people and its work at /w/<code>", domain=OrganizationDomain)
class OrganizationCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: The tenant every other piece of data belongs to.
    CONTRACT: Created together with its first user, its administrator, in one change. Its users and boundaries
        belong to it (composition).
    INVARIANTS: Its code is unique across Maxitor and never changes. Organizations never see each other's data.
    AI-CORE-END
    """

    id: str = Field(description="Organization id")
    name: str = Field(description="The organization's name, for example the studio's name")
    code: str = Field(
        description="The address code: lower-case ASCII letters, digits and hyphens, 2–63, not reserved, unique",
    )

    users: Annotated[
        CompositeMany[UserCoreEntity],
        Inverse(UserCoreEntity, "organization"),
    ] = Field(description="The organization's users")

    boundaries: Annotated[
        CompositeMany[BoundaryCoreEntity],
        Inverse(BoundaryCoreEntity, "organization"),
    ] = Field(description="The boundaries the organization works in")

    created_at: datetime = Field(description="When the organization was registered")
    updated_at: datetime | None = Field(default=None, description="When it last changed; empty if never")


class UserStateEntity(BaseStateEntity):
    """A user's state in the organization: active, blocked or removed."""

    sort_order: int = Field(default=0, description="Display order of the states")

    ACTIVE = value(code="active", display_name="Active", sort_order=1)
    BLOCKED = value(code="blocked", display_name="Blocked", sort_order=2)
    REMOVED = value(code="removed", display_name="Removed", sort_order=3)


class UserLifecycle(Lifecycle[UserStateEntity]):
    """
    A user appears active — as the first administrator here, by invitation later (bystrovmaxim/gnomon#13).
    An active user can be blocked and unblocked; removal from any state is final.
    """

    _template = (
        Lifecycle()
        .state(UserStateEntity.ACTIVE)
        .to(UserStateEntity.BLOCKED, UserStateEntity.REMOVED)
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
        their organization's users; blocking a user changes nothing in another organization.
    INVARIANTS: An organization and an account give at most one user. An organization keeps at least one active
        administrator.
    AI-CORE-END
    """

    id: str = Field(description="User id")
    name: str = Field(description="The user's name in this organization")
    is_admin: bool = Field(default=False, description="Administrates the organization")
    status: UserLifecycle = Field(description="The user's state: active, blocked or removed")

    organization: Annotated[
        AssociationOne[OrganizationCoreEntity],
        Inverse(OrganizationCoreEntity, "users"),
    ] = Field(description="The organization the user belongs to")

    account: Annotated[
        AssociationOne[AccountCoreEntity],
        Inverse(AccountCoreEntity, "users"),
    ] = Field(description="The account behind the user")

    boundaries: Annotated[
        AssociationMany[BoundaryCoreEntity],
        Inverse(BoundaryCoreEntity, "users"),
    ] = Field(description="The boundaries the user works in")

    created_at: datetime = Field(description="When the user was created")
    updated_at: datetime | None = Field(default=None, description="When the user last changed; empty if never")


@entity(description="All of ours that serves one end-to-end business process; spec 059's enterprise", domain=OrganizationDomain)
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
BoundaryCoreEntity.model_rebuild()


# ════════════════════════════════════════════════════════════════════════════
# Storage
# ════════════════════════════════════════════════════════════════════════════


@meta(description="The core's database: the schemas platform and organization, written as the role maxitor_core")
@entities(
    AccountCoreEntity,
    SignInCoreEntity,
    SignInProviderEnumEntity,
    SignInCodePurposeEnumEntity,
    SignInCodeCoreEntity,
    SignInAttemptCoreEntity,
    OrganizationCoreEntity,
    UserCoreEntity,
    BoundaryCoreEntity,
)
class CoreStorage(PostgresStorage):
    """
    AI-CORE-BEGIN
    ROLE: The one storage of the core; every read and write of accounts, sign-ins, codes, organizations and users.
    CONTRACT: Connects only as maxitor_core; names no schema in SQL — its search_path is organization, platform.
    INVARIANTS: organization_id in every condition on the organization's tables; public stays empty.
    AI-CORE-END
    """
