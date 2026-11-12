# packages/maxitor/maxitor-core/tests/test_plugins_check.py
"""
Checking a version: every reason a version is rejected, the wheel read only as a zip, the store keeping a wheel once
under its hash, the gateway opening only allowed https hosts within its limits, and the action's three verdicts.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from importlib.metadata import version as package_version
from pathlib import Path
from typing import Any

import httpx
import pytest
from maxitor.core.plugins.actions.check_version_action import (
    CheckParams,
    CheckVersionAction,
    VersionRejectedError,
    inspect,
)
from maxitor.core.plugins.gateways.wheel_source_gateway import WheelSourceError, WheelSourceGateway, release_url
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage
from maxitor.core.plugins.storage.wheel_storage import WHEELS_CONNECTION_KEY, WheelHashError, WheelStorage
from maxitor.core.plugins.wheel import WheelRefusedError, read_wheel

from aoa.action_machine.context.context import Context
from aoa.action_machine.context.user_info import UserInfo
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine
from tests.plugin_wheels import KEYS, NAVIGATION, PASSPORT, SCHEMA, wheel
from tests.recording_database import recording_pool

MOMENT = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)
VERSION = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
PLACEHOLDER = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f"
INSTALLER = Context(user=UserInfo(user_id="plugin-installer", roles=(InstallerRole,)))


def _reason(files: dict[str, str | None]) -> str:
    with pytest.raises(VersionRejectedError) as refused:
        inspect(read_wheel(wheel(files)))
    return refused.value.reason


# ── what a wheel alone shows ──────────────────────────────────────────────────


def test_the_templates_wheel_passes_with_its_nodes_in_the_files_order() -> None:
    passport, nodes = inspect(read_wheel(wheel()))
    assert passport["id"] == "run.aoa.maxitor.notes"
    assert [(n.full_name, n.parent, n.order, n.page) for n in nodes] == [("notes:tags", "root", 20, "/tags"), ("notes:notes", "root", 10, "/")]


LIST_NODE = NAVIGATION + """    children:
      - id: item
        each: { source: list_items, key: item_id }
        children:
          - { id: item-page, title: Item, page: "/items/{item_id}" }
