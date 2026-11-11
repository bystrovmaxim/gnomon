# packages/maxitor/maxitor-core/maxitor/core/plugins/plugin_tokens.py
"""
PluginTokensController — the tokens the core issues for plugins, signed with its Ed25519 key (EdDSA), and the JWKS
by which a plugin checks them (constitution 1.7.0, rule 56).

::

    {"iss": "maxitor", "aud": "<the plugin's passport id>", "sub": "<account id> | plugin:<passport id>",
     "sid": "...", "org": "<organization code>", "roles": ["member", "administrator"] | ["service"],
     "iat": ..., "exp": iat + 60}

The private key is read once from the PEM file the environment names and never leaves this object: no ``repr``,
log or error shows it. A plugin holds only the public key, from the JWKS, so no plugin can issue a token.
"""

from __future__ import annotations

import base64
import hashlib
import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseController

#: Connection key under which actions receive the controller.
PLUGIN_TOKENS_CONNECTION_KEY = "plugin_tokens"
#: Who issues every plugin token.
ISSUER = "maxitor"
#: How long a plugin token lives.
TOKEN_LIFETIME = timedelta(seconds=60)
#: The claims a plugin token must carry.
REQUIRED_CLAIMS = ["iss", "aud", "sub", "sid", "org", "roles", "iat", "exp"]


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


@meta(description="Signs the tokens the core issues for plugins with its Ed25519 key and publishes the key's public half")
class PluginTokensController(BaseController):
    """
    AI-CORE-BEGIN
    ROLE: Issue and read plugin tokens; answer the JWKS.
    CONTRACT: ``issue`` signs a 60-second token for one plugin; ``read`` answers the claims of a token this core
        signed, unexpired, or ``None``; ``jwks`` answers the public key with its thumbprint as ``kid``.
    INVARIANTS: The private key is never shown; only EdDSA is accepted on reading.
    AI-CORE-END
    """

    def __init__(self, private_key: Ed25519PrivateKey) -> None:
        self._private = private_key
        raw = private_key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
        self._x = _b64(raw)
        # RFC 7638: the thumbprint of the key's required members in lexicographic order, without spaces.
        canonical = json.dumps({"crv": "Ed25519", "kty": "OKP", "x": self._x}, separators=(",", ":"), sort_keys=True)
        self.kid = _b64(hashlib.sha256(canonical.encode("ascii")).digest())

    @classmethod
    def from_file(cls, path: Path) -> PluginTokensController:
        """The controller over the Ed25519 private key in a PEM file; raise ``ValueError`` for anything else."""
        key = serialization.load_pem_private_key(path.read_bytes(), password=None)
        if not isinstance(key, Ed25519PrivateKey):
            raise ValueError(f"{path} does not hold an Ed25519 private key")
        return cls(key)

    def __repr__(self) -> str:
        return f"PluginTokensController(kid={self.kid!r})"

    @classmethod
    def get_wrapper_class(cls) -> None:
        """No wrapper: a nested action uses the same key."""
        return None

    def issue(
        self, audience: str, subject: str, session_id: str | None, organization: str, roles: list[str], now: datetime
    ) -> str:
        """A token for the plugin ``audience``: the person or service, the organization and the roles, for 60 s."""
        claims = {
            "iss": ISSUER,
            "aud": audience,
            "sub": subject,
            "sid": session_id or str(uuid.uuid4()),
            "org": organization,
            "roles": roles,
            "iat": int(now.timestamp()),
            "exp": int((now + TOKEN_LIFETIME).timestamp()),
        }
        return jwt.encode(claims, self._private, algorithm="EdDSA", headers={"kid": self.kid})

    def read(self, token: str) -> dict[str, Any] | None:
        """The claims of an unexpired token this core signed, for whichever plugin; ``None`` otherwise."""
        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                self._private.public_key(),
                algorithms=["EdDSA"],
                issuer=ISSUER,
                options={"verify_aud": False, "require": REQUIRED_CLAIMS},
            )
        except jwt.InvalidTokenError:
            return None
        return claims

    def jwks(self) -> dict[str, list[dict[str, str]]]:
        """The public key as a JSON Web Key Set."""
        return {"keys": [{"kty": "OKP", "crv": "Ed25519", "x": self._x, "kid": self.kid, "use": "sig", "alg": "EdDSA"}]}
