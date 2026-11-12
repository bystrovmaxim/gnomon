# packages/maxitor/maxitor-core/tests/test_plugins_running.py
"""
Running plugins: the runner's storage names no schema and binds every condition; RunVersionAction starts what is
missing, leaves what runs, notices what exited and waits its pause; StopVersionAction forgets a version; the gateway's
pass lets through only an active member to a plugin enabled there, with the core's roles, and says when it does not
run; the frontend runs only from the installer's build for this core version; the controller really starts a test
wheel's backend and a frontend image on 127.0.0.1 with nothing of the core's settings in their environment.
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
from maxitor.core.plugins.frontend_builder import core_version
from maxitor.core.plugins.plugin_processes import (
    RUNNER_LABEL,
    VERSION_LABEL,
    EnvironmentInstallError,
    Images,
    Plan,
    PluginProcessesController,
    Started,
    build_failure,
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


async def test_a_runner_sees_and_removes_only_its_own_containers(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, ...]] = []

    async def docker(*args: str) -> tuple[int, str]:
        calls.append(args)
        return 0, ""

    monkeypatch.setattr("maxitor.core.plugins.plugin_processes.docker", docker)
    processes = PluginProcessesController(
        PluginRuntimeStorage(Path("/nowhere"), "postgresql://u@db/maxitor"), WheelStorage(Path("/nowhere")),
        gateway_url="http://host.docker.internal:3010", runner="second",
    )
    await processes.running_versions()
    await processes.stop_all()
    await processes.stop("v1")
    await processes.exit_code("v1", "backend")
    listed = [call for call in calls if call[0] == "ps"]
    assert len(listed) == 4
    assert all(f"label={RUNNER_LABEL}=second" in call for call in listed)
    # The frontend reaches its own runner's backend by that container's name.
    monkeypatch.setattr(processes._runtime, "env_path", lambda schema: Path("/nowhere") / schema / ".env")
    monkeypatch.setattr("maxitor.core.plugins.plugin_processes.read_env_file", lambda path: {})
    assert processes._environment("notes_0_8_0", "frontend")["MAXITOR_PLUGIN_API"] == "http://maxitor-second-notes_0_8_0-backend:8000"


def _docker_answering(monkeypatch: pytest.MonkeyPatch, answers: dict[tuple[str, ...], tuple[int, str]]) -> list[tuple[str, ...]]:
    """Docker pretended: each call is recorded; one beginning with a key of ``answers`` gets its answer, any other succeeds."""
    calls: list[tuple[str, ...]] = []

    async def docker(*args: str) -> tuple[int, str]:
        calls.append(args)
        return next((answer for start, answer in answers.items() if args[: len(start)] == start), (0, ""))

    monkeypatch.setattr("maxitor.core.plugins.plugin_processes.docker", docker)
    return calls


def _runner_with_database() -> PluginProcessesController:
    return PluginProcessesController(
        PluginRuntimeStorage(Path("/nowhere"), "postgresql://u@db/maxitor"), WheelStorage(Path("/nowhere")),
        gateway_url="http://host.docker.internal:3010", db_container="stand-pg", runner="second",
    )


async def test_a_stopped_version_takes_its_network_with_it_so_dockers_networks_never_run_out(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _docker_answering(monkeypatch, {("network", "ls"): (0, "maxitor-second-notes_0_15_7")})
    await _runner_with_database().stop("v7")
    listed = next(call for call in calls if call[:2] == ("network", "ls"))
    assert f"label={VERSION_LABEL}=v7" in listed and f"label={RUNNER_LABEL}=second" in listed
    # The database's container is let go first: while it is joined, Docker counts the network as in use.
    assert calls[-2:] == [("network", "disconnect", "--force", "maxitor-second-notes_0_15_7", "stand-pg"), ("network", "rm", "maxitor-second-notes_0_15_7")]


async def test_a_version_whose_containers_are_gone_but_whose_network_is_left_is_still_seen_so_the_round_stops_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _docker_answering(monkeypatch, {("ps",): (0, "v6"), ("network", "ls"): (0, "v6\nv7")})
    assert await _runner_with_database().running_versions() == {"v6", "v7"}


async def test_a_runner_starting_afresh_removes_every_network_of_its_own(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _docker_answering(monkeypatch, {("network", "ls"): (0, "maxitor-second-notes_0_15_6\nmaxitor-second-notes_0_15_7")})
    await _runner_with_database().stop_all()
    listed = next(call for call in calls if call[:2] == ("network", "ls"))
    assert f"label={VERSION_LABEL}" in listed and f"label={RUNNER_LABEL}=second" in listed
    assert [call[-1] for call in calls if call[:2] == ("network", "rm")] == ["maxitor-second-notes_0_15_6", "maxitor-second-notes_0_15_7"]


async def test_a_versions_network_is_labelled_with_it_and_its_runner(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _docker_answering(monkeypatch, {("network", "inspect"): (1, "No such network")})
    processes = _runner_with_database()
    monkeypatch.setattr(processes._runtime, "env_path", lambda schema: Path("/nowhere") / schema / ".env")
    monkeypatch.setattr("maxitor.core.plugins.plugin_processes.read_env_file", lambda path: {})
    with pytest.raises(RuntimeError):
        await processes.start("v7", "backend", "notes_0_15_7", "image")
    created = next(call for call in calls if call[:2] == ("network", "create"))
    assert created == ("network", "create", "--label", f"{VERSION_LABEL}=v7", "--label", f"{RUNNER_LABEL}=second", "maxitor-second-notes_0_15_7")


async def test_a_network_docker_cannot_make_stops_the_start_in_dockers_own_words(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _docker_answering(monkeypatch, {
        ("network", "inspect"): (1, "No such network"),
        ("network", "create"): (1, "Error response from daemon: all predefined address pools have been fully subnetted"),
    })
    with pytest.raises(RuntimeError, match=r"the network maxitor-second-notes_0_15_7 could not be made: .*address pools have been fully subnetted"):
        await _runner_with_database().start("v7", "backend", "notes_0_15_7", "image")
    assert not any(call[0] == "run" for call in calls)


# ── the runner's actions over a controller that only pretends ─────────────────


class PretendController(PluginProcessesController):
    """A controller that starts nothing: it answers from what the test sets."""

    def __init__(self, *, broken: bool = False, refuse: bool = False) -> None:
        super().__init__(
            PluginRuntimeStorage(Path("/nowhere"), "postgresql://u@db/maxitor"),
            WheelStorage(Path("/nowhere")),
            gateway_url="http://host.docker.internal:3000",
        )
        self.broken, self.refuse = broken, refuse
        self.codes: dict[tuple[str, str], int | None] = {}
        self.images: dict[tuple[str, str], str] = {}
        self.starts: list[tuple[str, str]] = []
        self.port = 40000

    def plan(self, sha256: str, frontend_image: str | None) -> Plan:
        return Plan("maxitor_notes.app:create_app", frontend_image)

    async def ensure_images(self, schema: str, sha256: str, plan: Plan) -> Images:
        if self.broken:
            raise EnvironmentInstallError("pip: No matching distribution found for aoa-action-machine")
        return Images(f"maxitor-plugin/{schema}-backend:aaaa", plan.frontend_image)

    async def start(self, version_id: str, kind: str, schema: str, image: str) -> Started:
        if self.refuse:
            raise RuntimeError("not_listening")
        self.port += 1
        self.starts.append((kind, image))
        self.codes[(version_id, kind)] = None
        self.images[(version_id, kind)] = image
        return Started(f"maxitor-{schema}-{kind}", f"http://127.0.0.1:{self.port}")

    async def exit_code(self, version_id: str, kind: str) -> int | None:
        return self.codes.get((version_id, kind), -1)

    async def image_of(self, version_id: str, kind: str) -> str | None:
        return self.images.get((version_id, kind))

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


def built(core: str, state: str = "built") -> dict[str, Any]:
    """The installer's build of the version's frontend for ``core``."""
    image = f"maxitor-plugin/notes_1_0_0-frontend:aaaaaaaaaaaa-{core}" if state == "built" else None
    return {
        "id": "b1", "version_id": "v1", "core_version": core, "state": state, "image": image,
        "error": None if state == "built" else "Type error: x", "started_at": datetime.now(UTC), "finished_at": None,
    }


async def test_the_frontend_starts_after_the_backend_from_the_installers_build() -> None:
    storage, processes = store(), PretendController()
    await storage.put_build(built(core_version()))
    assert (await run(storage, processes, RunVersionAction(), VERSION)).running == ["backend", "frontend"]
    assert processes.starts[1] == ("frontend", f"maxitor-plugin/notes_1_0_0-frontend:aaaaaaaaaaaa-{core_version()}")


async def test_the_frontend_runs_the_build_of_the_serving_core_version_and_restarts_when_the_site_moves() -> None:
    storage, processes = store(), PretendController()
    await storage.put_generation("4.4.1", core_version(), datetime.now(UTC))
    await storage.put_build(built("4.4.1"))
    await storage.put_build(built(core_version()))
    await run(storage, processes, RunVersionAction(), VERSION)
    assert processes.starts[-1] == ("frontend", "maxitor-plugin/notes_1_0_0-frontend:aaaaaaaaaaaa-4.4.1")
    await run(storage, processes, RunVersionAction(), VERSION)
    assert len(processes.starts) == 2
    await storage.put_generation(core_version(), None, datetime.now(UTC))
    assert (await run(storage, processes, RunVersionAction(), VERSION)).running == ["backend", "frontend"]
    assert processes.starts[2:] == [("frontend", f"maxitor-plugin/notes_1_0_0-frontend:aaaaaaaaaaaa-{core_version()}")]
    assert [row["failures"] for row in storage.tables["plugin_process"]] == [0, 0]


async def test_no_frontend_runs_without_a_build_for_this_core_version() -> None:
    storage, processes = store(), PretendController()
    await storage.put_build(built("0.0.1"))
    assert (await run(storage, processes, RunVersionAction(), VERSION)).running == ["backend"]
    await storage.put_build(built(core_version(), state="failed"))
    assert (await run(storage, processes, RunVersionAction(), VERSION)).running == ["backend"]


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
PASSPORT = """passport: 3
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
  source: probe_plugin/web
  navigation: probe_plugin/navigation.yaml
