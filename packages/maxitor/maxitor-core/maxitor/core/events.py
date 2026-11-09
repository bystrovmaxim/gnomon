# packages/maxitor/maxitor-core/maxitor/core/events.py
"""The typed events of the core's two domains, platform and organization: every line their actions may write."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.model.base_event import BaseEvent

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
