# packages/maxitor/maxitor-core/tests/test_plugins_deploy.py
"""
Deploying a version: one transaction that builds the user, the schema, the tables and the rights and enables the
plugin; the plain password reaches no statement, only the version's environment file; a failure at any step leaves
nothing and records the reason; a version already deployed is not built again; a row another installer holds is
left alone.
"""

from __future__ import annotations

import io
import stat
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from maxitor.core.plugins.actions.deploy_and_install_action import DeployAndInstallAction, DeployParams
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage
from maxitor.core.plugins.storage.plugin_runtime_storage import RUNTIME_CONNECTION_KEY, PluginRuntimeStorage
from maxitor.core.plugins.storage.wheel_storage import WHEELS_CONNECTION_KEY, WheelStorage

from aoa.action_machine.context.context import Context
from aoa.action_machine.context.user_info import UserInfo
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.resources.postgres import PostgresPool
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine
from tests.recording_database import RecordingConnection

MOMENT = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)
ORG = "0b9c2c8e-9a43-4d0e-8f3f-5d0f1b8b6a11"
ROW = "6f1d6b70-2a0b-4b61-9a3e-0a6e9a0f7c22"
VERSION = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
INSTALLER = Context(user=UserInfo(user_id="plugin-installer", roles=(InstallerRole,)))

PASSPORT = """passport: 2
id: run.aoa.maxitor.notes
name: notes
title: Notes
version: 0.4.0
database:
  schema: maxitor_notes/schema.yaml
  foreign_keys: maxitor_notes/foreign-keys.yaml
frontend:
  navigation: maxitor_notes/navigation.yaml
"""
SCHEMA = """schema: 1
tables:
  note:
    description: A note.
    columns:
      writer_id: {type: uuid, nullable: false, description: The user who wrote it.}
      body: {type: text, nullable: false, description: The text.}
"""
KEYS = """foreign_keys:
  - from: { table: note, columns: [organization_id, writer_id] }
    to:   { schema: core, table: user, columns: [organization_id, id] }
"""


def wheel(files: dict[str, str] | None = None) -> bytes:
    """A plugin wheel of the template's shape, as bytes."""
    contents = {
        "maxitor_notes-0.4.0.dist-info/METADATA": "Metadata-Version: 2.1\nName: maxitor-notes\nVersion: 0.4.0\n",
        "maxitor_notes/maxitor-plugin.yaml": PASSPORT,
        "maxitor_notes/schema.yaml": SCHEMA,
        "maxitor_notes/foreign-keys.yaml": KEYS,
        "maxitor_notes/navigation.yaml": "navigation: 1\n",
    } | (files or {})
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, text in contents.items():
            archive.writestr(name, text)
    return buffer.getvalue()


class FailingConnection(RecordingConnection):
    """A recording connection whose statement containing ``fail_on`` raises, as the database would."""

    def __init__(self, answer: Any, fail_on: str | None) -> None:
        super().__init__(answer)
        self.fail_on = fail_on

    async def execute(self, query: str, *params: Any) -> str:
        if self.fail_on and self.fail_on in query:
            self.statements.append((query, params))
            raise RuntimeError(f"the database refused: {self.fail_on}")
        return await super().execute(query, *params)


class Pool:
    def __init__(self, connection: RecordingConnection) -> None:
        self.connection = connection

    async def acquire(self, *, timeout: float | None = None) -> RecordingConnection:
        return self.connection

    async def release(self, connection: RecordingConnection) -> None:
        return None

    async def close(self) -> None:
        return None


class World:
    """The installer's connections over a recording database, a wheel store and a runtime directory."""

    def __init__(self, tmp: Path, *, deployed: str | None = None, claimed: bool = True, fail_on: str | None = None) -> None:
        self.store = WheelStorage(tmp / "wheels")
        self.sha = self.store.put(wheel())
        self.runtime = PluginRuntimeStorage(tmp / "runtime", "postgresql://maxitor_installer:secret@db.local:5432/maxitor")
        self.deployed, self.claimed = deployed, claimed
        self.connection = FailingConnection(self.answer, fail_on)

    def answer(self, query: str, params: tuple[Any, ...]) -> Any:
        if query.startswith("SELECT pg_try_advisory_xact_lock"):
            return self.claimed
        if query.startswith("SELECT greatest"):
            return MOMENT
        if "FROM organization_plugin op JOIN plugin p" in query and "op.id = $2" in query:
            return {"id": ROW, "organization_id": ORG, "state": "installing", "plugin_id": "p1", "version_id": VERSION,
                    "passport_id": "run.aoa.maxitor.notes", "version": "0.4.0", "schema_name": self.deployed, "database_user": None}
        if "FROM plugin_version v JOIN plugin p" in query:
            return {"id": VERSION, "plugin_id": "p1", "version": "0.4.0", "purl": "pkg:pypi/maxitor-notes@0.4.0",
                    "sha256": self.sha, "state": "active", "reason": None, "core_range": ">=4,<5",
                    "schema_name": self.deployed, "database_user": None, "passport_id": "run.aoa.maxitor.notes",
                    "name": "notes", "title": "Notes", "owner_organization_id": None}
        if query.startswith("SELECT * FROM"):
            return {"id": VERSION, "organization_id": ORG, "state": "enabled", "updated_at": MOMENT}
        return None

    async def run(self) -> str:
        storage = DeployStorage(pool=PostgresPool(pool=Pool(self.connection)))
        await storage.open()
        machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
        result = await machine.run(
            INSTALLER,
            DeployAndInstallAction(),
            DeployParams(organization_id=ORG, row_id=ROW),
            {DEPLOY_CONNECTION_KEY: storage, WHEELS_CONNECTION_KEY: self.store, RUNTIME_CONNECTION_KEY: self.runtime},
        )
        await storage.close()
        return str(result.state)

    def queries(self) -> list[str]:
        return self.connection.queries()

    def env(self) -> Path:
        return self.runtime.env_path("notes_0_4_0")


