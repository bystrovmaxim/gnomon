# packages/maxitor-plugin-template/tests/test_dependencies.py
"""A dependency cycle is found and named round; a graph without one passes."""

from plugin_check import find_cycle


def test_a_cycle_is_named_round() -> None:
    assert find_cycle({"a": ["b"], "b": ["c"], "c": ["a"]}) == ["a", "b", "c", "a"]


def test_a_plugin_depending_on_itself_is_a_cycle() -> None:
    assert find_cycle({"a": ["a"]}) == ["a", "a"]


def test_a_cycle_below_an_acyclic_start_is_found() -> None:
    assert find_cycle({"a": ["b"], "b": ["c"], "c": ["b"]}) == ["b", "c", "b"]


def test_a_diamond_is_not_a_cycle() -> None:
    assert find_cycle({"top": ["left", "right"], "left": ["base"], "right": ["base"]}) is None


def test_no_dependencies_is_not_a_cycle() -> None:
    assert find_cycle({"a": [], "b": []}) is None
