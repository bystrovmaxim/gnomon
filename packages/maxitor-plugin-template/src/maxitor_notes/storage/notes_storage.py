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
from uuid import UUID, uuid4

from maxitor_plugin_sdk.core_functions import MEMBER_ORGANIZATION_SQL, change_time_sql, member_name, watermark_sql
from maxitor_plugin_sdk.history import Version
from maxitor_plugin_sdk.moments import in_force, moment_text, overlaps

from aoa.action_machine.graph.core.exclude_graph_model import exclude_graph_model
from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources.postgres import PostgresStorage
from aoa.action_machine.resources.sql import SqlStorageWrapper
from maxitor_notes.draft_rules import PublishedNote, decide
from maxitor_notes.entities.item_entry_entity import ItemEntryCoreEntity
from maxitor_notes.entities.milestone_card_entity import MilestoneCardCoreEntity
from maxitor_notes.entities.milestone_entity import MilestoneCoreEntity
from maxitor_notes.entities.note_author_entity import NoteAuthorCoreEntity
from maxitor_notes.entities.note_change_entity import NoteChangeCoreEntity
from maxitor_notes.entities.note_conflict_entity import NoteConflictCoreEntity
from maxitor_notes.entities.note_entity import NoteCoreEntity
from maxitor_notes.entities.revision_entity import RevisionCoreEntity
from maxitor_notes.notes_refusal_error import NotesRefusalError

#: The plugin's version tables: its change time and watermark follow them.
VERSION_TABLES = ("item_versions", "note_versions", "note_change_versions", "revision_versions")


#: Connection key under which actions receive the storage.
NOTES_CONNECTION_KEY = "notes"

#: The icon of every item in the tree.
ITEM_ICON = "folder"