async def test_a_first_install_builds_the_version_in_one_transaction(tmp_path: Path) -> None:
    world = World(tmp_path)
    assert await world.run() == "enabled"
    q = world.queries()
    begin, commit = q.index("BEGIN"), q.index("COMMIT")
    assert q.count("BEGIN") == 1 and "ROLLBACK" not in q
    inside = q[begin:commit]
    assert any(s.startswith('CREATE ROLE "plg_notes_0_4_0" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT CONNECTION LIMIT 20 PASSWORD \'SCRAM-SHA-256$4096:') for s in inside)
    assert 'GRANT maxitor_plugin TO "plg_notes_0_4_0"' in inside
    assert 'CREATE SCHEMA "notes_0_4_0"' in inside
    assert any(s.startswith('CREATE TABLE "note" (') for s in inside)
    assert any(s.startswith('CREATE TABLE "note_versions" (') for s in inside)
    assert any(s.startswith('ALTER TABLE "note" ADD CONSTRAINT "xfk_') and 'REFERENCES "organization"."user" ("organization_id", "id")' in s for s in inside)
    assert 'GRANT USAGE ON SCHEMA "notes_0_4_0" TO "plg_notes_0_4_0"' in inside
    assert 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "notes_0_4_0" TO "plg_notes_0_4_0"' in inside
    assert inside.index('CREATE SCHEMA "notes_0_4_0"') < next(i for i, s in enumerate(inside) if s.startswith("UPDATE plugin_version SET"))
    assert any(s.startswith("UPDATE organization_plugin SET state = $1") for s in inside)
    assert not any(s.startswith(("GRANT CREATE", "GRANT ALL", "ALTER DEFAULT PRIVILEGES")) for s in q)


async def test_the_password_goes_only_into_the_environment_file(tmp_path: Path) -> None:
    world = World(tmp_path)
    await world.run()
    env = world.env().read_text(encoding="utf-8")
    assert stat.S_IMODE(world.env().stat().st_mode) == 0o600
    dsn = next(line for line in env.splitlines() if line.startswith("MAXITOR_PLUGIN_DSN="))
    password = dsn.split("plg_notes_0_4_0:")[1].split("@")[0]
    assert len(password) >= 40 and dsn.endswith("@db.local:5432/maxitor")
    for query, params in world.connection.statements:
        assert password not in query and all(password not in str(p) for p in params)
    assert "secret" not in env  # the installer's own password stays its own


@pytest.mark.parametrize("step", ['CREATE ROLE', 'CREATE SCHEMA', 'CREATE TABLE "note_versions"', 'ADD CONSTRAINT "xfk_', "GRANT SELECT", "UPDATE plugin_version SET"])
async def test_a_failure_at_any_step_leaves_nothing_and_records_why(tmp_path: Path, step: str) -> None:
    world = World(tmp_path, fail_on=step)
    assert await world.run() == "failed"
    q = world.queries()
    assert q.count("BEGIN") == 2 and q.count("ROLLBACK") == 1 and q.count("COMMIT") == 1
    failed = [p for s, p in world.connection.statements if s.startswith("UPDATE organization_plugin SET state = $1")]
    assert failed and failed[-1][0] == "failed" and step in failed[-1][1]
    assert not world.env().exists()


async def test_a_version_already_deployed_is_not_built_again(tmp_path: Path) -> None:
    world = World(tmp_path, deployed="notes_0_4_0")
    assert await world.run() == "enabled"
    q = world.queries()
    assert not any(s.startswith(("CREATE ROLE", "CREATE SCHEMA", "CREATE TABLE", "UPDATE plugin_version")) for s in q)
    assert any(s.startswith("UPDATE organization_plugin SET state = $1") for s in q)
    assert not world.env().exists()


async def test_a_row_another_installer_holds_is_left_alone(tmp_path: Path) -> None:
    world = World(tmp_path, claimed=False)
    assert await world.run() == "busy"
    assert not any(s.startswith(("CREATE", "UPDATE")) for s in world.queries())


async def test_a_key_to_a_dependency_is_refused_before_any_sql(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.store = WheelStorage(tmp_path / "other")
    world.sha = world.store.put(wheel({"maxitor_notes/foreign-keys.yaml": KEYS.replace("schema: core, table: user", "schema: tags, table: tag")}))
    assert await world.run() == "failed"
    assert not any(s.startswith(("CREATE ROLE", "CREATE SCHEMA")) for s in world.queries())
