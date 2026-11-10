# packages/maxitor-plugin-sdk/tests/test_plugin_schema.py
"""A plugin's schema.yaml: a valid file is read; every unsafe name and unknown type is refused before any SQL exists."""

from __future__ import annotations

import pytest
from maxitor_plugin_sdk.plugin_schema import PluginSchemaError, parse_plugin_schema

VALID = """
schema: 1
tables:
  note:
    description: A note on an item.
    columns:
      item_id: {type: uuid, nullable: false, description: The item the note is about.}
      writer_id: {type: uuid, nullable: false, description: Who wrote it.}
      body: {type: text, nullable: false, description: The text.}
    indexes: [[item_id]]
  note_tag:
    description: A tag of a note.
    columns:
      note_id: {type: uuid, nullable: false, description: The note.}
      tag: {type: text, nullable: false, description: The tag.}
    unique: [[note_id, tag]]
    keys:
      - {columns: [note_id], table: note, references: [id]}
mechanics:
  import_ledger:
    description: What was imported, kept without versions.
    columns:
      source: {type: text, nullable: false, description: The source.}
"""


def _with(name: str, *, table: bool) -> str:
    """A file whose one table or column is named ``name``."""
    if table:
        return f"schema: 1\ntables:\n  '{name}':\n    description: x\n    columns:\n      a: {{type: text, nullable: false, description: x}}\n"
    return f"schema: 1\ntables:\n  t:\n    description: x\n    columns:\n      '{name}': {{type: text, nullable: false, description: x}}\n"


def test_a_valid_file_is_read_in_its_order() -> None:
    schema = parse_plugin_schema(VALID)
    assert [t.name for t in schema.tables] == ["note", "note_tag", "import_ledger"]
    note = schema.tables[0]
    assert [c.name for c in note.columns] == ["item_id", "writer_id", "body"]
    assert note.primary_key == ("id",) and note.indexes == (("item_id",),) and not note.mechanics
    assert schema.tables[1].keys[0].table == "note" and schema.tables[2].mechanics


@pytest.mark.parametrize(
    "name",
    ['no"te', "no'te", "a.b", "a b", "a;drop", "A", "1a", "_a", "x" * 41, "note_versions", "é"],
)
def test_an_unsafe_table_name_is_refused(name: str) -> None:
    with pytest.raises(PluginSchemaError):
        parse_plugin_schema(_with(name, table=True))


@pytest.mark.parametrize(
    "name", ['co"l', "a.b", "a b", "a;b", "x" * 49, "id", "organization_id", "valid_from_at", "created_at"]
)
def test_an_unsafe_or_reserved_column_is_refused(name: str) -> None:
    with pytest.raises(PluginSchemaError):
        parse_plugin_schema(_with(name, table=False))


@pytest.mark.parametrize("kind", ["varchar", "serial", "int; DROP TABLE x", "TEXT", "money"])
def test_an_unknown_type_is_refused(kind: str) -> None:
    text = f"schema: 1\ntables:\n  t:\n    description: x\n    columns:\n      a: {{type: '{kind}', nullable: false, description: x}}\n"
    with pytest.raises(PluginSchemaError) as refused:
        parse_plugin_schema(text)
    assert any("tables/t/columns/a/type" in p for p in refused.value.problems)


def test_an_unknown_key_a_missing_description_and_a_dangling_reference_are_refused() -> None:
    with pytest.raises(PluginSchemaError):
        parse_plugin_schema(VALID.replace("schema: 1", "schema: 1\nsql: DROP TABLE x"))
    with pytest.raises(PluginSchemaError):
        parse_plugin_schema(VALID.replace(" description: The text.", ""))
    with pytest.raises(PluginSchemaError) as refused:
        parse_plugin_schema(VALID.replace("table: note, references", "table: nowhere, references"))
    assert refused.value.problems == ["note_tag: a key names no table nowhere"]
    with pytest.raises(PluginSchemaError) as refused:
        parse_plugin_schema(VALID.replace("indexes: [[item_id]]", "indexes: [[missing]]"))
    assert refused.value.problems == ["note: no column missing"]


def test_a_key_must_reference_a_primary_or_unique_key() -> None:
    with pytest.raises(PluginSchemaError) as refused:
        parse_plugin_schema(VALID.replace("references: [id]", "references: [body]"))
    assert refused.value.problems == ["note_tag: a key to note must reference its primary key or a unique key"]
