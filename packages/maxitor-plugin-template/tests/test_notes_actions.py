# packages/maxitor-plugin-template/tests/test_notes_actions.py
"""The actions: a person outside the organization is refused by @access_decide and gets nothing; a member reads and writes in the organization of the address."""

import pytest
from maxitor_notes.actions.add_item_action import AddItemAction, AddItemParams
from maxitor_notes.actions.add_note_action import AddNoteAction, AddNoteParams
from maxitor_notes.actions.delete_note_action import DeleteNoteAction, DeleteNoteParams
from maxitor_notes.actions.edit_note_action import EditNoteAction, EditNoteParams
from maxitor_notes.actions.list_item_notes_action import ListItemNotesAction, ListItemNotesParams
from maxitor_notes.actions.list_items_action import ListItemsAction, ListItemsParams
from maxitor_notes.actions.list_note_authors_action import ListNoteAuthorsAction, ListNoteAuthorsParams
from maxitor_notes.actions.list_note_draft_action import ListNoteDraftAction, ListNoteDraftParams
from maxitor_notes.actions.list_published_notes_action import ListPublishedNotesAction, ListPublishedNotesParams
from maxitor_notes.actions.publish_notes_action import PublishNotesAction, PublishNotesParams
from maxitor_notes.actions.rename_item_action import RenameItemAction, RenameItemParams
from maxitor_notes.actions.revert_note_change_action import RevertNoteChangeAction, RevertNoteChangeParams
from maxitor_notes.entities.item_entry_entity import ItemEntryCoreEntity
from maxitor_notes.entities.note_author_entity import NoteAuthorCoreEntity
from maxitor_notes.entities.note_entity import NoteCoreEntity
from maxitor_notes.membership import organization_access
from maxitor_notes.organization_member import OrganizationMember
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage
from maxitor_plugin_sdk.roles import MemberRole, ServiceRole

from aoa.action_machine.context import Context
from aoa.action_machine.exceptions.access_denied import AccessDenied
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.intents.access_control import FORBIDDEN_OBJECT, Allowed, Gate
from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine

ACME = "11111111-1111-1111-1111-111111111111"
ANN = "33333333-3333-3333-3333-333333333333"
ITEM = "22222222-2222-2222-2222-222222222222"
MOMENT = "2026-11-08T10:15:00.123456Z"


