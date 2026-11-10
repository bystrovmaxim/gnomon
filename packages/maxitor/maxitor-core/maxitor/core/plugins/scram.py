# packages/maxitor/maxitor-core/maxitor/core/plugins/scram.py
"""
The SCRAM-SHA-256 verifier of a password, computed here so that the plain password never reaches the database.

PostgreSQL accepts a verifier in ``CREATE ROLE … PASSWORD``; a statement log then holds the verifier only, from which
the password cannot be read back (FR-026c).
"""

from __future__ import annotations

import base64

import scramp

#: PostgreSQL's default iteration count for SCRAM-SHA-256.
ITERATIONS = 4096


def scram_verifier(password: str) -> str:
    """``SCRAM-SHA-256$<iterations>:<salt>$<stored key>:<server key>``, each part in base64."""
    salt, stored_key, server_key, iterations = scramp.ScramMechanism("SCRAM-SHA-256").make_auth_info(
        password, iteration_count=ITERATIONS
    )

    def b64(raw: bytes) -> str:
        return base64.b64encode(raw).decode("ascii")

    return f"SCRAM-SHA-256${iterations}:{b64(salt)}${b64(stored_key)}:{b64(server_key)}"