@meta(description="The plugin's own schema, written as its version's user; the core reached only by its functions")
@entities(ItemEntryCoreEntity, NoteCoreEntity, NoteAuthorCoreEntity, RevisionCoreEntity, NoteChangeCoreEntity, NoteConflictCoreEntity, MilestoneCoreEntity, MilestoneCardCoreEntity)
class NotesStorage(PostgresStorage):
    """
    AI-CORE-BEGIN
    ROLE: The database of the plugin ``notes``.
    CONTRACT: ``organization_of`` asks the core's membership function; ``add_item`` and ``rename_item`` write an item
    and its versions, ``add_note``, ``edit_note`` and ``delete_note`` a note and its versions, each in one
    transaction, and return the change time; ``items_at``, ``notes_of_item`` and ``note_authors`` read the
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

    async def item_of(self, organization_id: str, item_id: str) -> bool:
        """Whether ``item_id`` is an item of the organization now; an id that is no uuid is none."""
        try:
            UUID(item_id)
        except ValueError:
            return False
        return bool(
            await self._fetchval(
                "SELECT EXISTS (SELECT 1 FROM item WHERE organization_id = $1::text::uuid AND id = $2::text::uuid)",
                (organization_id, item_id),
            )
        )

    async def add_item(self, organization_id: str, title: str, author_id: str, operation: str) -> tuple[str, str]:
        """
        Write a new item and its first version in one transaction; return its id and the change time.

        The title is read against the current items after the organization's lock, so of two members adding one title
        at once the second is refused; the unique key only guards.
        """
        await self.begin()
        try:
            changed_at = await self._fetchval(change_time_sql(VERSION_TABLES), (organization_id,))
            await self._title_free(organization_id, title, None)
            item_id = str(uuid4())
            await self._execute(
                "INSERT INTO item (id, organization_id, title, created_at, updated_at)"
                " VALUES ($1::text::uuid, $2::text::uuid, $3, $4, $4)",
                (item_id, organization_id, title, changed_at),
            )
            await self._execute(
                "INSERT INTO item_versions (organization_id, id, valid_from_at, valid_to_at, author_id, operation,"
                " title, created_at, updated_at)"
                " SELECT organization_id, id, $3, NULL, $4::text::uuid, $5, title, created_at, updated_at"
                " FROM item WHERE organization_id = $1::text::uuid AND id = $2::text::uuid",
                (organization_id, item_id, changed_at, author_id, operation),
            )
            moment = await self._fetchval(f"SELECT {moment_text('$1::timestamptz')}", (changed_at,))
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return item_id, str(moment)

    async def rename_item(
        self, organization_id: str, item_id: str, title: str, base_moment: str, editor_id: str, operation: str
    ) -> tuple[str, str, bool]:
        """
        Give an item the editor saw at ``base_moment`` a new title; return the old title, the change time and whether
        anything changed.

        One transaction after the organization's lock: the current row is locked; an item changed by someone else
        after ``base_moment`` is refused; the title it has writes nothing and answers its open version's start; a
        title another item has now is refused. Otherwise the open version closes and the new one opens.
        """
        await self.begin()
        try:
            changed_at, now = await self._change_time(organization_id, base_moment)
            row = await self._fetchrow(
                "SELECT title FROM item WHERE organization_id = $1::text::uuid AND id = $2::text::uuid FOR UPDATE",
                (organization_id, item_id),
            )
            if row is None:
                raise NotesRefusalError("no_such_item", 404)
            version = await self._fetchrow(
                f"SELECT {moment_text('valid_from_at')} AS since,"
                f" {member_name('organization_id', 'author_id', 'valid_from_at')} AS changed_by FROM item_versions"
                " WHERE organization_id = $1::text::uuid AND id = $2::text::uuid AND valid_to_at IS NULL",
                (organization_id, item_id),
            )
            if version["since"] > base_moment:
                raise NotesRefusalError("changed_since", 409, changed_by=version["changed_by"], changed_at=version["since"])
            old = str(row["title"])
            if old == title:
                await self.rollback()
                return old, str(version["since"]), False
            await self._title_free(organization_id, title, item_id)
            await self._execute(
                "UPDATE item SET title = $3, updated_at = $4 WHERE organization_id = $1::text::uuid AND id = $2::text::uuid",
                (organization_id, item_id, title, changed_at),
            )
            await self._execute(
                "UPDATE item_versions SET valid_to_at = $3, closed_by = $4::text::uuid, closed_operation = $5"
                " WHERE organization_id = $1::text::uuid AND id = $2::text::uuid AND valid_to_at IS NULL AND valid_from_at < $3",
                (organization_id, item_id, changed_at, editor_id, operation),
            )
            await self._execute(
                "INSERT INTO item_versions (organization_id, id, valid_from_at, valid_to_at, author_id, operation,"
                " title, created_at, updated_at)"
                " SELECT organization_id, id, $3, NULL, $4::text::uuid, $5, title, created_at, updated_at"
                " FROM item WHERE organization_id = $1::text::uuid AND id = $2::text::uuid"
                " ON CONFLICT (organization_id, id, valid_from_at) DO UPDATE SET title = EXCLUDED.title, updated_at = EXCLUDED.updated_at",
                (organization_id, item_id, changed_at, editor_id, operation),
            )
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return old, now, True

    async def _title_free(self, organization_id: str, title: str, item_id: str | None) -> None:
        """Refuse ``title_taken`` when an item of the organization other than ``item_id`` has the title now."""
        taken = await self._fetchval(
            "SELECT EXISTS (SELECT 1 FROM item WHERE organization_id = $1::text::uuid AND title = $2"
            " AND ($3::text IS NULL OR id <> $3::text::uuid))",
            (organization_id, title, item_id),
        )
        if taken:
            raise NotesRefusalError("title_taken", 409, title=title)

    async def items_at(self, organization_id: str, moment: str | None, limit: int, after: str | None) -> list[ItemEntryCoreEntity]:
        """
        The organization's items at ``moment`` (the watermark when ``None``), ordered by title and then id, ``limit``
        of them after the item ``after`` as it stood at the same moment.
        """
        at = await self._moment(organization_id, moment)
        if at is None:
            return []
        when = "$2::text::timestamptz"
        rows = await self._fetch(
            f"SELECT i.id::text AS key, i.title AS title"
            f" FROM item_versions i"
            f" WHERE i.organization_id = $1::text::uuid AND {in_force('i', when)}"
            f" AND ($3::text IS NULL OR (i.title, i.id) > (SELECT a.title, a.id FROM item_versions a"
            f" WHERE a.organization_id = $1::text::uuid AND a.id = $3::text::uuid AND {in_force('a', when)}))"
            f" ORDER BY i.title, i.id LIMIT $4",
            (organization_id, at, after, limit),
        )
        return [ItemEntryCoreEntity(key=row["key"], title=row["title"], icon=ITEM_ICON) for row in rows]

    async def add_note_change(self, organization_id: str, item_id: str, person_id: str, body: str, operation: str) -> str:
        """Write a new note into the person's draft and its first version in one transaction; return the change time."""
        await self.begin()
        try:
            changed_at, now = await self._change_time_now(organization_id)
            change_id, note_id = str(uuid4()), str(uuid4())
            await self._execute(
                "INSERT INTO note_change (id, organization_id, item_id, person_id, note_id, writer_id, state, body,"
                " base_body, base_revision, created_at, updated_at)"
                " VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid, $4::text::uuid, $5::text::uuid,"
                " $4::text::uuid, 'new', $6, NULL, NULL, $7, $7)",
                (change_id, organization_id, item_id, person_id, note_id, body, changed_at),
            )
            await self._open_change_version(organization_id, person_id, note_id, changed_at, person_id, operation)
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return now

    async def edit_note(
        self,
        organization_id: str,
        item_id: str,
        note_id: str,
        body: str,
        base_body: str | None,
        base_revision: int | None,
        editor_id: str,
        operation: str,
    ) -> str:
        """
        Change a note in the editor's own draft; return the change time.

        One transaction under the organization's lock. A draft change already there keeps its base and takes the new
        text; a change that leaves the note as it is published removes the draft's change. A note that never was is
        refused. The published note is never written.
        """
        await self.begin()
        try:
            changed_at, now = await self._change_time_now(organization_id)
            row = await self._fetchrow(
                "SELECT id::text AS id, state, body, base_body, base_revision, writer_id::text AS writer_id"
                " FROM note_change WHERE organization_id = $1::text::uuid AND person_id = $2::text::uuid"
                " AND note_id = $3::text::uuid FOR UPDATE",
                (organization_id, editor_id, note_id),
            )
            published = await self._fetchrow(
                "SELECT writer_id::text AS writer_id, body FROM note"
                " WHERE organization_id = $1::text::uuid AND id = $2::text::uuid FOR UPDATE",
                (organization_id, note_id),
            )
            base = base_body if row is None else row["base_body"]
            if row is None:
                writer_id = published["writer_id"] if published is not None else await self._note_writer(organization_id, note_id)
                if writer_id is None:
                    raise NotesRefusalError("no_such_note", 404)
                if body == base or (published is not None and body == published["body"]):
                    await self.rollback()
                    return now
                await self._execute(
                    "INSERT INTO note_change (id, organization_id, item_id, person_id, note_id, writer_id, state, body,"
                    " base_body, base_revision, created_at, updated_at)"
                    " VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid, $4::text::uuid, $5::text::uuid,"
                    " $6::text::uuid, 'changed', $7, $8, $9, $10, $10)",
                    (str(uuid4()), organization_id, item_id, editor_id, note_id, writer_id, body, base, base_revision, changed_at),
                )
            else:
                if body == base or (published is not None and body == published["body"]):
                    await self._delete_change(organization_id, editor_id, note_id, changed_at, editor_id, operation)
                    await self.commit()
                    return now
                await self._execute(
                    "UPDATE note_change SET state = 'changed', body = $4, updated_at = $5"
                    " WHERE organization_id = $1::text::uuid AND person_id = $2::text::uuid AND note_id = $3::text::uuid",
                    (organization_id, editor_id, note_id, body, changed_at),
                )
            await self._close_change_version(organization_id, editor_id, note_id, changed_at, editor_id, operation)
            await self._open_change_version(organization_id, editor_id, note_id, changed_at, editor_id, operation)
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return now

    async def delete_note(
        self,
        organization_id: str,
        item_id: str,
        note_id: str,
        base_body: str | None,
        base_revision: int | None,
        editor_id: str,
        operation: str,
    ) -> str:
        """
        Delete a note in the editor's own draft; return the change time.

        A new note is removed from the draft; a published note becomes a deletion with its base. At every earlier
        moment, and for everyone else, the note stays as it is published.
        """
        await self.begin()
        try:
            changed_at, now = await self._change_time_now(organization_id)
            row = await self._fetchrow(
                "SELECT id::text AS id, state, body, base_body, base_revision, writer_id::text AS writer_id"
                " FROM note_change WHERE organization_id = $1::text::uuid AND person_id = $2::text::uuid"
                " AND note_id = $3::text::uuid FOR UPDATE",
                (organization_id, editor_id, note_id),
            )
            published = await self._fetchrow(
                "SELECT writer_id::text AS writer_id, body FROM note"
                " WHERE organization_id = $1::text::uuid AND id = $2::text::uuid FOR UPDATE",
                (organization_id, note_id),
            )
            if row is not None and row["state"] == "new":
                await self._delete_change(organization_id, editor_id, note_id, changed_at, editor_id, operation)
                await self.commit()
                return now
            writer_id = row["writer_id"] if row is not None else (published["writer_id"] if published is not None else await self._note_writer(organization_id, note_id))
            if writer_id is None:
                await self.rollback()
                return now
            if row is None:
                if published is None:
                    await self.rollback()
                    return now
                await self._execute(
                    "INSERT INTO note_change (id, organization_id, item_id, person_id, note_id, writer_id, state, body,"
                    " base_body, base_revision, created_at, updated_at)"
                    " VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid, $4::text::uuid, $5::text::uuid,"
                    " $6::text::uuid, 'deleted', $7, $7, $8, $9, $9)",
                    (str(uuid4()), organization_id, item_id, editor_id, note_id, writer_id, published["body"], base_revision, changed_at),
                )
            else:
                await self._execute(
                    "UPDATE note_change SET state = 'deleted', body = base_body, updated_at = $4"
                    " WHERE organization_id = $1::text::uuid AND person_id = $2::text::uuid AND note_id = $3::text::uuid",
                    (organization_id, editor_id, note_id, changed_at),
                )
            await self._close_change_version(organization_id, editor_id, note_id, changed_at, editor_id, operation)
            await self._open_change_version(organization_id, editor_id, note_id, changed_at, editor_id, operation)
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return now

    async def revert_note_change(self, organization_id: str, note_id: str, person_id: str, operation: str) -> str:
        """Give one change of the person's draft up; return the change time. The published note is untouched."""
        await self.begin()
        try:
            changed_at, now = await self._change_time_now(organization_id)
            row = await self._fetchrow(
                "SELECT id::text AS id FROM note_change"
                " WHERE organization_id = $1::text::uuid AND person_id = $2::text::uuid AND note_id = $3::text::uuid FOR UPDATE",
                (organization_id, person_id, note_id),
            )
            if row is None:
                await self.rollback()
                return now
            await self._delete_change(organization_id, person_id, note_id, changed_at, person_id, operation)
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return now

    async def _change_time_now(self, organization_id: str) -> tuple[Any, str]:
        """The change time after the organization's lock, and it as a moment."""
        changed_at = await self._fetchval(change_time_sql(VERSION_TABLES), (organization_id,))
        now = str(await self._fetchval(f"SELECT {moment_text('$1::timestamptz')}", (changed_at,)))
        return changed_at, now

    async def _change_time(self, organization_id: str, base_moment: str) -> tuple[Any, str]:
        """The change time, and it as a moment; a ``base_moment`` not come yet is refused."""
        changed_at, now = await self._change_time_now(organization_id)
        if base_moment >= now:
            raise NotesRefusalError("moment_not_come", 422, watermark=now)
        return changed_at, now

    async def _note_writer(self, organization_id: str, note_id: str) -> str | None:
        """The writer of a note that is no longer published, from its last version; none when it never was."""
        value = await self._fetchval(
            "SELECT writer_id::text AS writer_id FROM note_versions"
            " WHERE organization_id = $1::text::uuid AND id = $2::text::uuid ORDER BY valid_from_at DESC LIMIT 1",
            (organization_id, note_id),
        )
        return None if value is None else str(value)

    async def _close_change_version(
        self, organization_id: str, person_id: str, note_id: str, changed_at: Any, editor_id: str, operation: str
    ) -> None:
        """Close the draft's open version at the change time, with who closed it and by which action."""
        await self._execute(
            "UPDATE note_change_versions SET valid_to_at = $4, closed_by = $5::text::uuid, closed_operation = $6"
            " WHERE organization_id = $1::text::uuid AND person_id = $2::text::uuid AND note_id = $3::text::uuid"
            " AND valid_to_at IS NULL AND valid_from_at < $4",
            (organization_id, person_id, note_id, changed_at, editor_id, operation),
        )

    async def _open_change_version(
        self, organization_id: str, person_id: str, note_id: str, changed_at: Any, editor_id: str, operation: str
    ) -> None:
        """Open the draft's new version at the change time, from the current row."""
        await self._execute(
            "INSERT INTO note_change_versions (organization_id, id, valid_from_at, valid_to_at, author_id, operation,"
            " item_id, person_id, note_id, writer_id, state, body, base_body, base_revision, created_at, updated_at)"
            " SELECT organization_id, id, $4, NULL, $5::text::uuid, $6, item_id, person_id, note_id, writer_id, state,"
            " body, base_body, base_revision, created_at, updated_at FROM note_change"
            " WHERE organization_id = $1::text::uuid AND person_id = $2::text::uuid AND note_id = $3::text::uuid",
            (organization_id, person_id, note_id, changed_at, editor_id, operation),
        )

    async def _delete_change(
        self, organization_id: str, person_id: str, note_id: str, changed_at: Any, editor_id: str, operation: str
    ) -> None:
        """Close the draft's open version and remove the change from the draft."""
        await self._close_change_version(organization_id, person_id, note_id, changed_at, editor_id, operation)
        await self._execute(
            "DELETE FROM note_change WHERE organization_id = $1::text::uuid AND person_id = $2::text::uuid AND note_id = $3::text::uuid",
            (organization_id, person_id, note_id),
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
            f" {moment_text('n.updated_at')} AS updated_at, {moment_text('n.valid_from_at')} AS since,"
            f" {member_name('n.organization_id', 'n.author_id', 'n.valid_from_at')} AS changed_by"
            f" FROM note_versions n"
            f" WHERE n.organization_id = $1::text::uuid AND n.item_id = $2::text::uuid AND {in_force('n', when)}"
            f" AND ($4::text IS NULL OR n.writer_id = $4::text::uuid)"
            f" ORDER BY n.updated_at, n.id",
            (organization_id, item_id, at, writer_id),
        )
        return [NoteCoreEntity(**_mapping(row)) for row in rows]

    async def publish_notes(
        self,
        organization_id: str,
        item_id: str,
        person_id: str,
        title: str,
        comment: str,
        release: str | None,
        resolutions: dict[str, str],
        publisher_id: str,
        operation: str,
    ) -> tuple[int, str]:
        """
        Publish the person's whole draft as the item's next revision; return its number and the change time.

        Under the organization's lock the conflicts are found by value; while one has no choice the answer is the list
        and nothing is written. Otherwise the changes are applied — new, changed, restored, deleted — the revision is
        written, and the draft is emptied.
        """
        refusal: NotesRefusalError | None = None
        number = 0
        await self.begin()
        try:
            changed_at, now = await self._change_time_now(organization_id)
            last = await self._last_revision(organization_id, item_id)
            changes = await self._draft_changes(organization_id, item_id, person_id)
            if not changes:
                raise NotesRefusalError("nothing_to_publish", 409, revision=0 if last is None else last["number"])
            published, identities = await self._published_notes_now(organization_id, item_id)
            decisions = decide(changes, published)
            conflicts = [decision.conflict for decision in decisions if decision.kind == "conflict" and decision.conflict is not None]
            unanswered = [conflict for conflict in conflicts if resolutions.get(conflict.note_id) not in ("overwrite", "give_up")]
            if unanswered:
                raise NotesRefusalError("conflicts", 409, conflicts=[conflict.model_dump() for conflict in conflicts])
            applied = 0
            for decision in decisions:
                if await self._apply(decision, organization_id, item_id, person_id, published, identities, resolutions, changed_at, publisher_id, operation):
                    applied += 1
            if applied:
                number = 1 if last is None else int(last["number"]) + 1
                await self._write_revision(organization_id, item_id, number, title, comment, release, changed_at, publisher_id, operation)
            else:
                refusal = NotesRefusalError("nothing_to_publish", 409, revision=0 if last is None else last["number"])
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        if refusal is not None:
            raise refusal
        return number, now

    async def _last_revision(self, organization_id: str, item_id: str) -> Any:
        """The item's last revision's number and moment, or nothing before the first."""
        return await self._fetchrow(
            "SELECT number, created_at FROM revision WHERE organization_id = $1::text::uuid AND item_id = $2::text::uuid"
            " ORDER BY number DESC LIMIT 1",
            (organization_id, item_id),
        )

    async def _draft_changes(self, organization_id: str, item_id: str, person_id: str) -> list[NoteChangeCoreEntity]:
        """The person's changes in force now, locked, in the order they were made."""
        rows = await self._fetch(
            "SELECT note_id::text AS note_id, state, body, base_body, base_revision, writer_id::text AS writer_id,"
            f" {member_name('organization_id', 'writer_id', 'updated_at')} AS writer_name,"
            f" {moment_text('updated_at')} AS changed_at"
            " FROM note_change WHERE organization_id = $1::text::uuid AND item_id = $2::text::uuid"
            " AND person_id = $3::text::uuid ORDER BY created_at FOR UPDATE",
            (organization_id, item_id, person_id),
        )
        return [NoteChangeCoreEntity(**_mapping(row)) for row in rows]

    async def _apply(
        self,
        decision: Any,
        organization_id: str,
        item_id: str,
        person_id: str,
        published: dict[str, PublishedNote],
        identities: dict[str, dict[str, Any]],
        resolutions: dict[str, str],
        changed_at: Any,
        publisher_id: str,
        operation: str,
    ) -> bool:
        """Apply one change of the draft; answer whether anything reached the published notes."""
        change = decision.change
        give_up = decision.kind == "conflict" and resolutions.get(change.note_id) == "give_up"
        if decision.kind == "drop" or give_up:
            await self._delete_change(organization_id, person_id, change.note_id, changed_at, publisher_id, operation)
            return False
        applied = await self._apply_note(change, organization_id, item_id, published, identities, changed_at, publisher_id, operation)
        await self._delete_change(organization_id, person_id, change.note_id, changed_at, publisher_id, operation)
        return applied

    async def _apply_note(
        self,
        change: NoteChangeCoreEntity,
        organization_id: str,
        item_id: str,
        published: dict[str, PublishedNote],
        identities: dict[str, dict[str, Any]],
        changed_at: Any,
        publisher_id: str,
        operation: str,
    ) -> bool:
        """Write one change into the published notes: a new note, a changed or restored one, or a deletion."""
        present = change.note_id in published and published[change.note_id].body is not None
        if change.state == "new":
            await self._insert_note(organization_id, item_id, change.note_id, change.writer_id, change.body, changed_at)
            await self._open_note_version(organization_id, change.note_id, changed_at, publisher_id, operation)
            return True
        if change.state == "changed":
            if present:
                await self._replace_note(organization_id, change.note_id, change.body, changed_at, publisher_id, operation)
                return True
            identity = identities.get(change.note_id)
            if identity is None:
                raise NotesRefusalError("no_such_note", 404)
            await self._insert_note(organization_id, item_id, change.note_id, identity["writer_id"], change.body, changed_at, identity["created_at"])
            await self._open_note_version(organization_id, change.note_id, changed_at, publisher_id, operation)
            return True
        if not present:
            return False
        await self._execute(
            "DELETE FROM note WHERE organization_id = $1::text::uuid AND id = $2::text::uuid",
            (organization_id, change.note_id),
        )
        await self._close_note_version(organization_id, change.note_id, changed_at, publisher_id, operation)
        return True

    async def _replace_note(self, organization_id: str, note_id: str, body: str, changed_at: Any, publisher_id: str, operation: str) -> None:
        """Give the published note a new text, closing its open version and opening the new one."""
        await self._execute(
            "UPDATE note SET body = $3, updated_at = $4 WHERE organization_id = $1::text::uuid AND id = $2::text::uuid",
            (organization_id, note_id, body, changed_at),
        )
        await self._close_note_version(organization_id, note_id, changed_at, publisher_id, operation)
        await self._open_note_version(organization_id, note_id, changed_at, publisher_id, operation)

    async def _write_revision(
        self,
        organization_id: str,
        item_id: str,
        number: int,
        title: str,
        comment: str,
        release: str | None,
        changed_at: Any,
        publisher_id: str,
        operation: str,
    ) -> None:
        """Write the revision and its first version in one statement each."""
        revision_id = str(uuid4())
        await self._execute(
            "INSERT INTO revision (id, organization_id, item_id, number, title, comment, release, publisher_id, created_at, updated_at)"
            " VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid, $4, $5, $6, $7, $8::text::uuid, $9, $9)",
            (revision_id, organization_id, item_id, number, title, comment, release, publisher_id, changed_at),
        )
        await self._execute(
            "INSERT INTO revision_versions (organization_id, id, valid_from_at, valid_to_at, author_id, operation,"
            " item_id, number, title, comment, release, publisher_id, created_at, updated_at)"
            " SELECT organization_id, id, $3, NULL, $4::text::uuid, $5, item_id, number, title, comment, release,"
            " publisher_id, created_at, updated_at FROM revision WHERE organization_id = $1::text::uuid AND id = $2::text::uuid",
            (organization_id, revision_id, changed_at, publisher_id, operation),
        )

    async def _insert_note(
        self,
        organization_id: str,
        item_id: str,
        note_id: str,
        writer_id: str,
        body: str,
        changed_at: Any,
        created_at: Any | None = None,
    ) -> None:
        """Write a published note's current row, new or restored with its own creation moment."""
        await self._execute(
            "INSERT INTO note (id, organization_id, item_id, writer_id, body, created_at, updated_at)"
            " VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid, $4::text::uuid, $5, $6, $7)",
            (note_id, organization_id, item_id, writer_id, body, created_at or changed_at, changed_at),
        )

    async def _open_note_version(self, organization_id: str, note_id: str, changed_at: Any, author_id: str, operation: str) -> None:
        """Open the published note's new version at the change time, from its current row."""
        await self._execute(
            "INSERT INTO note_versions (organization_id, id, valid_from_at, valid_to_at, author_id, operation,"
            " item_id, writer_id, body, created_at, updated_at)"
            " SELECT organization_id, id, $3, NULL, $4::text::uuid, $5, item_id, writer_id, body, created_at, updated_at"
            " FROM note WHERE organization_id = $1::text::uuid AND id = $2::text::uuid"
            " ON CONFLICT (organization_id, id, valid_from_at) DO UPDATE SET body = EXCLUDED.body, updated_at = EXCLUDED.updated_at",
            (organization_id, note_id, changed_at, author_id, operation),
        )

    async def _close_note_version(
        self, organization_id: str, note_id: str, changed_at: Any, editor_id: str, operation: str
    ) -> None:
        """Close the published note's open version at the change time, with who closed it and by which action."""
        await self._execute(
            "UPDATE note_versions SET valid_to_at = $3, closed_by = $4::text::uuid, closed_operation = $5"
            " WHERE organization_id = $1::text::uuid AND id = $2::text::uuid AND valid_to_at IS NULL AND valid_from_at < $3",
            (organization_id, note_id, changed_at, editor_id, operation),
        )

    async def _published_notes_now(self, organization_id: str, item_id: str) -> tuple[dict[str, PublishedNote], dict[str, dict[str, Any]]]:
        """The item's published notes at now, and the writer and creation moment of every note it ever had."""
        rows = await self._fetch(
            f"SELECT n.id::text AS id, n.body AS body, n.writer_id::text AS writer_id,"
            f" {member_name('n.organization_id', 'n.author_id', 'n.valid_from_at')} AS by_name,"
            f" {moment_text('n.valid_from_at')} AS at, {moment_text('n.created_at')} AS created_at"
            f" FROM note_versions n"
            f" WHERE n.organization_id = $1::text::uuid AND n.item_id = $2::text::uuid AND n.valid_to_at IS NULL",
            (organization_id, item_id),
        )
        published: dict[str, PublishedNote] = {}
        identities: dict[str, dict[str, Any]] = {}
        for row in rows:
            published[row["id"]] = PublishedNote(body=row["body"], by_name=row["by_name"], at=row["at"])
            identities[row["id"]] = {"writer_id": row["writer_id"], "created_at": row["created_at"]}
        deletions = await self._deleted_notes(organization_id, item_id)
        for note_id, (by_name, at) in deletions.items():
            if note_id not in published:
                published[note_id] = PublishedNote(body=None, by_name=by_name, at=at)
        identities_rows = await self._fetch(
            "SELECT DISTINCT ON (n.id) n.id::text AS id, n.writer_id::text AS writer_id,"
            f" {moment_text('n.created_at')} AS created_at"
            " FROM note_versions n WHERE n.organization_id = $1::text::uuid AND n.item_id = $2::text::uuid"
            " ORDER BY n.id, n.valid_from_at DESC",
            (organization_id, item_id),
        )
        for row in identities_rows:
            identities.setdefault(row["id"], {"writer_id": row["writer_id"], "created_at": row["created_at"]})
        return published, identities

    async def _deleted_notes(self, organization_id: str, item_id: str) -> dict[str, tuple[str, str]]:
        """Who deleted each note of the item, and when: the versions closed with no successor, the last one per note."""
        rows = await self._fetch(
            f"SELECT n.id::text AS id, {member_name('n.organization_id', 'n.closed_by', 'n.valid_to_at')} AS by_name,"
            f" {moment_text('n.valid_to_at')} AS at"
            f" FROM note_versions n"
            f" WHERE n.organization_id = $1::text::uuid AND n.item_id = $2::text::uuid"
            f" AND n.closed_by IS NOT NULL ORDER BY n.valid_to_at",
            (organization_id, item_id),
        )
        return {row["id"]: (row["by_name"], row["at"]) for row in rows}

    async def revision_at(self, organization_id: str, item_id: str, moment: str | None) -> RevisionCoreEntity | None:
        """The revision of the item in force at ``moment`` (the watermark when ``None``): the last one published by then."""
        at = await self._moment(organization_id, moment)
        if at is None:
            return None
        when = "$3::text::timestamptz"
        row = await self._fetchrow(
            f"SELECT r.number AS number, 'v' || r.number AS ref, r.title AS title, r.comment AS comment, r.release AS release,"
            f" r.publisher_id::text AS publisher_id,"
            f" {member_name('r.organization_id', 'r.publisher_id', 'r.created_at')} AS publisher_name,"
            f" {moment_text('r.created_at')} AS at"
            f" FROM revision_versions r"
            f" WHERE r.organization_id = $1::text::uuid AND r.item_id = $2::text::uuid AND {in_force('r', when)}"
            f" ORDER BY r.number DESC LIMIT 1",
            (organization_id, item_id, at),
        )
        return None if row is None else RevisionCoreEntity(**_mapping(row))

    async def published_notes(self, organization_id: str, item_id: str, moment: str | None) -> tuple[RevisionCoreEntity | None, list[NoteCoreEntity]]:
        """The revision in force at ``moment`` and its notes as they read when it was published; none before the first."""
        revision = await self.revision_at(organization_id, item_id, moment)
        if revision is None:
            return None, []
        return revision, await self.notes_of_item(organization_id, item_id, revision.at, None)

    async def draft(self, organization_id: str, item_id: str, person_id: str, moment: str | None) -> tuple[RevisionCoreEntity | None, list[NoteChangeCoreEntity]]:
        """
        One person's draft of an item's notes at ``moment``: their changes in force then, each with its state, its base
        and — at now — the published note it meets, when that no longer reads as the base. At now a change that has
        nothing left to do is left out.
        """
        at = await self._moment(organization_id, moment)
        if at is None:
            return None, []
        revision = await self.revision_at(organization_id, item_id, at)
        rows = await self._fetch(
            f"SELECT d.note_id::text AS note_id, d.state AS state, d.body AS body, d.base_body AS base_body,"
            f" d.base_revision AS base_revision, d.writer_id::text AS writer_id,"
            f" {member_name('d.organization_id', 'd.writer_id', 'd.valid_from_at')} AS writer_name,"
            f" {moment_text('d.valid_from_at')} AS changed_at"
            f" FROM note_change_versions d"
            f" WHERE d.organization_id = $1::text::uuid AND d.item_id = $2::text::uuid"
            f" AND d.person_id = $3::text::uuid AND {in_force('d', '$4::text::timestamptz')}"
            f" ORDER BY d.valid_from_at, d.note_id",
            (organization_id, item_id, person_id, at),
        )
        changes = [NoteChangeCoreEntity(**_mapping(row)) for row in rows]
        if moment is not None:
            return revision, changes
        published = await self._published_sides(organization_id, item_id, {change.note_id for change in changes})
        return revision, [with_conflict(decision) for decision in decide(changes, published) if decision.kind != "drop"]

    async def _published_sides(self, organization_id: str, item_id: str, note_ids: set[str]) -> dict[str, PublishedNote]:
        """The published side of every note a draft names, at now: its text, or its deletion, and who and when."""
        sides: dict[str, PublishedNote] = {}
        if not note_ids:
            return sides
        notes = await self.notes_of_item(organization_id, item_id, None, None)
        for note in notes:
            if note.id in note_ids:
                sides[note.id] = PublishedNote(body=note.body, by_name=note.changed_by, at=note.since)
        missing = note_ids - set(sides)
        if missing:
            deletions = await self._deleted_notes(organization_id, item_id)
            for note_id in missing:
                by_name, deleted_at = deletions.get(note_id, ("", ""))
                sides[note_id] = PublishedNote(body=None, by_name=by_name, at=deleted_at)
        return sides

    async def note_versions_between(self, organization_id: str, item_id: str, start: str, end: str, writer_id: str | None) -> tuple[str, list[Version]]:
        """
        Every version of the item's notes in force at some time between ``start`` and ``end`` — the same query and
        filter as the notes page, with the stretch form of the moment condition — and the end the stretch was cut to:
        the watermark when ``end`` is later.
        """
        watermark = await self._watermark(organization_id)
        if watermark is None:
            return start, []
        end = min(end, watermark)
        rows = await self._fetch(
            f"SELECT n.id::text AS id, {moment_text('n.valid_from_at')} AS valid_from, {moment_text('n.valid_to_at')} AS valid_to"
            f" FROM note_versions n"
            f" WHERE n.organization_id = $1::text::uuid AND n.item_id = $2::text::uuid"
            f" AND {overlaps('n', '$3::text::timestamptz', '$4::text::timestamptz')}"
            f" AND ($5::text IS NULL OR n.writer_id = $5::text::uuid)",
            (organization_id, item_id, start, end, writer_id),
        )
        return end, [Version(entity_id=row["id"], valid_from=row["valid_from"], valid_to=row["valid_to"]) for row in rows]

    async def milestones(self, organization_id: str, item_id: str, start: str, end: str) -> list[MilestoneCoreEntity]:
        """The revisions published in the stretch, in order, and the draft last as a proposal when anything changed since the last one."""
        cards = await self._cards(organization_id, item_id, end)
        return [MilestoneCoreEntity(**card.model_dump(include=set(MilestoneCoreEntity.model_fields))) for card in cards if start < card.at or card.kind == "proposal"]

    async def milestone_card(self, organization_id: str, item_id: str, milestone_id: str, moment: str | None) -> MilestoneCardCoreEntity:
        """The card of one milestone as it read at ``moment`` (the watermark when ``None``)."""
        at = await self._moment(organization_id, moment)
        for card in await self._cards(organization_id, item_id, at) if at is not None else []:
            if card.id == milestone_id:
                return card
        raise NotesRefusalError("no_such_milestone", 404)

    async def _cards(self, organization_id: str, item_id: str, end: str) -> list[MilestoneCardCoreEntity]:
        """
        Every revision of the item published by ``end`` with what it changed against the one before, and the draft
        at ``end`` as a proposal when it holds any change. ``end`` is cut to the watermark.
        """
        watermark = await self._watermark(organization_id)
        if watermark is None:
            return []
        end = min(end, watermark)
        rows = await self._fetch(
            f"SELECT r.number AS number, 'v' || r.number AS ref, r.title AS title, r.comment AS comment, r.release AS release,"
            f" r.publisher_id::text AS publisher_id,"
            f" {member_name('r.organization_id', 'r.publisher_id', 'r.created_at')} AS publisher_name,"
            f" {moment_text('r.created_at')} AS at"
            f" FROM revision_versions r"
            f" WHERE r.organization_id = $1::text::uuid AND r.item_id = $2::text::uuid AND {in_force('r', '$3::text::timestamptz')}"
            f" ORDER BY r.number",
            (organization_id, item_id, end),
        )
        cards: list[MilestoneCardCoreEntity] = []
        before: dict[str, str] = {}
        for row in rows:
            revision = RevisionCoreEntity(**_mapping(row))
            notes = {note.id: note.body for note in await self.notes_of_item(organization_id, item_id, revision.at, None)}
            summary = _summary(before, notes)
            cards.append(
                MilestoneCardCoreEntity(
                    id=revision.ref, at=revision.at, kind="revision", ref=revision.ref, title=revision.title,
                    minor=summary["added"] == 0 and summary["removed"] == 0, release=revision.release,
                    author_id=revision.publisher_id, author_name=revision.publisher_name, summary=summary,
                    chips=[f"{len(notes)} notes"], comment=revision.comment,
                )
            )
            before = notes
        now = {note.id: note.body for note in await self.notes_of_item(organization_id, item_id, end, None)}
        draft = _summary(before, now)
        if any(draft.values()):
            cards.append(
                MilestoneCardCoreEntity(
                    id="draft", at=end, kind="proposal", ref="draft", title="Draft — waiting to be published", minor=False,
                    link=f"/items/{item_id}/draft", summary=draft, chips=[f"{len(now)} notes"], comment="",
                )
            )
        return cards

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


