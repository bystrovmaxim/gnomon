"""The template's own items: adding and renaming them with their events, a unique title, notes only on an item of the organization, and the list of items as the source of the tree's list node."""

from datetime import UTC, datetime
from pathlib import Path

import pytest
from maxitor_notes.actions.add_item_action import AddItemAction, AddItemParams
from maxitor_notes.actions.add_note_action import AddNoteAction, AddNoteParams
from maxitor_notes.actions.list_items_action import ListItemsAction, ListItemsParams
from maxitor_notes.actions.publish_notes_action import PublishNotesAction, PublishNotesParams
from maxitor_notes.actions.rename_item_action import RenameItemAction, RenameItemParams
from maxitor_notes.events import ItemAddedEvent, ItemRenamedEvent
from maxitor_notes.notes_refusal_error import NotesRefusalError
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage
from maxitor_plugin_sdk.plugin_schema import read_plugin_schema
from maxitor_plugin_sdk.roles import MemberRole
from pydantic import ValidationError

from aoa.action_machine.exceptions.access_denied import AccessDenied
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.intents.access_control import FORBIDDEN_OBJECT
from aoa.action_machine.logging.base_logger import BaseLogger
from aoa.action_machine.logging.log_coordinator import LogCoordinator
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine
from tests.recording_database import recording_pool
from tests.test_notes_actions import ACME, ANN, ITEM, MOMENT, ScriptedNotesStorage, _context

SCHEMA = Path(__file__).resolve().parents[1] / "src" / "maxitor_notes" / "schema.yaml"
ELSEWHERE = "99999999-9999-9999-9999-999999999999"
NOW = "2026-11-10T11:25:00.000000Z"
SEEN = "2026-11-10T09:00:00.000000Z"


class RecordingLogger(BaseLogger):
    """Every line the run writes, with its variables."""

    def __init__(self) -> None:
        super().__init__()
        self.lines: list[tuple[str, dict]] = []

    async def write(self, scope, message, var, ctx, state, params, indent) -> None:
        self.lines.append((message, dict(var)))


async def _run(action, params, storage=None):
    storage = storage or ScriptedNotesStorage()
    logger = RecordingLogger()
    machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator(), log_coordinator=LogCoordinator(loggers=[logger]))
    result = await machine.run(_context("acme", (MemberRole,)), action, params, {NOTES_CONNECTION_KEY: storage})
    return result, storage, logger


def _events(logger: RecordingLogger) -> list[str]:
    """The lines about items the run wrote."""
    return [message for message, _var in logger.lines if message.startswith("Item ")]


# --- the actions -------------------------------------------------------------------------------------------------


async def test_a_member_adds_an_item_and_the_event_says_so() -> None:
    result, storage, logger = await _run(AddItemAction(), AddItemParams(title="Payment service"))
    assert (result.item_id, result.changed_at) == (ITEM, MOMENT)
    assert storage.calls[-1] == ("add_item", ACME, "Payment service", ANN, "AddItemAction")
    assert _events(logger) == [f"Item {ITEM} added: Payment service"]


def test_the_events_are_the_domains_own() -> None:
    from maxitor_notes.notes_domain import NotesDomain

    assert NotesDomain.events == (ItemAddedEvent, ItemRenamedEvent)


@pytest.mark.parametrize(("given", "kept"), [("  Payments ", "Payments"), ("x" * 200, "x" * 200), (" " + "x" * 200 + " ", "x" * 200)])
def test_a_title_is_kept_without_the_spaces_at_its_ends(given, kept) -> None:
    assert AddItemParams(title=given).title == kept
    assert RenameItemParams(item_id=ITEM, title=given, base_moment=MOMENT).title == kept


@pytest.mark.parametrize("title", ["", "   ", "x" * 201])
def test_a_title_empty_or_longer_than_200_characters_is_refused(title) -> None:
    with pytest.raises(ValidationError):
        AddItemParams(title=title)
    with pytest.raises(ValidationError):
        RenameItemParams(item_id=ITEM, title=title, base_moment=MOMENT)


@pytest.mark.parametrize(
    ("action", "params", "written"),
    [
        (AddNoteAction(), AddNoteParams(item_id=ELSEWHERE, body="Check"), "add_note_change"),
        (PublishNotesAction(), PublishNotesParams(item_id=ELSEWHERE, title="T", comment="C"), "publish_notes"),
        (RenameItemAction(), RenameItemParams(item_id=ELSEWHERE, title="Billing", base_moment=MOMENT), "rename_item"),
        (AddNoteAction(), AddNoteParams(item_id="not-a-uuid", body="Check"), "add_note_change"),
    ],
)
async def test_an_item_that_is_not_one_of_the_organization_is_refused_and_nothing_is_written(action, params, written) -> None:
    storage = ScriptedNotesStorage()
    with pytest.raises(AccessDenied) as refusal:
        await _run(action, params, storage=storage)
    assert refusal.value.verdict == FORBIDDEN_OBJECT
    assert written not in [call[0] for call in storage.calls]


