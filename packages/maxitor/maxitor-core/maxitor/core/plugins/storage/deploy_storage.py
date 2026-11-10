# packages/maxitor/maxitor-core/maxitor/core/plugins/storage/deploy_storage.py
"""
DeployStorage — the installer's connection, as the role maxitor_installer: the schema plugins, and building a version.

Building a version is part of one transaction with writing its row: the database user with its SCRAM verifier, its
schema, the tables of its ``schema.yaml``, its keys to the core, its rights. A failure anywhere rolls back all of it,
so the database never holds half a version (FR-016).

The version's user gets ``USAGE`` on its schema, ``SELECT, INSERT, UPDATE, DELETE`` on its tables, membership of
``maxitor_plugin`` — which may execute the core's three functions — and nothing else (FR-024). The installer owns the
schema and the tables, so the plugin can never change them.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

from maxitor.core.plugins.ddl import build_statements, literal
from maxitor.core.plugins.storage.plugins_storage import PluginsStorage
from maxitor.core.schemas import CoreSchemas, identifier
from maxitor_plugin_sdk.plugin_schema import PluginSchema

from aoa.action_machine.intents.meta import meta

#: Connection key under which the installer's actions receive this storage.
DEPLOY_CONNECTION_KEY = "deploy"
#: How many connections one version's user may hold at once.
CONNECTION_LIMIT = 20


@dataclass(frozen=True)
class CoreKey:
    """A key from a plugin's table to a table of the core, from ``foreign-keys.yaml``, already checked."""

    table: str
    columns: tuple[str, ...]
    target: str
    references: tuple[str, ...]

    @property
    def name(self) -> str:
        """``xfk_`` and 16 characters of the declaration's hash: the same declaration, the same name."""
        text = f"{self.table}({','.join(self.columns)})->{self.target}({','.join(self.references)})"
        return "xfk_" + hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


@meta(description="The installer's connection: the schema plugins, and building a plugin version as maxitor_installer")
class DeployStorage(PluginsStorage):
    """
    AI-CORE-BEGIN
    ROLE: Build a plugin version inside the installer's transaction.
    CONTRACT: ``build_version`` runs inside the caller's transaction and builds everything of one version; the
        inherited writers move its rows.
    INVARIANTS: Every name enters SQL through ``identifier``; the password is never sent, only its verifier.
    AI-CORE-END
    """

    def __init__(self, *, schemas: CoreSchemas | None = None, **connection: Any) -> None:
        super().__init__(**connection)
        self._schemas = schemas or CoreSchemas()

    async def build_version(
        self,
        schema_name: str,
        user: str,
        verifier: str,
        plugin_schema: PluginSchema,
        core_keys: tuple[CoreKey, ...],
    ) -> None:
        """Create the version's user, schema, tables, keys to the core and rights; inside the caller's transaction."""
        if not verifier.startswith("SCRAM-SHA-256$"):
            raise ValueError("Only a SCRAM verifier is sent, never a password.")
        schemas, schema, role = self._schemas, identifier(schema_name), identifier(user)
        await self._execute(
            f"CREATE ROLE {role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT"
            f" CONNECTION LIMIT {CONNECTION_LIMIT} PASSWORD {literal(verifier)}",
            (),
        )
        await self._execute(f"GRANT maxitor_plugin TO {role}", ())
        await self._execute(f"CREATE SCHEMA {schema}", ())
        await self._execute(f"SET LOCAL search_path TO {schema}, {identifier(schemas.extensions)}", ())
        for statement in build_statements(plugin_schema):
            await self._execute(statement, ())
        for key in core_keys:
            await self._execute(
                f"ALTER TABLE {identifier(key.table)} ADD CONSTRAINT {identifier(key.name)}"
                f" FOREIGN KEY ({', '.join(identifier(c) for c in key.columns)})"
                f" REFERENCES {identifier(schemas.organization)}.{identifier(key.target)}"
                f" ({', '.join(identifier(c) for c in key.references)}) ON DELETE RESTRICT ON UPDATE RESTRICT",
                (),
            )
        await self._execute(f"GRANT USAGE ON SCHEMA {schema} TO {role}", ())
        await self._execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {schema} TO {role}", ())
        await self._execute(
            f"ALTER ROLE {role} SET search_path TO {schema}, {identifier(schemas.organization)},"
            f" {identifier(schemas.extensions)}",
            (),
        )
        await self._execute(
            f"SET LOCAL search_path TO {identifier(schemas.plugins)}, {identifier(schemas.organization)},"
            f" {identifier(schemas.extensions)}",
            (),
        )
