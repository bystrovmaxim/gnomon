# packages/maxitor-plugin-template/src/maxitor_notes/storage/notes_storage.py
"""
NotesStorage — the plugin's own database: its version's schema ``notes_<version>``, reached as its user
``plg_notes_<version>``.

═══════════════════════════════════════════════════════════════════════════════
PURPOSE
═══════════════════════════════════════════════════════════════════════════════

Every read and write of the plugin goes through here. Its user sees nothing but its own schema: what it needs of the
core — the organization's lock and change time, the watermark, membership and a member's name — it gets from the
core's functions (``maxitor_plugin_sdk.core_functions``), never from the core's tables. The installer built the
tables from ``schema.yaml``; this storage only reads and writes them.

═══════════════════════════════════════════════════════════════════════════════
VERSIONED STORAGE
═══════════════════════════════════════════════════════════════════════════════

A write is one transaction: the core's ``change_time`` takes the organization's lock — the same lock every writer
of the organization takes, the core's own included — and the time is after the organization's last change in the
core's tables and in this schema. Screens read only ``note_versions``, at one moment, with the moment condition and
``organization_id`` in every condition. No SQL names a schema: the user's ``search_path`` is its schema, then the
core's schema of functions.
"""

from __future__ import annotations

from typing import Any, cast
from uuid import uuid4

from maxitor_plugin_sdk.core_functions import MEMBER_ORGANIZATION_SQL, change_time_sql, member_name, watermark_sql
from maxitor_plugin_sdk.moments import in_force, moment_text

from aoa.action_machine.graph.core.exclude_graph_model import exclude_graph_model
from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources.postgres import PostgresStorage
from aoa.action_machine.resources.sql import SqlStorageWrapper
from maxitor_notes.entities.note_author_entity import NoteAuthorCoreEntity
from maxitor_notes.entities.note_entity import NoteCoreEntity
from maxitor_notes.notes_refusal_error import NotesRefusalError

#: The plugin's version tables: its change time and watermark follow them.
VERSION_TABLES = ("note_versions",)


#: Connection key under which actions receive the storage.
NOTES_CONNECTION_KEY = "notes"

