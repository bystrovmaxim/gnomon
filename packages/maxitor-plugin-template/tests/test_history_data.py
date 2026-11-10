"""The template's answers to the core's time scale: bars from its own reading query, milestones and their cards."""

import json
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator
from maxitor_notes.actions.list_item_notes_action import ListItemNotesAction, ListItemNotesParams
from maxitor_notes.entities.note_author_entity import NoteAuthorCoreEntity
from maxitor_notes.entities.note_entity import NoteCoreEntity
from maxitor_notes.history.list_note_history_action import ListNoteHistoryAction, ListNoteHistoryParams
from maxitor_notes.history.note_milestone_card_action import NoteMilestoneCardAction, NoteMilestoneCardParams
from maxitor_notes.notes_refusal_error import NotesRefusalError
from maxitor_notes.storage.notes_storage import NotesStorage
from maxitor_plugin_sdk import history as sdk_history

from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.meta import meta
from tests.recording_database import recording_pool
from tests.test_notes_actions import ACME, ITEM, ScriptedNotesStorage, _run

ORG = "11111111-1111-1111-1111-111111111111"
ANN = "33333333-3333-3333-3333-333333333333"
NOW = "2026-11-10T11:24:00.000000Z"
V1, V2, V3 = "2026-10-09T12:00:00.000000Z", "2026-10-20T16:00:00.000000Z", "2026-11-08T15:00:00.000000Z"
SCHEMA = json.loads((Path(sdk_history.__file__).parent / "schemas" / "history-1.schema.json").read_text())
PACKAGE = Path(__file__).resolve().parents[1] / "src" / "maxitor_notes"


def _valid(shape, document) -> None:
    validator = Draft202012Validator({"$ref": f"#/$defs/{shape}", "$defs": SCHEMA["$defs"]})
    assert list(validator.iter_errors(document)) == []


def _note(note_id, body):
    return {"id": note_id, "item_id": ITEM, "writer_id": ANN, "writer_name": "Anna", "body": body, "updated_at": V1, "since": V1, "changed_by": "Anna"}


#: v1 has two notes; v2 edits one and adds one; v3 only edits; after v3 one note is deleted.
NOTES = {
    V1: [_note("n1", "Retry three times"), _note("n2", "Import by 06:00")],
    V2: [_note("n1", "Retry five times"), _note("n2", "Import by 06:00"), _note("n3", "Tokens")],
    V3: [_note("n1", "Retry five times"), _note("n2", "Import by 05:30"), _note("n3", "Tokens")],
    NOW: [_note("n1", "Retry five times"), _note("n2", "Import by 05:30")],
}
REVISIONS = [
    {"number": 1, "ref": "v1", "title": "First review", "comment": "Agreed", "release": None, "publisher_id": ANN, "publisher_name": "Anna", "at": V1},
    {"number": 2, "ref": "v2", "title": "Fraud review", "comment": "Threshold 0.80", "release": "handbook 2026.10", "publisher_id": ANN, "publisher_name": "Olga", "at": V2},
    {"number": 3, "ref": "v3", "title": "Import deadline", "comment": "Only wording", "release": None, "publisher_id": ANN, "publisher_name": "Anna", "at": V3},
]


def _answer(query, params):
    if "watermark($1::text::uuid)" in query:
        return NOW
    if "FROM revision_versions r" in query:
        return REVISIONS
    if "FROM note_versions n" in query and "AS valid_from," in query:
        return [
            {"id": "n1", "valid_from": V1, "valid_to": "2026-10-15T10:00:00.000000Z"},
            {"id": "n1", "valid_from": "2026-10-15T10:00:00.000000Z", "valid_to": None},
            {"id": "n3", "valid_from": "2026-10-18T09:00:00.000000Z", "valid_to": "2026-11-09T17:00:00.000000Z"},
        ]
    if "FROM note_versions n" in query:
        return NOTES.get(params[2], [])
    return None


async def _open():
    pool, connection = recording_pool(_answer)
    storage = NotesStorage(pool=pool)
    await storage.open()
    return storage, connection


async def test_the_bars_count_what_the_page_shows_by_kind_from_the_same_query_over_the_stretch() -> None:
    storage, connection = await _open()
    end, versions = await storage.note_versions_between(ORG, ITEM, "2026-10-01T00:00:00.000000Z", "2026-12-01T00:00:00.000000Z", ANN)
    assert end == NOW
    query, params = connection.statements[-1]
    assert "n.writer_id = $5::text::uuid" in query and params[4] == ANN
    bars = sdk_history.bars_of(versions, "2026-10-01T00:00:00.000000Z", end, 86400)
    assert [(bar.start[:10], bar.added, bar.changed, bar.removed) for bar in bars] == [
        ("2026-10-09", 1, 0, 0),
        ("2026-10-15", 0, 1, 0),
        ("2026-10-18", 1, 0, 0),
        ("2026-11-09", 0, 0, 1),
    ]
    for bar in bars:
        _valid("bar", bar.__dict__)