async def test_a_note_on_an_item_of_the_organization_is_written() -> None:
    _result, storage, _logger = await _run(AddNoteAction(), AddNoteParams(item_id=ITEM, body="Check"))
    assert ("item_of", ACME, ITEM) in storage.calls
    assert storage.calls[-1][0] == "add_note_change"


async def test_a_rename_says_the_old_and_the_new_title() -> None:
    result, storage, logger = await _run(RenameItemAction(), RenameItemParams(item_id=ITEM, title="Billing", base_moment=MOMENT))
    assert result.changed_at == MOMENT
    assert storage.calls[-1] == ("rename_item", ACME, ITEM, "Billing", MOMENT, ANN, "RenameItemAction")
    assert _events(logger) == [f"Item {ITEM} renamed from Payments to Billing"]


async def test_a_rename_that_changes_nothing_writes_no_event() -> None:
    _result, _storage, logger = await _run(RenameItemAction(), RenameItemParams(item_id=ITEM, title="Payments", base_moment=MOMENT), ScriptedNotesStorage(renamed=False))
    assert _events(logger) == []


async def test_the_list_of_items_comes_in_parts_each_item_once() -> None:
    storage = ScriptedNotesStorage(items=tuple(f"Item {n:03d}" for n in range(120)))
    seen, parts, after = [], 0, None
    while True:
        result, _storage, _logger = await _run(ListItemsAction(), ListItemsParams(limit=50, after=after), storage)
        parts += 1
        seen += [entry.key for entry in result.entries]
        if result.next is None:
            break
        after = result.next
    assert parts == 3
    assert len(seen) == len(set(seen)) == 120
    assert {entry.icon for entry in result.entries} == {"folder"}


async def test_the_list_is_read_at_the_moment_of_the_address_and_asks_one_more_than_the_part() -> None:
    result, storage, _logger = await _run(ListItemsAction(), ListItemsParams(at=MOMENT, limit=2), ScriptedNotesStorage(items=("A", "B")))
    assert storage.calls[-1] == ("items_at", ACME, MOMENT, 3, None)
    assert [entry.title for entry in result.entries] == ["A", "B"]
    assert result.next is None


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 201}, {"after": "p1"}, {"at": "now"}])
def test_a_part_outside_the_lists_contract_is_refused(params) -> None:
    with pytest.raises(ValidationError):
        ListItemsParams(**params)


# --- the storage ---------------------------------------------------------------------------------------------------


def script(*, taken=False, title="Payments", since=SEEN, items=()):
    """A database whose item has ``title`` and whose open version started at ``since``; ``taken`` another item's title."""

    def answer(query, params):
        if "change_time($1::text::uuid)" in query:
            return datetime(2026, 11, 10, 11, 25, tzinfo=UTC)
        if "watermark($1::text::uuid)" in query:
            return NOW
        if query.startswith("SELECT to_char($1::timestamptz"):
            return NOW
        if "FROM item WHERE organization_id = $1::text::uuid AND title = $2" in query:
            return taken
        if query.startswith("SELECT title FROM item"):
            return None if title is None else {"title": title}
        if "FROM item_versions i" in query:
            return list(items)
        if "FROM item_versions" in query and "valid_to_at IS NULL" in query:
            return {"since": since, "changed_by": "Ilya"}
        return None

    return answer


async def _storage(answer):
    pool, connection = recording_pool(answer)
    storage = NotesStorage(pool=pool)
    await storage.open()
    return storage, connection


async def test_adding_reads_the_title_only_after_the_organizations_lock_and_writes_the_item_and_its_version() -> None:
    storage, connection = await _storage(script())
    item_id, moment = await storage.add_item(ACME, "Payments", ANN, "AddItemAction")
    assert moment == NOW and item_id
    queries = connection.queries()
    lock = next(i for i, q in enumerate(queries) if "change_time" in q)
    check = next(i for i, q in enumerate(queries) if "FROM item WHERE organization_id = $1::text::uuid AND title = $2" in q)
    insert = next(i for i, q in enumerate(queries) if q.startswith("INSERT INTO item "))
    assert lock < check < insert
    assert any(q.startswith("INSERT INTO item_versions") for q in queries)


