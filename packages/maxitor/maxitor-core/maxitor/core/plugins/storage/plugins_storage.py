# packages/maxitor/maxitor-core/maxitor/core/plugins/storage/plugins_storage.py
"""
PluginsStorage — the schema plugins: the marketplace and the plugins of each organization.

═══════════════════════════════════════════════════════════════════════════════
VERSIONED STORAGE
═══════════════════════════════════════════════════════════════════════════════
The same mechanics as the core's storage: one transaction, a lock, one change time, the row and its version. A
plugin and everything of its versions change under the plugin's lock (``plugin:<id>``); a plugin in an
organization under the organization's lock (``organization:<id>``), shared with the core's tables of that
organization.

The core's web process connects as ``maxitor_core``; the installer as ``maxitor_installer``, which may read and
write these tables and nothing else of the core. No SQL names a schema: the role's search_path finds the tables.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any, ClassVar

from maxitor.core.plugins.entities import (
    OrganizationPluginCoreEntity,
    PluginCoreEntity,
    PluginDependencyCoreEntity,
    PluginProcessCoreEntity,
    PluginSectionCoreEntity,
    PluginVersionCoreEntity,
)
from maxitor.core.storage.core_storage import VERSIONED, CoreStorage

from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.meta import meta

#: Connection key under which actions receive this storage.
PLUGINS_CONNECTION_KEY = "plugins"

#: The version tables of the schema plugins, beside the core's.
PLUGIN_VERSIONED: Mapping[str, tuple[str, tuple[str, ...]]] = {
    **VERSIONED,
    "plugin": ("plugin_versions", ("id",)),
    "plugin_version": ("plugin_version_versions", ("id",)),
    "plugin_dependency": ("plugin_dependency_versions", ("id",)),
    "plugin_section": ("plugin_section_versions", ("id",)),
    "organization_plugin": ("organization_plugin_versions", ("organization_id", "id")),
}

#: A version's numbers as a sortable array, highest version first in ORDER BY ... DESC.
_VERSION_ORDER = "string_to_array(v.version, '.')::int[]"

#: The active version of each listed plugin an organization may see: public or its own.
_OFFERED = f"""
SELECT DISTINCT ON (p.id)
    p.id::text AS plugin_id, p.passport_id, p.name, p.title, p.description,
    p.owner_organization_id::text AS owner_organization_id,
    v.id::text AS version_id, v.version, v.purl, v.sha256, v.core_range, v.schema_name, v.database_user
FROM plugin p JOIN plugin_version v ON v.plugin_id = p.id
WHERE p.state = 'listed' AND v.state = 'active'
    AND (p.owner_organization_id IS NULL OR p.owner_organization_id = $1::text::uuid)