async def test_the_reading_action_answers_bars_over_a_stretch_and_notes_at_a_moment() -> None:
    @meta(description="The scripted storage answering a stretch")
    @entities(NoteCoreEntity, NoteAuthorCoreEntity)
    class StretchStorage(ScriptedNotesStorage):
        async def note_versions_between(self, organization_id, item_id, start, end, writer_id):
            self.calls.append(("note_versions_between", organization_id, item_id, start, end, writer_id))
            return end, [sdk_history.Version("n1", "2026-11-08T10:00:00.000000Z", None)]

    params = ListItemNotesParams(item_id=ITEM, from_at="2026-11-08T00:00:00.000000Z", to_at="2026-11-09T00:00:00.000000Z", width=3600, author=ANN)
    result, storage = await _run(ListItemNotesAction(), params, storage=StretchStorage())
    assert storage.calls[-1] == ("note_versions_between", ACME, ITEM, params.from_at, params.to_at, ANN)
    assert [(bar.start, bar.added) for bar in result.bars] == [("2026-11-08T10:00:00.000000Z", 1)]
    assert result.notes == []


@pytest.mark.parametrize("extra", [{"from_at": "2026-11-08T00:00:00.000000Z"}, {"from_at": "2026-11-08T00:00:00.000000Z", "to_at": "2026-11-09T00:00:00.000000Z", "width": 3600, "at": "2026-11-08T00:00:00.000000Z"}, {"from_at": "2026-11-09T00:00:00.000000Z", "to_at": "2026-11-08T00:00:00.000000Z", "width": 3600}])
def test_a_stretch_comes_whole_never_with_a_moment_and_ends_after_it_starts(extra) -> None:
    with pytest.raises(ValueError):
        ListItemNotesParams(item_id=ITEM, **extra)


async def test_the_milestones_are_the_revisions_in_order_with_the_draft_last() -> None:
    storage, _connection = await _open()
    milestones = await storage.milestones(ORG, ITEM, "2026-10-01T00:00:00.000000Z", "2026-12-01T00:00:00.000000Z")
    assert [(m.id, m.kind, m.minor, m.release) for m in milestones] == [
        ("v1", "revision", False, None),
        ("v2", "revision", False, "handbook 2026.10"),
        ("v3", "revision", True, None),
        ("draft", "proposal", False, None),
    ]
    assert milestones[-1].link == f"/items/{ITEM}/draft"
    _valid("milestones", {"milestones": [m.model_dump() for m in milestones]})


async def test_a_stretch_takes_only_the_revisions_published_in_it() -> None:
    storage, _connection = await _open()
    milestones = await storage.milestones(ORG, ITEM, "2026-10-21T00:00:00.000000Z", "2026-12-01T00:00:00.000000Z")
    assert [m.id for m in milestones] == ["v3", "draft"]


async def test_a_card_counts_what_the_revision_changed_and_carries_its_comment() -> None:
    storage, _connection = await _open()
    card = await storage.milestone_card(ORG, ITEM, "v2", None)
    assert (card.summary, card.chips, card.comment, card.author_name, card.release) == ({"added": 1, "changed": 1, "removed": 0}, ["3 notes"], "Threshold 0.80", "Olga", "handbook 2026.10")
    _valid("card", card.model_dump())
    draft = await storage.milestone_card(ORG, ITEM, "draft", None)
    assert draft.summary == {"added": 0, "changed": 0, "removed": 1}


async def test_an_unknown_milestone_is_not_found() -> None:
    storage, _connection = await _open()
    with pytest.raises(NotesRefusalError) as refusal:
        await storage.milestone_card(ORG, ITEM, "v9", None)
    assert refusal.value.status == 404


async def test_the_history_actions_are_refused_outside_the_organization() -> None:
    from aoa.action_machine.exceptions.access_denied import AccessDenied

    for action, params in [
        (ListNoteHistoryAction(), ListNoteHistoryParams(item_id=ITEM, from_at=V1, to_at=NOW)),
        (NoteMilestoneCardAction(), NoteMilestoneCardParams(item_id=ITEM, id="v1")),
    ]:
        with pytest.raises(AccessDenied):
            await _run(action, params, organization="globex")


def test_the_pages_declare_their_history_and_the_passport_its_comparisons() -> None:
    passport = yaml.safe_load((PACKAGE / "maxitor-plugin.yaml").read_text())
    nodes = {node["id"]: node for node in yaml.safe_load((PACKAGE / "navigation.yaml").read_text())["nodes"]}
    assert passport["history"] == {"compare": ["diff", "side_by_side"]}
    assert nodes["item-notes"]["history"] == {"read": "list_item_notes", "milestones": "list_note_history", "card": "note_milestone_card"}
    assert nodes["item-published"]["history"] == {"milestones": "list_note_history", "card": "note_milestone_card"}
    assert nodes["item-draft"]["history"] == {"compare": []}
    assert {path.name for path in (PACKAGE / "history").glob("*_action.py")} == {"list_note_history_action.py", "note_milestone_card_action.py"}
