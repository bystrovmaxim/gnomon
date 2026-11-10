# packages/maxitor-plugin-sdk/tests/test_core_functions.py
"""What a plugin asks of the core is SQL over the core's functions only, built from the plugin's own table names."""

from __future__ import annotations

import pytest
from maxitor_plugin_sdk.core_functions import MEMBER_ORGANIZATION_SQL, change_time_sql, member_name, watermark_sql


def test_the_change_time_takes_the_cores_lock_and_follows_the_plugins_tables() -> None:
    sql = change_time_sql(["note_versions", "tag_versions"])
    assert sql.startswith("SELECT greatest(change_time($1::text::uuid),")
    assert "FROM note_versions WHERE organization_id = $1::text::uuid" in sql and "FROM tag_versions" in sql
    assert sql.endswith("+ interval '1 microsecond')")


def test_the_watermark_is_the_greatest_of_the_cores_and_the_plugins() -> None:
    assert watermark_sql(["note_versions"]).startswith("SELECT greatest(watermark($1::text::uuid), (SELECT max(t) FROM (")


def test_membership_and_names_come_from_functions() -> None:
    assert MEMBER_ORGANIZATION_SQL == "SELECT member_organization($1, $2::text::uuid)::text"
    assert member_name("n.organization_id", "n.writer_id", "$3") == "coalesce(member_name(n.organization_id, n.writer_id, $3), '')"


@pytest.mark.parametrize("table", ['note"; DROP', "organization.user", "Note", ""])
def test_a_table_name_that_is_not_bare_is_refused(table: str) -> None:
    with pytest.raises(ValueError):
        change_time_sql([table])
