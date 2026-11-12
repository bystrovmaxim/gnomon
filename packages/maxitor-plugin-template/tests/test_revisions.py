"""Publishing the whole draft: one revision, its conflicts overwritten or given up, nothing left to publish."""

from datetime import UTC, datetime

import pytest
from maxitor_notes.notes_refusal_error import NotesRefusalError
from maxitor_notes.storage.notes_storage import NotesStorage

from tests.recording_database import recording_pool

ORG = "11111111-1111-1111-1111-111111111111"
ITEM = "22222222-2222-2222-2222-222222222222"
ANN = "33333333-3333-3333-3333-333333333333"
NOTE = "44444444-4444-4444-4444-444444444444"
NOW = "2026-11-10T11:25:00.000000Z"
BASE = "The settlement window"
OLGA_AT = "2026-11-10T11:05:00.000000Z"


def _change(**over):
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


def _published(**over):
    row = {"id": NOTE, "body": BASE, "writer_id": ANN, "by_name": "Anna", "at": NOW, "created_at": NOW}
    row.update(over)
    return row


def script(*, changes=None, published=None, deleted=None, last=(6, BASE), revision=None, notes=None):
    def answer(query, params):
        if "watermark($1::text::uuid)" in query:
            return NOW
        if "change_time($1::text::uuid)" in query:
            return datetime(2026, 11, 10, 11, 25, tzinfo=UTC)
        if query.startswith("SELECT to_char($1::timestamptz"):
            return NOW
        if query.startswith("SELECT number, created_at FROM revision"):
            return None if last is None else {"number": last[0], "created_at": last[1]}
        if "FROM note_change WHERE" in query:
            return changes if changes is not None else []
        if "FROM note_change_versions d" in query:
            return changes if changes is not None else []
        if "n.item_id::text AS item_id" in query:
            return notes or []
        if "DISTINCT ON (n.id)" in query:
            return [{"id": row["id"], "writer_id": row.get("writer_id", ANN), "created_at": row.get("created_at", NOW)} for row in deleted or []]
        if "valid_to_at IS NULL" in query and "FROM note_versions n" in query:
            return published if published is not None else []
        if "closed_by IS NOT NULL" in query:
            return deleted or []
        if "FROM revision_versions r" in query:
            return revision
        return None

    return answer


async def _open(answer):
    pool, connection = recording_pool(answer)
    storage = NotesStorage(pool=pool)
    await storage.open()
    return storage, connection


async def test_a_draft_with_nothing_in_it_has_nothing_to_publish() -> None:
    storage, connection = await _open(script(changes=[]))
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.publish_notes(ORG, ITEM, ANN, "Again", "Nothing", None, {}, ANN, "PublishNotesAction")
    assert refusal.value.body == {"error": "nothing_to_publish", "revision": 6}
    assert not any(query.startswith(("INSERT", "UPDATE", "DELETE")) for query in connection.queries())
    assert connection.queries()[-1] == "ROLLBACK"


async def test_a_new_note_is_published_as_the_first_revision_and_the_draft_is_emptied() -> None:
    storage, connection = await _open(script(changes=[_change(state="new", base_body=None, base_revision=None)], last=None))
    number, moment = await storage.publish_notes(ORG, ITEM, ANN, "First review", "Agreed", None, {}, ANN, "PublishNotesAction")
    assert (number, moment) == (1, NOW)
    queries = connection.queries()
    assert any(query.startswith("INSERT INTO note ") for query in queries)
    assert any(query.startswith("INSERT INTO revision ") for query in queries)
    assert "DELETE FROM note_change WHERE" in "".join(queries)
    assert queries[-1] == "COMMIT"
    assert not any("nothing_to_publish" in query for query in queries)


