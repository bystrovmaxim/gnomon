# packages/maxitor/maxitor-core/maxitor/core/settings.py
"""
CoreSettings — the core's process settings, read once from the environment.

Every secret here comes from the environment and is never written to a log, an error or a ``repr``.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

#: The ways in that are providers, in the order the page shows them.
PROVIDERS = ("google", "github", "facebook", "yandex", "mailru")
#: The ways in that work in Russia.
RUSSIAN_WAYS = frozenset({"email", "yandex", "mailru"})


@dataclass(frozen=True)
class ProviderKeys:
    """One provider's app: its client id and secret."""

    client_id: str
    client_secret: str = field(repr=False)


@dataclass(frozen=True)
class CoreSettings:
    """
    AI-CORE-BEGIN
    ROLE: What the core's process is configured with.
    CONTRACT: ``from_environment`` reads every MAXITOR_* variable the core uses; ``session_secret`` is required.
    INVARIANTS: Secrets are never in the ``repr``.
    AI-CORE-END
    """

    session_secret: str = field(repr=False)
    public_url: str = "http://localhost:3000"
    policy_version: int = 1
    dsn: str | None = field(default=None, repr=False)
    mail_from: str = "Maxitor <no-reply@maxitor.aoa.run>"
    mail_outbox: Path | None = None
    postbox_key_id: str | None = None
    postbox_secret: str | None = field(default=None, repr=False)
    geoip_database: Path | None = None
    providers: dict[str, ProviderKeys] = field(default_factory=dict, repr=False)

    @classmethod
    def from_environment(cls) -> CoreSettings:
        """The settings the environment gives."""
        env = os.environ
        key_id, secret = env.get("MAXITOR_POSTBOX_KEY_ID"), env.get("MAXITOR_POSTBOX_SECRET")
        key_file = env.get("MAXITOR_POSTBOX_KEY_FILE")
        if key_file and not (key_id and secret):
            data = json.loads(Path(key_file).read_text(encoding="utf-8"))
            key_id, secret = data["access_key"]["key_id"], data["secret"]
        providers = {}
        for name in PROVIDERS:
            client_id = env.get(f"MAXITOR_{name.upper()}_CLIENT_ID")
            client_secret = env.get(f"MAXITOR_{name.upper()}_CLIENT_SECRET")
            if client_id and client_secret:
                providers[name] = ProviderKeys(client_id, client_secret)
        return cls(
            session_secret=env["MAXITOR_SESSION_SECRET"],
            public_url=env.get("MAXITOR_PUBLIC_URL", "http://localhost:3000").rstrip("/"),
            policy_version=int(env.get("MAXITOR_POLICY_VERSION", "1")),
            dsn=env.get("MAXITOR_CORE_DSN"),
            mail_from=env.get("MAXITOR_MAIL_FROM", "Maxitor <no-reply@maxitor.aoa.run>"),
            mail_outbox=Path(env["MAXITOR_MAIL_OUTBOX"]) if env.get("MAXITOR_MAIL_OUTBOX") else None,
            postbox_key_id=key_id,
            postbox_secret=secret,
            geoip_database=Path(env["MAXITOR_GEOIP_DATABASE"]) if env.get("MAXITOR_GEOIP_DATABASE") else None,
            providers=providers,
        )

    def redirect_uri(self, provider: str) -> str:
        """The address a provider sends the person back to."""
        return f"{self.public_url}/api/v1/sign-in/{provider}/callback"
