# packages/maxitor-plugin-template/tests/test_navigation.py
"""navigation.yaml: a plugin only adds nodes, and every address it declares can be built and told apart."""

import pytest
from maxitor_plugin_sdk.checks import check_plugin


def _root_section(doc):
    return next(node for node in doc["nodes"] if node["attach"] == "root")


def _all(nodes, depth=0):
    """Every node of the tree with its depth, the top level at 0."""
    for node in nodes:
        yield node, depth
        yield from _all(node.get("children", []), depth + 1)


def _node(doc, node_id):
    return next(node for node, _depth in _all(doc["nodes"]) if node["id"] == node_id)


def test_a_node_with_no_attachment_at_the_top_is_refused(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: doc["nodes"][0].pop("attach"))
    assert any("'attach' is a required property" in problem for problem in check_plugin(plugin))


def test_a_child_node_cannot_attach_elsewhere(plugin, edit) -> None:
    child = {"id": "inner", "title": "Inner", "page": "/inner", "attach": "core:settings"}
    edit("navigation.yaml", lambda doc: _root_section(doc).update(children=[child]))
    assert any("'attach' was unexpected" in problem for problem in check_plugin(plugin))


@pytest.mark.parametrize("field", [{"hide": ["core:settings.plugins"]}, {"rename": {"core:settings": "Mine"}}, {"before": "core:settings"}])
def test_there_is_no_field_to_change_a_node_the_plugin_does_not_own(plugin, edit, field) -> None:
    edit("navigation.yaml", lambda doc: doc["nodes"][0].update(field))
    assert any("was unexpected" in problem for problem in check_plugin(plugin))


@pytest.mark.parametrize("attach", ["core", "core:", ":settings", "Core:settings", "core:settings;drop"])
def test_an_attachment_that_is_not_a_node_name_is_refused(plugin, edit, attach) -> None:
    edit("navigation.yaml", lambda doc: doc["nodes"][0].update(attach=attach))
    assert any("nodes/0/attach" in problem for problem in check_plugin(plugin))


def test_a_list_node_takes_its_titles_from_its_source_not_a_title(plugin, edit) -> None:
    child = {"id": "author", "title": "Author", "each": {"source": "list_authors", "key": "author_id"}, "page": "/authors/{author_id}"}
    edit("navigation.yaml", lambda doc: _root_section(doc).update(children=[child]))
    assert any("nodes/0/children/0" in problem for problem in check_plugin(plugin))


def test_an_id_used_twice_is_refused(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _root_section(doc).update(id="item-draft"))
    assert "navigation: the id 'item-draft' is used twice" in check_plugin(plugin)


def test_two_nodes_opening_the_same_page_are_refused(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _root_section(doc).update(page="/items/{item_id}"))
    assert any("open the same page" in problem for problem in check_plugin(plugin))


def test_a_parameter_no_list_node_defines_is_refused(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _root_section(doc).update(page="/authors/{author_id}"))
    assert "navigation: 'notes' uses {author_id}, which neither it nor a list node above it defines" in check_plugin(plugin)


def test_a_parameter_a_list_node_above_defines_passes(plugin, edit, action) -> None:
    action("list_authors")
    child = {"id": "author", "each": {"source": "list_authors", "key": "author_id"}, "page": "/authors/{author_id}"}
    edit("navigation.yaml", lambda doc: _root_section(doc).update(children=[child]))
    assert check_plugin(plugin) == []


def test_a_list_key_defined_twice_in_one_scope_is_refused(plugin, edit) -> None:
    inner = {"id": "again", "each": {"source": "list_authors", "key": "author_id"}, "page": "/again/{author_id}"}
    outer = {"id": "author", "each": {"source": "list_authors", "key": "author_id"}, "page": "/authors/{author_id}", "children": [inner]}
    edit("navigation.yaml", lambda doc: _root_section(doc).update(children=[outer]))
    assert "navigation: 'again' defines 'author_id', which a list node above it already defines" in check_plugin(plugin)


@pytest.mark.parametrize("key", ["history", "room"])
def test_a_page_node_declaring_history_or_a_room_is_refused_by_name(plugin, edit, key) -> None:
    edit("navigation.yaml", lambda doc: _node(doc, "item-draft").update({key: {}}))
    assert any(f"'item-draft' declares {key}" in problem for problem in check_plugin(plugin))


@pytest.mark.parametrize("page", ["items/{item_id}", "/items/../admin", "/items/{Item}", "/items?view=table"])
def test_a_page_that_is_not_a_plain_path_is_refused(plugin, edit, page) -> None:
    edit("navigation.yaml", lambda doc: doc["nodes"][0].update(page=page))
    assert any("nodes/0/page" in problem for problem in check_plugin(plugin))


def test_every_node_of_the_template_hangs_from_its_own_root_and_none_from_a_node_the_core_does_not_have() -> None:
    import yaml

    from tests.conftest import PACKAGE, TEMPLATE

    doc = yaml.safe_load((TEMPLATE / PACKAGE / "navigation.yaml").read_text(encoding="utf-8"))
    assert [node["attach"] for node in doc["nodes"]] == ["root"]
    assert not any("attach" in node for node, depth in _all(doc["nodes"]) if depth > 0)


def test_the_items_pages_take_item_id_from_the_list_node_above_them() -> None:
    import yaml

    from tests.conftest import PACKAGE, TEMPLATE

    doc = yaml.safe_load((TEMPLATE / PACKAGE / "navigation.yaml").read_text(encoding="utf-8"))
    item = _node(doc, "item")
    assert item["each"] == {"source": "list_items", "key": "item_id"}
    assert "page" not in item
    pages = {child["id"]: child["page"] for child in item["children"]}
    assert pages == {"item-draft": "/items/{item_id}", "item-published": "/items/{item_id}/published"}


def test_a_page_under_the_items_without_the_list_node_above_is_refused(plugin, edit) -> None:
    def lift(doc):
        item = _node(doc, "item")
        _root_section(doc)["children"] = item["children"]

    edit("navigation.yaml", lift)
    assert any("uses {item_id}, which neither it nor a list node above it defines" in problem for problem in check_plugin(plugin))
