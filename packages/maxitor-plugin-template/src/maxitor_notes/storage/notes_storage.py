# packages/maxitor-plugin-template/src/maxitor_notes/storage/notes_storage.py
"""
NotesStorage — the plugin's own database: the schema ``notes``, reached as the role ``plg_notes``.

═══════════════════════════════════════════════════════════════════════════════
PURPOSE
═══════════════════════════════════════════════════════════════════════════════

Every read and write of the plugin goes through here. It writes only its own schema; it reads its own
version tables and the core's tables of organizations and members, which every plugin role may read.

═══════════════════════════════════════════════════════════════════════════════
VERSIONED STORAGE
═══════════════════════════════════════════════════════════════════════════════

A write is one transaction: the organization's lock, one change time, the current row and its version.
Screens read only ``note_versions``, at one moment, with the moment condition at every table and
``organization_id`` in every condition.

Two pieces belong to ``maxitor-plugin-sdk`` once it exists (bystrovmaxim/gnomon#73): the writing
functions, and the watermark over the version tables of every installed schema. Until then this
storage writes its rows itself and takes the last change of its own table as the watermark; the core's
tables it joins are read at the same moment.

═══════════════════════════════════════════════════════════════════════════════
THE CORE'S TABLES
═══════════════════════════════════════════════════════════════════════════════

The core keeps organizations and their users in its schema ``organization`` (bystrovmaxim/gnomon#73):
``organization (id, code)``, ``"user" (organization_id, id, account_id, name, status)`` and ``user_versions``.
A note's writer is the person's account, the ``sub`` of the plugin's token, matched against ``"user".account_id``.
No SQL here names that schema: its name comes from ``MAXITOR_SCHEMA_ORGANIZATION`` and enters SQL only through
``_identifier``. This storage only reads the core's tables.
"""

from __future__ import annotations

import os
from typing import Any, cast
from uuid import uuid4

from aoa.action_machine.graph.core.exclude_graph_model import exclude_graph_model
from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources.postgres import PostgresStorage
from aoa.action_machine.resources.sql import SqlStorageWrapper
from maxitor_notes.entities.note_author_entity import NoteAuthorCoreEntity
from maxitor_notes.entities.note_entity import NoteCoreEntity


def _identifier(name: str) -> str:
    """Quote ``name`` as a PostgreSQL identifier, doubling any double quote inside it."""
    if not name or "\x00" in name:
        raise ValueError("An identifier must be a non-empty name without NUL.")
    return '"' + name.replace('"', '""') + '"'


def _core(table: str) -> str:
    """A table of the core's schema, its schema named by the environment."""
    return f"{_identifier(os.environ.get('MAXITOR_SCHEMA_ORGANIZATION', 'organization'))}.{_identifier(table)}"


#: Connection key under which actions receive the storage.
NOTES_CONNECTION_KEY = "notes"

#: A time as the client sees it: ISO 8601 in UTC with microseconds, compared as a string, never as a Date.
_MOMENT = "to_char({} AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')"


def _in_force(alias: str, moment: str) -> str:
    """The moment condition of one version table, in the form a B-tree serves."""
    return f"{alias}.valid_from_at <= {moment} AND ({alias}.valid_to_at IS NULL OR {alias}.valid_to_at > {moment})"


