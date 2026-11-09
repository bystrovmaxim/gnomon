# packages/maxitor-plugin-template/tests/test_navigation.py
"""navigation.yaml: a plugin only adds nodes, and every address it declares can be built and told apart."""

import pytest
from maxitor_plugin_sdk.checks import check_plugin


def _root_section(doc):
    return next(node for node in doc["nodes"] if node["attach"] == "root")


def test_a_node_with_no_attachment_at_the_top_is_refused(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: doc["nodes"][0].pop("attach"))
    assert any("'attach' is a required property" in problem for problem in check_plugin(plugin))


def test_a_child_node_cannot_attach_elsewhere(plugin, edit) -> None:
    child = {"id": "inner", "title": "Inner", "page": "/inner", "attach": "core:catalog"}
    edit("navigation.yaml", lambda doc: _root_section(doc).update(children=[child]))
    assert any("'attach' was unexpected" in problem for problem in check_plugin(plugin))


@pytest.mark.parametrize("field", [{"hide": ["core:item.overview"]}, {"rename": {"core:catalog": "Mine"}}, {"before": "core:item"}])
def test_there_is_no_field_to_change_a_node_the_plugin_does_not_own(plugin, edit, field) -> None:
    edit("navigation.yaml", lambda doc: doc["nodes"][0].update(field))
    assert any("was unexpected" in problem for problem in check_plugin(plugin))


@pytest.mark.parametrize("attach", ["core", "core:", ":item", "Core:item", "core:item;drop"])
def test_an_attachment_that_is_not_a_node_name_is_refused(plugin, edit, attach) -> None:
    edit("navigation.yaml", lambda doc: doc["nodes"][0].update(attach=attach))
    assert any("nodes/0/attach" in problem for problem in check_plugin(plugin))


def test_a_list_node_takes_its_titles_from_its_source_not_a_title(plugin, edit) -> None:
    child = {"id": "author", "title": "Author", "each": {"source": "list_authors", "key": "author_id"}, "page": "/authors/{author_id}"}
    edit("navigation.yaml", lambda doc: _root_section(doc).update(children=[child]))
    assert any("nodes/1/children/0" in problem for problem in check_plugin(plugin))


def test_an_id_used_twice_is_refused(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _root_section(doc).update(id="item-notes"))
    assert "navigation: the id 'item-notes' is used twice" in check_plugin(plugin)


def test_two_nodes_opening_the_same_page_are_refused(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _root_section(doc).update(page="/items/{item_id}"))
    assert any("open the same page" in problem for problem in check_plugin(plugin))


def test_a_parameter_no_list_node_defines_is_refused(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _root_section(doc).update(page="/authors/{author_id}"))
    assert "navigation: 'notes' uses {author_id}, which neither it nor a list node above it defines" in check_plugin(plugin)


def test_a_parameter_a_list_node_above_defines_passes(plugin, edit) -> None:
    child = {"id": "author", "each": {"source": "list_authors", "key": "author_id"}, "page": "/authors/{author_id}"}
    edit("navigation.yaml", lambda doc: _root_section(doc).update(children=[child]))
    assert check_plugin(plugin) == []


def test_a_list_key_defined_twice_in_one_scope_is_refused(plugin, edit) -> None:
    inner = {"id": "again", "each": {"source": "list_authors", "key": "author_id"}, "page": "/again/{author_id}"}
    outer = {"id": "author", "each": {"source": "list_authors", "key": "author_id"}, "page": "/authors/{author_id}", "children": [inner]}
    edit("navigation.yaml", lambda doc: _root_section(doc).update(children=[outer]))
    assert "navigation: 'again' defines 'author_id', which a list node above it already defines" in check_plugin(plugin)


@pytest.mark.parametrize("name", ["at", "_view", "View"])
def test_a_shared_room_parameter_reserved_by_maxitor_is_refused(plugin, edit, name) -> None:
    edit("navigation.yaml", lambda doc: doc["nodes"][0]["room"].update(shared=[name]))
    assert any("room/shared/0" in problem for problem in check_plugin(plugin))


@pytest.mark.parametrize("page", ["items/{item_id}", "/items/../admin", "/items/{Item}", "/items?view=table"])
def test_a_page_that_is_not_a_plain_path_is_refused(plugin, edit, page) -> None:
    edit("navigation.yaml", lambda doc: doc["nodes"][0].update(page=page))
    assert any("nodes/0/page" in problem for problem in check_plugin(plugin))
