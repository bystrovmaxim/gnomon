"""The rule of a change against the published notes: by value, never by a version's identity."""

from maxitor_notes.draft_rules import PublishedNote, decide
from maxitor_notes.entities.note_change_entity import NoteChangeCoreEntity

ITEM = "22222222-2222-2222-2222-222222222222"
NOTE = "44444444-4444-4444-4444-444444444444"
ANN = "33333333-3333-3333-3333-333333333333"
AT = "2026-11-10T11:25:00.000000Z"
BASE = "The settlement window"


def change(state="changed", body="Mine", base=BASE, note_id=NOTE):
    return NoteChangeCoreEntity(
        note_id=note_id,
        state=state,
        body=body,
        base_body=base,
        base_revision=6,
        writer_id=ANN,
        writer_name="Anna",
        changed_at=AT,
    )


def published(body=BASE, by="Olga"):
    return PublishedNote(body=body, by_name=by, at="2026-11-10T11:05:00.000000Z")


def test_a_new_note_always_applies() -> None:
    assert decide([change(state="new", base=None)], {})[0].kind == "apply"


def test_a_change_over_the_published_text_applies() -> None:
    decision = decide([change()], {NOTE: published()})[0]
    assert decision.kind == "apply"
    assert decision.conflict is None


def test_a_change_over_another_text_is_a_conflict_with_both_sides() -> None:
    decision = decide([change()], {NOTE: published("Olga's text")})[0]
    assert decision.kind == "conflict"
    assert decision.conflict is not None
    assert (decision.conflict.body, decision.conflict.published_body, decision.conflict.published_by_name) == ("Mine", "Olga's text", "Olga")


def test_a_deleted_published_note_is_a_conflict_for_a_change() -> None:
    decision = decide([change()], {NOTE: PublishedNote(body=None, by_name="Olga", at=AT)})[0]
    assert decision.kind == "conflict"
    assert decision.conflict is not None
    assert decision.conflict.published_body is None


def test_a_change_whose_text_is_published_has_nothing_left_to_do() -> None:
    assert decide([change(body="Olga's text")], {NOTE: published("Olga's text")})[0].kind == "drop"


def test_a_deletion_over_the_published_text_applies() -> None:
    assert decide([change(state="deleted", body=BASE)], {NOTE: published()})[0].kind == "apply"


def test_a_deletion_of_a_note_someone_changed_is_a_conflict() -> None:
    decision = decide([change(state="deleted", body=BASE)], {NOTE: published("Olga's text")})[0]
    assert decision.kind == "conflict"
    assert decision.conflict is not None
    assert decision.conflict.published_body == "Olga's text"


def test_a_deletion_of_a_note_already_deleted_has_nothing_left_to_do() -> None:
    assert decide([change(state="deleted", body=BASE)], {NOTE: PublishedNote(body=None, by_name="Olga", at=AT)})[0].kind == "drop"


def test_a_note_changed_and_published_back_to_its_base_conflicts_with_nothing() -> None:
    assert decide([change(body="Mine")], {NOTE: published(BASE)})[0].kind == "apply"


def test_every_change_is_decided_in_the_draft_order() -> None:
    second = "55555555-5555-5555-5555-555555555555"
    decisions = decide([change(note_id=NOTE), change(note_id=second, state="new", base=None)], {})
    assert [decision.change.note_id for decision in decisions] == [NOTE, second]
