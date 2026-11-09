# packages/maxitor/maxitor-core/maxitor/core/passwords.py
"""
Passwords: the rules a new password keeps, and its Argon2id hash.

A password reaches the core only as a ``SecretStr`` and leaves this module only as a hash; it is never written to
a log, an event, an error or a ``repr``.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

MIN_LENGTH = 10
_HASHER = PasswordHasher()
#: A hash to verify against when the address has no password, so a wrong address takes as long as a wrong password.
_DUMMY = _HASHER.hash("an unused password that matches nothing")


@lru_cache(maxsize=1)
def _common() -> frozenset[str]:
    text = Path(__file__).with_name("common-passwords.txt").read_text(encoding="utf-8")
    return frozenset(line.strip().lower() for line in text.splitlines() if line.strip() and not line.startswith("#"))


def broken_rule(email: str, password: str) -> str | None:
    """The rule ``password`` breaks, in words for the page, or ``None`` when it keeps them all."""
    if len(password) < MIN_LENGTH:
        return f"Too short: at least {MIN_LENGTH} characters."
    if password.strip().lower() == email.strip().lower() or password.strip().lower() == email.split("@")[0].lower():
        return "It must not be your email."
    if password.lower() in _common():
        return "Too common: choose a password others do not use."
    return None


def hash_password(password: str) -> str:
    """The Argon2id hash of ``password``."""
    return _HASHER.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """Whether ``password`` matches ``password_hash``; with no hash, the same work and ``False``."""
    try:
        return _HASHER.verify(password_hash or _DUMMY, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
