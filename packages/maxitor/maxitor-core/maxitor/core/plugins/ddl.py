# packages/maxitor/maxitor-core/maxitor/core/plugins/ddl.py
"""
The statements that build a plugin version's tables from its ``schema.yaml``, by the rules of versioned storage.

Every name comes from a ``PluginSchema`` the SDK has already checked against its patterns, and still enters SQL only
through ``identifier``; every description only through ``literal``. The statements name no schema: the deploy runs
them with the version's schema first in ``search_path``.

Each declared table gets ``id``, ``organization_id``, ``created_at``, ``updated_at``; a primary key that begins with
``organization_id`` — the index an organization's rows are found and deleted by (bystrovmaxim/gnomon#94); and, unless
it is a table of mechanics, its ``<table>_versions`` with the service fields, a primary key on the period's start,
the constraint that no two versions of a row overlap, and the index of the versions in force.
"""

from __future__ import annotations

from maxitor.core.schemas import identifier
from maxitor_plugin_sdk.plugin_schema import TYPES, PluginSchema, Table


def literal(text: str) -> str:
    """``text`` as a PostgreSQL string literal, its quotes doubled; a NUL is refused."""
    if "\x00" in text:
        raise ValueError("A literal must not contain NUL.")
    return "'" + text.replace("'", "''") + "'"


def _names(columns: tuple[str, ...]) -> str:
    return ", ".join(identifier(c) for c in columns)


def _table(table: Table) -> list[str]:
    """CREATE TABLE of the current table, its comments, its unique keys and indexes."""
    name = identifier(table.name)
    lines = [f"{identifier('id')} uuid NOT NULL", f"{identifier('organization_id')} uuid NOT NULL"]
    lines += [f"{identifier(c.name)} {TYPES[c.type]} {'NULL' if c.nullable else 'NOT NULL'}" for c in table.columns]
    lines += [f"{identifier('created_at')} timestamptz NOT NULL", f"{identifier('updated_at')} timestamptz NULL"]
    lines.append(
        f"CONSTRAINT {identifier(table.name + '_pk')} PRIMARY KEY ({_names(('organization_id', *table.primary_key))})"
    )
    for n, group in enumerate(table.unique, start=1):
        lines.append(f"CONSTRAINT {identifier(f'{table.name}_u{n}')} UNIQUE ({_names(('organization_id', *group))})")
    statements = [f"CREATE TABLE {name} (\n    " + ",\n    ".join(lines) + "\n)"]
    statements.append(f"COMMENT ON TABLE {name} IS {literal(table.description)}")
    comments = {
        "id": "The row.",
        "organization_id": "The organization the row belongs to.",
        "created_at": "When the row was created.",
        "updated_at": "When the row last changed; NULL if never.",
    }
    comments.update({c.name: c.description for c in table.columns})
    statements += [f"COMMENT ON COLUMN {name}.{identifier(c)} IS {literal(text)}" for c, text in comments.items()]
    for n, group in enumerate(table.indexes, start=1):
        index = identifier(f"{table.name}_i{n}")
        statements.append(f"CREATE INDEX {index} ON {name} ({_names(('organization_id', *group))})")
        statements.append(f"COMMENT ON INDEX {index} IS {literal('An index the plugin declared.')}")
    return statements


def _versions(table: Table) -> list[str]:
    """CREATE TABLE of the version table, its comments, and the index of the versions in force."""
    name = identifier(f"{table.name}_versions")
    key = ("organization_id", *table.primary_key)
    types = {c.name: TYPES[c.type] for c in table.columns} | {"id": "uuid", "organization_id": "uuid"}
    nullable = {c.name: c.nullable for c in table.columns}
    data = [c for c in ("id", *(c.name for c in table.columns)) if c not in key]
    lines = [f"{identifier(c)} {types[c]} NOT NULL" for c in key]
    lines += [
        f"{identifier('valid_from_at')} timestamptz NOT NULL",
        f"{identifier('valid_to_at')} timestamptz NULL",
        f"{identifier('valid_during')} tstzrange GENERATED ALWAYS AS (tstzrange(valid_from_at, valid_to_at)) STORED",
        f"{identifier('author_id')} uuid NULL",
        f"{identifier('operation')} text NOT NULL",
        f"{identifier('closed_by')} uuid NULL",
        f"{identifier('closed_operation')} text NULL",
    ]
    lines += [f"{identifier(c)} {types[c]} {'NULL' if nullable.get(c, False) else 'NOT NULL'}" for c in data]
    lines += [f"{identifier('created_at')} timestamptz NOT NULL", f"{identifier('updated_at')} timestamptz NULL"]
    lines.append(f"CONSTRAINT {identifier(table.name + '_versions_pk')} PRIMARY KEY ({_names((*key, 'valid_from_at'))})")
    overlap = ", ".join(f"{identifier(c)} WITH =" for c in key)
    lines.append(
        f"CONSTRAINT {identifier(table.name + '_versions_no_overlap')} EXCLUDE USING gist ({overlap}, valid_during WITH &&)"
    )
    statements = [f"CREATE TABLE {name} (\n    " + ",\n    ".join(lines) + "\n)"]
    statements.append(f"COMMENT ON TABLE {name} IS {literal(f'Every state of {table.name} rows, each with the period it was in force.')}")
    service = {
        "valid_from_at": "The change time from which this version is in force.",
        "valid_to_at": "The change time from which it is not; NULL while in force.",
        "valid_during": "The period [valid_from_at, valid_to_at), for the overlap constraint.",
        "author_id": "Who opened the version; NULL for a system operation.",
        "operation": "The action that opened the version.",
        "closed_by": "Who closed the version; NULL while open.",
        "closed_operation": "The action that closed the version; NULL while open.",
        "created_at": "When the row was created.",
        "updated_at": "When the row last changed before this version; NULL if never.",
    }
    described = {c.name: c.description for c in table.columns} | {
        "id": "The row; the same in all its versions.",
        "organization_id": "The organization the row belongs to.",
    }
    for column in (*key, *data):
        statements.append(f"COMMENT ON COLUMN {name}.{identifier(column)} IS {literal(described[column])}")
    statements += [f"COMMENT ON COLUMN {name}.{identifier(c)} IS {literal(text)}" for c, text in service.items()]
    index = identifier(f"{table.name}_versions_open")
    statements.append(f"CREATE INDEX {index} ON {name} ({_names(key)}) WHERE valid_to_at IS NULL")
    statements.append(f"COMMENT ON INDEX {index} IS {literal('Finds the version of a row in force now.')}")
    return statements


def _keys(table: Table) -> list[str]:
    """The keys to other tables of the plugin, added once every table exists; nothing cascades."""
    statements = []
    for n, key in enumerate(table.keys, start=1):
        statements.append(
            f"ALTER TABLE {identifier(table.name)} ADD CONSTRAINT {identifier(f'{table.name}_k{n}')}"
            f" FOREIGN KEY ({_names(('organization_id', *key.columns))})"
            f" REFERENCES {identifier(key.table)} ({_names(('organization_id', *key.references))})"
            " ON DELETE RESTRICT ON UPDATE RESTRICT"
        )
    return statements


def build_statements(schema: PluginSchema) -> list[str]:
    """Every statement that builds ``schema``'s tables, in an order the database accepts."""
    statements: list[str] = []
    for table in schema.tables:
        statements += _table(table)
        if not table.mechanics:
            statements += _versions(table)
    for table in schema.tables:
        statements += _keys(table)
    return statements