@meta(description="The notes storage answered from memory")
@entities(ItemEntryCoreEntity, NoteCoreEntity, NoteAuthorCoreEntity)
class ScriptedNotesStorage(NotesStorage):
    """The storage's methods answered from memory; every call recorded."""

    def __init__(self, membership_lasts: int | None = None, items: tuple[str, ...] = ("Payments",), renamed: bool = True) -> None:
        super().__init__(connection_params="postgresql://scripted.invalid/notes")
        self.calls: list[tuple] = []
        self._membership_lasts = membership_lasts
        #: The organization's items now, by title; the first is ITEM.
        self._items = items
        self._renamed = renamed

    async def organization_of(self, code, user_id):
        self.calls.append(("organization_of", code, user_id))
        asked = sum(1 for call in self.calls if call[0] == "organization_of")
        if self._membership_lasts is not None and asked > self._membership_lasts:
            return None
        return ACME if (code, user_id) == ("acme", ANN) else None

    async def item_of(self, organization_id, item_id):
        self.calls.append(("item_of", organization_id, item_id))
        return (organization_id, item_id) == (ACME, ITEM)

    async def add_item(self, organization_id, title, author_id, operation):
        self.calls.append(("add_item", organization_id, title, author_id, operation))
        return ITEM, MOMENT

    async def rename_item(self, organization_id, item_id, title, base_moment, editor_id, operation):
        self.calls.append(("rename_item", organization_id, item_id, title, base_moment, editor_id, operation))
        return "Payments", MOMENT, self._renamed

    async def items_at(self, organization_id, moment, limit, after):
        self.calls.append(("items_at", organization_id, moment, limit, after))
        keys = [f"{n:08d}-0000-0000-0000-000000000000" for n in range(len(self._items))]
        start = 0 if after is None else keys.index(after) + 1
        return [ItemEntryCoreEntity(key=key, title=title, icon="folder") for key, title in zip(keys, self._items, strict=True)][start : start + limit]

    async def add_note_change(self, organization_id, item_id, person_id, body, operation):
        self.calls.append(("add_note_change", organization_id, item_id, person_id, body, operation))
        return MOMENT

    async def edit_note(self, organization_id, item_id, note_id, body, base_body, base_revision, editor_id, operation):
        self.calls.append(("edit_note", organization_id, item_id, note_id, body, base_body, base_revision, editor_id, operation))
        return MOMENT

    async def delete_note(self, organization_id, item_id, note_id, base_body, base_revision, editor_id, operation):
        self.calls.append(("delete_note", organization_id, item_id, note_id, base_body, base_revision, editor_id, operation))
        return MOMENT

    async def revert_note_change(self, organization_id, note_id, person_id, operation):
        self.calls.append(("revert_note_change", organization_id, note_id, person_id, operation))
        return MOMENT

    async def publish_notes(self, organization_id, item_id, person_id, title, comment, release, resolutions, publisher_id, operation):
        self.calls.append(("publish_notes", organization_id, item_id, person_id, title, comment, release, resolutions, publisher_id, operation))
        return 1, MOMENT

    async def published_notes(self, organization_id, item_id, moment):
        self.calls.append(("published_notes", organization_id, item_id, moment))
        return None, []

    async def draft(self, organization_id, item_id, person_id, moment):
        self.calls.append(("draft", organization_id, item_id, person_id, moment))
        return None, []

    async def milestones(self, organization_id, item_id, start, end):
        self.calls.append(("milestones", organization_id, item_id, start, end))
        return []

    async def milestone_card(self, organization_id, item_id, milestone_id, moment):
        self.calls.append(("milestone_card", organization_id, item_id, milestone_id, moment))
        raise AssertionError("not asked in these tests")

    async def notes_of_item(self, organization_id, item_id, moment, writer_id):
        self.calls.append(("notes_of_item", organization_id, item_id, moment, writer_id))
        return [NoteCoreEntity(id="n1", item_id=item_id, writer_id=ANN, writer_name="Ann", body="Check", updated_at=MOMENT, since=MOMENT)]

    async def note_authors(self, organization_id, item_id, moment, limit, after):
        self.calls.append(("note_authors", organization_id, item_id, moment, limit, after))
        return [NoteAuthorCoreEntity(id=f"p{i}", name=f"Person {i}") for i in range(limit)]


def _context(organization: str, roles: tuple) -> Context:
    return Context(user=OrganizationMember(user_id=ANN, session_id="s1", roles=roles, organization=organization))


async def _run(action, params, organization="acme", roles=(MemberRole,), storage=None):
    storage = storage or ScriptedNotesStorage()
    machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
    result = await machine.run(_context(organization, roles), action, params, {NOTES_CONNECTION_KEY: storage})
    return result, storage


#: Each action of the plugin with a valid call of it.
ACTION_CALLS = [
    (AddItemAction(), AddItemParams(title="Payments")),
    (RenameItemAction(), RenameItemParams(item_id=ITEM, title="Billing", base_moment=MOMENT)),
    (ListItemsAction(), ListItemsParams()),
    (AddNoteAction(), AddNoteParams(item_id=ITEM, body="Check the limits")),
    (ListItemNotesAction(), ListItemNotesParams(item_id=ITEM)),
    (ListNoteAuthorsAction(), ListNoteAuthorsParams(item_id=ITEM)),
    (EditNoteAction(), EditNoteParams(item_id=ITEM, note_id="n1", body="Check", base_body="Old", base_revision=3)),
    (DeleteNoteAction(), DeleteNoteParams(item_id=ITEM, note_id="n1", base_body="Old", base_revision=3)),
    (RevertNoteChangeAction(), RevertNoteChangeParams(note_id="n1")),
    (PublishNotesAction(), PublishNotesParams(item_id=ITEM, title="First review", comment="Agreed")),
    (ListPublishedNotesAction(), ListPublishedNotesParams(item_id=ITEM)),
    (ListNoteDraftAction(), ListNoteDraftParams(item_id=ITEM)),
]