async def test_a_change_that_meets_another_publication_is_refused_with_the_list_and_nothing_is_written() -> None:
    storage, connection = await _open(
        script(
            changes=[_change()],
            published=[_published(body="Olga's text", by_name="Olga", at=OLGA_AT)],
        )
    )
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.publish_notes(ORG, ITEM, ANN, "Mine", "Agreed", None, {}, ANN, "PublishNotesAction")
    assert refusal.value.status == 409
    assert refusal.value.body["error"] == "conflicts"
    conflict = refusal.value.body["conflicts"][0]
    assert (conflict["note_id"], conflict["body"], conflict["published_body"], conflict["published_by_name"]) == (NOTE, "Mine", "Olga's text", "Olga")
    assert not any(query.startswith(("INSERT", "UPDATE", "DELETE")) for query in connection.queries())
    assert connection.queries()[-1] == "ROLLBACK"


async def test_an_overwritten_conflict_replaces_the_published_text_and_goes_into_the_revision() -> None:
    storage, connection = await _open(
        script(changes=[_change()], published=[_published(body="Olga's text", by_name="Olga", at=OLGA_AT)])
    )
    number, _moment = await storage.publish_notes(
        ORG, ITEM, ANN, "Mine", "Agreed", None, {NOTE: "overwrite"}, ANN, "PublishNotesAction"
    )
    assert number == 7
    queries = connection.queries()
    assert any(query.startswith("UPDATE note SET body") for query in queries)
    assert any("closed_by = $4::text::uuid" in query for query in queries)
    assert any(query.startswith("INSERT INTO revision ") for query in queries)
    assert "DELETE FROM note_change WHERE" in "".join(queries)
    assert queries[-1] == "COMMIT"


async def test_a_given_up_change_leaves_the_draft_and_nothing_is_published() -> None:
    storage, connection = await _open(
        script(changes=[_change()], published=[_published(body="Olga's text", by_name="Olga", at=OLGA_AT)])
    )
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.publish_notes(ORG, ITEM, ANN, "Mine", "Agreed", None, {NOTE: "give_up"}, ANN, "PublishNotesAction")
    assert refusal.value.body["error"] == "nothing_to_publish"
    queries = connection.queries()
    assert "DELETE FROM note_change WHERE" in "".join(queries)
    assert not any(query.startswith("INSERT INTO revision ") for query in queries)
    assert queries[-1] == "COMMIT"


async def test_a_conflict_that_appeared_since_the_dialog_is_answered_again() -> None:
    storage, _connection = await _open(
        script(changes=[_change(), _change(note_id="n2", base_body="Old two", body="Mine two")], published=[_published(body="Olga's text", by_name="Olga", at=OLGA_AT)])
    )
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.publish_notes(ORG, ITEM, ANN, "Mine", "Agreed", None, {NOTE: "overwrite"}, ANN, "PublishNotesAction")
    assert [conflict["note_id"] for conflict in refusal.value.body["conflicts"]] == [NOTE, "n2"]


async def test_a_note_deleted_since_is_restored_with_the_member_text_and_its_own_writer() -> None:
    storage, connection = await _open(
        script(
            changes=[_change()],
            published=[],
            deleted=[{"id": NOTE, "by_name": "Olga", "at": OLGA_AT}],
        )
    )
    number, _moment = await storage.publish_notes(
        ORG, ITEM, ANN, "Mine", "Agreed", None, {NOTE: "overwrite"}, ANN, "PublishNotesAction"
    )
    assert number == 7
    insert = next(statement for statement in connection.statements if statement[0].startswith("INSERT INTO note "))
    assert insert[1][3] == ANN
    assert "INSERT INTO note_versions " in "".join(connection.queries())
    # The restored note keeps its creation moment as the database gave it: a timestamp, never its text, which the
    # driver refuses for a timestamptz column.
    identities = next(query for query in connection.queries() if query.startswith("SELECT DISTINCT ON (n.id)"))
    assert "n.created_at AS created_at" in identities
    assert "to_char(n.created_at" not in identities


