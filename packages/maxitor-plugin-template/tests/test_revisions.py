"""Revisions: consecutive numbers under the lock, nothing to publish refused, the published notes and the draft at any moment."""

import inspect
from datetime import UTC, datetime

import pytest
from maxitor_notes.notes_refusal_error import NotesRefusalError
from maxitor_notes.storage.notes_storage import NotesStorage

from tests.recording_database import recording_pool

ORG = "11111111-1111-1111-1111-111111111111"
ITEM = "22222222-2222-2222-2222-222222222222"
ANN = "33333333-3333-3333-3333-333333333333"
NOW = "2026-11-10T11:24:00.000000Z"
V1 = "2026-11-04T12:00:00.000000Z"
V2 = "2026-11-07T09:30:00.000000Z"
BETWEEN = "2026-11-06T18:00:00.000000Z"


def _note(note_id, body, since, by="Anna"):
    return {"id": note_id, "item_id": ITEM, "writer_id": ANN, "writer_name": "Anna", "body": body, "updated_at": since, "since": since, "changed_by": by}


#: What the item's notes read at each moment: v1's, then an edit, an addition and a deletion before now.
NOTES = {
    V1: [_note("n1", "Retry three times", V1), _note("n2", "Import by 06:00", V1), _note("n3", "Tokens at the provider", V1)],
    NOW: [_note("n1", "Retry five times", "2026-11-05T16:30:00.000000Z", "Ilya"), _note("n2", "Import by 06:00", V1), _note("n4", "Chargebacks", "2026-11-06T10:15:00.000000Z", "Olga")],
}


def script(*, last=None, changed=True, revision_at=V1):
    """A database with the last revision ``last`` (number, time), changes since it or none, the revision ``revision_at`` in force."""

    def answer(query, params):
        if "watermark($1::text::uuid)" in query:
            return NOW
        if "change_time($1::text::uuid)" in query:
            return datetime(2026, 11, 10, 11, 25, tzinfo=UTC)
        if query.startswith("SELECT to_char($1::timestamptz"):
            return "2026-11-10T11:25:00.000000Z"
        if query.startswith("SELECT number, created_at FROM revision"):
            return None if last is None else {"number": last[0], "created_at": last[1]}
        if query.startswith("SELECT EXISTS"):
            return changed
        if "FROM revision_versions r" in query:
            return None if revision_at is None else {"number": 1, "ref": "v1", "title": "First review", "comment": "Agreed", "release": None, "publisher_id": ANN, "publisher_name": "Anna", "at": revision_at}
        if "FROM note_versions n" in query and "closed_by IS NOT NULL" in query:
            return [{"id": "n3", "by_name": "Ilya", "at": "2026-11-06T14:48:00.000000Z"}]
        if "FROM note_versions n" in query:
            return NOTES.get(params[2], [])
        return None

    return answer


async def _open(answer):
    pool, connection = recording_pool(answer)
    storage = NotesStorage(pool=pool)
    await storage.open()
    return storage, connection


async def test_the_first_revision_is_v1_and_the_next_takes_the_next_number_under_the_lock() -> None:
    storage, connection = await _open(script())
    assert (await storage.publish_notes(ORG, ITEM, "First review", "Agreed", None, ANN, "PublishNotesAction"))[0] == 1
    queries = connection.queries()
    assert queries[1].startswith("SELECT greatest(change_time($1::text::uuid)")
    assert queries.index(next(q for q in queries if "FROM revision WHERE" in q)) > 1
    storage, connection = await _open(script(last=(2, V2)))
    number, moment = await storage.publish_notes(ORG, ITEM, "Partial refunds", "Fees kept", "handbook 2026.11", ANN, "PublishNotesAction")
    assert (number, moment) == (3, "2026-11-10T11:25:00.000000Z")
    insert = next(statement for statement in connection.statements if statement[0].startswith("INSERT INTO revision "))
    assert insert[1][3:8] == (3, "Partial refunds", "Fees kept", "handbook 2026.11", ANN)
    assert any(q.startswith("INSERT INTO revision_versions") for q in connection.queries())


async def test_nothing_changed_since_the_last_revision_is_nothing_to_publish() -> None:
    storage, connection = await _open(script(last=(2, V2), changed=False))
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.publish_notes(ORG, ITEM, "Again", "Nothing", None, ANN, "PublishNotesAction")
    assert refusal.value.body == {"error": "nothing_to_publish", "revision": 2}
    assert not any(q.startswith("INSERT") for q in connection.queries())


async def test_the_published_notes_between_two_revisions_are_the_earlier_ones_as_they_read_when_it_was_published() -> None:
    storage, connection = await _open(script(revision_at=V1))
    revision, notes = await storage.published_notes(ORG, ITEM, BETWEEN)
    assert revision.ref == "v1"
    assert [note.body for note in notes] == ["Retry three times", "Import by 06:00", "Tokens at the provider"]
    reads = [params for query, params in connection.statements if "FROM note_versions n" in query]
    assert reads[-1][2] == V1


async def test_before_the_first_revision_nothing_is_published() -> None:
    storage, _connection = await _open(script(revision_at=None))
    assert await storage.published_notes(ORG, ITEM, BETWEEN) == (None, [])


async def test_the_draft_lists_each_note_added_changed_or_removed_since_the_revision_with_who_and_when() -> None:
    storage, _connection = await _open(script(revision_at=V1))
    revision, changes = await storage.draft(ORG, ITEM, None)
    assert revision.ref == "v1"
    found = {(change.note_id, change.kind, change.by_name) for change in changes}
    assert found == {("n1", "changed", "Ilya"), ("n4", "added", "Olga"), ("n3", "removed", "Ilya")}
    changed = next(change for change in changes if change.kind == "changed")
    assert (changed.before, changed.body) == ("Retry three times", "Retry five times")
    assert [change.at for change in changes] == sorted(change.at for change in changes)


def test_no_action_changes_a_revision_once_it_is_published() -> None:
    from maxitor_notes import app

    storage = inspect.getsource(NotesStorage)
    assert "UPDATE revision" not in storage and "DELETE FROM revision" not in storage
    routes = inspect.getsource(app)
    assert "revisions/{" not in routes