def _summary(before: dict[str, str], after: dict[str, str]) -> dict[str, int]:
    """Notes added, changed and removed from ``before`` to ``after`` (note id → text)."""
    return {
        "added": sum(1 for note in after if note not in before),
        "changed": sum(1 for note, body in after.items() if note in before and before[note] != body),
        "removed": sum(1 for note in before if note not in after),
    }


def _mapping(row: Any) -> dict[str, Any]:
    """A driver row as a plain mapping of its columns."""
    return dict(row)


def with_conflict(decision: Any) -> NoteChangeCoreEntity:
    """The change as the page shows it, with its conflict's other side when it meets one."""
    if decision.conflict is None:
        return cast(NoteChangeCoreEntity, decision.change)
    return cast(NoteChangeCoreEntity, decision.change.model_copy(
        update={
            "conflict": True,
            "published_body": decision.conflict.published_body,
            "published_by_name": decision.conflict.published_by_name,
            "published_at": decision.conflict.published_at,
        }
    ))


@exclude_graph_model
class NotesStorageWrapper(SqlStorageWrapper):
    """What a nested action receives: the storage's reads and writes, without control of the transaction."""

    def _storage(self) -> NotesStorage:
        """The storage this wrapper stands for."""
        return cast(NotesStorage, self._connection_manager)

    async def organization_of(self, code: str, user_id: str) -> str | None:
        """Pass on the wrapped storage's membership check."""
        return await self._storage().organization_of(code, user_id)

    async def item_of(self, organization_id: str, item_id: str) -> bool:
        """Pass on the wrapped storage's check of an item."""
        return await self._storage().item_of(organization_id, item_id)

    async def add_item(self, organization_id: str, title: str, author_id: str, operation: str) -> tuple[str, str]:
        """Pass on the wrapped storage's adding of an item."""
        return await self._storage().add_item(organization_id, title, author_id, operation)

    async def rename_item(self, organization_id: str, item_id: str, title: str, base_moment: str, editor_id: str, operation: str) -> tuple[str, str, bool]:
        """Pass on the wrapped storage's renaming of an item."""
        return await self._storage().rename_item(organization_id, item_id, title, base_moment, editor_id, operation)

    async def items_at(self, organization_id: str, moment: str | None, limit: int, after: str | None) -> list[ItemEntryCoreEntity]:
        """Pass on the wrapped storage's read of the items."""
        return await self._storage().items_at(organization_id, moment, limit, after)

    async def add_note_change(self, organization_id: str, item_id: str, person_id: str, body: str, operation: str) -> str:
        """Pass on the wrapped storage's adding of a change to the draft."""
        return await self._storage().add_note_change(organization_id, item_id, person_id, body, operation)

    async def edit_note(
        self,
        organization_id: str,
        item_id: str,
        note_id: str,
        body: str,
        base_body: str | None,
        base_revision: int | None,
        editor_id: str,
        operation: str,
    ) -> str:
        """Pass on the wrapped storage's edit."""
        return await self._storage().edit_note(organization_id, item_id, note_id, body, base_body, base_revision, editor_id, operation)

    async def delete_note(
        self,
        organization_id: str,
        item_id: str,
        note_id: str,
        base_body: str | None,
        base_revision: int | None,
        editor_id: str,
        operation: str,
    ) -> str:
        """Pass on the wrapped storage's deletion."""
        return await self._storage().delete_note(organization_id, item_id, note_id, base_body, base_revision, editor_id, operation)

    async def revert_note_change(self, organization_id: str, note_id: str, person_id: str, operation: str) -> str:
        """Pass on the wrapped storage's revert."""
        return await self._storage().revert_note_change(organization_id, note_id, person_id, operation)

    async def notes_of_item(self, organization_id: str, item_id: str, moment: str | None, writer_id: str | None) -> list[NoteCoreEntity]:
        """Pass on the wrapped storage's read of an item's notes."""
        return await self._storage().notes_of_item(organization_id, item_id, moment, writer_id)

    async def publish_notes(
        self,
        organization_id: str,
        item_id: str,
        person_id: str,
        title: str,
        comment: str,
        release: str | None,
        resolutions: dict[str, str],
        publisher_id: str,
        operation: str,
    ) -> tuple[int, str]:
        """Pass on the wrapped storage's publication."""
        return await self._storage().publish_notes(organization_id, item_id, person_id, title, comment, release, resolutions, publisher_id, operation)

    async def published_notes(self, organization_id: str, item_id: str, moment: str | None) -> tuple[RevisionCoreEntity | None, list[NoteCoreEntity]]:
        """Pass on the wrapped storage's read of the published notes."""
        return await self._storage().published_notes(organization_id, item_id, moment)

    async def draft(self, organization_id: str, item_id: str, person_id: str, moment: str | None) -> tuple[RevisionCoreEntity | None, list[NoteChangeCoreEntity]]:
        """Pass on the wrapped storage's read of the draft."""
        return await self._storage().draft(organization_id, item_id, person_id, moment)

    async def note_versions_between(self, organization_id: str, item_id: str, start: str, end: str, writer_id: str | None) -> tuple[str, list[Version]]:
        """Pass on the wrapped storage's read over a stretch."""
        return await self._storage().note_versions_between(organization_id, item_id, start, end, writer_id)

    async def milestones(self, organization_id: str, item_id: str, start: str, end: str) -> list[MilestoneCoreEntity]:
        """Pass on the wrapped storage's milestones."""
        return await self._storage().milestones(organization_id, item_id, start, end)

    async def milestone_card(self, organization_id: str, item_id: str, milestone_id: str, moment: str | None) -> MilestoneCardCoreEntity:
        """Pass on the wrapped storage's milestone card."""
        return await self._storage().milestone_card(organization_id, item_id, milestone_id, moment)

    async def note_authors(self, organization_id: str, item_id: str, moment: str | None, limit: int, after: str | None) -> list[NoteAuthorCoreEntity]:
        """Pass on the wrapped storage's read of an item's writers."""
        return await self._storage().note_authors(organization_id, item_id, moment, limit, after)

    @classmethod
    def get_wrapper_class(cls) -> type[NotesStorageWrapper]:
        """Deeper nesting receives the same wrapper."""
        return NotesStorageWrapper
