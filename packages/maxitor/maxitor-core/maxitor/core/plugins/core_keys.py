# packages/maxitor/maxitor-core/maxitor/core/plugins/core_keys.py
"""
The keys a plugin version may have to the core, read from its ``foreign-keys.yaml`` and checked before any SQL.

In this work a key may point only at what the core keeps for plugins to refer to: an organization's user
(``core.user (organization_id, id)`` or ``(organization_id, account_id)``) and an organization (``core.organization (id)``). A key to a dependency's table
would bind one version's schema to another's, and moving an organization between versions is not decided yet, so it
is refused (``foreign_keys``).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import maxitor_plugin_sdk
import yaml
from jsonschema import Draft202012Validator
from maxitor.core.plugins.storage.deploy_storage import CoreKey
from maxitor_plugin_sdk.plugin_schema import SERVICE_COLUMNS, PluginSchema

#: The tables of the core a plugin may refer to, and the keys each offers: a user by its id or by its account.
CORE_TARGETS: dict[str, tuple[tuple[str, ...], ...]] = {
    "user": (("organization_id", "id"), ("organization_id", "account_id")),
    "organization": (("id",),),
}


class CoreKeysError(ValueError):
    """``foreign-keys.yaml`` declares a key Maxitor does not build."""


def _schema() -> dict[str, Any]:
    path = Path(maxitor_plugin_sdk.__file__).parent / "schemas" / "foreign-keys-1.schema.json"
    return dict(json.loads(path.read_text(encoding="utf-8")))


def core_keys(text: str | None, plugin_schema: PluginSchema) -> tuple[CoreKey, ...]:
    """The checked keys of ``text`` (``foreign-keys.yaml``, or ``None`` for none); raise ``CoreKeysError``."""
    if text is None:
        return ()
    data = yaml.safe_load(text)
    problems = [error.message for error in Draft202012Validator(_schema()).iter_errors(data)]
    if problems:
        raise CoreKeysError("; ".join(sorted(problems)))
    keys = []
    for item in data["foreign_keys"]:
        source, target = item["from"], item["to"]
        if target["schema"] != "core":
            raise CoreKeysError(f"a key to {target['schema']}.{target['table']}: only keys to the core are built")
        if tuple(target["columns"]) not in CORE_TARGETS.get(target["table"], ()):
            raise CoreKeysError(f"a key to core.{target['table']} {target['columns']}: not a key the core offers")
        table = plugin_schema.table(source["table"])
        if table is None:
            raise CoreKeysError(f"a key from {source['table']}: no such table in schema.yaml")
        own = {c.name for c in table.columns} | set(SERVICE_COLUMNS)
        missing = [c for c in source["columns"] if c not in own]
        if missing:
            raise CoreKeysError(f"a key from {source['table']}: no column {missing[0]}")
        keys.append(CoreKey(source["table"], tuple(source["columns"]), target["table"], tuple(target["columns"])))
    return tuple(keys)