#: The actions whose decision also asks whether the item of the call is one of the organization's now.
DECIDES_ON_THE_ITEM = (AddNoteAction, PublishNotesAction, RenameItemAction)


def _decision(action, organization: str) -> list[tuple]:
    """What a decision asks the storage: the membership, then the item when the action is about one and the person is a member."""
    asked = [("organization_of", organization, ANN)]
    if isinstance(action, DECIDES_ON_THE_ITEM) and organization == "acme":
        asked.append(("item_of", ACME, ITEM))
    return asked


async def test_a_member_writes_a_note_in_the_organization_of_the_address_as_herself() -> None:
    result, storage = await _run(AddNoteAction(), AddNoteParams(item_id=ITEM, body="Check the limits"))
    assert result.changed_at == MOMENT
    assert storage.calls[-1] == ("add_note_change", ACME, ITEM, ANN, "Check the limits", "AddNoteAction")


@pytest.mark.parametrize(("action", "params"), ACTION_CALLS)
async def test_each_action_declares_its_access_check_in_the_graph(action, params) -> None:
    _ = params
    coordinator = create_node_graph_coordinator()
    action_ids = [node.node_id for node in coordinator.get_all_nodes() if node.node_type == "Action" and node.node_id.endswith(f".{type(action).__name__}")]
    decisions = [source_id for source_id, _target_id, _edge in coordinator.get_edges_by_type("@access_decide") if source_id in action_ids]
    assert len(action_ids) == 1
    assert decisions == action_ids


@pytest.mark.parametrize(("action", "params"), ACTION_CALLS)
async def test_a_person_outside_the_organization_is_refused_by_access_decide_and_gets_no_data(action, params) -> None:
    storage = ScriptedNotesStorage()
    with pytest.raises(AccessDenied) as refusal:
        await _run(action, params, organization="globex", storage=storage)
    assert refusal.value.verdict == FORBIDDEN_OBJECT
    assert refusal.value.verdict.gate is Gate.ACCESS_DECIDE
    assert storage.calls == [("organization_of", "globex", ANN)]


@pytest.mark.parametrize(("action", "params"), ACTION_CALLS)
async def test_a_membership_ended_after_the_decision_is_refused_the_same_way_and_touches_nothing(action, params) -> None:
    storage = ScriptedNotesStorage(membership_lasts=1)
    with pytest.raises(AccessDenied) as refusal:
        await _run(action, params, storage=storage)
    assert refusal.value.verdict == FORBIDDEN_OBJECT
    assert storage.calls == [*_decision(action, "acme"), ("organization_of", "acme", ANN)]


@pytest.mark.parametrize(("action", "params"), ACTION_CALLS)
@pytest.mark.parametrize(("organization", "answer"), [("acme", Allowed()), ("globex", FORBIDDEN_OBJECT)])
async def test_access_is_answered_without_running_the_action(action, params, organization, answer) -> None:
    storage = ScriptedNotesStorage()
    machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
    verdict = await machine.check_access_decide(_context(organization, (MemberRole,)), type(action), params, connections={NOTES_CONNECTION_KEY: storage})
    assert verdict == answer
    assert storage.calls == _decision(action, organization)


async def test_a_call_without_member_cannot_write() -> None:
    with pytest.raises(AccessDenied) as refusal:
        await _run(AddNoteAction(), AddNoteParams(item_id=ITEM, body="Check"), roles=(ServiceRole,))
    assert refusal.value.verdict.gate is Gate.CHECK_ROLES


async def test_the_notes_are_read_at_the_moment_of_the_address() -> None:
    _result, storage = await _run(ListItemNotesAction(), ListItemNotesParams(item_id=ITEM, at=MOMENT, author=ANN))
    assert storage.calls[-1] == ("notes_of_item", ACME, ITEM, MOMENT, ANN)


