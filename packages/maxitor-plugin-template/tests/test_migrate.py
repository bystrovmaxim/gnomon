# packages/maxitor-plugin-template/tests/test_migrate.py
"""The migrations: each file runs once, in its own transaction, and a file edited after it ran stops the run."""

import hashlib
from contextlib import asynccontextmanager

import pytest

from maxitor_notes import migrate


class LedgerConnection:
    """A connection whose ledger is a dict; it records what ran."""

    def __init__(self, ledger: dict[str, str]) -> None:
        self.ledger = ledger
        self.executed: list[str] = []
        self.transactions = 0
        self.closed = False

    async def execute(self, query: str, *params: str) -> str:
        if query.startswith("INSERT INTO migration_ledger"):
            self.ledger[params[0]] = params[1]
        else:
            self.executed.append(query)
        return "OK"

    async def fetch(self, query: str) -> list[dict[str, str]]:
        return [{"name": name, "sha256": digest} for name, digest in self.ledger.items()]

    @asynccontextmanager
    async def transaction(self):
        self.transactions += 1
        yield

    async def close(self) -> None:
        self.closed = True


def _connect_to(connection, monkeypatch) -> None:
    async def connect(_dsn: str) -> LedgerConnection:
        return connection

    monkeypatch.setattr(migrate.asyncpg, "connect", connect)


def _digest(name: str) -> str:
    return hashlib.sha256((migrate.MIGRATIONS / name).read_text(encoding="utf-8").encode("utf-8")).hexdigest()


async def test_a_new_database_gets_every_migration_once_each_in_its_own_transaction(monkeypatch) -> None:
    connection = LedgerConnection({})
    _connect_to(connection, monkeypatch)
    assert await migrate.apply_migrations("postgresql://plg_notes@db/maxitor") == ["0001_note.sql"]
    assert connection.transactions == 1
    assert connection.ledger == {"0001_note.sql": _digest("0001_note.sql")}
    assert connection.closed


async def test_a_migrated_database_runs_nothing(monkeypatch) -> None:
    connection = LedgerConnection({"0001_note.sql": _digest("0001_note.sql")})
    _connect_to(connection, monkeypatch)
    assert await migrate.apply_migrations("postgresql://plg_notes@db/maxitor") == []
    assert not any("CREATE TABLE note" in query for query in connection.executed)


async def test_a_migration_edited_after_it_ran_stops_the_run(monkeypatch) -> None:
    connection = LedgerConnection({"0001_note.sql": "0" * 64})
    _connect_to(connection, monkeypatch)
    with pytest.raises(migrate.MigrationChangedError):
        await migrate.apply_migrations("postgresql://plg_notes@db/maxitor")
    assert connection.closed
