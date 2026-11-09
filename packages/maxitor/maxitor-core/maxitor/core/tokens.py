# packages/maxitor/maxitor-core/maxitor/core/tokens.py
"""
SessionTokensController — the core's signed tokens: the session and the consent step's token.

The session token (HS256) carries ``sub`` (the account), ``sid`` (new at each sign-in), ``roles``, ``iat``,
``exp`` = ``iat`` + 8 h and ``auth_at`` (when the person signed in). A renewal keeps ``sid`` and ``auth_at`` and is
possible for 30 days from ``auth_at``. The consent token (``aud`` = ``maxitor-consent``, 15 minutes) carries only
references to a proven sign-in waiting for the person's consent; a password hash never travels in it.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseController

SESSION_LIFETIME = timedelta(hours=8)
SESSION_LIMIT = timedelta(days=30)
CONSENT_LIFETIME = timedelta(minutes=15)
CONSENT_AUDIENCE = "maxitor-consent"
#: Connection key under which actions receive the tokens.
TOKENS_CONNECTION_KEY = "tokens"
#: The cookie the session lives in.
SESSION_COOKIE = "__Host-maxitor_session"


@meta(description="Signs and reads the core's session and consent tokens with the process's secret")
class SessionTokensController(BaseController):
    """
    AI-CORE-BEGIN
    ROLE: Issue and read the core's tokens.
    CONTRACT: ``session`` signs a session token; ``renewed`` signs its renewal or answers ``None`` past the limit;
        ``consent`` signs a consent token; ``read_consent`` answers its claims or ``None``.
    INVARIANTS: The secret comes from the environment and is never shown.
    AI-CORE-END
    """

    def __init__(self, secret: str, policy_version: int = 1) -> None:
        self._secret = secret
        #: The version of the privacy policy a new account accepts and an existing one must have accepted.
        self.policy_version = policy_version

    def hash_code(self, email: str, purpose: str, code: str) -> str:
        """The keyed hash of a one-time code; the code itself is never stored."""
        from maxitor.core.codes import code_hash  # pylint: disable=import-outside-toplevel

        return code_hash(self._secret, email, purpose, code)

    def same_code(self, email: str, purpose: str, code: str, stored_hash: str) -> bool:
        """Whether ``code`` is the code whose hash is ``stored_hash``."""
        from maxitor.core.codes import same_code  # pylint: disable=import-outside-toplevel

        return same_code(self._secret, email, purpose, code, stored_hash)

    def __repr__(self) -> str:
        return "SessionTokensController(secret=...)"

    @classmethod
    def get_wrapper_class(cls) -> None:
        """No wrapper: a nested action uses the same tokens."""
        return None

    def session(self, account_id: str, now: datetime, sid: str | None = None, auth_at: datetime | None = None) -> str:
        """A session token for ``account_id``: a new ``sid`` and ``auth_at`` unless renewing."""
        claims = {
            "sub": account_id,
            "sid": sid or str(uuid.uuid4()),
            "roles": ["account"],
            "iat": int(now.timestamp()),
            "exp": int((now + SESSION_LIFETIME).timestamp()),
            "auth_at": int((auth_at or now).timestamp()),
        }
        return jwt.encode(claims, self._secret, algorithm="HS256")

    def read_session(self, token: str) -> dict[str, Any] | None:
        """The claims of a valid, unexpired session token, or ``None``."""
        try:
            return jwt.decode(
                token, self._secret, algorithms=["HS256"], options={"require": ["exp", "sub", "sid", "iat"]}
            )
        except jwt.InvalidTokenError:
            return None

    def renewed(self, claims: dict[str, Any], now: datetime) -> str | None:
        """A renewal of the session ``claims``, or ``None`` once 30 days have passed since signing in."""
        auth_at = datetime.fromtimestamp(int(claims.get("auth_at", claims["iat"])), UTC)
        if now - auth_at > SESSION_LIMIT:
            return None
        return self.session(str(claims["sub"]), now, sid=str(claims["sid"]), auth_at=auth_at)

    def consent(self, references: dict[str, Any], now: datetime) -> str:
        """A consent token naming ``references``; it lives fifteen minutes."""
        claims = {
            **references,
            "aud": CONSENT_AUDIENCE,
            "iat": int(now.timestamp()),
            "exp": int((now + CONSENT_LIFETIME).timestamp()),
        }
        return jwt.encode(claims, self._secret, algorithm="HS256")

    def read_consent(self, token: str) -> dict[str, Any] | None:
        """The references of a valid consent token, or ``None``."""
        try:
            claims = jwt.decode(
                token, self._secret, algorithms=["HS256"], audience=CONSENT_AUDIENCE, options={"require": ["exp"]}
            )
        except jwt.InvalidTokenError:
            return None
        return {k: v for k, v in claims.items() if k not in {"aud", "iat", "exp"}}
