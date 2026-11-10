# packages/maxitor/tools/plugin-installer/tests/test_ddl.py
"""
The statements built from a schema.yaml keep versioned storage by construction: every table has its version table,
the service fields, the overlap constraint and a key that begins with the organization; a table of mechanics has no
versions; every name is quoted and every description a literal.
"""

from __future__ import annotations

import re

import pytest
from maxitor.plugin_installer.ddl import build_statements, literal
from maxitor_plugin_sdk.plugin_schema import parse_plugin_schema

SCHEMA = """
schema: 1
tables:
  note:
    description: A note's text — "quoted" and it's fine.
    columns:
      item_id: {type: uuid, nullable: false, description: The item the note is about.}
      body: {type: text, nullable: true, description: The text; NULL while a draft.}
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
    description: What was imported.
    columns:
      source: {type: text, nullable: false, description: The source.}
"""


@pytest.fixture(scope="module")
def statements() -> list[str]:
    return build_statements(parse_plugin_schema(SCHEMA))


def _create(statements: list[str], table: str) -> str:
    return next(s for s in statements if s.startswith(f'CREATE TABLE "{table}" ('))


def test_every_declared_table_has_its_version_table(statements: list[str]) -> None:
    created = re.findall(r'^CREATE TABLE "(\w+)"', "\n".join(statements), re.M)
    assert created == ["note", "note_versions", "note_tag", "note_tag_versions", "import_ledger"]


def test_the_service_fields_and_the_organizations_key(statements: list[str]) -> None:
    note = _create(statements, "note")
    for line in ('"id" uuid NOT NULL', '"organization_id" uuid NOT NULL', '"body" text NULL', '"created_at" timestamptz NOT NULL', '"updated_at" timestamptz NULL'):
        assert line in note
    assert 'CONSTRAINT "note_pk" PRIMARY KEY ("organization_id", "id")' in note
    versions = _create(statements, "note_versions")
    assert 'CONSTRAINT "note_versions_pk" PRIMARY KEY ("organization_id", "id", "valid_from_at")' in versions
    assert 'EXCLUDE USING gist ("organization_id" WITH =, "id" WITH =, valid_during WITH &&)' in versions
    for line in ('"valid_to_at" timestamptz NULL', '"author_id" uuid NULL', '"operation" text NOT NULL', '"closed_by" uuid NULL', '"closed_operation" text NULL', '"item_id" uuid NOT NULL'):
        assert line in versions
    assert 'CREATE INDEX "note_versions_open" ON "note_versions" ("organization_id", "id") WHERE valid_to_at IS NULL' in statements


def test_every_table_is_found_by_its_organization_first(statements: list[str]) -> None:
    for table in ("note", "note_versions", "note_tag", "note_tag_versions", "import_ledger"):
        assert re.search(r'PRIMARY KEY \("organization_id"', _create(statements, table)), table
    assert 'CREATE INDEX "note_i1" ON "note" ("organization_id", "item_id")' in statements
    assert 'CONSTRAINT "note_tag_u1" UNIQUE ("organization_id", "note_id", "tag")' in _create(statements, "note_tag")


def test_a_table_of_mechanics_has_no_versions(statements: list[str]) -> None:
    assert not any("import_ledger_versions" in s for s in statements)
    assert 'CONSTRAINT "import_ledger_pk" PRIMARY KEY ("organization_id", "id")' in _create(statements, "import_ledger")


def test_keys_come_after_every_table_and_never_cascade(statements: list[str]) -> None:
    key = statements[-1]
    assert key == (
        'ALTER TABLE "note_tag" ADD CONSTRAINT "note_tag_k1" FOREIGN KEY ("organization_id", "note_id")'
        ' REFERENCES "note" ("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT'
    )
    assert all("CASCADE" not in s and " DEFAULT " not in s for s in statements)


def test_every_table_and_column_is_described(statements: list[str]) -> None:
    text = "\n".join(statements)
    for table in ("note", "note_versions", "note_tag", "note_tag_versions", "import_ledger"):
        assert f'COMMENT ON TABLE "{table}" IS' in text
        for column in re.findall(r'^\s+"(\w+)" ', _create(statements, table), re.M):
            assert f'COMMENT ON COLUMN "{table}"."{column}" IS' in text, f"{table}.{column}"
    assert "COMMENT ON TABLE \"note\" IS 'A note''s text — \"quoted\" and it''s fine.'" in text


def test_no_statement_names_a_schema(statements: list[str]) -> None:
    for statement in statements:
        code = re.sub(r"'(?:[^']|'')*'", "''", statement)
        assert not re.search(r'"\w+"\."\w+" (?!IS)', code.replace("COMMENT ON COLUMN", "")), statement


def test_a_literal_doubles_quotes_and_refuses_nul() -> None:
    assert literal("it's") == "'it''s'"
    with pytest.raises(ValueError):
        literal("a\x00b")
