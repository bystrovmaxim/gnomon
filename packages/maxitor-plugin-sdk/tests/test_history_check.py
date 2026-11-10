"""The history a plugin declares: comparisons within the passport's, history names that are actions of history/."""

from pathlib import Path

import yaml

from maxitor_plugin_sdk.checks import check_plugin

PASSPORT = {
    "passport": 2, "id": "io.example.notes", "name": "notes", "title": "Notes", "description": "Notes.", "version": "1.0.0",
    "requires": {"maxitor": ">=4.0,<5"}, "backend": {"app": "notes.app:create_app"},
    "frontend": {"build": "notes/_web", "navigation": "notes/navigation.yaml"},
}


def _plugin(tmp_path: Path, passport_history=None, page_history=None, actions=("list_note_history",)) -> Path:
    package = tmp_path / "src" / "notes"
    (package / "history").mkdir(parents=True)
    for name in actions:
        (package / "history" / f"{name}_action.py").write_text("")
    passport = dict(PASSPORT)
    if passport_history is not None:
        passport["history"] = passport_history
    (package / "maxitor-plugin.yaml").write_text(yaml.safe_dump(passport))
    node = {"id": "item-notes", "attach": "core:item", "title": "Notes", "page": "/items/{item_id}"}
    if page_history is not None:
        node["history"] = page_history
    (package / "navigation.yaml").write_text(yaml.safe_dump({"navigation": 1, "nodes": [node]}))
    (tmp_path / "pyproject.toml").write_text('[project]\nname = "notes"\nversion = "1.0.0"\n')
    return tmp_path


def test_a_page_within_the_passports_comparisons_naming_its_history_actions_is_accepted(tmp_path) -> None:
    root = _plugin(tmp_path, {"compare": ["diff", "side_by_side"]}, {"compare": ["diff"], "read": "list_item_notes", "milestones": "list_note_history"})
    assert check_plugin(root) == []


def test_a_page_offering_more_than_the_passport_is_refused_by_name(tmp_path) -> None:
    root = _plugin(tmp_path, {"compare": ["diff"]}, {"compare": ["side_by_side"]})
    assert check_plugin(root) == ["navigation: 'item-notes' offers 'side_by_side', which the passport's history does not"]


def test_without_history_in_the_passport_a_page_offers_no_comparison(tmp_path) -> None:
    root = _plugin(tmp_path, None, {"compare": ["diff"]})
    assert check_plugin(root) == ["navigation: 'item-notes' offers 'diff', which the passport's history does not"]


def test_a_history_name_with_no_action_in_history_is_refused(tmp_path) -> None:
    root = _plugin(tmp_path, {"compare": ["diff"]}, {"card": "note_milestone_card"})
    assert check_plugin(root) == ["navigation: 'item-notes' names card 'note_milestone_card', but there is no history/note_milestone_card_action.py"]


def test_a_plugin_with_no_history_at_all_is_accepted(tmp_path) -> None:
    assert check_plugin(_plugin(tmp_path)) == []


def test_an_unknown_comparison_is_refused_by_the_schema(tmp_path) -> None:
    root = _plugin(tmp_path, {"compare": ["timeline"]})
    assert any("history/compare/0" in problem for problem in check_plugin(root))
