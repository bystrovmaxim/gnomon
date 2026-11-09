# packages/maxitor/maxitor-core/maxitor/core/gateways/providers.py
"""
The providers' gateways: Google, GitHub, Facebook, Yandex ID and Mail.ru ID.

Each gateway builds the address the person goes to (``authorize_url``) and turns the code the provider sends back
into the person (``person``): the provider's id, the email it gives and the name. ``state`` and the PKCE challenge
(S256) go to every provider; one that ignores PKCE is still bound by ``state``. Only the name and the email are asked.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, ClassVar
from urllib.parse import urlencode

import httpx

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseGateway


@dataclass(frozen=True)
class ProviderPerson:
    """Who a provider says the person is."""

    subject: str
    email: str | None
    name: str


class ProviderRefusedError(RuntimeError):
    """The provider refused the code, or its answer did not make sense."""


@meta(description="One provider's sign-in, as the core asks it")
class ProviderSignInGateway(BaseGateway):
    """
    AI-CORE-BEGIN
    ROLE: One provider's sign-in, as the core asks it.
    CONTRACT: ``authorize_url`` answers the address of the provider's consent page; ``person`` exchanges the code and
        answers the person, or raises ``ProviderRefusedError``.
    INVARIANTS: The client secret and every token stay inside the gateway; none reaches a log or a ``repr``.
    AI-CORE-END
    """

    name: ClassVar[str]
    authorize_endpoint: ClassVar[str]
    token_endpoint: ClassVar[str]
    scope: ClassVar[str]

    def __init__(
        self,
        client_id: str | None,
        client_secret: str | None,
        redirect_uri: str,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._client_id = client_id or ""
        self._client_secret = client_secret or ""
        self._redirect_uri = redirect_uri
        self._transport = transport

    @property
    def configured(self) -> bool:
        """Whether the provider's app is set up on this server."""
        return bool(self._client_id and self._client_secret)

    def __repr__(self) -> str:
        return f"{type(self).__name__}(client_id={self._client_id!r}, secret=...)"

    @classmethod
    def get_wrapper_class(cls) -> None:
        """No wrapper: a nested action uses the same gateway."""
        return None

    def authorize_url(self, state: str, challenge: str) -> str:
        """The provider's page that asks the person to let Maxitor know their name and email."""
        query = {
            "response_type": "code",
            "client_id": self._client_id,
            "redirect_uri": self._redirect_uri,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            **({"scope": self.scope} if self.scope else {}),
        }
        return f"{self.authorize_endpoint}?{urlencode(query)}"

    async def person(self, code: str, verifier: str) -> ProviderPerson:
        """Exchange ``code`` for a token and read the person."""
        async with httpx.AsyncClient(transport=self._transport, timeout=15.0) as client:
            try:
                token = await self._token(client, code, verifier, self._redirect_uri)
                return await self._person(client, token)
            except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
                raise ProviderRefusedError(f"{self.name} refused: {type(exc).__name__}") from None

    async def _token(self, client: httpx.AsyncClient, code: str, verifier: str, redirect_uri: str) -> str:
        answer = await client.post(
            self.token_endpoint,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "code_verifier": verifier,
            },
            headers={"Accept": "application/json"},
        )
        answer.raise_for_status()
        return str(answer.json()["access_token"])

    async def _person(self, client: httpx.AsyncClient, token: str) -> ProviderPerson:
        raise NotImplementedError


@meta(description="Signing in with Google")
class GoogleSignInGateway(ProviderSignInGateway):
    """Google: OpenID Connect userinfo."""

    name = "google"
    authorize_endpoint = "https://accounts.google.com/o/oauth2/v2/auth"
    token_endpoint = "https://oauth2.googleapis.com/token"
    scope = "openid email profile"

    async def _person(self, client: httpx.AsyncClient, token: str) -> ProviderPerson:
        data: dict[str, Any] = (
            (
                await client.get(
                    "https://openidconnect.googleapis.com/v1/userinfo", headers={"Authorization": f"Bearer {token}"}
                )
            )
            .raise_for_status()
            .json()
        )
        email = data.get("email") if data.get("email_verified") else None
        return ProviderPerson(str(data["sub"]), email, str(data.get("name") or ""))


