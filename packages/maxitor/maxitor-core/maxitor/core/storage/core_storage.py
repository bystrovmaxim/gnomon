# packages/maxitor/maxitor-core/maxitor/core/storage/core_storage.py
"""
CoreStorage — the core's database: the schemas platform and organization, written as the role maxitor_core.

═══════════════════════════════════════════════════════════════════════════════
VERSIONED STORAGE
═══════════════════════════════════════════════════════════════════════════════
A change is one transaction: a lock, one change time, the current row and its version. The schema platform
locks by the account (``account:<id>``), the schema organization by the organization (``organization:<id>``).
The change time is the clock, or one microsecond after the last version opened or closed under the same lock,
whichever is later, so the versions of one lock never share a moment. Opening a version copies the row's
columns except those ``_UNVERSIONED`` names (the password's hash is never kept in history).

No SQL names a schema: the role's search_path is organization, platform, extensions.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

from maxitor.core.entities import (
    AccountCoreEntity,
    BoundaryCoreEntity,
    OrganizationCoreEntity,
    SignInAttemptCoreEntity,
    SignInCodeCoreEntity,
    SignInCodePurposeEnumEntity,
    SignInCoreEntity,
    SignInProviderEnumEntity,
    UserCoreEntity,
)

from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources.postgres import PostgresStorage

#: Connection key under which actions receive the storage.
CORE_CONNECTION_KEY = "core"

#: Columns a table keeps that its version table does not.
_UNVERSIONED: Mapping[str, frozenset[str]] = {"sign_in": frozenset({"password_hash", "last_used_at"})}

#: The version table of each versioned table, and the columns that name one row of it.
VERSIONED: Mapping[str, tuple[str, tuple[str, ...]]] = {
    "account": ("account_versions", ("id",)),
    "sign_in": ("sign_in_versions", ("id",)),
    "organization": ("organization_versions", ("organization_id",)),
    '"user"': ("user_versions", ("organization_id", "id")),
    "boundary": ("boundary_versions", ("organization_id", "id")),
    "boundary_user": ("boundary_user_versions", ("organization_id", "boundary_id", "user_id")),
}

#: How a current table's key columns are named in it, when they differ from its version table's.
_ROW_KEY: Mapping[str, tuple[str, ...]] = {"organization": ("id",)}


def _placeholders(start: int, count: int) -> str:
    return ", ".join(f"${i}" for i in range(start, start + count))


@meta(description="The core's database: the schemas platform and organization, written as the role maxitor_core")
@entities(
    AccountCoreEntity,
    SignInCoreEntity,
    SignInProviderEnumEntity,
    SignInCodePurposeEnumEntity,
    SignInCodeCoreEntity,
    SignInAttemptCoreEntity,
    OrganizationCoreEntity,
    UserCoreEntity,
    BoundaryCoreEntity,
)
class CoreStorage(PostgresStorage):
    """
    AI-CORE-BEGIN
    ROLE: The one storage of the core; every read and write of accounts, sign-ins, codes, organizations and users.
    CONTRACT: ``lock`` takes a lock for the rest of the transaction and answers the change time; ``insert``,
        ``update`` and ``delete`` change one row of a versioned table and its version together; the readers and
        writers of the actions build on them.
    INVARIANTS: Names no schema in SQL; a versioned row never changes without its version; public stays empty.
    AI-CORE-END
    """

    async def lock(self, key: str, versions: Sequence[tuple[str, str, Any]]) -> datetime:
        """
        Lock ``key`` until the transaction ends and answer its change time.

        ``versions`` names, for each version table the lock guards, the column and value that select its rows;
        the change time is after every version opened or closed there.
        """
        await self._fetchval("SELECT pg_advisory_xact_lock(hashtext($1))", (key,))
        parts: list[str] = []
        params: list[Any] = []
        for table, column, value in versions:
            params.append(value)
            n = len(params)
            parts.append(f"SELECT max(valid_from_at) AS t FROM {table} WHERE {column} = ${n}")
            parts.append(f"SELECT max(valid_to_at) FROM {table} WHERE {column} = ${n}")
        if not parts:
            value = await self._fetchval("SELECT clock_timestamp()")
            return value  # type: ignore[no-any-return]
        query = (
            "SELECT greatest(clock_timestamp(), coalesce(max(t), '-infinity'::timestamptz) + interval '1 microsecond')"
            f" FROM ({' UNION ALL '.join(parts)}) AS last_changes"
        )
        value = await self._fetchval(query, tuple(params))
        return value  # type: ignore[no-any-return]

    async def insert(self, table: str, row: Mapping[str, Any], changed_at: datetime, author: str | None, operation: str) -> None:
        """Insert ``row`` into ``table`` and open its first version at ``changed_at``."""
        columns = list(row)
        await self._execute(
            f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({_placeholders(1, len(columns))})",
            tuple(row.values()),
        )
        await self._open_version(table, row, changed_at, author, operation)

    async def update(
        self,
        table: str,
        key: Mapping[str, Any],
        changes: Mapping[str, Any],
        changed_at: datetime,
        author: str | None,
        operation: str,
    ) -> None:
        """Change the row of ``table`` that ``key`` names: close its version, update it, open the next version."""
        await self._close_version(table, key, changed_at, author, operation)
        sets = ", ".join(f"{column} = ${i}" for i, column in enumerate(changes, start=1))
        where = " AND ".join(f"{column} = ${i}" for i, column in enumerate(key, start=len(changes) + 1))
        await self._execute(f"UPDATE {table} SET {sets} WHERE {where}", (*changes.values(), *key.values()))
        row = await self._fetchrow(
            f"SELECT * FROM {table} WHERE {' AND '.join(f'{c} = ${i}' for i, c in enumerate(key, start=1))}",
            tuple(key.values()),
        )
        await self._open_version(table, dict(row), changed_at, author, operation)

    async def delete(self, table: str, key: Mapping[str, Any], changed_at: datetime, author: str | None, operation: str) -> None:
        """Close the version of the row ``key`` names and delete the row; its history stays."""
        await self._close_version(table, key, changed_at, author, operation)
        where = " AND ".join(f"{column} = ${i}" for i, column in enumerate(key, start=1))
        await self._execute(f"DELETE FROM {table} WHERE {where}", tuple(key.values()))

    async def _open_version(self, table: str, row: Mapping[str, Any], changed_at: datetime, author: str | None, operation: str) -> None:
        versions, version_key = VERSIONED[table]
        row_key = _ROW_KEY.get(table, version_key)
        skip = _UNVERSIONED.get(table, frozenset())
        data = {c: v for c, v in row.items() if c not in skip and c not in row_key}
        keys = dict(zip(version_key, (row[c] for c in row_key), strict=True))
        columns = [*keys, "valid_from_at", "valid_to_at", "author_id", "operation", *data]
        values = [*keys.values(), changed_at, None, author, operation, *data.values()]
        await self._execute(
            f"INSERT INTO {versions} ({', '.join(columns)}) VALUES ({_placeholders(1, len(columns))})",
            tuple(values),
        )

    async def _close_version(self, table: str, key: Mapping[str, Any], changed_at: datetime, author: str | None, operation: str) -> None:
        versions, version_key = VERSIONED[table]
        row_key = _ROW_KEY.get(table, version_key)
        mapped = dict(zip(version_key, (key[c] for c in row_key), strict=True))
        where = " AND ".join(f"{column} = ${i}" for i, column in enumerate(mapped, start=4))
        await self._execute(
            f"UPDATE {versions} SET valid_to_at = $1, closed_by = $2, closed_operation = $3"
            f" WHERE {where} AND valid_to_at IS NULL",
            (changed_at, author, operation, *mapped.values()),
        )
