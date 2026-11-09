# packages/maxitor/maxitor-core/maxitor/core/actions/provider_sign_in.py
"""
StartSignInAction and FinishSignInAction — signing in with a provider the request's region allows.

The region is checked when the sign-in starts and again when the provider answers: from Russia, Google, GitHub and
Facebook are refused even for an account that already has them.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

from maxitor.core.actions.common import allowed, country_word, now, provider, region_of, storage, tokens
from maxitor.core.actions.email_sign_in import ConsentResult
from maxitor.core.domains import PlatformDomain
from maxitor.core.errors import CoreRefusalError, RegionRefusedError, SignInRefusedError
from maxitor.core.events import ProviderAnswerRejectedEvent, ProviderRefusedForRegionEvent, SignedInEvent
from maxitor.core.gateways.geoip import GEOIP_CONNECTION_KEY, GeoIpGateway
from maxitor.core.gateways.providers import ProviderPerson, ProviderRefusedError, with_providers
from maxitor.core.settings import PROVIDERS
from maxitor.core.storage.core_storage import CORE_CONNECTION_KEY, CoreStorage
from maxitor.core.tokens import TOKENS_CONNECTION_KEY, SessionTokensController
from pydantic import Field

from aoa.action_machine.auth import GuestRole
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.emits import emits
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging import Channel
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class ProviderNotConfiguredError(CoreRefusalError):
    """The provider's app is not set up on this server."""

    status = 503


async def checked_region(
    box: ToolsBox, connections: Connections, name: str, account_id: str | None = None
) -> str | None:
    """The request's country; refuses ``name`` when the region does not allow it."""
    if name not in PROVIDERS:
        raise SignInRefusedError("unknown_provider")
    region, country = await region_of(box, connections)
    if not allowed(region, name):
        await box.warning(
            Channel.security,
            "{%var.provider} refused for {%var.country}",
            ProviderRefusedForRegionEvent(provider=name, country=country_word(country), account_id=account_id),
        )
        raise RegionRefusedError("region", provider=name)
    return country


def challenge_of(verifier: str) -> str:
    """The PKCE S256 challenge of ``verifier``."""
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()


class StartParams(BaseParams):
    """The provider to sign in with."""

    provider: str = Field(description="google, github, facebook, yandex or mailru")


class StartResult(BaseResult):
    """Where to send the person, and what the frontend keeps until they come back."""

    authorize_url: str = Field(description="The provider's consent page")
    state: str = Field(description="Kept by the frontend; must come back unchanged")
    verifier: str = Field(description="The PKCE verifier, kept by the frontend")


@meta(description="Start signing in with a provider the region allows", domain=PlatformDomain)
@check_roles(GuestRole)
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The core's settings")
@with_providers
class StartSignInAction(BaseAction[StartParams, StartResult]):
    """
    AI-CORE-BEGIN
    ROLE: Send the person to a provider.
    CONTRACT: Refuses a provider of the other region (403) or one not set up (503); otherwise answers the provider's
        address with a new ``state`` and PKCE challenge.
    AI-CORE-END
    """

    @summary_aspect("Check the region and build the provider's address")
    @emits(ProviderRefusedForRegionEvent)
    async def start_summary(
        self, params: StartParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> StartResult:
        """Region, then the address."""
        _ = state
        await checked_region(box, connections, params.provider)
        gateway = provider(connections, params.provider)
        if gateway is None or not gateway.configured:
            raise ProviderNotConfiguredError("not_configured", provider=params.provider)
        sign_state, verifier = secrets.token_urlsafe(24), secrets.token_urlsafe(48)
        return StartResult(
            authorize_url=gateway.authorize_url(sign_state, challenge_of(verifier)), state=sign_state, verifier=verifier
        )


class FinishParams(BaseParams):
    """What the provider sent back, and what the frontend kept."""

    provider: str = Field(description="google, github, facebook, yandex or mailru")
    code: str = Field(min_length=1, description="The provider's code")
    state: str = Field(min_length=1, description="The state the provider sent back")
    expected_state: str = Field(min_length=1, description="The state the frontend kept")
    verifier: str = Field(min_length=1, description="The PKCE verifier the frontend kept")


class FinishResult(BaseResult):
    """A session for a known sign-in, or a consent token for a new person."""

    session_token: str | None = Field(default=None, description="Set when the sign-in is known")
    policy_current: bool = Field(default=True, description="False when the account must accept the current policy")
    consent_token: str | None = Field(default=None, description="Set when the person is new")
    name: str = Field(default="", description="The name the provider gave, for the consent step")


async def proven_person(
    box: ToolsBox, connections: Connections, params: FinishParams, country: str | None
) -> ProviderPerson:
    """The person the provider vouches for; refuses a wrong ``state`` or a refused code."""
    gateway = provider(connections, params.provider)
    if gateway is None or not gateway.configured:
        raise ProviderNotConfiguredError("not_configured", provider=params.provider)
    if not hmac.compare_digest(params.state, params.expected_state):
        await box.warning(
            Channel.security,
            "{%var.provider} answer rejected: {%var.reason}",
            ProviderAnswerRejectedEvent(provider=params.provider, country=country_word(country), reason="state"),
        )
        raise SignInRefusedError("state")
    try:
        return await gateway.person(params.code, params.verifier)
    except ProviderRefusedError:
        await box.warning(
            Channel.security,
            "{%var.provider} answer rejected: {%var.reason}",
            ProviderAnswerRejectedEvent(provider=params.provider, country=country_word(country), reason="code"),
        )
        raise SignInRefusedError("provider") from None


@meta(
    description="Finish signing in with a provider: a session for a known person, the consent step for a new one",
    domain=PlatformDomain,
)
@check_roles(GuestRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The core's tokens")
@with_providers
class FinishSignInAction(BaseAction[FinishParams, FinishResult]):
    """
    AI-CORE-BEGIN
    ROLE: Turn a provider's answer into a session or a consent step.
    CONTRACT: The region is checked again; a ``state`` that does not match or a refused code is refused (401); a
        provider that gives no email for a new person is refused with ``no_email``.
    AI-CORE-END
    """

    @summary_aspect("Check the region and the answer, then sign in or ask for consent")
    @emits(ProviderAnswerRejectedEvent, ProviderRefusedForRegionEvent, SignedInEvent)
    async def finish_summary(
        self, params: FinishParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> FinishResult:
        """Known sign-in: a session. New person: a consent token."""
        _ = state
        country = await checked_region(box, connections, params.provider)
        person = await proven_person(box, connections, params, country)
        store, keys, at = storage(connections), tokens(connections), now()
        known = await store.sign_in_of(params.provider, person.subject)
        if known is not None:
            account_id = str(known["account_id"])
            await store.touch_sign_in(str(known["id"]), at)
            account = await store.account(account_id)
            await box.info(
                Channel.security,
                "Account {%var.account_id} signed in by {%var.provider}",
                SignedInEvent(account_id=account_id, provider=params.provider, country=country_word(country)),
            )
            return FinishResult(
                session_token=keys.session(account_id, at),
                policy_current=bool(account and account["policy_version"] >= keys.policy_version),
            )
        if not person.email:
            raise SignInRefusedError("no_email")
        references = {
            "kind": "provider",
            "provider": params.provider,
            "subject": person.subject,
            "email": person.email.lower(),
            "name": person.name,
        }
        return FinishResult(consent_token=keys.consent(references, at), name=person.name)


__all__ = ["ConsentResult", "FinishSignInAction", "StartSignInAction", "checked_region", "proven_person"]
