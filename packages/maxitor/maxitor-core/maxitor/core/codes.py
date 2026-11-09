# packages/maxitor/maxitor-core/maxitor/core/codes.py
"""
One-time codes: six digits, kept only as a keyed hash, with their limits.

A code works ten minutes and five tries. One address gets at most one code a minute and ten an hour, one IP at
most thirty an hour; the same limits hold for confirming an email and for resetting a password.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import timedelta

CODE_LIFETIME = timedelta(minutes=10)
CODE_TRIES = 5
PER_ADDRESS_MINUTE = 1
PER_ADDRESS_HOUR = 10
PER_IP_HOUR = 30
#: How long an ended code stays, so the hourly limit can count it.
KEPT_FOR_COUNTING = timedelta(hours=1)
#: Wrong passwords: per address and per IP within fifteen minutes.
PASSWORD_WINDOW = timedelta(minutes=15)
PASSWORDS_PER_ADDRESS = 10
PASSWORDS_PER_IP = 30


def new_code() -> str:
    """Six random digits."""
    return f"{secrets.randbelow(1_000_000):06d}"


def code_hash(secret: str, email: str, purpose: str, code: str) -> str:
    """The keyed hash of ``code`` for ``email`` and ``purpose``; the code itself is never stored."""
    message = f"{purpose}:{email.lower()}:{code}".encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def same_code(secret: str, email: str, purpose: str, code: str, stored_hash: str) -> bool:
    """Whether ``code`` is the one whose hash is ``stored_hash``, compared in constant time."""
    return hmac.compare_digest(code_hash(secret, email, purpose, code.strip()), stored_hash)


def mask(email: str) -> str:
    """The address as an event may carry it: ``a***@yandex.ru``."""
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"
