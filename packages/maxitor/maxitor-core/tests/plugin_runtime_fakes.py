# packages/maxitor/maxitor-core/tests/plugin_runtime_fakes.py
"""
The runner's and the gateway's readings of the schema plugins in memory, for tests: the processes, the pass, the
exchange and the service token, over the same lists as MemoryPluginsStorage.
"""

from __future__ import annotations

from typing import Any


class MemoryRuntimeReadings:
    """What the runner and the gateway read and write; mixed into MemoryPluginsStorage, whose lists it uses."""

    tables: dict[str, list[dict[str, Any]]]
    core: Any

    def _plugin_by(self, field: str, value: Any) -> dict[str, Any]:
        return next(p for p in self.tables["plugin"] if p[field] == value)

    def _version_of(self, version_id: str) -> dict[str, Any]:
        return next(v for v in self.tables["plugin_version"] if v["id"] == version_id)

    async def runnable_versions(self) -> list[dict[str, Any]]:
        enabled = {r["plugin_version_id"] for r in self.tables["organization_plugin"] if r["state"] == "enabled"}
        found = []
        for version in self.tables["plugin_version"]:
            if version["id"] in enabled and version["schema_name"]:
                plugin = self._plugin_by("id", version["plugin_id"])
                found.append(
                    {"version_id": version["id"], "version": version["version"], "sha256": version["sha256"],
                     "schema_name": version["schema_name"], "passport_id": plugin["passport_id"], "name": plugin["name"]}
                )
        return found

    async def processes(self) -> list[dict[str, Any]]:
        return [dict(row) for row in self.tables["plugin_process"]]

    async def put_process(self, row: Any) -> None:
        rows = self.tables["plugin_process"]
        rows[:] = [r for r in rows if (r["version_id"], r["kind"]) != (row["version_id"], row["kind"])]
        rows.append(dict(row))

    async def forget_processes(self, version_id: str | None = None) -> None:
        rows = self.tables["plugin_process"]
        rows[:] = [r for r in rows if version_id is not None and r["version_id"] != version_id]

    async def pass_target(self, code: str, account_id: str, name: str, kind: str) -> dict[str, Any] | None:
        organization = await self.core.organization_for(code, account_id)
        if organization is None:
            return None
        for row in self.tables["organization_plugin"]:
            plugin = self._plugin_by("id", row["plugin_id"])
            if row["organization_id"] == organization["id"] and row["state"] == "enabled" and plugin["name"] == name:
                process = next(
                    (p for p in self.tables["plugin_process"] if p["version_id"] == row["plugin_version_id"] and p["kind"] == kind),
                    None,
                )
                return {"organization_id": organization["id"], "is_admin": organization["is_admin"],
                        "passport_id": plugin["passport_id"], "version_id": row["plugin_version_id"],
                        "version": self._version_of(row["plugin_version_id"])["version"],
                        "address": process["address"] if process else None}
        return None

    async def exchange_target(self, code: str, caller: str, name: str, kind: str) -> dict[str, Any] | None:
        organization = next((o for o in self.core.tables["organization"] if o["code"] == code), None)
        if organization is None:
            return None
        enabled = [r for r in self.tables["organization_plugin"] if r["organization_id"] == organization["id"] and r["state"] == "enabled"]
        mine = next((r for r in enabled if self._plugin_by("id", r["plugin_id"])["passport_id"] == caller), None)
        if mine is None:
            return None
        needs = {d["passport_id"] for d in self.tables["plugin_dependency"] if d["plugin_version_id"] == mine["plugin_version_id"]}
        for row in enabled:
            plugin = self._plugin_by("id", row["plugin_id"])
            if plugin["name"] == name and plugin["passport_id"] in needs:
                process = next(
                    (p for p in self.tables["plugin_process"] if p["version_id"] == row["plugin_version_id"] and p["kind"] == kind),
                    None,
                )
                return {"passport_id": plugin["passport_id"], "address": process["address"] if process else None}
        return None

    async def service_target(self, key_hash: str, code: str) -> dict[str, Any] | None:
        organization = next((o for o in self.core.tables["organization"] if o["code"] == code), None)
        for version in self.tables["plugin_version"]:
            if version.get("service_key_hash") != key_hash or organization is None:
                continue
            if any(r["plugin_version_id"] == version["id"] and r["organization_id"] == organization["id"] and r["state"] == "enabled"
                   for r in self.tables["organization_plugin"]):
                return {"passport_id": self._plugin_by("id", version["plugin_id"])["passport_id"]}
        return None