@meta(description="Signing in with GitHub")
class GitHubSignInGateway(ProviderSignInGateway):
    """GitHub: the user and their primary verified email."""

    name = "github"
    authorize_endpoint = "https://github.com/login/oauth/authorize"
    token_endpoint = "https://github.com/login/oauth/access_token"
    scope = "read:user user:email"

    async def _person(self, client: httpx.AsyncClient, token: str) -> ProviderPerson:
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
        user: dict[str, Any] = (
            (await client.get("https://api.github.com/user", headers=headers)).raise_for_status().json()
        )
        emails: list[dict[str, Any]] = (
            (await client.get("https://api.github.com/user/emails", headers=headers)).raise_for_status().json()
        )
        primary = next((e["email"] for e in emails if e.get("primary") and e.get("verified")), None)
        return ProviderPerson(str(user["id"]), primary, str(user.get("name") or user.get("login") or ""))


@meta(description="Signing in with Facebook")
class FacebookSignInGateway(ProviderSignInGateway):
    """Facebook: the Graph API's me."""

    name = "facebook"
    authorize_endpoint = "https://www.facebook.com/v21.0/dialog/oauth"
    token_endpoint = "https://graph.facebook.com/v21.0/oauth/access_token"
    scope = "email public_profile"

    async def _person(self, client: httpx.AsyncClient, token: str) -> ProviderPerson:
        data: dict[str, Any] = (
            (
                await client.get(
                    "https://graph.facebook.com/me", params={"fields": "id,name,email", "access_token": token}
                )
            )
            .raise_for_status()
            .json()
        )
        return ProviderPerson(str(data["id"]), data.get("email"), str(data.get("name") or ""))


@meta(description="Signing in with Yandex ID")
class YandexSignInGateway(ProviderSignInGateway):
    """Yandex ID: login.yandex.ru/info."""

    name = "yandex"
    authorize_endpoint = "https://oauth.yandex.ru/authorize"
    token_endpoint = "https://oauth.yandex.ru/token"
    scope = "login:email login:info"

    async def _person(self, client: httpx.AsyncClient, token: str) -> ProviderPerson:
        data: dict[str, Any] = (
            (
                await client.get(
                    "https://login.yandex.ru/info",
                    params={"format": "json"},
                    headers={"Authorization": f"OAuth {token}"},
                )
            )
            .raise_for_status()
            .json()
        )
        name = data.get("real_name") or data.get("display_name") or data.get("login") or ""
        return ProviderPerson(str(data["id"]), data.get("default_email"), str(name))


@meta(description="Signing in with Mail.ru ID")
class MailRuSignInGateway(ProviderSignInGateway):
    """Mail.ru ID: oauth.mail.ru/userinfo."""

    name = "mailru"
    authorize_endpoint = "https://oauth.mail.ru/login"
    token_endpoint = "https://oauth.mail.ru/token"
    scope = "userinfo"

    async def _person(self, client: httpx.AsyncClient, token: str) -> ProviderPerson:
        data: dict[str, Any] = (
            (await client.get("https://oauth.mail.ru/userinfo", params={"access_token": token}))
            .raise_for_status()
            .json()
        )
        return ProviderPerson(str(data["id"]), data.get("email"), str(data.get("name") or ""))


GATEWAYS: dict[str, type[ProviderSignInGateway]] = {
    gateway.name: gateway
    for gateway in (
        GoogleSignInGateway,
        GitHubSignInGateway,
        FacebookSignInGateway,
        YandexSignInGateway,
        MailRuSignInGateway,
    )
}


def with_providers(cls: type) -> type:
    """Declare the five providers' gateways as connections of an action, keyed by the provider's name."""
    from aoa.action_machine.intents.connection import connection  # pylint: disable=import-outside-toplevel

    for name, gateway in GATEWAYS.items():
        cls = connection(gateway, key=name, description=f"Signing in with {name}")(cls)
    return cls
