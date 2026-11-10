# packages/maxitor-plugin-template/tests/test_notes_storage.py
"""NotesStorage: a write is one transaction under the organization's lock; a read is bound to one organization and one moment."""

import re
from datetime import UTC, datetime

import pytest
from maxitor_notes.notes_refusal_error import NotesRefusalError
from maxitor_notes.storage.notes_storage import NotesStorage

from aoa.action_machine.exceptions import HandleError
from tests.recording_database import recording_pool

ORG = "11111111-1111-1111-1111-111111111111"
ITEM = "22222222-2222-2222-2222-222222222222"
WRITER = "33333333-3333-3333-3333-333333333333"
MOMENT = "2026-11-08T10:15:00.123456Z"


LATER = "2026-11-09T10:15:00.123456Z"


def _answer(query, params):
    if "watermark($1::text::uuid)" in query:
        return LATER
    if "change_time($1::text::uuid)" in query:
        return datetime(2026, 11, 8, 10, 15, tzinfo=UTC)
    if query.startswith("SELECT to_char($1::timestamptz"):
        return MOMENT
    if "FROM note_versions n" in query and "DISTINCT" not in query:
        return [{"id": "n1", "item_id": ITEM, "writer_id": WRITER, "writer_name": "Ann", "body": "Check the limits", "updated_at": MOMENT, "since": MOMENT}]
    if "DISTINCT n.writer_id" in query:
        return [{"id": WRITER, "name": "Ann"}]
    return None


async def _open(answer=_answer):
    pool, connection = recording_pool(answer)
    storage = NotesStorage(pool=pool)
    await storage.open()
    return storage, connection


async def test_a_note_is_written_with_its_version_in_one_transaction_under_the_lock() -> None:
    storage, connection = await _open()
    changed_at = await storage.add_note(ORG, ITEM, WRITER, "Check the limits", "AddNoteAction")
    queries = connection.queries()
    assert changed_at == MOMENT
    assert queries[0] == "BEGIN"
    assert queries[1].startswith("SELECT greatest(change_time($1::text::uuid)")
    assert queries[2].startswith("INSERT INTO note ")
    assert queries[3].startswith("INSERT INTO note_versions ")
    assert queries[-1] == "COMMIT"


async def test_the_time_comes_from_the_cores_lock_and_follows_the_plugins_own_changes() -> None:
    storage, connection = await _open()
    await storage.add_note(ORG, ITEM, WRITER, "Check the limits", "AddNoteAction")
    time = connection.queries()[1]
    assert "change_time($1::text::uuid)" in time and "FROM note_versions WHERE organization_id = $1::text::uuid" in time
    assert "+ interval '1 microsecond'" in time
    assert not any("pg_advisory" in q for q in connection.queries())  # the core's function takes the lock


async def test_a_failed_write_rolls_back_and_leaves_nothing() -> None:
    pool, connection = recording_pool(_answer)
    connection.execute = _raising_on_versions(connection)
    storage = NotesStorage(pool=pool)
    await storage.open()
    with pytest.raises(HandleError):
        await storage.add_note(ORG, ITEM, WRITER, "Check the limits", "AddNoteAction")
    assert connection.queries()[-1] == "ROLLBACK"
    assert "COMMIT" not in connection.queries()


def _raising_on_versions(connection):
    original = connection.execute

    async def execute(query, *params):
        if query.startswith("INSERT INTO note_versions"):
            connection.statements.append((query, params))
            raise RuntimeError("the database refused")
        return await original(query, *params)

    return execute


@pytest.mark.parametrize("read", ["notes", "authors"])
async def test_every_version_table_of_a_read_is_bound_to_the_organization_and_the_moment(read) -> None:
    storage, connection = await _open()
    if read == "notes":
        await storage.notes_of_item(ORG, ITEM, MOMENT, None)
    else:
        await storage.note_authors(ORG, ITEM, MOMENT, 50, None)
    query = connection.queries()[-1]
    aliases = re.findall(r'(?:FROM|JOIN) (?:"?\w+"?\.)?"?(\w+_versions)"? (\w+)', query)
    assert {table for table, _alias in aliases} == {"note_versions"}
    assert "member_name(n.organization_id, n.writer_id, $3::text::timestamptz)" in query
    assert "user" not in query.replace("member_name", "")
    for _table, alias in aliases:
        assert f"{alias}.valid_from_at <= $3::text::timestamptz" in query
        assert f"{alias}.valid_to_at IS NULL OR {alias}.valid_to_at > $3::text::timestamptz" in query
        assert f"{alias}.organization_id" in query
    assert connection.statements[-1][1][:3] == (ORG, ITEM, MOMENT)


async def test_a_read_without_a_moment_reads_at_the_watermark() -> None:
    def answer(query, params):
        if "watermark($1::text::uuid)" in query:
            return MOMENT
        return _answer(query, params)

    storage, connection = await _open(answer)
    notes = await storage.notes_of_item(ORG, ITEM, None, None)
    assert [note.id for note in notes] == ["n1"]
    assert connection.statements[-1][1][2] == MOMENT


async def test_an_organization_without_changes_has_no_notes_and_no_query_for_them() -> None:
    storage, connection = await _open(lambda query, params: None)
    assert await storage.notes_of_item(ORG, ITEM, None, None) == []
    assert not any("FROM note_versions n" in query for query in connection.queries())


async def test_membership_is_asked_of_the_cores_function_never_of_its_tables() -> None:
    storage, connection = await _open(lambda query, params: ORG if "member_organization(" in query else None)
    assert await storage.organization_of("acme", WRITER) == ORG
    query, params = connection.statements[-1]
    assert query == "SELECT member_organization($1, $2::text::uuid)::text"
    assert params == ("acme", WRITER)


@pytest.mark.parametrize("read", ["notes", "authors"])
async def test_a_moment_later_than_the_watermark_is_refused_and_nothing_is_read(read) -> None:
    storage, connection = await _open()
    future = "2026-11-10T00:00:00.000000Z"
    with pytest.raises(NotesRefusalError) as refusal:
        if read == "notes":
            await storage.notes_of_item(ORG, ITEM, future, None)
        else:
            await storage.note_authors(ORG, ITEM, future, 50, None)
    assert (refusal.value.reason, refusal.value.status) == ("moment_not_come", 422)
    assert refusal.value.body == {"error": "moment_not_come", "watermark": LATER}
    assert not any("FROM note_versions n" in query for query in connection.queries())


async def test_any_moment_before_an_organizations_first_change_is_refused() -> None:
    storage, _connection = await _open(lambda query, params: None)
    with pytest.raises(NotesRefusalError):
        await storage.notes_of_item(ORG, ITEM, MOMENT, None)
