# packages/maxitor/maxitor-core/tests/test_core_storage.py
"""CoreStorage changes a row and its version together, under one change time, and names no schema."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from maxitor.core.storage.core_storage import CoreStorage

from tests.recording_database import recording_pool

MOMENT = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)


def _storage() -> tuple[CoreStorage, Any]:
    def answer(query: str, params: tuple[Any, ...]) -> Any:
        if query.startswith("SELECT greatest") or query.startswith("SELECT clock_timestamp"):
            return MOMENT
        if query.startswith("SELECT * FROM sign_in"):
            return {"id": "s1", "account_id": "a1", "provider": "email", "provider_subject": "a@b.c", "email": "a@b.c",
                    "password_hash": "$argon2id$secret", "password_changed_at": MOMENT, "added_country": None,
                    "added_ip": "127.0.0.1", "added_at": MOMENT, "last_used_at": None}
        return None

    pool, connection = recording_pool(answer)
    return CoreStorage(pool=pool), connection


async def test_lock_takes_the_lock_then_the_change_time() -> None:
    storage, connection = _storage()
    await storage.open()
    changed_at = await storage.lock("account:a1", [("account_versions", "id", "a1"), ("sign_in_versions", "account_id", "a1")])
    assert changed_at == MOMENT
    queries = connection.queries()
    assert queries[0] == "SELECT pg_advisory_xact_lock(hashtext($1))"
    assert "account_versions" in queries[1] and "sign_in_versions" in queries[1]
    assert "+ interval '1 microsecond'" in queries[1]


async def test_insert_opens_the_first_version() -> None:
    storage, connection = _storage()
    await storage.open()
    row = {"id": "a1", "name": "Anna", "email": "a@b.c", "policy_version": 1, "policy_accepted_at": MOMENT,
           "policy_accepted_ip": "127.0.0.1", "created_at": MOMENT, "updated_at": None}
    await storage.insert("account", row, MOMENT, "a1", "CreateAccountAction")
    q = connection.queries()
    assert q[0].startswith("INSERT INTO account (id, name")
    assert q[1].startswith("INSERT INTO account_versions (id, valid_from_at, valid_to_at, author_id, operation, name")


async def test_the_password_hash_never_reaches_a_version() -> None:
    storage, connection = _storage()
    await storage.open()
    row = {"id": "s1", "account_id": "a1", "provider": "email", "provider_subject": "a@b.c", "email": "a@b.c",
           "password_hash": "$argon2id$secret", "password_changed_at": MOMENT, "added_country": None,
           "added_ip": "127.0.0.1", "added_at": MOMENT, "last_used_at": None}
    await storage.insert("sign_in", row, MOMENT, "a1", "CreateAccountAction")
    await storage.update("sign_in", {"id": "s1"}, {"password_hash": "$argon2id$new"}, MOMENT, "a1", "ResetPasswordAction")
    for query, params in connection.statements:
        if "sign_in_versions" in query:
            assert "password_hash" not in query
            assert not any(isinstance(p, str) and p.startswith("$argon2id") for p in params)


async def test_update_closes_then_opens() -> None:
    storage, connection = _storage()
    await storage.open()
    await storage.update("sign_in", {"id": "s1"}, {"email": "x@y.z"}, MOMENT, "a1", "LinkEmailAction")
    q = connection.queries()
    assert q[0].startswith("UPDATE sign_in_versions SET valid_to_at = $1")
    assert q[1].startswith("UPDATE sign_in SET email = $1 WHERE id = $2")
    assert q[3].startswith("INSERT INTO sign_in_versions")


async def test_organization_rows_are_keyed_by_organization() -> None:
    storage, connection = _storage()
    await storage.open()
    row = {"organization_id": "o1", "id": "u1", "account_id": "a1", "name": "Anna", "is_admin": True,
           "status": "active", "created_at": MOMENT, "updated_at": None}
    await storage.insert('"user"', row, MOMENT, "u1", "RegisterOrganizationAction")
    q = connection.queries()
    assert q[1].startswith("INSERT INTO user_versions (organization_id, id, valid_from_at")


async def test_no_statement_names_a_schema() -> None:
    storage, connection = _storage()
    await storage.open()
    await storage.lock("organization:o1", [("organization_versions", "organization_id", "o1")])
    await storage.delete("boundary", {"organization_id": "o1", "id": "b1"}, MOMENT, "u1", "RemoveBoundaryAction")
    for query in connection.queries():
        assert "platform." not in query and "organization." not in query and "public." not in query
