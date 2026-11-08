# packages/maxitor-plugin-template/src/maxitor_notes/storage/migrations_storage.py
"""MigrationsStorage — the plugin's schema as its migrator sees it: the ledger of migrations and the migrations themselves."""

from __future__ import annotations

from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources.postgres import PostgresStorage

_LEDGER = (
    "CREATE TABLE IF NOT EXISTS migration_ledger ("
    " name text NOT NULL PRIMARY KEY,"
    " sha256 text NOT NULL,"
    " applied_at timestamptz NOT NULL DEFAULT clock_timestamp())"
)


@meta(description="The plugin's schema notes as its migrator sees it, connected as plg_notes")
@entities()
class MigrationsStorage(PostgresStorage):
    """
    AI-CORE-BEGIN
    ROLE: Keep the ledger of the plugin's migrations and run a migration with its record.
    CONTRACT: ``recorded`` creates the ledger when it is missing and answers name → sha256; ``apply`` runs one
    migration and records it in one transaction.
    INVARIANTS: The ledger is a table of mechanics, without versions.
    AI-CORE-END
    """

    async def recorded(self) -> dict[str, str]:
        """The migrations that have run, by name, with the sha256 they had then."""
        await self._execute(_LEDGER)
        rows = await self._fetch("SELECT name, sha256 FROM migration_ledger")
        return {str(row["name"]): str(row["sha256"]) for row in rows}

    async def apply(self, name: str, text: str, digest: str) -> None:
        """Run the migration ``text`` and record it as ``name`` with ``digest``, both or neither."""
        await self.begin()
        try:
            await self._execute(text)
            await self._execute("INSERT INTO migration_ledger (name, sha256) VALUES ($1, $2)", (name, digest))
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
