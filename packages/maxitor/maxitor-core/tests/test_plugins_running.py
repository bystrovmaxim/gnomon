# packages/maxitor/maxitor-core/tests/test_plugins_running.py
"""
Running plugins: the runner's storage names no schema and binds every condition; RunVersionAction starts what is
missing, leaves what runs, notices what exited and waits its pause; StopVersionAction forgets a version; the gateway's
pass lets through only an active member to a plugin enabled there, with the core's roles, and says when it does not
run; the controller really starts a test wheel's backend and frontend on 127.0.0.1 with nothing of the core's
settings in their environment.
"""

from __future__ import annotations

import io
import shutil
import urllib.request
import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import jwt
import pytest
from maxitor.core.plugins.actions.run_version_action import RunVersionAction, RunVersionParams, pause_after
from maxitor.core.plugins.actions.stop_version_action import StopVersionAction, StopVersionParams
from maxitor.core.plugins.actions.take_up_running_action import TakeUpRunningAction, TakeUpRunningParams
from maxitor.core.plugins.plugin_processes import (
    EnvironmentInstallError,
    Images,
    Plan,
    PluginProcessesController,
    Started,
    frontend_files,
    moved_dsn,
    wheel_file_name,
)
from maxitor.core.plugins.runner_role import RunnerRole
from maxitor.core.plugins.storage.plugin_runtime_storage import PluginRuntimeStorage
from maxitor.core.plugins.storage.plugins_storage import PluginsStorage
from maxitor.core.plugins.storage.wheel_storage import WheelStorage

from aoa.action_machine.context.context import Context
from aoa.action_machine.context.user_info import UserInfo
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine
from tests.fakes import MemoryCoreStorage, World
from tests.plugin_fakes import MemoryPluginsStorage
from tests.recording_database import recording_pool

RUNNER = Context(user=UserInfo(user_id="plugin-runner", roles=(RunnerRole,)))
VERSION = RunVersionParams(
    version_id="v1", version="1.0.0", sha256="a" * 64, schema_name="notes_1_0_0", passport_id="io.x.notes", name="notes"
)


# ── the storage ───────────────────────────────────────────────────────────────


async def test_the_runners_readings_name_no_schema_and_bind_every_condition() -> None:
    pool, connection = recording_pool(lambda _q, _p: None)
    storage = PluginsStorage(pool=pool)
    await storage.open()
    await storage.runnable_versions()
    await storage.pass_target("acme", "a1", "notes", "backend")
    await storage.forget_processes("v1")
    queries = connection.queries()
    assert "op.state = 'enabled'" in queries[0] and "v.schema_name IS NOT NULL" in queries[0]
    assert connection.statements[1][1] == ("acme", "a1", "notes", "backend")
    assert "u.status = 'active'" in queries[1] and "op.state = 'enabled'" in queries[1]
    assert connection.statements[2] == ("DELETE FROM plugin_process WHERE plugin_version_id = $1::text::uuid", ("v1",))
    assert not any(word in query for query in queries for word in ("plugins.", "organization.", "platform."))


# ── the runner's actions over a controller that only pretends ─────────────────


class PretendController(PluginProcessesController):
    """A controller that starts nothing: it answers from what the test sets."""

    def __init__(self, *, frontend: bool = False, broken: bool = False, refuse: bool = False) -> None:
        super().__init__(
            PluginRuntimeStorage(Path("/nowhere"), "postgresql://u@db/maxitor"),
            WheelStorage(Path("/nowhere")),
            gateway_url="http://host.docker.internal:3000",
        )
        self.frontend, self.broken, self.refuse = frontend, broken, refuse
        self.codes: dict[tuple[str, str], int | None] = {}
        self.starts: list[tuple[str, str]] = []
        self.port = 40000

    def plan(self, sha256: str) -> Plan:
        return Plan("maxitor_notes.app:create_app", "maxitor_notes/_web" if self.frontend else None)

    async def ensure_images(self, schema: str, sha256: str, plan: Plan) -> Images:
        if self.broken:
            raise EnvironmentInstallError("pip: No matching distribution found for aoa-action-machine")
        return Images(f"maxitor-plugin/{schema}-backend:aaaa", f"maxitor-plugin/{schema}-frontend:aaaa" if plan.frontend_build else None)

    async def start(self, version_id: str, kind: str, schema: str, image: str) -> Started:
        if self.refuse:
            raise RuntimeError("not_listening")
        self.port += 1
        self.starts.append((kind, image))
        self.codes[(version_id, kind)] = None
        return Started(f"maxitor-{schema}-{kind}", f"http://127.0.0.1:{self.port}")

    async def exit_code(self, version_id: str, kind: str) -> int | None:
        return self.codes.get((version_id, kind), -1)

    async def stop_one(self, version_id: str, kind: str) -> None:
        self.codes.pop((version_id, kind), None)

    async def stop(self, version_id: str) -> None:
        for key in [k for k in self.codes if k[0] == version_id]:
            self.codes.pop(key)