async def test_the_published_notes_at_a_past_moment_are_the_revision_in_force_then() -> None:
    storage, _connection = await _open(
        script(
            revision={"number": 5, "ref": "v5", "title": "Earlier", "comment": "C", "release": None, "publisher_id": ANN, "publisher_name": "Anna", "at": "2026-11-09T17:30:00.000000Z"},
            notes=[{"id": NOTE, "item_id": ITEM, "writer_id": ANN, "writer_name": "Anna", "body": "Old text", "updated_at": NOW, "since": NOW, "changed_by": "Anna"}],
        )
    )
    revision, notes = await storage.published_notes(ORG, ITEM, "2026-11-09T17:30:00.000000Z")
    assert revision.ref == "v5"
    assert [note.body for note in notes] == ["Old text"]


OTHER = "55555555-5555-5555-5555-555555555555"
V3_AT = "2026-11-04T12:00:00.000000Z"


def _held(note_id, body):
    """A note as revision 3 held it."""
    return {"id": note_id, "item_id": ITEM, "writer_id": ANN, "writer_name": "Anna", "body": body, "updated_at": V3_AT, "since": V3_AT, "changed_by": "Anna"}


def rollback_script(**over):
    """The publishing script, and revision 3's moment for the rollback to read its notes at."""
    base = script(**over)

    def answer(query, params):
        if "AS at FROM revision WHERE" in query:
            return {"at": V3_AT}
        return base(query, params)

    return answer


async def test_a_rollback_publishes_the_notes_of_a_past_revision_as_the_next_one_and_names_it() -> None:
    storage, connection = await _open(
        rollback_script(
            published=[_published(body="Retry five times"), _published(id=OTHER, body="Payouts twice a day")],
            notes=[_held(NOTE, "Retry three times")],
        )
    )
    number, moment = await storage.rollback_publication(ORG, ITEM, 3, "Back to v3", "The retry change broke the import.", ANN, "RollbackPublicationAction")
    assert (number, moment) == (7, NOW)
    queries = connection.queries()
    update = next(statement for statement in connection.statements if statement[0].startswith("UPDATE note SET body"))
    assert update[1][2] == "Retry three times"
    assert any(query.startswith("DELETE FROM note WHERE") for query in queries)
    revision = next(statement for statement in connection.statements if statement[0].startswith("INSERT INTO revision "))
    assert (revision[1][3], revision[1][4], revision[1][9]) == (7, "Back to v3", 3)
    # Nothing of anyone's draft is touched, and the revisions between stay as they are.
    assert not any("note_change" in query for query in queries if query.startswith(("DELETE", "UPDATE", "INSERT")))
    assert not any(query.startswith("UPDATE revision") or query.startswith("DELETE FROM revision") for query in queries)
    assert queries[-1] == "COMMIT"


async def test_a_rollback_opens_again_a_note_the_item_no_longer_publishes() -> None:
    storage, connection = await _open(
        rollback_script(published=[], deleted=[{"id": NOTE, "by_name": "Olga", "at": OLGA_AT}], notes=[_held(NOTE, "Tokens rotate every 90 days")])
    )
    await storage.rollback_publication(ORG, ITEM, 3, "Back to v3", "Tokens are back.", ANN, "RollbackPublicationAction")
    insert = next(statement for statement in connection.statements if statement[0].startswith("INSERT INTO note "))
    assert insert[1][4] == "Tokens rotate every 90 days"


@pytest.mark.parametrize("to_revision, last", [(6, (6, BASE)), (9, (6, BASE)), (1, None)])
async def test_only_a_revision_older_than_the_one_in_force_is_brought_back(to_revision, last) -> None:
    storage, connection = await _open(rollback_script(last=last))
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.rollback_publication(ORG, ITEM, to_revision, "Back", "Why", ANN, "RollbackPublicationAction")
    assert (refusal.value.status, refusal.value.body["error"]) == (422, "not_a_past_revision")
    assert not any(query.startswith(("INSERT", "UPDATE", "DELETE")) for query in connection.queries())
    assert connection.queries()[-1] == "ROLLBACK"
