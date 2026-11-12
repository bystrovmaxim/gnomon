# packages/maxitor/maxitor-core/tests/test_tree_builder.py
"""
The tree builder (spec 077, FR-008 – FR-011): the core's file and the template's join into one tree; each fault the
plugin concept lists in 7.3 is refused with its reason; a person sees only the nodes of their roles.
"""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

import pytest
import yaml
from maxitor.core.plugins.tree_builder import (
    PluginFile,
    TreeRefusedError,
    build_tree,
    check_version,
    core_nodes,
    visible,
)

TEMPLATE = Path(__file__).resolve().parents[3] / "maxitor-plugin-template" / "src" / "maxitor_notes"
NAVIGATION: dict[str, Any] = yaml.safe_load((TEMPLATE / "navigation.yaml").read_text(encoding="utf-8"))
ACTIONS = {"list_items", "list_item_notes", "list_note_history", "note_milestone_card"}


def _tree(*plugins: PluginFile) -> list[Any]:
    return build_tree(list(core_nodes()), list(plugins))


def _notes(navigation: dict[str, Any] | None = None, actions: set[str] = ACTIONS) -> PluginFile:
    return PluginFile("notes", frozenset(), check_version("notes", navigation or NAVIGATION, actions))


def _refused(call: Any) -> str:
    with pytest.raises(TreeRefusedError) as refused:
        call()
    return refused.value.reason


def test_the_core_and_the_template_make_one_tree() -> None:
    tree = {node.full_name: node for node in _tree(_notes())}
    assert tree["core:settings.plugins"].parent == "core:settings"
    assert tree["notes:notes"].parent == "root"
    assert (tree["notes:item"].each_source, tree["notes:item"].each_key) == ("list_items", "item_id")
    assert tree["notes:item-draft"].scope == ("item_id",)
    assert tree["notes:item-published"].scope == ("item_id",)


def test_a_member_sees_the_template_and_an_administrator_settings_too() -> None:
    tree = _tree(_notes())
    member = {node.full_name for node in visible(tree, frozenset({"member"}))}
    administrator = {node.full_name for node in visible(tree, frozenset({"member", "administrator"}))}
    assert "core:settings" not in member and "notes:item-draft" in member
    assert {"core:settings", "core:settings.plugins"} <= administrator


def test_a_parent_with_no_visible_child_and_no_page_is_hidden() -> None:
    navigation = {
        "navigation": 3,
        "nodes": [
            {
                "id": "group",
                "attach": "root",
                "title": "Group",
                "children": [{"id": "secret", "title": "Secret", "page": "/secret", "roles": ["administrator"]}],
            }
        ],
    }
    tree = build_tree(list(core_nodes()), [PluginFile("acme", frozenset(), check_version("acme", navigation, set()))])
    assert [node.full_name for node in visible(tree, frozenset({"member"}))] == []


def _with(change: Any) -> dict[str, Any]:
    navigation = copy.deepcopy(NAVIGATION)
    change(navigation)
    return navigation


def _item_notes(navigation: dict[str, Any]) -> dict[str, Any]:
    return navigation["nodes"][0]["children"][0]["children"][0]


@pytest.mark.parametrize(
    ("navigation", "actions", "reason"),
    [
        # A file that fails its schema: an unknown field.
        (_with(lambda n: n["nodes"][0].update(colour="red")), ACTIONS, "not allowed"),
        # An id used twice within one owner.
        (_with(lambda n: n["nodes"][0]["children"][0]["children"][1].update(id="item-draft")), ACTIONS, "used twice"),
        # Two nodes of one owner open the same page.
        (
            _with(lambda n: n["nodes"][0]["children"][0]["children"][1].update(page="/items/{item_id}")),
            ACTIONS,
            "open the same page",
        ),
        # A parameter no list node above defines.
        (
            _with(lambda n: n["nodes"][0]["children"][0]["children"][1].update(page="/items/{note_id}/published")),
            ACTIONS,
            "neither it nor a list node above",
        ),
        # Two list nodes with one key, one under the other.
        (
            _with(
                lambda n: n["nodes"][0]["children"][0]["children"].append(
                    {"id": "again", "each": {"source": "list_items", "key": "item_id"}}
                )
            ),
            ACTIONS,
            "already defines",
        ),
        # Navigation format 1, which declared controls.
        (_with(lambda n: n.update(navigation=1)), ACTIONS, "navigation format 1 is not read; write format 3"),
        # Navigation format 2, which carried a page's history and a room's shared parameters.
        (_with(lambda n: n.update(navigation=2)), ACTIONS, "navigation format 2 is not read; write format 3"),
        # A node that declares what its page gives or a room it no longer has, named.
        (_with(lambda n: _item_notes(n).update(controls={"views": {}})), ACTIONS, "'item-draft' declares controls"),
        (_with(lambda n: _item_notes(n).update(history={"read": "list_item_notes"})), ACTIONS, "'item-draft' declares history"),
        (_with(lambda n: _item_notes(n).update(room={"shared": ["view"]})), ACTIONS, "'item-draft' declares room"),
        # A list whose source is no action of the plugin.
        (NAVIGATION, ACTIONS - {"list_items"}, "is no action of the plugin"),
        # Attached to a node the core does not have.
        (_with(lambda n: n["nodes"][0].update(attach="core:item")), ACTIONS, "which the core does not have"),
    ],
)
def test_each_fault_of_one_file_is_refused(navigation: dict[str, Any], actions: set[str], reason: str) -> None:
    assert reason in _refused(lambda: check_version("notes", navigation, actions))


def _reviews(attach: str) -> dict[str, Any]:
    return {
        "navigation": 3,
        "nodes": [{"id": "reviews", "attach": attach, "title": "Reviews", "page": "/items/{item_id}/reviews"}],
    }


def test_a_plugin_stands_under_a_node_of_its_direct_dependency_and_sees_its_scope() -> None:
    reviews = PluginFile("reviews", frozenset({"notes"}), check_version("reviews", _reviews("notes:item"), set()))
    tree = {node.full_name: node for node in _tree(_notes(), reviews)}
    assert tree["reviews:reviews"].scope == ("item_id",)


def test_a_plugin_attached_to_a_plugin_that_is_no_direct_dependency_is_refused() -> None:
    reviews = PluginFile("reviews", frozenset(), check_version("reviews", _reviews("notes:item"), set()))
    assert "only to the core or to a direct dependency" in _refused(lambda: _tree(_notes(), reviews))


def test_a_plugin_attached_to_a_node_its_dependency_does_not_have_is_refused() -> None:
    reviews = PluginFile("reviews", frozenset({"notes"}), check_version("reviews", _reviews("notes:folder"), set()))
    assert "which does not exist" in _refused(lambda: _tree(_notes(), reviews))


def test_a_parameter_the_attachment_does_not_give_is_refused() -> None:
    reviews = PluginFile("reviews", frozenset({"notes"}), check_version("reviews", _reviews("notes:notes"), set()))
    assert "which nothing above it defines" in _refused(lambda: _tree(_notes(), reviews))
