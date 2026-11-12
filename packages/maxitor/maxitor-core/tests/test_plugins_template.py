# packages/maxitor/maxitor-core/tests/test_plugins_template.py
"""The plugin template deploys as Maxitor's installer builds it: its schema.yaml and its key to the core are accepted,
and its version's schema and user are named notes_<version> and plg_notes_<version>."""

from __future__ import annotations

from pathlib import Path

import yaml
from maxitor.core.plugins.actions.deploy_and_install_action import schema_name_of
from maxitor.core.plugins.core_keys import core_keys
from maxitor.core.plugins.ddl import build_statements
from maxitor_plugin_sdk.plugin_schema import read_plugin_schema

TEMPLATE = Path(__file__).resolve().parents[3] / "maxitor-plugin-template" / "src" / "maxitor_notes"


def test_the_templates_tables_and_key_are_built() -> None:
    schema = read_plugin_schema(TEMPLATE / "schema.yaml")
    keys = core_keys((TEMPLATE / "foreign-keys.yaml").read_text(encoding="utf-8"), schema)
    assert [(k.table, k.columns, k.target, k.references) for k in keys] == [
        ("note", ("organization_id", "writer_id"), "user", ("organization_id", "account_id")),
        ("revision", ("organization_id", "publisher_id"), "user", ("organization_id", "account_id")),
        ("note_change", ("organization_id", "person_id"), "user", ("organization_id", "account_id")),
        ("note_change", ("organization_id", "writer_id"), "user", ("organization_id", "account_id")),
    ]
    statements = build_statements(schema)
    for table in ("note", "note_versions", "note_change", "note_change_versions", "revision", "revision_versions"):
        assert any(s.startswith(f'CREATE TABLE "{table}" (') for s in statements)


def test_the_templates_version_is_named_after_its_passport() -> None:
    passport = yaml.safe_load((TEMPLATE / "maxitor-plugin.yaml").read_text(encoding="utf-8"))
    assert passport["passport"] == 3 and "migrate" not in passport["backend"]
    schema = schema_name_of(passport["name"], passport["version"])
    assert (schema, f"plg_{schema}") == ("notes_0_14_0", "plg_notes_0_14_0")
