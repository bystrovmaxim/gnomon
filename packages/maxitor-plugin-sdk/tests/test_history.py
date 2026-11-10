"""The bars a page's own reading query gives: added, changed and removed, from what the versions say."""

import pytest
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