@meta(description="The plugin's own schema, written as its version's user; the core reached only by its functions")
@entities(NoteCoreEntity, NoteAuthorCoreEntity)
class NotesStorage(PostgresStorage):
    """
    AI-CORE-BEGIN
    ROLE: The database of the plugin ``notes``.
    CONTRACT: ``organization_of`` asks the core's membership function; ``add_note``, ``edit_note`` and
    ``delete_note`` write a note and its versions in one transaction and return the change time; ``notes_of_item`` and ``note_authors`` read the
    version tables at one moment, the watermark when no moment is given.
    INVARIANTS: Reads and writes only its own schema; ``organization_id`` in every condition; a moment travels as a
        string.
    AI-CORE-END
    """

    @classmethod
    def get_wrapper_class(cls) -> type[NotesStorageWrapper]:
        """A nested action receives the wrapper: it reads and writes, but never opens or ends a transaction."""
        return NotesStorageWrapper

    async def organization_of(self, code: str, user_id: str) -> str | None:
        """The id of the organization ``code`` if ``user_id`` is a member of it now, else ``None``."""
        value = await self._fetchval(MEMBER_ORGANIZATION_SQL, (code, user_id))
        return None if value is None else str(value)

    async def add_note(self, organization_id: str, item_id: str, writer_id: str, body: str, operation: str) -> str:
        """Write a new note and its first version in one transaction; return the change time."""
        await self.begin()
        try:
            changed_at = await self._fetchval(change_time_sql(VERSION_TABLES), (organization_id,))
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
            moment = await self._fetchval(f"SELECT {moment_text('$1::timestamptz')}", (changed_at,))
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return str(moment)

    async def edit_note(self, organization_id: str, note_id: str, body: str, base_moment: str, editor_id: str, operation: str) -> str:
        """
        Change the text of a note the editor saw at ``base_moment``; return the change time.

        One transaction after the organization's lock: the current row is locked; a note deleted since, or changed by
        someone else after ``base_moment``, is refused and nothing is written; the same text writes nothing. Otherwise
        the open version closes and the new one opens, both at the change time.
        """
        await self.begin()
        try:
            changed_at, now = await self._change_time(organization_id, base_moment)
            since = await self._open_version(organization_id, note_id, base_moment)
            if since["body"] == body:
                await self.rollback()
                return str(since["since"])
            await self._execute(
                "UPDATE note SET body = $3, updated_at = $4 WHERE organization_id = $1::text::uuid AND id = $2::text::uuid",
                (organization_id, note_id, body, changed_at),
            )
            await self._close_version(organization_id, note_id, changed_at, editor_id, operation)
            await self._execute(
                "INSERT INTO note_versions (organization_id, id, valid_from_at, valid_to_at, author_id, operation,"
                " item_id, writer_id, body, created_at, updated_at)"
                " SELECT organization_id, id, $3, NULL, $4::text::uuid, $5, item_id, writer_id, body, created_at, updated_at"
                " FROM note WHERE organization_id = $1::text::uuid AND id = $2::text::uuid"
                " ON CONFLICT (organization_id, id, valid_from_at) DO UPDATE SET body = EXCLUDED.body, updated_at = EXCLUDED.updated_at",
                (organization_id, note_id, changed_at, editor_id, operation),
            )
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return now

    async def delete_note(self, organization_id: str, note_id: str, base_moment: str, editor_id: str, operation: str) -> str:
        """
        Delete a note the editor saw at ``base_moment``; return the change time.

        The same checks as an edit; the current row is deleted and its open version closed with who deleted it and by
        which action — no new version. At every earlier moment the note is still there.
        """
        await self.begin()
        try:
            changed_at, now = await self._change_time(organization_id, base_moment)
            await self._open_version(organization_id, note_id, base_moment)
            await self._execute(
                "DELETE FROM note WHERE organization_id = $1::text::uuid AND id = $2::text::uuid", (organization_id, note_id)
            )
            await self._close_version(organization_id, note_id, changed_at, editor_id, operation)
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return now

    async def _change_time(self, organization_id: str, base_moment: str) -> tuple[Any, str]:
        """The change time after the organization's lock, and it as a moment; a ``base_moment`` not come yet is refused."""
        changed_at = await self._fetchval(change_time_sql(VERSION_TABLES), (organization_id,))
        now = str(await self._fetchval(f"SELECT {moment_text('$1::timestamptz')}", (changed_at,)))
        if base_moment >= now:
            raise NotesRefusalError("moment_not_come", 422, watermark=now)
        return changed_at, now

    async def _open_version(self, organization_id: str, note_id: str, base_moment: str) -> Any:
        """
        The note's open version, its current row locked; refused when the note is deleted, or changed by someone
        else after ``base_moment``. A changing action reads the current table; the version tells only when and who.
        """
        row = await self._fetchrow(
            "SELECT id FROM note WHERE organization_id = $1::text::uuid AND id = $2::text::uuid FOR UPDATE",
            (organization_id, note_id),
        )
        if row is None:
            closed = await self._fetchrow(
                f"SELECT {member_name('organization_id', 'closed_by', 'valid_to_at')} AS deleted_by,"
                f" {moment_text('valid_to_at')} AS deleted_at FROM note_versions"
                " WHERE organization_id = $1::text::uuid AND id = $2::text::uuid AND closed_by IS NOT NULL"
                " ORDER BY valid_to_at DESC LIMIT 1",
                (organization_id, note_id),
            )
            if closed is None:
                raise NotesRefusalError("no_such_note", 404)
            raise NotesRefusalError("deleted", 409, deleted_by=closed["deleted_by"], deleted_at=closed["deleted_at"])
        version = await self._fetchrow(
            f"SELECT {moment_text('valid_from_at')} AS since, body,"
            f" {member_name('organization_id', 'author_id', 'valid_from_at')} AS changed_by FROM note_versions"
            " WHERE organization_id = $1::text::uuid AND id = $2::text::uuid AND valid_to_at IS NULL",
            (organization_id, note_id),
        )
        if version["since"] > base_moment:
            raise NotesRefusalError("changed_since", 409, changed_by=version["changed_by"], changed_at=version["since"])
        return version

    async def _close_version(self, organization_id: str, note_id: str, changed_at: Any, editor_id: str, operation: str) -> None:
        """Close the note's open version at the change time, with who closed it and by which action."""
        await self._execute(
            "UPDATE note_versions SET valid_to_at = $3, closed_by = $4::text::uuid, closed_operation = $5"
            " WHERE organization_id = $1::text::uuid AND id = $2::text::uuid AND valid_to_at IS NULL AND valid_from_at < $3",
            (organization_id, note_id, changed_at, editor_id, operation),
        )

    async def notes_of_item(self, organization_id: str, item_id: str, moment: str | None, writer_id: str | None) -> list[NoteCoreEntity]:
        """The notes of ``item_id`` at ``moment`` (the watermark when ``None``), of one writer when ``writer_id`` is given."""
        at = await self._moment(organization_id, moment)
        if at is None:
            return []
        when = "$3::text::timestamptz"
        rows = await self._fetch(
            f"SELECT n.id::text AS id, n.item_id::text AS item_id, n.writer_id::text AS writer_id,"
            f" {member_name('n.organization_id', 'n.writer_id', when)} AS writer_name, n.body AS body,"
            f" {moment_text('n.updated_at')} AS updated_at, {moment_text('n.valid_from_at')} AS since"
            f" FROM note_versions n"
            f" WHERE n.organization_id = $1::text::uuid AND n.item_id = $2::text::uuid AND {in_force('n', when)}"
            f" AND ($4::text IS NULL OR n.writer_id = $4::text::uuid)"
            f" ORDER BY n.updated_at, n.id",
            (organization_id, item_id, at, writer_id),
        )
        return [NoteCoreEntity(**_mapping(row)) for row in rows]

    async def note_authors(self, organization_id: str, item_id: str, moment: str | None, limit: int, after: str | None) -> list[NoteAuthorCoreEntity]:
        """The writers of the notes of ``item_id`` at ``moment``, ordered by id, ``limit`` of them after ``after``."""
        at = await self._moment(organization_id, moment)
        if at is None:
            return []
        when = "$3::text::timestamptz"
        rows = await self._fetch(
            f"SELECT DISTINCT n.writer_id::text AS id, {member_name('n.organization_id', 'n.writer_id', when)} AS name"
            f" FROM note_versions n"
            f" WHERE n.organization_id = $1::text::uuid AND n.item_id = $2::text::uuid AND {in_force('n', when)}"
            f" AND ($4::text IS NULL OR n.writer_id > $4::text::uuid)"
            f" ORDER BY id LIMIT $5",
            (organization_id, item_id, at, after, limit),
        )
        return [NoteAuthorCoreEntity(**_mapping(row)) for row in rows]

    async def _moment(self, organization_id: str, moment: str | None) -> str | None:
        """
        The moment a read answers at: the watermark when none is given; a given moment later than the watermark is
        refused, because its answer could still change. ``None`` before the organization's first change.
        """
        watermark = await self._watermark(organization_id)
        if moment is None:
            return watermark
        if watermark is None or moment > watermark:
            raise NotesRefusalError("moment_not_come", 422, watermark=watermark)
        return moment

    async def _watermark(self, organization_id: str) -> str | None:
        """The last change of the organization in the core's tables and this schema, as a moment string; ``None``
        before the first."""
        value = await self._fetchval(
            f"SELECT {moment_text('w')} FROM ({watermark_sql(VERSION_TABLES)} AS w) AS mark", (organization_id,)
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

    async def edit_note(self, organization_id: str, note_id: str, body: str, base_moment: str, editor_id: str, operation: str) -> str:
        """Pass on the wrapped storage's edit."""
        return await self._storage().edit_note(organization_id, note_id, body, base_moment, editor_id, operation)

    async def delete_note(self, organization_id: str, note_id: str, base_moment: str, editor_id: str, operation: str) -> str:
        """Pass on the wrapped storage's deletion."""
        return await self._storage().delete_note(organization_id, note_id, base_moment, editor_id, operation)

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