async def test_a_title_another_item_has_now_is_refused_and_nothing_is_written() -> None:
    storage, connection = await _storage(script(taken=True))
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.add_item(ACME, "Payments", ANN, "AddItemAction")
    assert (refusal.value.reason, refusal.value.status) == ("title_taken", 409)
    assert not any(q.startswith("INSERT") for q in connection.queries())
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.rename_item(ACME, ITEM, "Billing", SEEN, ANN, "RenameItemAction")
    assert refusal.value.reason == "title_taken"
    assert not any(q.startswith(("INSERT", "UPDATE")) for q in connection.queries())


async def test_a_title_is_free_against_the_other_items_now_not_against_past_titles() -> None:
    storage, connection = await _storage(script())
    await storage.rename_item(ACME, ITEM, "Billing", SEEN, ANN, "RenameItemAction")
    check = next((q, p) for q, p in connection.statements if "AND title = $2" in q)
    assert "FROM item WHERE" in check[0] and "item_versions" not in check[0]
    assert check[1] == (ACME, "Billing", ITEM)


async def test_a_rename_closes_the_open_version_and_opens_the_new_one() -> None:
    storage, connection = await _storage(script())
    assert await storage.rename_item(ACME, ITEM, "Billing", SEEN, ANN, "RenameItemAction") == ("Payments", NOW, True)
    queries = connection.queries()
    assert any(q.startswith("UPDATE item SET title") for q in queries)
    assert any(q.startswith("UPDATE item_versions SET valid_to_at") for q in queries)
    assert any(q.startswith("INSERT INTO item_versions") for q in queries)


async def test_a_rename_based_on_a_moment_before_someone_elses_change_is_refused() -> None:
    storage, connection = await _storage(script(since="2026-11-10T10:00:00.000000Z"))
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.rename_item(ACME, ITEM, "Billing", SEEN, ANN, "RenameItemAction")
    assert (refusal.value.reason, refusal.value.status) == ("changed_since", 409)
    assert refusal.value.details == {"changed_by": "Ilya", "changed_at": "2026-11-10T10:00:00.000000Z"}
    assert not any(q.startswith(("INSERT", "UPDATE")) for q in connection.queries())


async def test_a_rename_to_the_title_it_has_writes_nothing() -> None:
    storage, connection = await _storage(script(title="Billing"))
    assert await storage.rename_item(ACME, ITEM, "Billing", SEEN, ANN, "RenameItemAction") == ("Billing", SEEN, False)
    assert not any(q.startswith(("INSERT", "UPDATE")) for q in connection.queries())


async def test_a_rename_based_on_a_moment_not_come_is_refused() -> None:
    storage, _connection = await _storage(script())
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.rename_item(ACME, ITEM, "Billing", "2026-11-11T00:00:00.000000Z", ANN, "RenameItemAction")
    assert refusal.value.reason == "moment_not_come"


async def test_the_list_reads_the_items_at_the_moment_by_title_after_the_last_entry_of_the_part_before() -> None:
    rows = [{"key": ITEM, "title": "Payments"}]
    storage, connection = await _storage(script(items=rows))
    entries = await storage.items_at(ACME, MOMENT, 51, ELSEWHERE)
    assert [(e.key, e.title, e.icon) for e in entries] == [(ITEM, "Payments", "folder")]
    query, params = next((q, p) for q, p in connection.statements if "FROM item_versions i" in q)
    assert "ORDER BY i.title, i.id LIMIT $4" in query
    assert "(i.title, i.id) > (SELECT a.title, a.id FROM item_versions a" in query
    assert params == (ACME, MOMENT, ELSEWHERE, 51)


async def test_the_list_at_a_moment_not_come_is_refused() -> None:
    storage, _connection = await _storage(script())
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.items_at(ACME, "2026-11-11T00:00:00.000000Z", 50, None)
    assert refusal.value.reason == "moment_not_come"


async def test_an_item_id_that_is_no_uuid_is_no_item_and_asks_nothing() -> None:
    storage, connection = await _storage(script())
    assert await storage.item_of(ACME, "not-a-uuid") is False
    assert connection.queries() == []


# --- the schema ----------------------------------------------------------------------------------------------------


def test_a_note_and_a_revision_point_at_an_item_of_the_plugin() -> None:
    schema = read_plugin_schema(SCHEMA)
    assert schema.table("item").unique == (("title",),)
    for name in ("note", "revision"):
        assert [(k.columns, k.table, k.references) for k in schema.table(name).keys] == [(("item_id",), "item", ("id",))]
