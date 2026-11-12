"""The draft: a change is one person's, keeps its base, and never writes the published note."""

from datetime import UTC, datetime

import pytest
from maxitor_notes.notes_refusal_error import NotesRefusalError
from maxitor_notes.storage.notes_storage import NotesStorage

from tests.recording_database import recording_pool

ORG = "11111111-1111-1111-1111-111111111111"
ITEM = "22222222-2222-2222-2222-222222222222"
NOTE = "44444444-4444-4444-4444-444444444444"
ANN = "33333333-3333-3333-3333-333333333333"
OLGA = "55555555-5555-5555-5555-555555555555"
NOW = "2026-11-10T11:25:00.000000Z"
BASE = "The settlement window"


def script(*, draft=None, published=None, watermark=NOW, revision=None, deleted=None, notes=None, published_notes=None, writer=ANN):
    """A database with the person's draft row ``draft``, the published note ``published``, and what the reads answer."""

    def answer(query, params):
        if "watermark($1::text::uuid)" in query:
            return watermark
        if "change_time($1::text::uuid)" in query:
            return datetime(2026, 11, 10, 11, 25, tzinfo=UTC)
        if query.startswith("SELECT to_char($1::timestamptz"):
            return NOW
        if "FROM note_change WHERE" in query and "FOR UPDATE" in query:
            return draft
        if "FROM note WHERE" in query and "FOR UPDATE" in query:
            return published
        if "FROM revision_versions r" in query:
            return revision
        if "FROM note_change_versions d" in query:
            return notes or []
        if "FROM note_versions n" in query and "closed_by IS NOT NULL" in query:
            return deleted or []
        if "n.item_id::text AS item_id" in query:
            return published_notes or []
        if "FROM note_versions" in query:
            return None if writer is None else {"writer_id": writer}
        return None

    return answer


async def _open(answer):
    pool, connection = recording_pool(answer)
    storage = NotesStorage(pool=pool)
    await storage.open()
    return storage, connection


def _row(**over):
    row = {
        "note_id": NOTE,
        "state": "changed",
        "body": "Mine",
        "base_body": BASE,
        "base_revision": 6,
        "writer_id": ANN,
        "writer_name": "Anna",
        "changed_at": NOW,
    }
    row.update(over)
    return row


async def test_a_new_note_is_written_into_the_draft_and_its_version_not_into_the_published_notes() -> None:
    storage, connection = await _open(script())
    assert await storage.add_note_change(ORG, ITEM, ANN, "Check the limits", "AddNoteAction") == NOW
    queries = connection.queries()
    assert queries[3].startswith("INSERT INTO note_change ")
    assert "INSERT INTO note_change_versions " in queries[4]
    assert not any(query.startswith(("INSERT INTO note ", "INSERT INTO note_versions ")) for query in queries)
    insert = connection.statements[3]
    assert insert[1][1:4] == (ORG, ITEM, ANN)
    assert insert[1][5] == "Check the limits"
    version = connection.statements[4]
    assert version[1][0:2] == (ORG, ANN)


async def test_an_edit_writes_the_draft_row_with_the_published_text_it_was_made_over() -> None:
    storage, connection = await _open(script(published={"writer_id": OLGA, "body": BASE}))
    assert await storage.edit_note(ORG, ITEM, NOTE, "Mine", BASE, 6, ANN, "EditNoteAction") == NOW
    insert = next(statement for statement in connection.statements if statement[0].startswith("INSERT INTO note_change "))
    assert insert[1][2:6] == (ITEM, ANN, NOTE, OLGA)
    assert insert[1][6:9] == ("Mine", BASE, 6)
    assert not any(query.startswith(("UPDATE note ", "DELETE FROM note ")) for query in connection.queries())


async def test_a_second_change_of_one_note_keeps_the_base_of_the_first() -> None:
    storage, connection = await _open(script(draft=_row(), published={"writer_id": ANN, "body": BASE}))
    await storage.edit_note(ORG, ITEM, NOTE, "Mine again", "a newer text", 7, ANN, "EditNoteAction")
    update = next(statement for statement in connection.statements if statement[0].startswith("UPDATE note_change SET state"))
    assert "base_body" not in update[0]
    assert update[1][3] == "Mine again"


async def test_a_new_note_edited_again_stays_new() -> None:
    storage, connection = await _open(script(draft=_row(state="new", base_body=None, base_revision=None), published=None))
    await storage.edit_note(ORG, ITEM, NOTE, "Mine again", None, None, ANN, "EditNoteAction")
    update = next(statement for statement in connection.statements if statement[0].startswith("UPDATE note_change SET state"))
    assert update[1][5] == "new"


async def test_a_changed_note_edited_again_stays_changed() -> None:
    storage, connection = await _open(script(draft=_row(), published={"writer_id": ANN, "body": BASE}))
    await storage.edit_note(ORG, ITEM, NOTE, "Mine again", BASE, 6, ANN, "EditNoteAction")
    update = next(statement for statement in connection.statements if statement[0].startswith("UPDATE note_change SET state"))
    assert update[1][5] == "changed"


async def test_a_change_that_leaves_the_note_as_published_takes_the_change_out_of_the_draft() -> None:
    storage, connection = await _open(script(draft=_row(), published={"writer_id": ANN, "body": "Mine"}))
    await storage.edit_note(ORG, ITEM, NOTE, "Mine", BASE, 6, ANN, "EditNoteAction")
    queries = connection.queries()
    assert "DELETE FROM note_change WHERE" in "".join(queries)
    assert not any(query.startswith("UPDATE note_change SET") for query in queries)


