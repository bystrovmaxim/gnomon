# packages/maxitor-plugin-sdk/tests/test_date_bounds.py
"""A range of dates read on the server as the shell writes it (spec 079, FR-046): the same cases as pickers/dates.ts."""

from datetime import date

import pytest
from maxitor_plugin_sdk.date_bounds import parse, resolve, shift, within

TODAY = date(2026, 11, 12)


@pytest.mark.parametrize(
    ("bound", "end", "day"),
    [
        ("2026-09-01", False, date(2026, 9, 1)),
        ("2026-09", False, date(2026, 9, 1)),
        ("2026-09", True, date(2026, 9, 30)),
        ("now", False, TODAY),
        ("now-30d", False, date(2026, 10, 13)),
        ("now-2w", False, date(2026, 10, 29)),
        ("now/M", False, date(2026, 11, 1)),
        ("now/M", True, date(2026, 11, 30)),
        ("now/Q", True, date(2026, 12, 31)),
        ("now-1y/y", False, date(2025, 1, 1)),
        ("now-1y/y", True, date(2025, 12, 31)),
        ("", False, None),
        ("yesterday", False, None),
    ],
)
def test_a_bound_reads_as_the_shell_writes_it(bound: str, end: bool, day: date | None) -> None:
    assert resolve(bound, end, TODAY) == day


def test_a_month_back_runs_over_a_shorter_month_as_javascript_does() -> None:
    assert shift(date(2026, 3, 31), 1, "M") == date(2026, 3, 3)
    assert shift(date(2028, 2, 29), 1, "y") == date(2027, 3, 1)


def test_a_range_has_two_bounds_either_open() -> None:
    assert parse("2026-09-01..2026-09-30", TODAY) == (date(2026, 9, 1), date(2026, 9, 30))
    assert parse("now-30d..now", TODAY) == (date(2026, 10, 13), TODAY)
    assert parse("2026-09..", TODAY) == (date(2026, 9, 1), None)
    assert parse(None, TODAY) == (None, None)
    assert parse("2026-09-01", TODAY) == (None, None)


def test_a_moment_lies_within_the_days_and_an_empty_one_only_in_an_open_range() -> None:
    september = (date(2026, 9, 1), date(2026, 9, 30))
    assert within("2026-09-30T23:59:59.000000Z", september)
    assert not within("2026-10-01T00:00:00.000000Z", september)
    assert within("", (None, None))
    assert not within("", september)
