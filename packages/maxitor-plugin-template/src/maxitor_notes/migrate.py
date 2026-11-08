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

from maxitor_notes.storage.migrations_storage import MigrationsStorage

MIGRATIONS = Path(__file__).with_name("migrations")


class MigrationChangedError(RuntimeError):
    """A migration that has already run was edited afterwards."""


async def apply_migrations(storage: MigrationsStorage) -> list[str]:
    """Run every migration not yet in the ledger; return the names of those that ran now."""
    await storage.open()
    try:
        recorded = await storage.recorded()
        ran: list[str] = []
        for path in sorted(MIGRATIONS.glob("*.sql")):
            text = path.read_text(encoding="utf-8")
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
            if path.name in recorded:
                if recorded[path.name] != digest:
                    raise MigrationChangedError(f"{path.name} changed after it ran")
                continue
            await storage.apply(path.name, text, digest)
            ran.append(path.name)
        return ran
    finally:
        await storage.close()


def upgrade() -> None:
    """The passport's ``backend.migrate``: migrate the database ``$MAXITOR_PLUGIN_DSN`` and print what ran."""
    storage = MigrationsStorage(connection_params=os.environ["MAXITOR_PLUGIN_DSN"])
    for name in asyncio.run(apply_migrations(storage)):
        print(name)
