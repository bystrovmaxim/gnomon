# packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/date_bounds.py
"""
A range of dates as the shell of ``@maxitor/panel`` writes it in the address, read on a plugin's server.

A filter of dates keeps its bounds as written — ``from..to``, either side empty — so a bound may be a day
(``2026-09-01``), a month (``2026-09``) or a bound moving with today (``now``, ``now-30d``, ``now/M``, ``now-1y/y``).
The rules are those of ``@maxitor/panel``'s ``pickers/dates.ts`` (``resolve``, ``shift``, ``periodEdge``), so a page's
reading action and its bars filter exactly as the page shows::

    parse("2026-09-01..2026-09-30", today)  →  (2026-09-01, 2026-09-30)
    parse("now-30d..now", 2026-11-12)        →  (2026-10-13, 2026-11-12)
    parse("2026-09..", today)                →  (2026-09-01, None)
    within("2026-09-15T10:00:00.000000Z", (2026-09-01, 2026-09-30))  →  True
"""

from __future__ import annotations

import re
from datetime import date, timedelta

_MOVING = re.compile(r"^now(?:-(\d+)([dwMy]))?(?:/([dMQy]))?$")
_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_MONTH = re.compile(r"^\d{4}-\d{2}$")

Range = tuple[date | None, date | None]


def _overflow(year: int, month: int, day: int) -> date:
    """The day ``day`` of ``month`` of ``year``, running into the next month when the month is shorter, as JS's Date does."""
    year += (month - 1) // 12
    month = (month - 1) % 12 + 1
    return date(year, month, 1) + timedelta(days=day - 1)


def shift(day: date, n: int, unit: str) -> date:
    """The day ``n`` units before ``day``."""
    if unit == "d":
        return day - timedelta(days=n)
    if unit == "w":
        return day - timedelta(days=7 * n)
    if unit == "M":
        return _overflow(day.year, day.month - n, day.day)
    if unit == "y":
        return _overflow(day.year - n, day.month, day.day)
    return day


def period_edge(day: date, unit: str, end: bool) -> date:
    """The first or the last day of the period of ``unit`` that holds ``day``."""
    if unit == "M":
        return _overflow(day.year, day.month + 1, 1) - timedelta(days=1) if end else date(day.year, day.month, 1)
    if unit == "Q":
        first = (day.month - 1) // 3 * 3 + 1
        return _overflow(day.year, first + 3, 1) - timedelta(days=1) if end else date(day.year, first, 1)
    if unit == "y":
        return date(day.year, 12, 31) if end else date(day.year, 1, 1)
    return day


def resolve(bound: str, end: bool, today: date) -> date | None:
    """The day a bound stands for; ``None`` for an empty or unknown bound."""
    if not bound:
        return None
    if _DAY.match(bound):
        return date.fromisoformat(bound)
    if _MONTH.match(bound):
        return period_edge(date.fromisoformat(f"{bound}-01"), "M", end)
    found = _MOVING.match(bound)
    if not found:
        return None
    day = shift(today, int(found.group(1)), found.group(2)) if found.group(1) else today
    if found.group(3):
        day = period_edge(day, found.group(3), end)
    return day


def parse(value: str | None, today: date) -> Range:
    """The two days of a range written ``from..to``; an absent value or side is an open bound."""
    if not value or ".." not in value:
        return None, None
    start, finish = value.split("..", 1)
    return resolve(start, False, today), resolve(finish, True, today)


def within(moment: str, bounds: Range) -> bool:
    """Whether a moment's day lies inside the bounds; an open range lets everything through, an empty moment only an open one."""
    start, finish = bounds
    if start is None and finish is None:
        return True
    if not moment:
        return False
    day = date.fromisoformat(moment[:10])
    return (start is None or day >= start) and (finish is None or day <= finish)
