# packages/maxitor-plugin-template/tests/test_controls.py
"""The page's controls: a closed set, each an address parameter of its own, coloured from Maxitor's palette only."""

import pytest
from maxitor_plugin_sdk.checks import check_plugin


def _item_notes(doc):
    return next(node for node in doc["nodes"] if node["id"] == "item-notes")


def _controls(doc):
    return _item_notes(doc)["controls"]


MODE = {
    "param": "mode",
    "default": "recent",
    "options": [{"value": "recent", "label": "Recent", "icon": "clock"}, {"value": "pinned", "label": "Pinned"}],
    "counts": "count_notes_by_mode",
}


def test_a_mode_pill_with_counts_passes(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _controls(doc).update(mode=MODE))
    assert check_plugin(plugin) == []


def test_counts_belong_to_the_mode_pill_only(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _controls(doc)["views"].update(counts="count_notes"))
    assert any("'counts' was unexpected" in problem for problem in check_plugin(plugin))


@pytest.mark.parametrize("field", [{"position": "bottom"}, {"style": {"color": "#ff0000"}}, {"search": {"param": "q"}}])
def test_there_is_no_field_to_place_restyle_or_invent_a_control(plugin, edit, field) -> None:
    edit("navigation.yaml", lambda doc: _controls(doc).update(field))
    assert any("was unexpected" in problem for problem in check_plugin(plugin))


def test_a_colour_is_a_palette_name_not_a_code(plugin, edit) -> None:
    states = {"title": "State", "param": "state", "options": [{"value": "open", "label": "Open", "colour": "#00ff00"}]}
    edit("navigation.yaml", lambda doc: _controls(doc)["filters"].append(states))
    assert any("filters/1/options/0/colour" in problem for problem in check_plugin(plugin))


def test_a_filter_takes_options_or_a_source_not_both(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _controls(doc)["filters"][0].update(options=[{"value": "me", "label": "Me"}]))
    assert any("filters/0" in problem for problem in check_plugin(plugin))


@pytest.mark.parametrize("param", ["at", "_view", "View"])
def test_a_parameter_reserved_by_maxitor_is_refused(plugin, edit, param) -> None:
    edit("navigation.yaml", lambda doc: _controls(doc)["views"].update(param=param))
    assert any("controls/views/param" in problem for problem in check_plugin(plugin))


def test_two_controls_on_one_parameter_are_refused(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _controls(doc)["filters"][0].update(param="view"))
    assert "navigation: 'item-notes' has two controls on the parameter 'view'" in check_plugin(plugin)


def test_a_control_on_a_parameter_of_the_path_is_refused(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _controls(doc)["filters"][0].update(param="item_id"))
    assert "navigation: 'item-notes' has a control on 'item_id', which is a parameter of its path" in check_plugin(plugin)


def test_a_default_that_is_not_an_option_is_refused(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _controls(doc)["views"].update(default="grid"))
    assert "navigation: 'item-notes': the default 'grid' of 'view' is not one of its options" in check_plugin(plugin)


def test_a_choice_needs_at_least_two_options(plugin, edit) -> None:
    edit("navigation.yaml", lambda doc: _controls(doc)["views"].update(options=[{"value": "list", "label": "List"}]))
    assert any("controls/views/options" in problem for problem in check_plugin(plugin))
