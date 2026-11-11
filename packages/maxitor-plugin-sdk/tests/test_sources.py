# packages/maxitor-plugin-sdk/tests/test_sources.py
"""Every list, filter, legend and count a plugin's navigation names is an action of the plugin (spec 077, FR-010)."""

from __future__ import annotations

from pathlib import Path

import pytest
from maxitor_plugin_sdk.checks import action_names, source_problems

NAVIGATION = {
    "navigation": 1,
    "nodes": [
        {
            "id": "notes",
            "attach": "root",
            "title": "Notes",
            "page": "/",
            "children": [
                {
                    "id": "item",
                    "each": {"source": "list_items", "key": "item_id"},
                    "children": [
                        {
                            "id": "item-notes",
                            "title": "Notes",
                            "page": "/items/{item_id}",
                            "controls": {
                                "mode": {
                                    "param": "mode",
                                    "default": "all",
                                    "options": [{"value": "all", "label": "All"}],
                                    "counts": "count_notes",
                                },
                                "filters": [{"title": "Author", "param": "author", "source": "list_note_authors"}],
                                "legend": {"title": "Kind", "source": "list_kind_colours"},
                            },
                        }
                    ],
                }
            ],
        }
    ],
}
ACTIONS = {"list_items", "count_notes", "list_note_authors", "list_kind_colours"}


def test_a_navigation_whose_sources_are_actions_passes() -> None:
    assert source_problems(NAVIGATION, ACTIONS) == []


@pytest.mark.parametrize("missing", sorted(ACTIONS))
def test_a_source_that_is_no_action_is_refused(missing: str) -> None:
    problems = source_problems(NAVIGATION, ACTIONS - {missing})
    assert len(problems) == 1 and f"reads {missing!r}, which is no action of the plugin" in problems[0]


def test_the_actions_are_the_files_of_actions_and_history(tmp_path: Path) -> None:
    (tmp_path / "actions").mkdir()
    (tmp_path / "history").mkdir()
    (tmp_path / "actions" / "list_items_action.py").write_text("", encoding="utf-8")
    (tmp_path / "actions" / "__init__.py").write_text("", encoding="utf-8")
    (tmp_path / "history" / "list_note_history_action.py").write_text("", encoding="utf-8")
    assert action_names(tmp_path) == {"list_items", "list_note_history"}
