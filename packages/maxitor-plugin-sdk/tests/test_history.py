"""The history contract: the bars a page's own reading query gives, and the shapes of format 2."""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from maxitor_plugin_sdk import history
from maxitor_plugin_sdk.history import Bar, Version, bars_of

START = "2026-11-08T00:00:00.000000Z"
END = "2026-11-08T03:00:00.000000Z"
HOUR = 3600


def test_an_opening_alone_is_added_a_closing_with_an_opening_changed_and_a_closing_alone_removed() -> None:
    versions = [
        Version("n1", "2026-11-08T00:30:00.000000Z", None),
        Version("n2", "2026-11-07T10:00:00.000000Z", "2026-11-08T01:15:00.000000Z"),
        Version("n2", "2026-11-08T01:15:00.000000Z", None),
        Version("n3", "2026-11-07T10:00:00.000000Z", "2026-11-08T02:45:00.000000Z"),
    ]
    assert bars_of(versions, START, END, HOUR) == [
        Bar("2026-11-08T00:00:00.000000Z", 1, 0, 0),
        Bar("2026-11-08T01:00:00.000000Z", 0, 1, 0),
        Bar("2026-11-08T02:00:00.000000Z", 0, 0, 1),
    ]


def test_only_times_inside_the_stretch_count() -> None:
    versions = [
        Version("n1", "2026-11-07T23:00:00.000000Z", "2026-11-08T03:00:00.000000Z"),
        Version("n2", START, None),
        Version("n3", "2026-11-08T03:00:00.000001Z", None),
    ]
    assert bars_of(versions, START, END, HOUR) == [Bar("2026-11-08T02:00:00.000000Z", 0, 0, 1)]


def test_a_stretch_with_nothing_in_it_has_no_bars() -> None:
    assert bars_of([Version("n1", "2026-11-01T00:00:00.000000Z", None)], START, END, HOUR) == []


def test_several_changes_in_one_bar_add_up() -> None:
    versions = [Version(f"n{i}", f"2026-11-08T00:{10 + i}:00.000000Z", None) for i in range(3)]
    assert bars_of(versions, START, END, HOUR) == [Bar("2026-11-08T00:00:00.000000Z", 3, 0, 0)]


def test_a_bar_lasts_at_least_a_second() -> None:
    with pytest.raises(ValueError):
        bars_of([], START, END, 0)


def _schema(shape: str) -> Draft202012Validator:
    schema = json.loads((Path(history.__file__).parent / "schemas" / f"history-{history.HISTORY_FORMAT}.schema.json").read_text())
    return Draft202012Validator({"$ref": f"#/$defs/{shape}", "$defs": schema["$defs"]})


def test_format_2_milestones_name_a_kind_of_the_page_and_carry_no_closed_list() -> None:
    milestone = {"id": "v6", "at": "2026-11-10T11:30:00.000000Z", "ref": "v6", "title": "Back to v3", "kind": "rollback", "comment": "Back to v3."}
    assert list(_schema("milestone").iter_errors(milestone)) == []
    assert list(_schema("milestone").iter_errors({**milestone, "minor": True})) != []
    assert list(_schema("milestone").iter_errors({**milestone, "kind": "Rolled Back"})) != []


def test_a_card_is_a_list_of_blocks_of_known_shapes() -> None:
    card = {
        "blocks": [
            {"line": [{"badge": {"icon": "undo", "label": "Rolled back", "tone": "red"}}, {"ref": "v6"}, {"ago": "2026-11-10T11:30:00.000000Z"}]},
            {"title": "Back to v3"},
            {"text": "to v3 · everything published after it stays in the history"},
            {"person": {"id": "a1", "name": "Anna"}},
            {"chips": [{"chip": "12 notes"}, {"text": "+2 notes · 1 changed"}]},
        ]
    }
    assert list(_schema("card").iter_errors(card)) == []
    assert list(_schema("card").iter_errors({"blocks": [{"script": "alert(1)"}]})) != []
    assert list(_schema("card").iter_errors({"blocks": [{"line": [{"badge": {"icon": "rocket", "label": "x", "tone": "red"}}]}]})) != []
