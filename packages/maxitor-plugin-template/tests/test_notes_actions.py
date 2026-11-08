# packages/maxitor-plugin-template/tests/test_notes_actions.py
"""The actions: a person outside the organization gets nothing; a member reads and writes in the organization of the address."""

import pytest

from aoa.action_machine.context import Context
from aoa.action_machine.exceptions import AuthorizationError
from aoa.action_machine.exceptions.access_denied import AccessDenied
from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine
from maxitor_notes.actions.add_note_action import AddNoteAction, AddNoteParams
from maxitor_notes.actions.list_item_notes_action import ListItemNotesAction, ListItemNotesParams
from maxitor_notes.actions.list_note_authors_action import ListNoteAuthorsAction, ListNoteAuthorsParams
from maxitor_notes.entities.note_author_entity import NoteAuthorCoreEntity
from maxitor_notes.entities.note_entity import NoteCoreEntity
from maxitor_notes.notes_editor_role import NotesEditorRole
from maxitor_notes.notes_reader_role import NotesReaderRole
from maxitor_notes.organization_member import OrganizationMember
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage

ACME = "11111111-1111-1111-1111-111111111111"
ANN = "33333333-3333-3333-3333-333333333333"
ITEM = "22222222-2222-2222-2222-222222222222"
MOMENT = "2026-11-08T10:15:00.123456Z"


@meta(description="The notes storage answered from memory")
@entities(NoteCoreEntity, NoteAuthorCoreEntity)
class ScriptedNotesStorage(NotesStorage):
    """The storage's methods answered from memory; every call recorded."""

    def __init__(self) -> None:
        super().__init__(connection_params="postgresql://scripted.invalid/notes")
        self.calls: list[tuple] = []

    async def organization_of(self, code, user_id):
        self.calls.append(("organization_of", code, user_id))
        return ACME if (code, user_id) == ("acme", ANN) else None

    async def add_note(self, organization_id, item_id, writer_id, body, operation):
        self.calls.append(("add_note", organization_id, item_id, writer_id, body, operation))
        return MOMENT

    async def notes_of_item(self, organization_id, item_id, moment, writer_id):
        self.calls.append(("notes_of_item", organization_id, item_id, moment, writer_id))
        return [NoteCoreEntity(id="n1", item_id=item_id, writer_id=ANN, writer_name="Ann", body="Check", updated_at=MOMENT)]

    async def note_authors(self, organization_id, item_id, moment, limit, after):
        self.calls.append(("note_authors", organization_id, item_id, moment, limit, after))
        return [NoteAuthorCoreEntity(id=f"p{i}", name=f"Person {i}") for i in range(limit)]


def _context(organization: str, roles: tuple) -> Context:
    return Context(user=OrganizationMember(user_id=ANN, session_id="s1", roles=roles, organization=organization))


async def _run(action, params, organization="acme", roles=(NotesReaderRole, NotesEditorRole)):
    storage = ScriptedNotesStorage()
    machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
    result = await machine.run(_context(organization, roles), action, params, {NOTES_CONNECTION_KEY: storage})
    return result, storage


async def test_a_member_writes_a_note_in_the_organization_of_the_address_as_herself() -> None:
    result, storage = await _run(AddNoteAction(), AddNoteParams(item_id=ITEM, body="Check the limits"))
    assert result.changed_at == MOMENT
    assert storage.calls[-1] == ("add_note", ACME, ITEM, ANN, "Check the limits", "AddNoteAction")


@pytest.mark.parametrize(
    ("action", "params"),
    [
        (AddNoteAction(), AddNoteParams(item_id=ITEM, body="Check the limits")),
        (ListItemNotesAction(), ListItemNotesParams(item_id=ITEM)),
        (ListNoteAuthorsAction(), ListNoteAuthorsParams(item_id=ITEM)),
    ],
)
async def test_a_person_outside_the_organization_gets_a_refusal_and_no_data(action, params) -> None:
    with pytest.raises(AuthorizationError):
        await _run(action, params, organization="globex")


async def test_a_reader_cannot_write() -> None:
    with pytest.raises(AccessDenied):
        await _run(AddNoteAction(), AddNoteParams(item_id=ITEM, body="Check"), roles=(NotesReaderRole,))


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
