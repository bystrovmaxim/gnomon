# packages/maxitor/maxitor-core/maxitor/core/domains.py
"""The core's two domains: platform, outside any organization, and organization, reserved for the core."""

from __future__ import annotations

from maxitor.core.events import (
    AccountCreatedEvent,
    AddressCodeLostRaceEvent,
    CodeLimitReachedEvent,
    CodeSentEvent,
    CodeTriesUsedUpEvent,
    ForeignOrganizationRefusedEvent,
    LetterNotSentEvent,
    LinkRefusedEvent,
    OrganizationRegisteredEvent,
    PasswordChangedEvent,
    PasswordLimitReachedEvent,
    PasswordResetRequestedEvent,
    PolicyAcceptedAgainEvent,
    ProviderAnswerRejectedEvent,
    ProviderRefusedForRegionEvent,
    SignedInEvent,
    SignedOutEvent,
    SignInLinkedEvent,
    SignInUnlinkedEvent,
    WrongCodeEvent,
    WrongPasswordEvent,
)

from aoa.action_machine.domain import BaseDomain

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
