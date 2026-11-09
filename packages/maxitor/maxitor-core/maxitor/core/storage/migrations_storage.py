# packages/maxitor/maxitor-core/maxitor/core/storage/migrations_storage.py
"""MigrationsStorage — the core's database as its migrator sees it: the ledger of migrations and the migrations."""

from __future__ import annotations

from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources.postgres import PostgresStorage

#: The ledger lives in the schema platform; the migrator creates it under that schema's search_path.
_LEDGER = (
    "CREATE TABLE IF NOT EXISTS migration ("
    " name text NOT NULL PRIMARY KEY,"
    " sha256 text NOT NULL,"
    " applied_at timestamptz NOT NULL)"
)


@meta(description="The core's database as its migrator sees it, connected as maxitor_core")
@entities()
class MigrationsStorage(PostgresStorage):
    """
    AI-CORE-BEGIN
    ROLE: Keep the ledger of the core's migrations and run one migration with its record.
    CONTRACT: ``recorded`` creates the ledger when missing and answers name → sha256; ``apply`` sets the
        folder's search_path, runs the migration and records it, in one transaction.
    INVARIANTS: The ledger is a table of mechanics, without versions.
    AI-CORE-END
    """

    async def recorded(self, platform_search_path: str) -> dict[str, str]:
        """The migrations that have run, by name, with the sha256 they had then."""
        await self.begin()
        try:
            await self._execute(f"SET LOCAL search_path TO {platform_search_path}")
            await self._execute(_LEDGER)
            rows = await self._fetch("SELECT name, sha256 FROM migration")
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return {str(row["name"]): str(row["sha256"]) for row in rows}

    async def apply(self, search_path: str, name: str, text: str, digest: str) -> None:
        """Run the migration ``text`` under ``search_path`` and record it as ``name``, both or neither."""
        await self.begin()
        try:
            await self._execute(f"SET LOCAL search_path TO {search_path}")
            await self._execute(text)
            await self._execute(
                "INSERT INTO migration (name, sha256, applied_at) VALUES ($1, $2, clock_timestamp())",
                (name, digest),
            )
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
