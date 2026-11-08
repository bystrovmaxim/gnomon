# packages/maxitor-plugin-template/tests/test_migrate.py
"""The migrations: each file runs once, in its own transaction, and a file edited after it ran stops the run."""

import hashlib

import pytest
from maxitor_notes import migrate
from maxitor_notes.storage.migrations_storage import MigrationsStorage

from tests.recording_database import recording_pool


def _digest(name: str) -> str:
    return hashlib.sha256((migrate.MIGRATIONS / name).read_text(encoding="utf-8").encode("utf-8")).hexdigest()


def _storage(ledger: dict[str, str]):
    def answer(query, params):
        if query.startswith("SELECT name, sha256 FROM migration_ledger"):
            return [{"name": name, "sha256": digest} for name, digest in ledger.items()]
        return None

    pool, connection = recording_pool(answer)
    return MigrationsStorage(pool=pool), connection


async def test_a_new_database_gets_every_migration_once_in_its_own_transaction() -> None:
    storage, connection = _storage({})
    assert await migrate.apply_migrations(storage) == ["0001_note.sql"]
    queries = connection.queries()
    begin = queries.index("BEGIN")
    assert queries[begin + 1].startswith("-- 0001_note.sql")
    assert queries[begin + 2].startswith("INSERT INTO migration_ledger")
    assert connection.statements[begin + 2][1] == ("0001_note.sql", _digest("0001_note.sql"))
    assert queries[begin + 3] == "COMMIT"


async def test_a_migrated_database_runs_nothing() -> None:
    storage, connection = _storage({"0001_note.sql": _digest("0001_note.sql")})
    assert await migrate.apply_migrations(storage) == []
    assert "BEGIN" not in connection.queries()


async def test_a_migration_edited_after_it_ran_stops_the_run() -> None:
    storage, connection = _storage({"0001_note.sql": "0" * 64})
    with pytest.raises(migrate.MigrationChangedError):
        await migrate.apply_migrations(storage)
    assert "BEGIN" not in connection.queries()