ORDER BY p.id, {_VERSION_ORDER} DESC
"""

#: The words a search looks through, and the condition that matches them.
_MATCH = (
    "($2 = '' OR p.title ILIKE $2 ESCAPE '\\' OR p.name ILIKE $2 ESCAPE '\\'"
    " OR p.passport_id ILIKE $2 ESCAPE '\\' OR p.description ILIKE $2 ESCAPE '\\')"
)


def like_pattern(query: str) -> str:
    """``query`` as an ILIKE pattern that matches it anywhere, its ``%``, ``_`` and ``\\`` taken literally."""
    text = query.strip()
    if not text:
        return ""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


@meta(description="The schema plugins: the marketplace and the plugins of each organization")
@entities(
    PluginCoreEntity,
    PluginVersionCoreEntity,
    PluginDependencyCoreEntity,
    PluginSectionCoreEntity,
    OrganizationPluginCoreEntity,
    PluginProcessCoreEntity,
)
class PluginsStorage(CoreStorage):
    """
    AI-CORE-BEGIN
    ROLE: Every read and write of the marketplace and of the plugins of an organization.
    CONTRACT: ``plugin_lock`` and ``organization_lock`` take the lock and answer the change time; the core's
        ``insert`` and ``update`` write a row with its version; the readers answer what one page or one step needs.
    INVARIANTS: Names no schema in SQL; every reading of organization_plugin names its organization; a private plugin
        is read only for its owner; plugin_process is mechanics of work, written without versions by the runner only.
    AI-CORE-END
    """

    versioned: ClassVar[Mapping[str, tuple[str, tuple[str, ...]]]] = PLUGIN_VERSIONED

    # ── locks ─────────────────────────────────────────────────────────────────

    async def plugin_lock(self, plugin_id: str) -> datetime:
        """The lock and change time of one plugin and all of its versions."""
        return await self.lock(
            f"plugin:{plugin_id}",
            [("plugin_versions", "id", plugin_id), ("plugin_version_versions", "plugin_id", plugin_id)],
        )

    async def organization_lock(self, organization_id: str) -> datetime:
        """The organization's lock, its change time following its plugins' rows too."""
        return await self.lock(
            f"organization:{organization_id}",
            [
                ("organization_versions", "organization_id", organization_id),
                ("user_versions", "organization_id", organization_id),
                ("boundary_versions", "organization_id", organization_id),
                ("boundary_user_versions", "organization_id", organization_id),
                ("organization_plugin_versions", "organization_id", organization_id),
            ],
        )

    async def version_lock(self, version_id: str) -> None:
        """Deploying one version: two installs of it never build it twice."""
        await self._fetchval("SELECT pg_advisory_xact_lock(hashtext($1))", (f"version:{version_id}",))

    async def try_hold(self, key: str) -> bool:
        """Hold ``key`` for this connection until ``release``; ``False`` when another process holds it."""
        return bool(await self._fetchval("SELECT pg_try_advisory_lock(hashtext($1))", (key,)))

    async def release(self, key: str) -> None:
        """Let go of a key held by ``try_hold``: a pooled connection would keep it otherwise."""
        await self._fetchval("SELECT pg_advisory_unlock(hashtext($1))", (key,))

    async def try_claim(self, key: str) -> bool:
        """Claim a row for the rest of the transaction; ``False`` when another process holds it."""
        return bool(await self._fetchval("SELECT pg_try_advisory_xact_lock(hashtext($1))", (key,)))

    # ── the page ──────────────────────────────────────────────────────────────

    async def installed(self, organization_id: str, query: str) -> list[dict[str, Any]]:
        """The organization's plugins not removed, then the removed ones, matching ``query``."""
        rows = await self._fetch(
            "SELECT op.id::text AS row_id, op.state, op.reason, op.created_at AS installed_at, op.updated_at,"
            " u.name AS installed_by_name, p.id::text AS plugin_id, p.passport_id, p.name, p.title, p.description,"
            " p.state AS plugin_state, p.owner_organization_id IS NOT NULL AS private,"
            " v.id::text AS version_id, v.version, v.purl, v.sha256"
            ' FROM organization_plugin op JOIN plugin p ON p.id = op.plugin_id'
            " JOIN plugin_version v ON v.id = op.plugin_version_id"
            ' JOIN "user" u ON u.organization_id = op.organization_id AND u.id = op.installed_by'
            f" WHERE op.organization_id = $1::text::uuid AND {_MATCH}"
            " ORDER BY op.state = 'removed', p.title, op.created_at",
            (organization_id, like_pattern(query)),
        )
        return [dict(row) for row in rows]

    async def offered(self, organization_id: str, query: str) -> list[dict[str, Any]]:
        """The marketplace's active versions the organization may install and does not run, matching ``query``."""
        rows = await self._fetch(
            "SELECT o.plugin_id, o.passport_id, o.name, o.title, o.description, o.owner_organization_id, o.version_id,"
            " o.version, o.purl, o.sha256, o.core_range, o.schema_name, o.database_user"
            f" FROM ({_OFFERED}) o JOIN plugin p ON p.id = o.plugin_id::uuid WHERE {_MATCH}"
            " AND NOT EXISTS (SELECT 1 FROM organization_plugin op WHERE op.organization_id = $1::text::uuid"
            " AND op.plugin_id = p.id AND op.state <> 'removed')"
            " ORDER BY o.owner_organization_id IS NULL, o.title",
            (organization_id, like_pattern(query)),
        )
        return [dict(row) for row in rows]

    async def private_pending(self, organization_id: str, query: str) -> list[dict[str, Any]]:
        """The organization's private versions not yet active: draft or rejected, newest first."""
        rows = await self._fetch(
            "SELECT p.id::text AS plugin_id, p.passport_id, p.name, p.title, p.description,"
            " v.id::text AS version_id, v.version, v.purl, v.sha256, v.state, v.reason"
            " FROM plugin p JOIN plugin_version v ON v.plugin_id = p.id"
            f" WHERE p.owner_organization_id = $1::text::uuid AND v.state IN ('draft', 'rejected') AND {_MATCH}"
            " ORDER BY v.created_at DESC",
            (organization_id, like_pattern(query)),
        )
        return [dict(row) for row in rows]

    async def plugin_for(self, organization_id: str, passport_id: str) -> dict[str, Any] | None:
        """A plugin the organization may see, with its offered or installed version; ``None`` for another's private one."""
        row = await self._fetchrow(
            "SELECT p.id::text AS plugin_id, p.passport_id, p.name, p.title, p.description, p.state AS plugin_state,"
            " p.owner_organization_id::text AS owner_organization_id,"
            " v.id::text AS version_id, v.version, v.purl, v.sha256, v.core_range, v.state AS version_state,"
            " v.schema_name, v.database_user, op.id::text AS row_id, op.state AS row_state, op.reason AS row_reason"
            " FROM plugin p"
            " LEFT JOIN organization_plugin op ON op.plugin_id = p.id AND op.organization_id = $1::text::uuid"
            " AND op.state <> 'removed'"
            " JOIN plugin_version v ON v.id = coalesce(op.plugin_version_id,"
            f" (SELECT o.version_id::uuid FROM ({_OFFERED}) o WHERE o.plugin_id = p.id::text))"
            " WHERE p.passport_id = $2"
            " AND (p.owner_organization_id IS NULL OR p.owner_organization_id = $1::text::uuid)",
            (organization_id, passport_id),
        )
        return None if row is None else dict(row)

    async def dependencies(self, version_ids: list[str]) -> list[dict[str, Any]]:
        """The dependencies of the versions ``version_ids``."""
        if not version_ids:
            return []
        rows = await self._fetch(
            "SELECT plugin_version_id::text AS version_id, passport_id, version_range FROM plugin_dependency"
            " WHERE plugin_version_id = ANY($1::text[]::uuid[]) ORDER BY passport_id",
            (version_ids,),
        )
        return [dict(row) for row in rows]

    async def sections(self, version_ids: list[str]) -> list[dict[str, Any]]:
        """The top-level sections of the versions ``version_ids``, in their order."""
        if not version_ids:
            return []
        rows = await self._fetch(
            "SELECT plugin_version_id::text AS version_id, position, title, path FROM plugin_section"
            " WHERE plugin_version_id = ANY($1::text[]::uuid[]) ORDER BY plugin_version_id, position",
            (version_ids,),
        )
        return [dict(row) for row in rows]

    async def live_states(self, organization_id: str) -> dict[str, str]:
        """The state of every plugin of the organization not removed, by passport id."""
        rows = await self._fetch(
            "SELECT p.passport_id, op.state FROM organization_plugin op JOIN plugin p ON p.id = op.plugin_id"
            " WHERE op.organization_id = $1::text::uuid AND op.state <> 'removed'",
            (organization_id,),
        )
        return {row["passport_id"]: row["state"] for row in rows}

    async def enabled_dependents(self, organization_id: str, passport_id: str) -> list[dict[str, Any]]:
        """The organization's enabled plugins whose version needs ``passport_id``."""
        rows = await self._fetch(
            "SELECT p.passport_id, p.title FROM organization_plugin op JOIN plugin p ON p.id = op.plugin_id"
            " JOIN plugin_dependency d ON d.plugin_version_id = op.plugin_version_id"
            " WHERE op.organization_id = $1::text::uuid AND op.state = 'enabled' AND d.passport_id = $2"
            " ORDER BY p.title",
            (organization_id, passport_id),
        )
        return [dict(row) for row in rows]

    async def enabled_plugins(self, organization_id: str) -> list[dict[str, Any]]:
        """The organization's enabled plugins with their version, by title — the groups of its tree."""
        rows = await self._fetch(
            "SELECT p.passport_id, p.name, p.title, op.plugin_version_id::text AS version_id"
            " FROM organization_plugin op JOIN plugin p ON p.id = op.plugin_id"
            " WHERE op.organization_id = $1::text::uuid AND op.state = 'enabled' ORDER BY p.title",
            (organization_id,),
        )
        return [dict(row) for row in rows]

    # ── the marketplace's rows ────────────────────────────────────────────────

    async def plugin_by_passport(self, passport_id: str) -> dict[str, Any] | None:
        """The plugin with ``passport_id``, whoever owns it."""
        row = await self._fetchrow(
            "SELECT id::text AS id, name, owner_organization_id::text AS owner_organization_id FROM plugin"
            " WHERE passport_id = $1",
            (passport_id,),
        )
        return None if row is None else dict(row)

    async def plugin_by_name(self, name: str) -> dict[str, Any] | None:
        """The plugin named ``name``, whoever owns it."""
        row = await self._fetchrow(
            "SELECT id::text AS id, passport_id, owner_organization_id::text AS owner_organization_id FROM plugin"
            " WHERE name = $1",
            (name,),
        )
        return None if row is None else dict(row)

    async def version(self, version_id: str) -> dict[str, Any] | None:
        """One version with its plugin."""
        row = await self._fetchrow(
            "SELECT v.id::text AS id, v.plugin_id::text AS plugin_id, v.version, v.purl, v.sha256, v.state, v.reason,"
            " v.core_range, v.schema_name, v.database_user, p.passport_id, p.name, p.title,"
            " p.owner_organization_id::text AS owner_organization_id"
            " FROM plugin_version v JOIN plugin p ON p.id = v.plugin_id WHERE v.id = $1::text::uuid",
            (version_id,),
        )
        return None if row is None else dict(row)

    async def row(self, organization_id: str, row_id: str) -> dict[str, Any] | None:
        """One plugin of an organization with its version."""
        found = await self._fetchrow(
            "SELECT op.id::text AS id, op.organization_id::text AS organization_id, op.state,"
            " op.plugin_id::text AS plugin_id, op.plugin_version_id::text AS version_id, p.passport_id, v.version,"
            " v.schema_name, v.database_user"
            " FROM organization_plugin op JOIN plugin p ON p.id = op.plugin_id"
            " JOIN plugin_version v ON v.id = op.plugin_version_id"
            " WHERE op.organization_id = $1::text::uuid AND op.id = $2::text::uuid",
            (organization_id, row_id),
        )
        return None if found is None else dict(found)

    # ── the installer's queue ─────────────────────────────────────────────────

    async def pending_versions(self) -> list[str]:
        """The versions waiting for their check, oldest first."""
        rows = await self._fetch(
            "SELECT id::text AS id FROM plugin_version WHERE state = 'draft' ORDER BY created_at", ()
        )
        return [row["id"] for row in rows]

    async def pending_installs(self) -> list[tuple[str, str]]:
        """The installs waiting for the installer, oldest first: (organization id, row id)."""
        rows = await self._fetch(
            "SELECT organization_id::text AS organization_id, id::text AS id FROM organization_plugin"
            " WHERE state = 'installing' ORDER BY created_at",
            (),
        )
        return [(row["organization_id"], row["id"]) for row in rows]

    # ── the runner ────────────────────────────────────────────────────────────

    async def runnable_versions(self) -> list[dict[str, Any]]:
        """The deployed versions enabled in at least one organization: what the runner keeps running."""
        rows = await self._fetch(
            "SELECT v.id::text AS version_id, v.version, v.sha256, v.schema_name, p.passport_id, p.name"
            " FROM plugin_version v JOIN plugin p ON p.id = v.plugin_id"
            " WHERE v.schema_name IS NOT NULL AND EXISTS (SELECT 1 FROM organization_plugin op"
            " WHERE op.plugin_version_id = v.id AND op.state = 'enabled')"
            " ORDER BY p.passport_id, v.version",
            (),
        )
        return [dict(row) for row in rows]

    async def processes(self) -> list[dict[str, Any]]:
        """Every process row the runner keeps."""
        rows = await self._fetch(
            "SELECT id::text AS id, plugin_version_id::text AS version_id, kind, address, pid, started_at, failures,"
            " next_start_at FROM plugin_process ORDER BY plugin_version_id, kind",
            (),
        )
        return [dict(row) for row in rows]

    async def put_process(self, row: Mapping[str, Any]) -> None:
        """Write a version's process row: its address, its pid and how its starts went."""
        await self._execute(
            "INSERT INTO plugin_process (id, plugin_version_id, kind, address, pid, started_at, failures,"
            " next_start_at, updated_at) VALUES ($1::text::uuid, $2::text::uuid, $3, $4, $5, $6, $7, $8, $9)"
            " ON CONFLICT (plugin_version_id, kind) DO UPDATE SET address = EXCLUDED.address, pid = EXCLUDED.pid,"
            " started_at = EXCLUDED.started_at, failures = EXCLUDED.failures, next_start_at = EXCLUDED.next_start_at,"
            " updated_at = EXCLUDED.updated_at",
            (
                row["id"],
                row["version_id"],
                row["kind"],
                row["address"],
                row["pid"],
                row["started_at"],
                row["failures"],
                row["next_start_at"],
                row["updated_at"],
            ),
        )

    async def forget_processes(self, version_id: str | None = None) -> None:
        """Remove the process rows of one version, or of every version when ``version_id`` is empty."""
        if version_id is None:
            await self._execute("DELETE FROM plugin_process", ())
        else:
            await self._execute("DELETE FROM plugin_process WHERE plugin_version_id = $1::text::uuid", (version_id,))

    # ── the gateway ───────────────────────────────────────────────────────────

    async def pass_target(self, code: str, account_id: str, name: str, kind: str) -> dict[str, Any] | None:
        """
        The plugin ``name`` enabled in the organization ``code`` for an active user of ``account_id`` there, with the
        user's administration and the address of the version's ``kind`` process; ``None`` when any of it is missing.
        """
        row = await self._fetchrow(
            "SELECT o.id::text AS organization_id, u.is_admin, p.passport_id, v.id::text AS version_id, v.version,"
            " pr.address"
            ' FROM organization o JOIN "user" u ON u.organization_id = o.id'
            " AND u.account_id = $2::text::uuid AND u.status = 'active'"
            " JOIN organization_plugin op ON op.organization_id = o.id AND op.state = 'enabled'"
            " JOIN plugin p ON p.id = op.plugin_id AND p.name = $3"
            " JOIN plugin_version v ON v.id = op.plugin_version_id"
            " LEFT JOIN plugin_process pr ON pr.plugin_version_id = v.id AND pr.kind = $4"
            " WHERE o.code = $1",
            (code, account_id, name, kind),
        )
        return None if row is None else dict(row)

    async def exchange_target(self, code: str, caller: str, name: str, kind: str) -> dict[str, Any] | None:
        """
        The plugin ``name`` when the organization ``code`` has it enabled and it is a direct dependency of the version
        of ``caller`` (a passport id) enabled there, with the address of its ``kind`` process; ``None`` otherwise.
        """
        row = await self._fetchrow(
            "SELECT callee.passport_id, pr.address"
            " FROM organization o"
            " JOIN organization_plugin mine ON mine.organization_id = o.id AND mine.state = 'enabled'"
            " JOIN plugin caller ON caller.id = mine.plugin_id AND caller.passport_id = $2"
            " JOIN plugin_dependency d ON d.plugin_version_id = mine.plugin_version_id"
            " JOIN plugin callee ON callee.passport_id = d.passport_id AND callee.name = $3"
            " JOIN organization_plugin theirs ON theirs.organization_id = o.id AND theirs.plugin_id = callee.id"
            " AND theirs.state = 'enabled'"
            " LEFT JOIN plugin_process pr ON pr.plugin_version_id = theirs.plugin_version_id AND pr.kind = $4"
            " WHERE o.code = $1",
            (code, caller, name, kind),
        )
        return None if row is None else dict(row)

    async def service_target(self, key_hash: str, code: str) -> dict[str, Any] | None:
        """The plugin whose version has the service key ``key_hash`` when that version is the one enabled in ``code``."""
        row = await self._fetchrow(
            "SELECT p.passport_id FROM plugin_version v JOIN plugin p ON p.id = v.plugin_id"
            " JOIN organization_plugin op ON op.plugin_version_id = v.id AND op.state = 'enabled'"
            " JOIN organization o ON o.id = op.organization_id AND o.code = $2"
            " WHERE v.service_key_hash = $1",
            (key_hash, code),
        )
        return None if row is None else dict(row)