"""


def probe_wheel(uvicorn_required: bool = True) -> bytes:
    metadata = "Metadata-Version: 2.1\nName: probe-plugin\nVersion: 0.1.0\n" + ("Requires-Dist: uvicorn\n" if uvicorn_required else "")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("probe_plugin/__init__.py", "")
        archive.writestr("probe_plugin/app.py", APP)
        archive.writestr("probe_plugin/maxitor-plugin.yaml", PASSPORT)
        archive.writestr("probe_plugin/navigation.yaml", "navigation: 3\nnodes: []\n")
        archive.writestr("probe_plugin-0.1.0.dist-info/METADATA", metadata)
        archive.writestr("probe_plugin-0.1.0.dist-info/WHEEL", "Wheel-Version: 1.0\nRoot-Is-Purelib: true\nTag: py3-none-any\n")
        archive.writestr("probe_plugin-0.1.0.dist-info/RECORD", "")
    return buffer.getvalue()


def test_a_wheel_is_named_by_its_own_tag() -> None:
    assert wheel_file_name(probe_wheel()) == "probe_plugin-0.1.0-py3-none-any.whl"


def test_the_containers_reach_the_database_under_their_own_address() -> None:
    dsn = "postgresql://plg_notes:p%40ss@127.0.0.1:55432/maxitor"
    assert moved_dsn(dsn, "maxitor-db:5432") == "postgresql://plg_notes:p%40ss@maxitor-db:5432/maxitor"
    assert moved_dsn(dsn, None) == dsn


#: What ``docker build --progress=plain`` answers on Docker Desktop when pip finds no wheel the plugin needs.
FAILED_BUILD = """#5 [2/3] RUN pip install --no-cache-dir --find-links /wheels /wheels/notes-0.9.0-py3-none-any.whl
#5 0.825 ERROR: Could not find a version that satisfies the requirement maxitor-plugin-sdk<2,>=1.5 (from versions: 1.4.0)
#5 0.825 ERROR: No matching distribution found for maxitor-plugin-sdk<2,>=1.5
#5 ERROR: process "/bin/sh -c pip install" did not complete successfully: exit code: 1
------
ERROR: failed to build: failed to solve: process "/bin/sh -c pip install" did not complete successfully: exit code: 1

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/y7fr1ukioyrxjn5no7l3cq1o2"""


async def test_an_image_that_cannot_be_built_is_reported_in_the_words_of_the_failing_step(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    calls: list[tuple[str, ...]] = []

    async def docker(*args: str) -> tuple[int, str]:
        calls.append(args)
        return 1, FAILED_BUILD

    monkeypatch.setattr("maxitor.core.plugins.plugin_processes.docker", docker)
    processes = PluginProcessesController(
        PluginRuntimeStorage(tmp_path, "postgresql://u@db/maxitor"), WheelStorage(tmp_path),
        gateway_url="http://host.docker.internal:3000",
    )
    with pytest.raises(EnvironmentInstallError) as failed:
        await processes._build("maxitor-plugin/notes_0_9_0-backend:aaaa", tmp_path)
    assert failed.value.reason == (
        "ERROR: Could not find a version that satisfies the requirement maxitor-plugin-sdk<2,>=1.5 (from versions: 1.4.0)"
    )
    assert "--progress=plain" in calls[0] and "--quiet" not in calls[0]


def test_a_build_without_a_step_error_names_dockers_error_or_its_last_line() -> None:
    assert build_failure('#5 ERROR: process "/bin/sh -c x" did not complete successfully: exit code: 1', 1) == (
        'ERROR: process "/bin/sh -c x" did not complete successfully: exit code: 1'
    )
    assert build_failure("no space left on device\n\nView build details: docker-desktop://x", 1) == "no space left on device"
    assert build_failure("", 125) == "exit 125"


def fetch(address: str) -> str:
    with urllib.request.urlopen(address, timeout=5) as answer:
        return str(answer.read().decode("utf-8"))


@pytest.mark.skipif(shutil.which("docker") is None, reason="needs Docker on the host")
async def test_the_controller_runs_a_wheels_backend_and_frontend_in_unprivileged_containers(tmp_path: Path) -> None:
    wheels = WheelStorage(tmp_path / "wheels")
    sha256 = wheels.put(probe_wheel())
    runtime = PluginRuntimeStorage(tmp_path / "runtime", "postgresql://u@127.0.0.1:5432/maxitor")
    runtime.write_env("probe_0_1_0", "plg_probe_0_1_0", "secret", "service-key")
    # A runner of its own: the test never touches the containers of a stand running on the same host.
    processes = PluginProcessesController(
        runtime, wheels, gateway_url="http://host.docker.internal:3000", db_address="maxitor-db:5432", runner="tests"
    )
    # The installer's build stands in: an image of the frontend's server, built here.
    context = tmp_path / "frontend"
    context.mkdir()
    (context / "server.js").write_text(SERVER, encoding="utf-8")
    (context / "Dockerfile").write_text(
        'FROM node:22-slim\nCOPY server.js /app/server.js\nENV HOSTNAME=0.0.0.0 PORT=3000\nCMD ["node", "/app/server.js"]\n', encoding="utf-8"
    )
    frontend_image = "maxitor-plugin/probe_0_1_0-frontend:tests"
    await processes._build(frontend_image, context)
    plan = processes.plan(sha256, frontend_image)
    images = await processes.ensure_images("probe_0_1_0", sha256, plan)
    assert images.frontend == frontend_image
    try:
        backend = await processes.start("v-probe", "backend", "probe_0_1_0", images.backend)
        frontend = await processes.start("v-probe", "frontend", "probe_0_1_0", images.frontend)
        assert backend.address.startswith("http://127.0.0.1:") and frontend.address.startswith("http://127.0.0.1:")
        seen = fetch(backend.address)
        names = set(seen.split())
        assert {"MAXITOR_PLUGIN_DSN", "MAXITOR_PLUGIN_SERVICE_KEY", "MAXITOR_CORE_JWKS_URL", "MAXITOR_GATEWAY_URL"} <= names
        assert "MAXITOR_CORE_DSN" not in names and "MAXITOR_SESSION_SECRET" not in names
        assert seen.endswith("uid=65534")
        assert fetch(frontend.address) == "frontend http://maxitor-tests-probe_0_1_0-backend:8000"
        assert await processes.exit_code("v-probe", "backend") is None
        assert await processes.running_versions() >= {"v-probe"}
    finally:
        await processes.stop("v-probe")
    assert await processes.exit_code("v-probe", "backend") == -1