"""


def test_a_list_reads_an_action_the_wheel_carries() -> None:
    _passport, nodes = inspect(read_wheel(wheel({"maxitor_notes/navigation.yaml": LIST_NODE, "maxitor_notes/actions/list_items_action.py": ""})))
    assert [n.each_source for n in nodes if n.each_source] == ["list_items"]


@pytest.mark.parametrize(
    ("files", "reason"),
    [
        ({"maxitor_notes/maxitor-plugin.yaml": PASSPORT.replace("passport: 3", "passport: 1")}, "passport"),
        # Format 2 named a built site; the core builds the frontend from its sources.
        ({"maxitor_notes/maxitor-plugin.yaml": PASSPORT.replace("passport: 3", "passport: 2")}, "passport"),
        ({"maxitor_notes/maxitor-plugin.yaml": PASSPORT.replace("source: maxitor_notes/web", "build: maxitor_notes/_web")}, "passport"),
        ({"maxitor_notes/web/package-lock.json": None}, "frontend"),
        ({"maxitor_notes/web/package.json": None}, "frontend"),
        ({"maxitor_notes/web/node_modules/next/package.json": "{}"}, "frontend"),
        ({"maxitor_notes/web/.next/BUILD_ID": "x"}, "frontend"),
        ({"maxitor_notes/web/server.js": "x"}, "frontend"),
        ({"maxitor_notes/maxitor-plugin.yaml": PASSPORT.replace("name: notes", "name: Notes!")}, "passport"),
        ({"maxitor_notes/maxitor-plugin.yaml": PASSPORT.replace("version: 0.4.0", "version: 0.4.1")}, "passport"),
        ({"maxitor_notes/schema.yaml": SCHEMA.replace("type: text", "type: varchar")}, "schema"),
        ({"maxitor_notes/schema.yaml": None}, "schema"),
        ({"maxitor_notes/foreign-keys.yaml": KEYS.replace("schema: core, table: user", "schema: tags, table: tag")}, "foreign_keys"),
        ({"maxitor_notes/navigation.yaml": None}, "navigation"),
        ({"maxitor_notes/navigation.yaml": NAVIGATION.replace("navigation: 3", "navigation: 7")}, "navigation"),
        ({"maxitor_notes/navigation.yaml": NAVIGATION.replace("navigation: 3", "navigation: 1")}, "navigation"),
        # Navigation format 2 carried a page's history and a room's shared parameters.
        ({"maxitor_notes/navigation.yaml": NAVIGATION.replace("navigation: 3", "navigation: 2")}, "navigation"),
        ({"maxitor_notes/navigation.yaml": NAVIGATION + "    history: {read: list_items}\n"}, "navigation"),
        ({"maxitor_notes/maxitor-plugin.yaml": PASSPORT.replace('">=4.0,<5"', '">=5.0,<6"')}, "core_range"),
        ({"maxitor_notes/maxitor-plugin.yaml": PASSPORT + "roles:\n  - name: reader\n    description: Reads.\n"}, "passport"),
        ({"maxitor_notes/navigation.yaml": NAVIGATION + "    roles: [reader]\n"}, "navigation"),
        # A list whose source is no action of the wheel.
        ({"maxitor_notes/navigation.yaml": LIST_NODE}, "navigation"),
        # A node attached to a node the core does not have.
        ({"maxitor_notes/navigation.yaml": NAVIGATION.replace("attach: root\n    title: Tags", "attach: core:item\n    title: Tags")}, "navigation"),
    ],
)
def test_each_fault_of_a_wheel_rejects_it(files: dict[str, str | None], reason: str) -> None:
    assert _reason(files) == reason


def test_a_wheel_is_read_only_as_a_safe_zip() -> None:
    for data, reason in [
        (b"not a zip", "not_a_wheel"),
        (wheel({"maxitor_notes-0.4.0.dist-info/METADATA": None}), "not_a_wheel"),
        (wheel({"../escape.txt": "x"}), "unsafe_path"),
        (wheel({"maxitor_notes/maxitor-plugin.yaml": None}), "passport"),
    ]:
        with pytest.raises(WheelRefusedError) as refused:
            read_wheel(data)
        assert refused.value.reason == reason
    with pytest.raises(WheelRefusedError) as refused:
        read_wheel(wheel({"maxitor_notes/blob.bin": "x" * 5000}), max_expanded=4000)
    assert refused.value.reason == "too_large"


def test_the_store_keeps_a_wheel_once_under_its_hash(tmp_path: Path) -> None:
    store = WheelStorage(tmp_path)
    data = wheel()
    sha = store.put(data)
    assert store.read(sha) == data and store.put(data, sha) == sha
    assert len(list(tmp_path.glob("*.whl"))) == 1
    with pytest.raises(WheelHashError):
        store.put(b"other bytes", sha)
    with pytest.raises(WheelHashError):
        store.read("../../etc/passwd")


# ── the gateway ───────────────────────────────────────────────────────────────


def _gateway(handler: Any, max_bytes: int = 1_000_000, timeout: float = 5.0) -> WheelSourceGateway:
    return WheelSourceGateway(max_bytes, timeout, transport=httpx.MockTransport(handler))


def test_release_addresses() -> None:
    assert release_url("pkg:github/acme/maxitor-notes@v1.2.0?file=n-1.2.0-py3-none-any.whl") == (
        "https://github.com/acme/maxitor-notes/releases/download/v1.2.0/n-1.2.0-py3-none-any.whl"
    )
    assert release_url("pkg:gitlab/acme/tools/maxitor-notes@v1.2.0?file=n.whl") == (
        "https://gitlab.com/acme/tools/maxitor-notes/-/releases/v1.2.0/downloads/n.whl"
    )
    assert release_url("pkg:pypi/maxitor-notes@1.2.0") is None


async def test_pypi_names_the_pure_wheel() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "pypi.org":
            return httpx.Response(200, json={"urls": [
                {"packagetype": "sdist", "filename": "n-1.0.0.tar.gz", "url": "https://files.pythonhosted.org/n.tar.gz"},
                {"packagetype": "bdist_wheel", "filename": "n-1.0.0-py3-none-any.whl", "url": "https://files.pythonhosted.org/n.whl"},
            ]})
        assert str(request.url) == "https://files.pythonhosted.org/n.whl"
        return httpx.Response(200, content=b"wheel bytes")

    assert await _gateway(handler).download("pkg:pypi/n@1.0.0") == b"wheel bytes"


@pytest.mark.parametrize(
    ("location", "reason"),
    [("http://objects.githubusercontent.com/w", "redirect"), ("https://169.254.169.254/latest", "redirect"), ("https://evil.example/w", "redirect")],
)
async def test_a_redirect_off_the_allowed_hosts_stops(location: str, reason: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "github.com":
            return httpx.Response(302, headers={"location": location})
        return httpx.Response(200, content=b"from a host wheels never come from")

    with pytest.raises(WheelSourceError) as stopped:
        await _gateway(handler).download("pkg:github/acme/n@v1?file=n.whl")
    assert stopped.value.reason == reason


async def test_an_allowed_redirect_is_followed() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "github.com":
            return httpx.Response(302, headers={"location": "https://release-assets.githubusercontent.com/a/n.whl"})
        return httpx.Response(200, content=b"ok")

    assert await _gateway(handler).download("pkg:github/acme/n@v1?file=n.whl") == b"ok"


async def test_a_closed_repository_too_large_and_slow_downloads() -> None:
    with pytest.raises(WheelSourceError) as closed:
        await _gateway(lambda r: httpx.Response(404)).download("pkg:github/acme/n@v1?file=n.whl")
    assert closed.value.reason == "closed_repository"
    with pytest.raises(WheelSourceError) as large:
        await _gateway(lambda r: httpx.Response(200, content=b"x" * 2000), max_bytes=1000).download("pkg:gitlab/acme/n@v1?file=n.whl")
    assert large.value.reason == "too_large"

    async def slow(request: httpx.Request) -> httpx.Response:
        await asyncio.sleep(1)
        return httpx.Response(200, content=b"late")

    with pytest.raises(WheelSourceError) as late:
        await _gateway(slow, timeout=0.05).download("pkg:github/acme/n@v1?file=n.whl")
    assert late.value.reason == "timeout"


# ── the action ────────────────────────────────────────────────────────────────


class World:
    """A draft version over a recording database, its wheel in the store or behind a gateway."""

    def __init__(self, tmp: Path, *, data: bytes | None = None, stored: bool = True, taken: dict[str, Any] | None = None, handler: Any = None) -> None:
        self.store = WheelStorage(tmp / "wheels")
        self.data = data if data is not None else wheel()
        import hashlib

        self.sha = hashlib.sha256(self.data).hexdigest()
        if stored:
            self.store.put(self.data)
        self.taken = taken or {}
        self.gateway = _gateway(handler or (lambda r: httpx.Response(200, content=self.data)))
        self.pool, self.connection = recording_pool(self.answer)

    held = True

    def answer(self, query: str, params: tuple[Any, ...]) -> Any:
        if query.startswith("SELECT pg_try_advisory_lock"):
            return self.held
        if query.startswith("SELECT greatest"):
            return MOMENT
        if "FROM plugin_version v JOIN plugin p" in query:
            return {"id": VERSION, "plugin_id": PLACEHOLDER, "version": "0.0.0", "purl": "pkg:github/acme/n@v1?file=n.whl",
                    "sha256": self.sha, "state": "draft", "reason": None, "core_range": None, "schema_name": None,
                    "database_user": None, "passport_id": f"pending.{VERSION}", "name": "pending_9a8b7c6d5e4f4a3b8c2d1e0f",
                    "title": "", "owner_organization_id": "0b9c2c8e-9a43-4d0e-8f3f-5d0f1b8b6a11"}
        if "FROM plugin WHERE passport_id = $1" in query:
            return self.taken.get("id")
        if "FROM plugin WHERE name = $1" in query:
            return self.taken.get("name")
        if query.startswith("SELECT * FROM"):
            return {"id": VERSION, "state": "active", "updated_at": MOMENT}
        return None

    async def run(self) -> str:
        storage = DeployStorage(pool=self.pool)
        await storage.open()
        machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
        result = await machine.run(
            INSTALLER, CheckVersionAction(), CheckParams(version_id=VERSION),
            {DEPLOY_CONNECTION_KEY: storage, WHEELS_CONNECTION_KEY: self.store, "wheel_source": self.gateway},
        )
        await storage.close()
        return str(result.state)

    def updates(self, table: str) -> list[tuple[str, tuple[Any, ...]]]:
        return [(q, p) for q, p in self.connection.statements if q.startswith(f"UPDATE {table} SET")]


async def test_a_good_version_becomes_active_under_its_passports_identity(tmp_path: Path) -> None:
    world = World(tmp_path, data=wheel({"maxitor_notes/history/list_note_history_action.py": "", "maxitor_notes/actions/list_items_action.py": ""}))
    assert await world.run() == "active"
    plugin = world.updates("plugin")
    assert plugin[0][0].startswith("UPDATE plugin SET passport_id = $1, name = $2, title = $3, description = $4")
    assert plugin[0][1][:2] == ("run.aoa.maxitor.notes", "notes")
    nodes = [p for q, p in world.connection.statements if q.startswith("INSERT INTO plugin_node (")]
    assert [(p[2], p[6]) for p in nodes] == [("notes:tags", "Tags"), ("notes:notes", "All notes")]
    version = world.updates("plugin_version")[-1]
    assert "state = $6" in version[0] and version[1][:3] == (PLACEHOLDER, "0.4.0", ">=4.0,<5") and version[1][5] == "active"
    # What a page's history is checked against: the wheel's actions and the passport's comparisons.
    assert "history_actions = $4" in version[0] and version[1][3] == ["list_items", "list_note_history"] and version[1][4] == []


async def test_a_wheel_not_in_the_store_is_downloaded_and_kept(tmp_path: Path) -> None:
    world = World(tmp_path, stored=False)
    assert await world.run() == "active"
    assert world.store.read(world.sha) == world.data


async def test_a_wrong_hash_rejects_and_keeps_nothing(tmp_path: Path) -> None:
    world = World(tmp_path, stored=False, handler=lambda r: httpx.Response(200, content=b"other bytes"))
    assert await world.run() == "rejected"
    assert world.updates("plugin_version")[-1][1][1].startswith("hash: ")
    assert not list((tmp_path / "wheels").glob("*.whl"))


async def test_a_slow_source_leaves_the_version_waiting(tmp_path: Path) -> None:
    async def slow(request: httpx.Request) -> httpx.Response:
        await asyncio.sleep(1)
        return httpx.Response(200)

    world = World(tmp_path, stored=False)
    world.gateway = _gateway(slow, timeout=0.05)
    assert await world.run() == "draft"
    assert world.updates("plugin_version")[-1][1][0] == "draft"


async def test_an_id_or_name_another_owner_has_is_refused(tmp_path: Path) -> None:
    taken_id = World(tmp_path / "a", taken={"id": {"id": "other", "name": "notes", "owner_organization_id": None}})
    assert await taken_id.run() == "rejected"
    assert taken_id.updates("plugin_version")[-1][1][1].startswith("id_taken: ")
    taken_name = World(tmp_path / "b", taken={"name": {"id": "other", "passport_id": "io.example.other", "owner_organization_id": None}})
    assert await taken_name.run() == "rejected"
    assert taken_name.updates("plugin_version")[-1][1][1].startswith("name_taken: ")


async def test_the_same_owners_plugin_takes_the_new_version(tmp_path: Path) -> None:
    owner = "0b9c2c8e-9a43-4d0e-8f3f-5d0f1b8b6a11"
    world = World(tmp_path, taken={"id": {"id": "existing", "name": "notes", "owner_organization_id": owner},
                                   "name": {"id": "existing", "passport_id": "run.aoa.maxitor.notes", "owner_organization_id": owner}})
    assert await world.run() == "active"
    assert world.updates("plugin")[0][1][0] == "withdrawn"  # the waiting plugin steps aside
    assert world.updates("plugin_version")[-1][1][0] == "existing"


async def test_a_version_another_installer_is_checking_is_left_alone(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.held = False
    assert await world.run() == "busy"
    assert not any(q.startswith(("UPDATE", "INSERT")) for q in world.connection.queries())


async def test_the_hold_is_let_go_whatever_the_verdict(tmp_path: Path) -> None:
    for world in (World(tmp_path / "a"), World(tmp_path / "b", stored=False, handler=lambda r: httpx.Response(200, content=b"x"))):
        await world.run()
        queries = world.connection.queries()
        assert queries[0] == "SELECT pg_try_advisory_lock(hashtext($1))"
        assert queries[-1] == "SELECT pg_advisory_unlock(hashtext($1))"
        assert world.connection.statements[0][1] == world.connection.statements[-1][1] == (f"check:{VERSION}",)


def test_a_passport_of_format_2_is_refused_by_name() -> None:
    with pytest.raises(VersionRejectedError) as refused:
        inspect(read_wheel(wheel({"maxitor_notes/maxitor-plugin.yaml": PASSPORT.replace("passport: 3", "passport: 2")})))
    assert refused.value.detail == (
        f"the passport is format 2; the core {package_version('maxitor')} reads format 3 — the frontend ships as sources (frontend.source)"
    )


def test_sources_without_their_lock_are_refused_by_name() -> None:
    with pytest.raises(VersionRejectedError) as refused:
        inspect(read_wheel(wheel({"maxitor_notes/web/package-lock.json": None})))
    assert refused.value.detail == "frontend.source holds no package-lock.json; the core builds the frontend strictly by its lock file"
