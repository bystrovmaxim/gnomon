"""Editing and deleting a note: one transaction under the organization's lock, never over someone else's change."""

from datetime import UTC, datetime

import pytest
from maxitor_notes.notes_refusal_error import NotesRefusalError
from maxitor_notes.storage.notes_storage import NotesStorage

from tests.recording_database import recording_pool

ORG = "11111111-1111-1111-1111-111111111111"
NOTE = "44444444-4444-4444-4444-444444444444"
EDITOR = "33333333-3333-3333-3333-333333333333"
SAW = "2026-11-08T10:15:00.000000Z"
OPENED = "2026-11-08T10:15:00.000000Z"
NOW = "2026-11-09T09:00:00.000000Z"


def script(*, row=True, since=OPENED, body="Check the limits", closed=None):
    """A database where the note's current row exists or not, its open version began at ``since``, and it was closed as ``closed``."""

    def answer(query, params):
        if "change_time($1::text::uuid)" in query:
            return datetime(2026, 11, 9, 9, 0, tzinfo=UTC)
        if query.startswith("SELECT to_char($1::timestamptz"):
            return NOW
        if "FOR UPDATE" in query:
            return {"id": NOTE} if row else None
        if "closed_by IS NOT NULL" in query:
            return closed
        if "valid_to_at IS NULL" in query and query.startswith("SELECT"):
            return {"since": since, "body": body, "changed_by": "Olga"}
        return None

    return answer


async def _open(answer):
    pool, connection = recording_pool(answer)
    storage = NotesStorage(pool=pool)
    await storage.open()
    return storage, connection


async def test_an_edit_closes_the_open_version_and_opens_the_new_one_in_one_transaction() -> None:
    storage, connection = await _open(script())
    assert await storage.edit_note(ORG, NOTE, "Check the new limits", SAW, EDITOR, "EditNoteAction") == NOW
    queries = connection.queries()
    assert queries[0] == "BEGIN" and queries[-1] == "COMMIT"
    assert queries[1].startswith("SELECT greatest(change_time($1::text::uuid)")
    assert any("FOR UPDATE" in q for q in queries)
    update = queries.index(next(q for q in queries if q.startswith("UPDATE note SET body")))
    close = queries.index(next(q for q in queries if q.startswith("UPDATE note_versions SET valid_to_at")))
    insert = queries.index(next(q for q in queries if q.startswith("INSERT INTO note_versions")))
    assert update < close < insert
    closing = connection.statements[close]
    assert "closed_by = $4::text::uuid, closed_operation = $5" in closing[0]
    assert closing[1][3:] == (EDITOR, "EditNoteAction")


async def test_a_note_changed_after_the_editor_saw_it_is_a_conflict_naming_who_and_when_and_nothing_is_written() -> None:
    later = "2026-11-08T12:00:00.000000Z"
    storage, connection = await _open(script(since=later))
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.edit_note(ORG, NOTE, "Mine", SAW, EDITOR, "EditNoteAction")
    assert refusal.value.status == 409
    assert refusal.value.body == {"error": "changed_since", "changed_by": "Olga", "changed_at": later}
    assert not any(q.startswith(("UPDATE", "INSERT", "DELETE")) for q in connection.queries())
    assert connection.queries()[-1] == "ROLLBACK"


async def test_a_deleted_note_cannot_be_edited_and_the_refusal_names_who_deleted_it() -> None:
    storage, connection = await _open(script(row=False, closed={"deleted_by": "Ilya", "deleted_at": "2026-11-08T11:00:00.000000Z"}))
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.edit_note(ORG, NOTE, "Mine", SAW, EDITOR, "EditNoteAction")
    assert refusal.value.body == {"error": "deleted", "deleted_by": "Ilya", "deleted_at": "2026-11-08T11:00:00.000000Z"}
    assert not any(q.startswith(("UPDATE", "INSERT", "DELETE")) for q in connection.queries())


async def test_a_note_that_never_was_is_not_found() -> None:
    storage, _connection = await _open(script(row=False))
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.delete_note(ORG, NOTE, SAW, EDITOR, "DeleteNoteAction")
    assert (refusal.value.reason, refusal.value.status) == ("no_such_note", 404)


async def test_the_same_text_writes_nothing() -> None:
    storage, connection = await _open(script(body="Same"))
    assert await storage.edit_note(ORG, NOTE, "Same", SAW, EDITOR, "EditNoteAction") == OPENED
    assert not any(q.startswith(("UPDATE", "INSERT")) for q in connection.queries())
    assert "COMMIT" not in connection.queries()


async def test_a_base_moment_not_come_is_refused() -> None:
    storage, connection = await _open(script())
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.edit_note(ORG, NOTE, "Mine", "2026-12-01T00:00:00.000000Z", EDITOR, "EditNoteAction")
    assert (refusal.value.reason, refusal.value.status) == ("moment_not_come", 422)
    assert not any("FOR UPDATE" in q for q in connection.queries())


async def test_a_deletion_deletes_the_row_and_closes_its_version_with_no_new_version() -> None:
    storage, connection = await _open(script())
    assert await storage.delete_note(ORG, NOTE, SAW, EDITOR, "DeleteNoteAction") == NOW
    queries = connection.queries()
    delete = next(q for q in queries if q.startswith("DELETE FROM note "))
    close = next(i for i, q in enumerate(queries) if q.startswith("UPDATE note_versions SET valid_to_at"))
    assert queries.index(delete) < close
    assert connection.statements[close][1][3:] == (EDITOR, "DeleteNoteAction")
    assert not any(q.startswith("INSERT") for q in queries)
    assert queries[-1] == "COMMIT"


async def test_a_deletion_of_a_note_changed_since_is_refused_too() -> None:
    storage, connection = await _open(script(since="2026-11-08T12:00:00.000000Z"))
    with pytest.raises(NotesRefusalError):
        await storage.delete_note(ORG, NOTE, SAW, EDITOR, "DeleteNoteAction")
    assert not any(q.startswith("DELETE") for q in connection.queries())