@pytest.mark.parametrize("moment", ["2026-11-08", "2026-11-08T10:15:00Z", "2026-11-08T10:15:00.123Z", "now"])
def test_a_moment_other_than_microseconds_in_utc_is_refused(moment) -> None:
    with pytest.raises(ValueError):
        ListItemNotesParams(item_id=ITEM, at=moment)


async def test_the_author_list_keeps_maxitors_list_contract() -> None:
    result, storage = await _run(ListNoteAuthorsAction(), ListNoteAuthorsParams(item_id=ITEM, limit=2))
    assert [(entry.key, entry.title) for entry in result.entries] == [("p0", "Person 0"), ("p1", "Person 1")]
    assert result.next == "p1"
    assert storage.calls[-1] == ("note_authors", ACME, ITEM, None, 2, None)


@pytest.mark.parametrize(("code", "user_id"), [(None, ANN), ("", ANN), ("acme", None), ("acme", "")])
async def test_an_address_or_a_token_without_an_organization_or_a_person_is_refused_without_a_query(code, user_id) -> None:
    storage = ScriptedNotesStorage()
    assert await organization_access(storage, code, user_id) == FORBIDDEN_OBJECT
    assert storage.calls == []


async def test_an_editor_edits_and_deletes_in_her_draft_over_the_version_she_saw() -> None:
    _result, storage = await _run(EditNoteAction(), EditNoteParams(item_id=ITEM, note_id="n1", body="Check", base_body="Old", base_revision=3))
    assert storage.calls[-1] == ("edit_note", ACME, ITEM, "n1", "Check", "Old", 3, ANN, "EditNoteAction")
    _result, storage = await _run(DeleteNoteAction(), DeleteNoteParams(item_id=ITEM, note_id="n1", base_body="Old", base_revision=3))
    assert storage.calls[-1] == ("delete_note", ACME, ITEM, "n1", "Old", 3, ANN, "DeleteNoteAction")


async def test_a_member_gives_one_change_of_her_draft_up() -> None:
    _result, storage = await _run(RevertNoteChangeAction(), RevertNoteChangeParams(note_id="n1"))
    assert storage.calls[-1] == ("revert_note_change", ACME, "n1", ANN, "RevertNoteChangeAction")


@pytest.mark.parametrize(
    ("action", "params"),
    [
        (EditNoteAction(), EditNoteParams(item_id=ITEM, note_id="n1", body="Check", base_body="Old", base_revision=3)),
        (DeleteNoteAction(), DeleteNoteParams(item_id=ITEM, note_id="n1", base_body="Old", base_revision=3)),
        (RevertNoteChangeAction(), RevertNoteChangeParams(note_id="n1")),
    ],
)
async def test_a_call_without_member_cannot_edit_or_delete(action, params) -> None:
    with pytest.raises(AccessDenied) as refusal:
        await _run(action, params, roles=(ServiceRole,))
    assert refusal.value.verdict.gate is Gate.CHECK_ROLES


async def test_a_member_publishes_as_themselves_and_a_call_without_member_cannot() -> None:
    result, storage = await _run(PublishNotesAction(), PublishNotesParams(item_id=ITEM, title="First review", comment="Agreed", release="handbook 2026.11"))
    assert (result.number, result.changed_at) == (1, MOMENT)
    assert storage.calls[-1] == ("publish_notes", ACME, ITEM, ANN, "First review", "Agreed", "handbook 2026.11", {}, ANN, "PublishNotesAction")
    with pytest.raises(AccessDenied):
        await _run(PublishNotesAction(), PublishNotesParams(item_id=ITEM, title="T", comment="C"), roles=(ServiceRole,))


async def test_the_published_notes_and_the_draft_are_read_at_the_moment_of_the_address() -> None:
    _result, storage = await _run(ListPublishedNotesAction(), ListPublishedNotesParams(item_id=ITEM, at=MOMENT))
    assert storage.calls[-1] == ("published_notes", ACME, ITEM, MOMENT)
    _result, storage = await _run(ListNoteDraftAction(), ListNoteDraftParams(item_id=ITEM, at=MOMENT))
    assert storage.calls[-1] == ("draft", ACME, ITEM, ANN, MOMENT)
