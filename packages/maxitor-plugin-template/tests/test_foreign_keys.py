# packages/maxitor-plugin-template/tests/test_foreign_keys.py
"""foreign-keys.yaml: nothing but checked identifiers reaches the installer, so nothing in it can become SQL."""

import pytest
from maxitor_plugin_sdk.checks import check_plugin


def _key(doc):
    return doc["foreign_keys"][0]


@pytest.mark.parametrize(
    "table",
    ['items"; DROP TABLE core.users; --', "core.items", "items items", "items;", "Items", "items'", "a" * 64],
)
def test_a_name_that_is_not_a_bare_identifier_is_refused(plugin, edit, table) -> None:
    edit("foreign-keys.yaml", lambda doc: _key(doc)["to"].update(table=table))
    assert any("foreign_keys/0/to/table" in problem for problem in check_plugin(plugin))


@pytest.mark.parametrize("column", ["id)", "id, secret", "(select 1)"])
def test_a_column_that_is_not_a_bare_identifier_is_refused(plugin, edit, column) -> None:
    edit("foreign-keys.yaml", lambda doc: _key(doc)["from"].update(columns=[column]))
    assert any("foreign_keys/0/from/columns/0" in problem for problem in check_plugin(plugin))


@pytest.mark.parametrize("field", [{"name": "fk_mine"}, {"on_delete": "CASCADE"}, {"sql": "ALTER TABLE ..."}])
def test_there_is_no_field_for_a_name_a_rule_or_sql(plugin, edit, field) -> None:
    edit("foreign-keys.yaml", lambda doc: _key(doc).update(field))
    assert any("was unexpected" in problem for problem in check_plugin(plugin))


def test_the_source_schema_cannot_be_given(plugin, edit) -> None:
    edit("foreign-keys.yaml", lambda doc: _key(doc)["from"].update(schema="core"))
    assert any("'schema' was unexpected" in problem for problem in check_plugin(plugin))


def test_a_version_table_is_refused(plugin, edit) -> None:
    edit("foreign-keys.yaml", lambda doc: _key(doc)["to"].update(table="items_versions"))
    assert any("foreign_keys/0/to/table" in problem for problem in check_plugin(plugin))


def test_a_key_into_the_plugins_own_schema_is_refused(plugin, edit) -> None:
    edit("foreign-keys.yaml", lambda doc: _key(doc)["to"].update(schema="notes"))
    assert check_plugin(plugin) == ["foreign key 1: a key inside the plugin's own schema belongs to its migrations"]


def test_column_lists_of_different_length_are_refused(plugin, edit) -> None:
    edit("foreign-keys.yaml", lambda doc: _key(doc)["to"].update(columns=["id", "organization_id"]))
    assert check_plugin(plugin) == ["foreign key 1: 1 columns refer to 2"]