@meta(description="The plugin's own schema notes, written as plg_notes; the core's members read alongside")
@entities(NoteCoreEntity, NoteAuthorCoreEntity)
class NotesStorage(PostgresStorage):
    """
    AI-CORE-BEGIN
    ROLE: The database of the plugin ``notes``.
    CONTRACT: ``organization_of`` checks membership on the current tables; ``add_note`` writes a note and its
    version in one transaction and returns the change time; ``notes_of_item`` and ``note_authors`` read the
    version tables at one moment, the watermark when no moment is given.
    INVARIANTS: Writes only the schema ``notes``; ``organization_id`` in every condition; a moment travels as a string.
    AI-CORE-END
    """

    @classmethod
    def get_wrapper_class(cls) -> type[NotesStorageWrapper]:
        """A nested action receives the wrapper: it reads and writes, but never opens or ends a transaction."""
        return NotesStorageWrapper

    async def organization_of(self, code: str, user_id: str) -> str | None:
        """The id of the organization ``code`` if ``user_id`` is a member of it now, else ``None``."""
        value = await self._fetchval(
            f"SELECT o.id::text FROM {_core('organization')} o"
            f" JOIN {_core('user')} m ON m.organization_id = o.id"
            " WHERE o.code = $1 AND m.account_id = $2::text::uuid AND m.status = 'active'",
            (code, user_id),
        )
        return None if value is None else str(value)

    async def add_note(self, organization_id: str, item_id: str, writer_id: str, body: str, operation: str) -> str:
        """Write a new note and its first version in one transaction; return the change time."""
        await self.begin()
        try:
            await self._fetchval("SELECT pg_advisory_xact_lock(hashtext($1))", (organization_id,))
            changed_at = await self._fetchval(
                "SELECT greatest(clock_timestamp(), coalesce(max(t), '-infinity'::timestamptz) + interval '1 microsecond')"
                " FROM (SELECT max(valid_from_at) AS t FROM note_versions WHERE organization_id = $1::text::uuid"
                " UNION ALL SELECT max(valid_to_at) FROM note_versions WHERE organization_id = $1::text::uuid) AS last_changes",
                (organization_id,),
            )
            note_id = str(uuid4())
            await self._execute(
                "INSERT INTO note (id, organization_id, item_id, writer_id, body, created_at, updated_at)"
                " VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid, $4::text::uuid, $5, $6, $6)",
                (note_id, organization_id, item_id, writer_id, body, changed_at),
            )
            await self._execute(
                "INSERT INTO note_versions (organization_id, id, valid_from_at, valid_to_at, author_id, operation,"
                " item_id, writer_id, body, created_at, updated_at)"
                " SELECT organization_id, id, $3, NULL, $4::text::uuid, $5, item_id, writer_id, body, created_at, updated_at"
                " FROM note WHERE organization_id = $1::text::uuid AND id = $2::text::uuid",
                (organization_id, note_id, changed_at, writer_id, operation),
            )
            moment = await self._fetchval(f"SELECT {_MOMENT.format('$1::timestamptz')}", (changed_at,))
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return str(moment)

    async def notes_of_item(self, organization_id: str, item_id: str, moment: str | None, writer_id: str | None) -> list[NoteCoreEntity]:
        """The notes of ``item_id`` at ``moment`` (the watermark when ``None``), of one writer when ``writer_id`` is given."""
        at = moment or await self._watermark(organization_id)
        if at is None:
            return []
        when = "$3::text::timestamptz"
        rows = await self._fetch(
            f"SELECT n.id::text AS id, n.item_id::text AS item_id, n.writer_id::text AS writer_id,"
            f" coalesce(m.name, '') AS writer_name, n.body AS body, {_MOMENT.format('n.updated_at')} AS updated_at"
            f" FROM note_versions n"
            f" LEFT JOIN {_core('user_versions')} m ON m.organization_id = n.organization_id AND m.account_id = n.writer_id"
            f" AND {_in_force('m', when)}"
            f" WHERE n.organization_id = $1::text::uuid AND n.item_id = $2::text::uuid AND {_in_force('n', when)}"
            f" AND ($4::text IS NULL OR n.writer_id = $4::text::uuid)"
            f" ORDER BY n.updated_at, n.id",
            (organization_id, item_id, at, writer_id),
        )
        return [NoteCoreEntity(**_mapping(row)) for row in rows]

    async def note_authors(self, organization_id: str, item_id: str, moment: str | None, limit: int, after: str | None) -> list[NoteAuthorCoreEntity]:
        """The writers of the notes of ``item_id`` at ``moment``, ordered by id, ``limit`` of them after ``after``."""
        at = moment or await self._watermark(organization_id)
        if at is None:
            return []
        when = "$3::text::timestamptz"
        rows = await self._fetch(
            f"SELECT DISTINCT n.writer_id::text AS id, coalesce(m.name, '') AS name"
            f" FROM note_versions n"
            f" LEFT JOIN {_core('user_versions')} m ON m.organization_id = n.organization_id AND m.account_id = n.writer_id"
            f" AND {_in_force('m', when)}"
            f" WHERE n.organization_id = $1::text::uuid AND n.item_id = $2::text::uuid AND {_in_force('n', when)}"
            f" AND ($4::text IS NULL OR n.writer_id > $4::text::uuid)"
            f" ORDER BY id LIMIT $5",
            (organization_id, item_id, at, after, limit),
        )
        return [NoteAuthorCoreEntity(**_mapping(row)) for row in rows]

    async def _watermark(self, organization_id: str) -> str | None:
        """The last change of the organization in this schema, as a moment string; ``None`` before the first."""
        value = await self._fetchval(
            f"SELECT {_MOMENT.format('max(t)')} FROM ("
            " SELECT max(valid_from_at) AS t FROM note_versions WHERE organization_id = $1::text::uuid"
            " UNION ALL SELECT max(valid_to_at) FROM note_versions WHERE organization_id = $1::text::uuid) AS last_changes",
            (organization_id,),
        )
        return None if value is None else str(value)


def _mapping(row: Any) -> dict[str, Any]:
    """A driver row as a plain mapping of its columns."""
    return dict(row)


@exclude_graph_model
class NotesStorageWrapper(SqlStorageWrapper):
    """What a nested action receives: the storage's reads and writes, without control of the transaction."""

    def _storage(self) -> NotesStorage:
        """The storage this wrapper stands for."""
        return cast(NotesStorage, self._connection_manager)

    async def organization_of(self, code: str, user_id: str) -> str | None:
        """Pass on the wrapped storage's membership check."""
        return await self._storage().organization_of(code, user_id)

    async def notes_of_item(self, organization_id: str, item_id: str, moment: str | None, writer_id: str | None) -> list[NoteCoreEntity]:
        """Pass on the wrapped storage's read of an item's notes."""
        return await self._storage().notes_of_item(organization_id, item_id, moment, writer_id)

    async def note_authors(self, organization_id: str, item_id: str, moment: str | None, limit: int, after: str | None) -> list[NoteAuthorCoreEntity]:
        """Pass on the wrapped storage's read of an item's writers."""
        return await self._storage().note_authors(organization_id, item_id, moment, limit, after)

    @classmethod
    def get_wrapper_class(cls) -> type[NotesStorageWrapper]:
        """Deeper nesting receives the same wrapper."""
        return NotesStorageWrapper
