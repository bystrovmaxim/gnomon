# packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/moments.py
"""
The moment condition of versioned storage, written in one place for every plugin.

A screen reads only version tables, and every version table of a reading query carries the same condition. This
module writes it in its two forms:

``in_force(alias, moment)``        the version in force at one moment — what a page reads
``overlaps(alias, start, end)``    every version in force at some time between two moments — what a page's bars count

Both are the form a B-tree serves (versioned storage, section 5). A moment travels between a page, the core and a
plugin as an opaque string, UTC to the microsecond, and is compared as a string: ``MOMENT_PATTERN`` is that form,
``moment_text`` turns a database time into it.
"""

from __future__ import annotations

import re

#: A moment as an address carries it: ISO 8601 in UTC with microseconds.
MOMENT_PATTERN = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$"

_ALIAS = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
_PARAMETER = re.compile(r"^\$\d{1,2}::text::timestamptz$")


def moment_text(expression: str) -> str:
    """An SQL expression: the time ``expression`` written as a moment string."""
    return f"to_char({expression} AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')"


def in_force(alias: str, moment: str) -> str:
    """The condition of the version of ``alias`` in force at ``moment`` (a query parameter such as ``$3::text::timestamptz``)."""
    _check(alias, moment)
    return f"{alias}.valid_from_at <= {moment} AND ({alias}.valid_to_at IS NULL OR {alias}.valid_to_at > {moment})"


def overlaps(alias: str, start: str, end: str) -> str:
    """The condition of every version of ``alias`` in force at some time in the stretch from ``start`` to ``end``."""
    _check(alias, start)
    _check(alias, end)
    return f"{alias}.valid_from_at <= {end} AND ({alias}.valid_to_at IS NULL OR {alias}.valid_to_at > {start})"


def _check(alias: str, moment: str) -> None:
    """Only a table alias and a parameter cast to a time enter the condition: nothing else is written into SQL."""
    if not _ALIAS.match(alias):
        raise ValueError(f"Not a table alias: {alias!r}")
    if not _PARAMETER.match(moment):
        raise ValueError(f"Not a moment parameter: {moment!r}")
