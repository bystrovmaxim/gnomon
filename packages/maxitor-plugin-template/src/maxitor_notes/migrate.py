# packages/maxitor-plugin-template/src/maxitor_notes/migrate.py
"""
The plugin's migrations: Maxitor's installer runs ``upgrade`` in a process of its own, connected as ``plg_notes``.

Each file of ``migrations/`` runs once, in name order, in its own transaction, and is recorded in the
mechanics table ``migration_ledger`` with its sha256. A file whose recorded sha256 no longer matches stops the
run: a migration that has run is never edited, a new one is added.
"""

from __future__ import annotations

import asyncio
import hashlib
import os
from pathlib import Path

import asyncpg

MIGRATIONS = Path(__file__).with_name("migrations")

_LEDGER = (
    "CREATE TABLE IF NOT EXISTS migration_ledger ("
    " name text NOT NULL PRIMARY KEY,"
    " sha256 text NOT NULL,"
    " applied_at timestamptz NOT NULL DEFAULT clock_timestamp())"
)


class MigrationChangedError(RuntimeError):
    """A migration that has already run was edited afterwards."""


async def apply_migrations(dsn: str) -> list[str]:
    """Run every migration not yet in the ledger; return the names of those that ran now."""
    connection = await asyncpg.connect(dsn)
    try:
        await connection.execute(_LEDGER)
        recorded = {row["name"]: row["sha256"] for row in await connection.fetch("SELECT name, sha256 FROM migration_ledger")}
        ran: list[str] = []
        for path in sorted(MIGRATIONS.glob("*.sql")):
            text = path.read_text(encoding="utf-8")
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
            if path.name in recorded:
                if recorded[path.name] != digest:
                    raise MigrationChangedError(f"{path.name} changed after it ran")
                continue
            async with connection.transaction():
                await connection.execute(text)
                await connection.execute("INSERT INTO migration_ledger (name, sha256) VALUES ($1, $2)", path.name, digest)
            ran.append(path.name)
        return ran
    finally:
        await connection.close()


def upgrade() -> None:
    """The passport's ``backend.migrate``: migrate the database ``$MAXITOR_PLUGIN_DSN`` and print what ran."""
    for name in asyncio.run(apply_migrations(os.environ["MAXITOR_PLUGIN_DSN"])):
        print(name)