class Box:
    """Collects what an action writes."""

    def __init__(self) -> None:
        self.lines: list[tuple[str, Any]] = []


async def run(storage: MemoryPluginsStorage, processes: PretendController, action: Any, params: Any) -> Any:
    machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
    connections = {"plugins": storage, "processes": processes}
    declared = {info.key for info in getattr(type(action), "_connection_info", [])}
    return await machine.run(RUNNER, action, params, {key: connections[key] for key in declared})


def store() -> MemoryPluginsStorage:
    return MemoryPluginsStorage(MemoryCoreStorage())


async def test_a_version_gets_its_backend_started_and_recorded() -> None:
    storage, processes = store(), PretendController()
    result = await run(storage, processes, RunVersionAction(), VERSION)
    assert result.running == ["backend"]
    assert processes.starts == [("backend", "maxitor-plugin/notes_1_0_0-backend:aaaa")]
    [row] = storage.tables["plugin_process"]
    assert row["container"] == "maxitor-notes_1_0_0-backend"
    assert row["address"] == "http://127.0.0.1:40001" and row["failures"] == 0 and row["next_start_at"] is None


async def test_the_frontend_starts_after_the_backend_from_its_own_image() -> None:
    storage, processes = store(), PretendController(frontend=True)
    assert (await run(storage, processes, RunVersionAction(), VERSION)).running == ["backend", "frontend"]
    assert processes.starts[1] == ("frontend", "maxitor-plugin/notes_1_0_0-frontend:aaaa")


async def test_a_running_process_is_left_alone() -> None:
    storage, processes = store(), PretendController()
    await run(storage, processes, RunVersionAction(), VERSION)
    await run(storage, processes, RunVersionAction(), VERSION)
    assert len(processes.starts) == 1


async def test_an_exited_process_loses_its_address_and_waits_its_pause() -> None:
    storage, processes = store(), PretendController()
    await run(storage, processes, RunVersionAction(), VERSION)
    processes.codes[("v1", "backend")] = 3
    assert (await run(storage, processes, RunVersionAction(), VERSION)).running == []
    [row] = storage.tables["plugin_process"]
    assert row["address"] is None and row["failures"] == 1 and row["next_start_at"] > datetime.now(UTC)
    # Inside the pause nothing starts; once it is over the process starts again.
    assert (await run(storage, processes, RunVersionAction(), VERSION)).running == []
    row["next_start_at"] = datetime.now(UTC) - timedelta(seconds=1)
    assert (await run(storage, processes, RunVersionAction(), VERSION)).running == ["backend"]
    assert len(processes.starts) == 2 and storage.tables["plugin_process"][0]["failures"] == 1


async def test_failures_are_forgotten_after_a_minute_of_running() -> None:
    storage, processes = store(), PretendController()
    await run(storage, processes, RunVersionAction(), VERSION)
    storage.tables["plugin_process"][0].update(failures=3, started_at=datetime.now(UTC) - timedelta(minutes=2))
    await run(storage, processes, RunVersionAction(), VERSION)
    assert storage.tables["plugin_process"][0]["failures"] == 0


async def test_a_process_that_does_not_come_up_waits_and_says_why() -> None:
    storage, processes = store(), PretendController(refuse=True)
    assert (await run(storage, processes, RunVersionAction(), VERSION)).running == []
    [row] = storage.tables["plugin_process"]
    assert row["address"] is None and row["failures"] == 1


async def test_images_that_cannot_be_built_start_nothing() -> None:
    storage, processes = store(), PretendController(broken=True)
    assert (await run(storage, processes, RunVersionAction(), VERSION)).running == []
    assert processes.starts == [] and storage.tables["plugin_process"] == []


