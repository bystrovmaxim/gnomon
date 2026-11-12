# packages/maxitor/maxitor-core/tests/plugin_fakes.py
"""
The schema plugins in memory, for tests: the same readings as PluginsStorage, over lists, beside the core's memory.

The marketplace is filled by ``offer`` the way the installer leaves it: a listed plugin and its active version; the
organization's rows are written by the actions themselves, with their versions, as the real storage writes them.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from maxitor.core.plugins.storage.plugins_storage import PLUGIN_VERSIONED, PluginsStorage
from maxitor.core.storage.core_storage import UniqueRowError

from aoa.action_machine.intents.meta import meta
from tests.fakes import MemoryCoreStorage
from tests.plugin_runtime_fakes import MemoryRuntimeReadings


def _matches(query: str, *words: str) -> bool:
    text = query.strip().lower()
    return not text or any(text in word.lower() for word in words)


@meta(description="The schema plugins in memory, for tests")
class MemoryPluginsStorage(MemoryRuntimeReadings, PluginsStorage):
    """Lists for the five tables; the core's organizations and users read from the core's memory."""

    def __init__(self, core: MemoryCoreStorage) -> None:
        super().__init__(connection_params="postgresql://unused")
        self.core = core
        self.tables: dict[str, list[dict[str, Any]]] = {
            t: []
            for t in ("plugin", "plugin_version", "plugin_dependency", "plugin_node", "organization_plugin", "plugin_process")
        }
        self.versions: dict[str, list[dict[str, Any]]] = {v: [] for v, _k in PLUGIN_VERSIONED.values()}
        self.clock = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)

    # ── filling the marketplace as the installer leaves it ─────────────────────

    def offer(
        self,
        passport_id: str,
        name: str,
        title: str,
        *,
        description: str = "",
        version: str = "1.0.0",
        needs: tuple[str, ...] = (),
        core_range: str = ">=4.0,<5",
        owner: str | None = None,
        state: str = "listed",
        version_state: str = "active",
        deployed: bool = False,
        sections: tuple[tuple[str, str], ...] = (),
        nodes: tuple[dict[str, Any], ...] = (),
    ) -> str:
        """A plugin and one version of it; answer the version's id."""
        plugin_id, version_id = str(uuid.uuid4()), str(uuid.uuid4())
        self.tables["plugin"].append(
            {"id": plugin_id, "passport_id": passport_id, "name": name, "title": title, "description": description,
             "owner_organization_id": owner, "state": state}
        )
        schema = f"{name}_{version.replace('.', '_')}"
        self.tables["plugin_version"].append(
            {"id": version_id, "plugin_id": plugin_id, "version": version, "purl": f"pkg:pypi/maxitor-{name}@{version}",
             "sha256": "a" * 64, "core_range": core_range, "state": version_state, "reason": None,
             "schema_name": schema if deployed else None, "database_user": f"plg_{schema}" if deployed else None,
             "created_at": self.clock}
        )
        for dependency in needs:
            self.tables["plugin_dependency"].append({"plugin_version_id": version_id, "passport_id": dependency, "version_range": ">=0"})
        # A section is a node attached to the root; ``nodes`` are rows as PluginsStorage.nodes reads them.
        rows = [
            {"full_name": f"{name}:section-{position}", "parent": "root", "node_order": position * 100, "title": section_title,
             "icon": None, "page": path, "each_source": None, "each_key": None, "roles": []}
            for position, (section_title, path) in enumerate(sections, start=1)
        ] + list(nodes)
        for position, row in enumerate(rows, start=1):
            self.tables["plugin_node"].append({"plugin_version_id": version_id, "position": position, **row})
        return version_id

    def set_state(self, organization_id: str, passport_id: str, state: str, reason: str | None = None) -> None:
        """Move a row as the installer would."""
        plugin = self._plugin_by("passport_id", passport_id)
        for row in self.tables["organization_plugin"]:
            if row["organization_id"] == organization_id and row["plugin_id"] == plugin["id"] and row["state"] != "removed":
                row.update(state=state, reason=reason)

    # ── the writing primitives ────────────────────────────────────────────────

    async def open(self) -> None:
        return None

    async def close(self) -> None:
        return None

    async def in_transaction(self, work: Any) -> Any:
        return await work()

    async def lock(self, key: str, versions: Any) -> datetime:
        self.clock += timedelta(microseconds=1)
        return self.clock

    async def insert(self, table: str, row: Any, changed_at: datetime, author: str | None, operation: str) -> None:
        if table == "organization_plugin" and any(
            r["organization_id"] == row["organization_id"] and r["plugin_id"] == row["plugin_id"] and r["state"] != "removed"
            for r in self.tables[table]
        ):
            raise UniqueRowError("organization_plugin_one_live")
        self.tables[table].append(dict(row))
        self.versions[PLUGIN_VERSIONED[table][0]].append({**row, "valid_from_at": changed_at, "operation": operation})

    async def update(self, table: str, key: Any, changes: Any, changed_at: datetime, author: str | None, operation: str) -> None:
        for row in self.tables[table]:
            if all(row[k] == v for k, v in key.items()):
                row.update(changes)
                self.versions[PLUGIN_VERSIONED[table][0]].append({**row, "valid_from_at": changed_at, "operation": operation})

    # ── the readings ──────────────────────────────────────────────────────────

    async def organization_for(self, code: str, account_id: str) -> dict[str, Any] | None:
        return await self.core.organization_for(code, account_id)

    def _plugin_by(self, field: str, value: Any) -> dict[str, Any]:
        return next(p for p in self.tables["plugin"] if p[field] == value)

    def _version_of(self, version_id: str) -> dict[str, Any]:
        return next(v for v in self.tables["plugin_version"] if v["id"] == version_id)

    def _visible(self, plugin: dict[str, Any], organization_id: str) -> bool:
        return plugin["owner_organization_id"] in (None, organization_id)

    def _offered(self, organization_id: str) -> list[dict[str, Any]]:
        found = []
        for plugin in self.tables["plugin"]:
            if plugin["state"] != "listed" or not self._visible(plugin, organization_id):
                continue
            active = [v for v in self.tables["plugin_version"] if v["plugin_id"] == plugin["id"] and v["state"] == "active"]
            if active:
                best = max(active, key=lambda v: tuple(int(n) for n in v["version"].split(".")))
                found.append(
                    {"plugin_id": plugin["id"], "passport_id": plugin["passport_id"], "name": plugin["name"],
                     "title": plugin["title"], "description": plugin["description"],
                     "owner_organization_id": plugin["owner_organization_id"], "version_id": best["id"],
                     "version": best["version"], "purl": best["purl"], "sha256": best["sha256"],
                     "core_range": best["core_range"], "schema_name": best["schema_name"], "database_user": best["database_user"]}
                )
        return found

    def _live(self, organization_id: str, plugin_id: str) -> dict[str, Any] | None:
        return next(
            (r for r in self.tables["organization_plugin"]
             if r["organization_id"] == organization_id and r["plugin_id"] == plugin_id and r["state"] != "removed"),
            None,
        )

    async def installed(self, organization_id: str, query: str) -> list[dict[str, Any]]:
        rows = []
        users = {u["id"]: u for u in self.core.tables['"user"']}
        for r in self.tables["organization_plugin"]:
            if r["organization_id"] != organization_id:
                continue
            plugin, version = self._plugin_by("id", r["plugin_id"]), self._version_of(r["plugin_version_id"])
            if not _matches(query, plugin["title"], plugin["name"], plugin["passport_id"], plugin["description"]):
                continue
            rows.append(
                {"row_id": r["id"], "state": r["state"], "reason": r["reason"], "installed_at": r["created_at"],
                 "updated_at": r["updated_at"], "installed_by_name": users[r["installed_by"]]["name"],
                 "plugin_id": plugin["id"], "passport_id": plugin["passport_id"], "name": plugin["name"],
                 "title": plugin["title"], "description": plugin["description"], "plugin_state": plugin["state"],
                 "private": plugin["owner_organization_id"] is not None, "version_id": version["id"],
                 "version": version["version"], "purl": version["purl"], "sha256": version["sha256"]}
            )
        return sorted(rows, key=lambda r: (r["state"] == "removed", r["title"]))

    async def offered(self, organization_id: str, query: str) -> list[dict[str, Any]]:
        return sorted(
            (o for o in self._offered(organization_id)
             if _matches(query, o["title"], o["name"], o["passport_id"], o["description"])
             and self._live(organization_id, o["plugin_id"]) is None),
            key=lambda o: (o["owner_organization_id"] is None, o["title"]),
        )

    async def private_pending(self, organization_id: str, query: str) -> list[dict[str, Any]]:
        found = []
        for plugin in self.tables["plugin"]:
            if plugin["owner_organization_id"] != organization_id:
                continue
            for v in self.tables["plugin_version"]:
                if v["plugin_id"] == plugin["id"] and v["state"] in ("draft", "rejected") and _matches(
                    query, plugin["title"], plugin["name"], plugin["passport_id"], plugin["description"]
                ):
                    found.append(
                        {"plugin_id": plugin["id"], "passport_id": plugin["passport_id"], "name": plugin["name"],
                         "title": plugin["title"], "description": plugin["description"], "version_id": v["id"],
                         "version": v["version"], "purl": v["purl"], "sha256": v["sha256"], "state": v["state"],
                         "reason": v["reason"]}
                    )
        return found

    async def plugin_for(self, organization_id: str, passport_id: str) -> dict[str, Any] | None:
        plugin = next((p for p in self.tables["plugin"] if p["passport_id"] == passport_id), None)
        if plugin is None or not self._visible(plugin, organization_id):
            return None
        row = self._live(organization_id, plugin["id"])
        if row is not None:
            version = self._version_of(row["plugin_version_id"])
        else:
            offered = next((o for o in self._offered(organization_id) if o["plugin_id"] == plugin["id"]), None)
            if offered is None:
                return None
            version = self._version_of(offered["version_id"])
        return {"plugin_id": plugin["id"], "passport_id": plugin["passport_id"], "name": plugin["name"],
                "title": plugin["title"], "description": plugin["description"], "plugin_state": plugin["state"],
                "owner_organization_id": plugin["owner_organization_id"], "version_id": version["id"],
                "version": version["version"], "purl": version["purl"], "sha256": version["sha256"],
                "core_range": version["core_range"], "version_state": version["state"],
                "schema_name": version["schema_name"], "database_user": version["database_user"],
                "row_id": row["id"] if row else None, "row_state": row["state"] if row else None,
                "row_reason": row["reason"] if row else None}

    async def dependencies(self, version_ids: list[str]) -> list[dict[str, Any]]:
        return [{"version_id": d["plugin_version_id"], "passport_id": d["passport_id"], "version_range": d["version_range"]}
                for d in self.tables["plugin_dependency"] if d["plugin_version_id"] in version_ids]

    async def sections(self, version_ids: list[str]) -> list[dict[str, Any]]:
        return [{"version_id": n["plugin_version_id"], "position": n["position"], "title": n["title"] or "", "path": n["page"] or ""}
                for n in self.tables["plugin_node"]
                if n["plugin_version_id"] in version_ids and n["parent"].partition(":")[0] != n["full_name"].partition(":")[0]]

    async def nodes(self, version_ids: list[str]) -> list[dict[str, Any]]:
        return [{"version_id": n["plugin_version_id"], **{k: v for k, v in n.items() if k != "plugin_version_id"}}
                for n in self.tables["plugin_node"] if n["plugin_version_id"] in version_ids]

    async def live_states(self, organization_id: str) -> dict[str, str]:
        return {self._plugin_by("id", r["plugin_id"])["passport_id"]: r["state"]
                for r in self.tables["organization_plugin"] if r["organization_id"] == organization_id and r["state"] != "removed"}

    async def enabled_dependents(self, organization_id: str, passport_id: str) -> list[dict[str, Any]]:
        found = []
        for r in self.tables["organization_plugin"]:
            if r["organization_id"] == organization_id and r["state"] == "enabled":
                if any(d["plugin_version_id"] == r["plugin_version_id"] and d["passport_id"] == passport_id
                       for d in self.tables["plugin_dependency"]):
                    plugin = self._plugin_by("id", r["plugin_id"])
                    found.append({"passport_id": plugin["passport_id"], "title": plugin["title"]})
        return found

    async def enabled_plugins(self, organization_id: str) -> list[dict[str, Any]]:
        found = []
        for r in self.tables["organization_plugin"]:
            if r["organization_id"] == organization_id and r["state"] == "enabled":
                plugin = self._plugin_by("id", r["plugin_id"])
                found.append({"passport_id": plugin["passport_id"], "name": plugin["name"], "title": plugin["title"],
                              "version_id": r["plugin_version_id"]})
        return sorted(found, key=lambda p: p["title"])

    async def plugin_histories(self, organization_id: str) -> dict[str, dict[str, list[str]]]:
        found: dict[str, dict[str, list[str]]] = {}
        for row in await self.enabled_plugins(organization_id):
            version = self._version_of(row["version_id"])
            found[row["name"]] = {"actions": list(version.get("history_actions") or []), "compare": list(version.get("history_compare") or [])}
        return found
