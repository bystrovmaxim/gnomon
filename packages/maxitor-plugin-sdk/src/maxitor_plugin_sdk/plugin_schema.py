# packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/plugin_schema.py
"""
A plugin's ``schema.yaml``: read safely, checked against its JSON schema and the rules a schema cannot express.

A plugin carries no SQL. It declares its tables here, and Maxitor's installer builds them by the rules of versioned
storage. Every name that may reach SQL is checked here first — the pattern leaves no quote, dot, space or
semicolon — so a refused file never yields a statement.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator

SCHEMA_FILE = Path(__file__).parent / "schemas" / "plugin-schema-1.schema.json"
#: A ``schema.yaml`` larger than this is refused unread.
MAX_BYTES = 256 * 1024
#: The column types a plugin may declare, and the PostgreSQL type each becomes.
TYPES = {
    "uuid": "uuid",
    "text": "text",
    "integer": "integer",
    "bigint": "bigint",
    "numeric": "numeric",
    "boolean": "boolean",
    "date": "date",
    "timestamptz": "timestamptz",
    "jsonb": "jsonb",
}
#: Columns every table has, added by the installer.
SERVICE_COLUMNS = ("id", "organization_id", "created_at", "updated_at")


class PluginSchemaError(ValueError):
    """``schema.yaml`` is not a valid declaration; ``problems`` names each fault."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__("; ".join(problems))
        self.problems = problems


@dataclass(frozen=True)
class Column:
    """One declared column."""

    name: str
    type: str
    nullable: bool
    description: str


@dataclass(frozen=True)
class Key:
    """A key from some columns of a table to a primary or unique key of another table of the plugin."""

    columns: tuple[str, ...]
    table: str
    references: tuple[str, ...]


@dataclass(frozen=True)
class Table:
    """One declared table: versioned unless it is a table of mechanics."""

    name: str
    description: str
    columns: tuple[Column, ...]
    primary_key: tuple[str, ...]
    unique: tuple[tuple[str, ...], ...] = ()
    indexes: tuple[tuple[str, ...], ...] = ()
    keys: tuple[Key, ...] = ()
    mechanics: bool = False


@dataclass(frozen=True)
class PluginSchema:
    """Every table of a plugin, versioned ones first, in the file's order."""

    tables: tuple[Table, ...] = field(default_factory=tuple)

    def table(self, name: str) -> Table | None:
        """The table ``name``, or ``None``."""
        return next((t for t in self.tables if t.name == name), None)


def read_plugin_schema(path: Path) -> PluginSchema:
    """Read and check ``path``; raise ``PluginSchemaError`` naming every fault."""
    if path.stat().st_size > MAX_BYTES:
        raise PluginSchemaError([f"{path.name} is larger than {MAX_BYTES} bytes"])
    return parse_plugin_schema(path.read_text(encoding="utf-8"))


def parse_plugin_schema(text: str) -> PluginSchema:
    """Parse ``text`` as ``schema.yaml``; raise ``PluginSchemaError`` naming every fault."""
    if len(text.encode("utf-8")) > MAX_BYTES:
        raise PluginSchemaError([f"schema.yaml is larger than {MAX_BYTES} bytes"])
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as error:
        raise PluginSchemaError([f"schema.yaml is not YAML: {error}"]) from None
    validator = Draft202012Validator(json.loads(SCHEMA_FILE.read_text(encoding="utf-8")))
    problems = [f"{'/'.join(str(p) for p in e.absolute_path) or 'schema.yaml'}: {e.message}" for e in validator.iter_errors(data)]
    if problems:
        raise PluginSchemaError(sorted(problems))
    schema = PluginSchema(
        tuple(
            [_table(name, body, mechanics=False) for name, body in data["tables"].items()]
            + [_table(name, body, mechanics=True) for name, body in (data.get("mechanics") or {}).items()]
        )
    )
    problems = _cross_problems(schema)
    if problems:
        raise PluginSchemaError(problems)
    return schema


def _table(name: str, body: dict[str, Any], *, mechanics: bool) -> Table:
    columns = tuple(
        Column(column, spec["type"], bool(spec["nullable"]), spec["description"]) for column, spec in body["columns"].items()
    )
    return Table(
        name=name,
        description=body["description"],
        columns=columns,
        primary_key=tuple(body.get("primary_key") or ("id",)),
        unique=tuple(tuple(u) for u in body.get("unique") or ()),
        indexes=tuple(tuple(i) for i in body.get("indexes") or ()),
        keys=tuple(Key(tuple(k["columns"]), k["table"], tuple(k["references"])) for k in body.get("keys") or ()),
        mechanics=mechanics,
    )


def _cross_problems(schema: PluginSchema) -> list[str]:
    """The rules across tables a JSON schema cannot express."""
    problems: list[str] = []
    names = [t.name for t in schema.tables]
    for duplicate in sorted({n for n in names if names.count(n) > 1}):
        problems.append(f"{duplicate}: declared both as a table and as a table of mechanics")
    for table in schema.tables:
        own = {c.name for c in table.columns} | set(SERVICE_COLUMNS)
        for group in (table.primary_key, *table.unique, *table.indexes):
            for column in group:
                if column not in own:
                    problems.append(f"{table.name}: no column {column}")
        for key in table.keys:
            target = schema.table(key.table)
            if target is None:
                problems.append(f"{table.name}: a key names no table {key.table}")
                continue
            if len(key.columns) != len(key.references):
                problems.append(f"{table.name}: a key to {key.table} pairs {len(key.columns)} columns with {len(key.references)}")
            for column in key.columns:
                if column not in own:
                    problems.append(f"{table.name}: no column {column}")
            if key.references not in (target.primary_key, *target.unique):
                problems.append(f"{table.name}: a key to {key.table} must reference its primary key or a unique key")
    return problems