def test_the_pause_doubles_and_stops_at_five_minutes() -> None:
    assert [pause_after(n).total_seconds() for n in (1, 2, 3, 7, 20)] == [5, 10, 20, 300, 300]


async def test_the_round_lists_the_enabled_deployed_versions_and_forgets_old_rows_on_start() -> None:
    storage, processes = store(), PretendController()
    deployed = storage.offer("io.x.notes", "notes", "Notes", deployed=True)
    storage.offer("io.x.tasks", "tasks", "Tasks", deployed=True)
    storage.tables["organization_plugin"].append({"organization_id": "o1", "plugin_id": storage.tables["plugin"][0]["id"],
                                                  "plugin_version_id": deployed, "state": "enabled"})
    storage.tables["plugin_process"].append({"version_id": "old", "kind": "backend"})
    queue = await run(storage, processes, TakeUpRunningAction(), TakeUpRunningParams(started=True))
    assert [v.passport_id for v in queue.versions] == ["io.x.notes"] and queue.recorded == []


async def test_a_stopped_version_loses_its_processes_and_rows() -> None:
    storage, processes = store(), PretendController()
    await run(storage, processes, RunVersionAction(), VERSION)
    await run(storage, processes, StopVersionAction(), StopVersionParams(version_id="v1"))
    assert storage.tables["plugin_process"] == [] and processes.codes == {}


# ── the gateway's pass over HTTP ──────────────────────────────────────────────

CODE = "severny-veter"


@pytest.fixture
def world() -> World:
    w = World()
    w.signed(w.sign_up())
    assert w.client.post("/api/v1/organizations", json={"name": "Severny Veter", "code": CODE}).status_code == 200
    version_id = w.plugins.offer("io.x.notes", "notes", "Notes", deployed=True)
    organization = next(o["id"] for o in w.storage.tables["organization"] if o["code"] == CODE)
    w.plugins.tables["organization_plugin"].append(
        {"organization_id": organization, "plugin_id": w.plugins.tables["plugin"][0]["id"], "plugin_version_id": version_id,
         "state": "enabled"}
    )
    w.plugins.tables["plugin_process"].append({"version_id": version_id, "kind": "backend", "address": "http://127.0.0.1:41873"})
    return w


def ask(world: World, **params: str) -> Any:
    return world.client.post("/api/v1/gateway/pass", json={"plugin": "notes", "organization": CODE, "kind": "backend", **params})


def test_an_administrator_passes_to_an_enabled_plugin_with_the_cores_roles(world: World) -> None:
    answer = ask(world)
    assert answer.status_code == 200, answer.text
    body = answer.json()
    token = body.pop("token")
    assert body == {"address": "http://127.0.0.1:41873", "passport_id": "io.x.notes", "organization": CODE,
                    "roles": ["member", "administrator"]}
    claims = jwt.decode(token, world.gateway_key.public_key(), algorithms=["EdDSA"], audience="io.x.notes", issuer="maxitor")
    assert claims["org"] == CODE and claims["roles"] == ["member", "administrator"] and claims["exp"] - claims["iat"] == 60
    assert claims["sub"] == world.storage.tables["account"][0]["id"]


def test_a_plain_member_carries_member_only(world: World) -> None:
    for user in world.storage.tables['"user"']:
        user["is_admin"] = False
    assert ask(world).json()["roles"] == ["member"]


def test_every_other_case_is_the_same_not_found(world: World) -> None:
    assert ask(world, organization="beta").status_code == 404
    assert ask(world, plugin="tasks").status_code == 404
    world.plugins.tables["organization_plugin"][0]["state"] = "disabled"
    assert ask(world).status_code == 404


def test_a_plugin_whose_process_does_not_accept_is_not_running(world: World) -> None:
    assert (ask(world, kind="frontend").status_code, ask(world, kind="frontend").json()) == (502, {"error": "not_running"})


def test_no_session_is_unauthorized(world: World) -> None:
    world.client.cookies.clear()
    assert ask(world).status_code == 401


# ── the controller, for real ──────────────────────────────────────────────────

