# packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/core_functions.py
"""
What a plugin needs of Maxitor's core, as the SQL that calls the core's functions — never its tables.

A plugin's database user sees only its own schema and may execute five functions of the core's schema
``organization``, found through its ``search_path``:

``change_time(organization)``                 the organization's lock and the core's change time for it
``watermark(organization)``                   the organization's last change in the core's tables
``is_member(organization, account)``          whether the account has an active user there now
``member_organization(code, account)``        the organization of the address when the account is active there
``member_name(organization, account, at)``    the account's user's name in the organization at a moment

A plugin's own change time and watermark are the greatest of the core's and its own version tables' — the SQL here
builds both from the names of those tables, which are the plugin's own constants.
"""

from __future__ import annotations

import re
from collections.abc import Sequence

_TABLE = re.compile(r"^[a-z][a-z0-9_]{0,62}$")


def _changes(version_tables: Sequence[str]) -> str:
    """Every opening and closing time of the organization ``$1`` in the plugin's own version tables."""
    parts = []
    for table in version_tables:
        if not _TABLE.match(table):
            raise ValueError(f"Not a table's name: {table!r}")
        parts.append(f"SELECT max(valid_from_at) AS t FROM {table} WHERE organization_id = $1::text::uuid")
        parts.append(f"SELECT max(valid_to_at) FROM {table} WHERE organization_id = $1::text::uuid")
    return " UNION ALL ".join(parts)


def change_time_sql(version_tables: Sequence[str]) -> str:
    """
    One value: the change time of a write of the organization ``$1`` — taken under the organization's lock, after
    the core's last change and one microsecond after the plugin's own.
    """
    return (
        "SELECT greatest(change_time($1::text::uuid),"
        f" coalesce((SELECT max(t) FROM ({_changes(version_tables)}) AS own), '-infinity'::timestamptz)"
        " + interval '1 microsecond')"
    )


def watermark_sql(version_tables: Sequence[str]) -> str:
    """One value: the last change of the organization ``$1`` in the core's tables and the plugin's own; NULL before any."""
    return (
        "SELECT greatest(watermark($1::text::uuid),"
        f" (SELECT max(t) FROM ({_changes(version_tables)}) AS own))"
    )


#: One value: the organization ``$1`` (its address code) as text when the account ``$2`` is active there; NULL otherwise.
MEMBER_ORGANIZATION_SQL = "SELECT member_organization($1, $2::text::uuid)::text"


def member_name(organization: str, account: str, moment: str) -> str:
    """An SQL expression: the name of ``account``'s user in ``organization`` at ``moment``, '' when it had none."""
    return f"coalesce(member_name({organization}, {account}, {moment}), '')"
