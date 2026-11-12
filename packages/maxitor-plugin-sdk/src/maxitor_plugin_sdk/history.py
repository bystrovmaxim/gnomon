# packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/history.py
"""
The history contract between a plugin and the core's time scale: the bars a page's own reading query gives, and the
rules of the history a plugin declares.

A page's bars count what its reading query shows: the same query, run over a stretch with the interval form of the
moment condition (``moments.overlaps``), finds every version that was part of the page's answer at some time in the
stretch. ``bars_of`` turns those versions into counts, by what the versions themselves say (versioned storage,
section 5)::

    an opening at T, and no version of that entity closed at T   → added
    an opening at T where a version of that entity closed at T    → changed
    a closing at T with no opening of that entity at T            → removed

Only times inside the stretch ``(start, end]`` count; a bar is ``width`` seconds long and starts at
``start + k · width``, a change at ``end`` itself falling into the last bar; only bars with a change are answered.

The shapes that pass between the scale and a plugin are ``schemas/history-1.schema.json``.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

#: The folder of a plugin's package holding its history actions, one per file: ``history/<name>_action.py``.
HISTORY_FOLDER = "history"

#: The comparisons a page may offer beside one moment.
COMPARISONS = ("diff", "side_by_side")

_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ"


@dataclass(frozen=True)
class Version:
    """One version a reading query found: its entity, and when it opened and closed (``None`` while open)."""

    entity_id: str
    valid_from: str
    valid_to: str | None


@dataclass(frozen=True)
class Bar:
    """One bar of the scale: its start and its counts."""

    start: str
    added: int
    changed: int
    removed: int


def bars_of(versions: Iterable[Version], start: str, end: str, width: int) -> list[Bar]:
    """The bars of the stretch ``(start, end]``, ``width`` seconds each, from the versions a page's query found."""
    if width <= 0:
        raise ValueError("A bar must last at least a second")
    origin, finish = _time(start), _time(end)
    opened: dict[str, set[datetime]] = defaultdict(set)
    closed: dict[str, set[datetime]] = defaultdict(set)
    for version in versions:
        opening = _time(version.valid_from)
        if origin < opening <= finish:
            opened[version.entity_id].add(opening)
        if version.valid_to is not None:
            closing = _time(version.valid_to)
            if origin < closing <= finish:
                closed[version.entity_id].add(closing)
    counts: dict[int, list[int]] = defaultdict(lambda: [0, 0, 0])
    last = max(0, -(-int((finish - origin).total_seconds()) // width) - 1)
    for entity in set(opened) | set(closed):
        for moment in opened[entity] | closed[entity]:
            kind = 1 if moment in opened[entity] and moment in closed[entity] else 0 if moment in opened[entity] else 2
            # A change at the stretch's very end belongs to its last bar, not to one past it.
            counts[min(int((moment - origin).total_seconds() // width), last)][kind] += 1
    return [
        Bar(start=_text(origin + timedelta(seconds=index * width)), added=added, changed=changed, removed=removed)
        for index, (added, changed, removed) in sorted(counts.items())
    ]


def _time(moment: str) -> datetime:
    """A moment string as a time."""
    return datetime.strptime(moment, _FORMAT).replace(tzinfo=UTC)


def _text(time: datetime) -> str:
    """A time as a moment string."""
    return time.astimezone(UTC).strftime(_FORMAT)