async def test_a_change_over_a_note_that_was_deleted_since_keeps_the_base_the_editor_saw() -> None:
    storage, connection = await _open(
        script(published=None, deleted=[{"id": NOTE, "by_name": "Olga", "at": "2026-11-10T09:00:00.000000Z"}])
    )
    await storage.edit_note(ORG, ITEM, NOTE, "Mine", BASE, 6, ANN, "EditNoteAction")
    insert = next(statement for statement in connection.statements if statement[0].startswith("INSERT INTO note_change "))
    assert insert[1][4] == NOTE
    assert insert[1][6:9] == ("Mine", BASE, 6)


async def test_a_note_that_never_was_is_refused() -> None:
    storage, connection = await _open(script(published=None, writer=None))
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.edit_note(ORG, ITEM, NOTE, "Mine", None, None, ANN, "EditNoteAction")
    assert refusal.value.body == {"error": "no_such_note"}
    assert connection.queries()[-1] == "ROLLBACK"


async def test_deleting_a_new_note_removes_it_from_the_draft() -> None:
    storage, connection = await _open(script(draft=_row(state="new", base_body=None, base_revision=None)))
    await storage.delete_note(ORG, ITEM, NOTE, None, ANN, "DeleteNoteAction")
    queries = connection.queries()
    assert "DELETE FROM note_change WHERE" in "".join(queries)
    assert not any(query.startswith("INSERT INTO note_change ") for query in queries)


async def test_deleting_a_published_note_puts_a_deletion_with_its_base_in_the_draft() -> None:
    storage, connection = await _open(script(published={"writer_id": OLGA, "body": BASE}))
    await storage.delete_note(ORG, ITEM, NOTE, 6, ANN, "DeleteNoteAction")
    insert = next(statement for statement in connection.statements if statement[0].startswith("INSERT INTO note_change "))
    assert "'deleted'" in insert[0]
    assert insert[1][6] == BASE


async def test_a_revert_closes_the_change_and_touches_no_published_note() -> None:
    storage, connection = await _open(script(draft=_row()))
    await storage.revert_note_change(ORG, NOTE, ANN, "RevertNoteChangeAction")
    queries = connection.queries()
    assert "UPDATE note_change_versions SET valid_to_at" in "".join(queries)
    assert "DELETE FROM note_change WHERE" in "".join(queries)
    assert not any(query.startswith(("UPDATE note ", "DELETE FROM note ")) for query in queries)


async def test_a_revert_of_nothing_writes_nothing() -> None:
    storage, connection = await _open(script(draft=None))
    await storage.revert_note_change(ORG, NOTE, ANN, "RevertNoteChangeAction")
    assert connection.queries()[-1] == "ROLLBACK"
    assert await storage.revert_note_change(ORG, NOTE, ANN, "RevertNoteChangeAction") == NOW


async def test_the_draft_is_read_for_one_person_and_one_item_at_the_moment_of_the_address() -> None:
    storage, connection = await _open(script(notes=[_row()]))
    revision, changes = await storage.draft(ORG, ITEM, ANN, None)
    assert revision is None
    assert [change.state for change in changes] == ["changed"]
    read = next(statement for statement in connection.statements if "FROM note_change_versions d" in statement[0])
    assert read[1] == (ORG, ITEM, ANN, NOW)
    assert "d.person_id = $3::text::uuid" in read[0]


async def test_the_draft_in_the_past_is_read_without_the_published_side() -> None:
    storage, connection = await _open(
        script(
            notes=[_row()],
            revision={"number": 6, "ref": "v6", "title": "T", "comment": "C", "release": None, "publisher_id": ANN, "publisher_name": "Anna", "at": "2026-11-09T17:00:00.000000Z"},
        )
    )
    revision, changes = await storage.draft(ORG, ITEM, ANN, "2026-11-09T17:30:00.000000Z")
    assert revision.ref == "v6"
    assert changes[0].conflict is False
    assert not any("FROM note_versions n" in query and "in_force" in query for query in connection.queries())


async def test_a_change_whose_note_was_deleted_since_is_a_conflict_naming_who_and_when() -> None:
    storage, _connection = await _open(
        script(
            notes=[_row()],
            deleted=[{"id": NOTE, "by_name": "Olga", "at": "2026-11-10T09:00:00.000000Z"}],
        )
    )
    _revision, changes = await storage.draft(ORG, ITEM, ANN, None)
    assert changes[0].conflict is True
    assert changes[0].published_body is None
    assert (changes[0].published_by_name, changes[0].published_at) == ("Olga", "2026-11-10T09:00:00.000000Z")


async def test_a_change_whose_own_text_was_published_has_nothing_left_to_do() -> None:
    storage, _connection = await _open(
        script(
            notes=[_row(state="changed", body="Olga's text", base_body=BASE)],
            published_notes=[{"id": NOTE, "item_id": ITEM, "writer_id": ANN, "writer_name": "Anna", "body": "Olga's text", "updated_at": NOW, "since": NOW, "changed_by": "Olga"}],
        )
    )
    _revision, changes = await storage.draft(ORG, ITEM, ANN, None)
    assert changes == []