APP = """
import os


def create_app():
    async def app(scope, receive, send):
        if scope["type"] != "http":
            return
        body = " ".join(sorted(os.environ)).encode() + b" uid=" + str(os.getuid()).encode()
        await send({"type": "http.response.start", "status": 200, "headers": [(b"content-type", b"text/plain")]})
        await send({"type": "http.response.body", "body": body})
    return app
"""
SERVER = """
const http = require("http");
http.createServer((req, res) => res.end("frontend " + process.env.MAXITOR_PLUGIN_API)).listen(Number(process.env.PORT), process.env.HOSTNAME);
"""
PASSPORT = """passport: 2
id: io.x.probe
name: probe
title: Probe
description: A plugin that only answers.
version: 0.1.0
sdk: 1
requires:
  maxitor: ">=4.0,<5"
backend:
  app: probe_plugin.app:create_app
frontend:
  build: probe_plugin/_web
  navigation: probe_plugin/navigation.yaml
"""


def probe_wheel(uvicorn_required: bool = True) -> bytes:
    metadata = "Metadata-Version: 2.1\nName: probe-plugin\nVersion: 0.1.0\n" + ("Requires-Dist: uvicorn\n" if uvicorn_required else "")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("probe_plugin/__init__.py", "")
        archive.writestr("probe_plugin/app.py", APP)
        archive.writestr("probe_plugin/maxitor-plugin.yaml", PASSPORT)
        archive.writestr("probe_plugin/navigation.yaml", "navigation: 1\nnodes: []\n")
        archive.writestr("probe_plugin/_web/server.js", SERVER)
        archive.writestr("probe_plugin-0.1.0.dist-info/METADATA", metadata)
        archive.writestr("probe_plugin-0.1.0.dist-info/WHEEL", "Wheel-Version: 1.0\nRoot-Is-Purelib: true\nTag: py3-none-any\n")
        archive.writestr("probe_plugin-0.1.0.dist-info/RECORD", "")
    return buffer.getvalue()


def test_a_wheel_is_named_by_its_own_tag_and_gives_its_pages() -> None:
    assert wheel_file_name(probe_wheel()) == "probe_plugin-0.1.0-py3-none-any.whl"
    assert set(frontend_files(probe_wheel(), "probe_plugin/_web")) == {"server.js"}


def test_the_containers_reach_the_database_under_their_own_address() -> None:
    dsn = "postgresql://plg_notes:p%40ss@127.0.0.1:55432/maxitor"
    assert moved_dsn(dsn, "maxitor-db:5432") == "postgresql://plg_notes:p%40ss@maxitor-db:5432/maxitor"
    assert moved_dsn(dsn, None) == dsn


def fetch(address: str) -> str:
    with urllib.request.urlopen(address, timeout=5) as answer:
        return str(answer.read().decode("utf-8"))


@pytest.mark.skipif(shutil.which("docker") is None, reason="needs Docker on the host")
async def test_the_controller_runs_a_wheels_backend_and_frontend_in_unprivileged_containers(tmp_path: Path) -> None:
    wheels = WheelStorage(tmp_path / "wheels")
    sha256 = wheels.put(probe_wheel())
    runtime = PluginRuntimeStorage(tmp_path / "runtime", "postgresql://u@127.0.0.1:5432/maxitor")
    runtime.write_env("probe_0_1_0", "plg_probe_0_1_0", "secret", "service-key")
    processes = PluginProcessesController(runtime, wheels, gateway_url="http://host.docker.internal:3000", db_address="maxitor-db:5432")
    plan = processes.plan(sha256)
    images = await processes.ensure_images("probe_0_1_0", sha256, plan)
    assert images.frontend is not None
    try:
        backend = await processes.start("v-probe", "backend", "probe_0_1_0", images.backend)
        frontend = await processes.start("v-probe", "frontend", "probe_0_1_0", images.frontend)
        assert backend.address.startswith("http://127.0.0.1:") and frontend.address.startswith("http://127.0.0.1:")
        seen = fetch(backend.address)
        names = set(seen.split())
        assert {"MAXITOR_PLUGIN_DSN", "MAXITOR_PLUGIN_SERVICE_KEY", "MAXITOR_CORE_JWKS_URL", "MAXITOR_GATEWAY_URL"} <= names
        assert "MAXITOR_CORE_DSN" not in names and "MAXITOR_SESSION_SECRET" not in names
        assert seen.endswith("uid=65534")
        assert fetch(frontend.address) == "frontend http://maxitor-probe_0_1_0-backend:8000"
        assert await processes.exit_code("v-probe", "backend") is None
        assert await processes.running_versions() >= {"v-probe"}
    finally:
        await processes.stop("v-probe")
    assert await processes.exit_code("v-probe", "backend") == -1
