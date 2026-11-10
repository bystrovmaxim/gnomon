# packages/maxitor/maxitor-core/maxitor/core/migrate.py
"""
The core's migrations: ``maxitor-core migrate`` connects as ``maxitor_core`` and brings the database up to date.

The folder ``migrations/platform`` runs first, under the schema platform; ``migrations/organization`` next, under
organization then platform; ``migrations/plugins`` last, under plugins, organization, platform. Each file runs once, in name order, in its own transaction, and is recorded in the
ledger with its sha256. A file whose recorded sha256 no longer matches stops the run: a migration that has run is
never edited, a new one is added.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from maxitor.core.schemas import CoreSchemas
from maxitor.core.storage.migrations_storage import MigrationsStorage

MIGRATIONS = Path(__file__).with_name("migrations")
#: The folders in the order they run.
FOLDERS = ("platform", "organization", "plugins")


class MigrationChangedError(RuntimeError):
    """A migration that has already run was edited afterwards."""


async def apply_migrations(storage: MigrationsStorage, schemas: CoreSchemas) -> list[str]:
    """Run every migration not yet in the ledger; return the names of those that ran now."""
    await storage.open()
    try:
        recorded = await storage.recorded(schemas.search_path("platform"))
        ran: list[str] = []
        for folder in FOLDERS:
            for path in sorted((MIGRATIONS / folder).glob("*.sql")):
                name = f"{folder}/{path.name}"
                text = path.read_text(encoding="utf-8")
                digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
                if name in recorded:
                    if recorded[name] != digest:
                        raise MigrationChangedError(f"{name} changed after it ran")
                    continue
                await storage.apply(schemas.search_path(folder), name, text, digest)
                ran.append(name)
        return ran
    finally:
        await storage.close()
