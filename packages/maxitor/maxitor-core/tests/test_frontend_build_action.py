# packages/maxitor/maxitor-core/tests/test_frontend_build_action.py
"""
BuildFrontendAction: a version's frontend is built from the sources its wheel carries, once per core version; its
row goes building, then built with the image or failed with the first error; a failed row is built again; the
builder image's build is an event of its own.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from maxitor.core.plugins.actions.build_frontend_action import BuildFrontendAction, BuildParams
from maxitor.core.plugins.frontend_builder import BUILDER_CONNECTION_KEY, FrontendBuilderController
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.plugin_processes import EnvironmentInstallError
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage
from maxitor.core.plugins.storage.wheel_storage import WHEELS_CONNECTION_KEY, WheelStorage

from aoa.action_machine.context.context import Context
from aoa.action_machine.context.user_info import UserInfo
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine
from tests.plugin_wheels import wheel
from tests.recording_database import recording_pool

VERSION = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
CORE = "9.9.9"
INSTALLER = Context(user=UserInfo(user_id="plugin-installer", roles=(InstallerRole,)))


class PretendBuilderController(FrontendBuilderController):
    """A builder that runs no Docker: it answers what the test sets and records the sources it was given."""

    def __init__(self, work: Path, *, fails: str | None = None, fresh: bool = False) -> None:
        super().__init__(work, version=CORE)
        self.fails, self.fresh = fails, fresh
        self.built: list[tuple[str, list[str]]] = []

    async def ensure_builder(self) -> bool:
        return self.fresh

    async def build(self, schema: str, sha256: str, source: Path) -> str:
        self.built.append((schema, sorted(str(p.relative_to(source)) for p in source.rglob("*") if p.is_file())))
        if self.fails:
            raise EnvironmentInstallError(self.fails)
        return self.frontend_image(schema, sha256)


class World:
    def __init__(self, tmp: Path, *, found: dict[str, Any] | None = None, builder: PretendBuilderController | None = None) -> None:
        self.wheels = WheelStorage(tmp / "wheels")
        self.sha = self.wheels.put(wheel())
        self.found = found
        self.builder = builder or PretendBuilderController(tmp / "builds")
        self.pool, self.connection = recording_pool(self.answer)

    def answer(self, query: str, params: tuple[Any, ...]) -> Any:
        if "FROM plugin_version v JOIN plugin p" in query:
            return {"id": VERSION, "plugin_id": "p1", "version": "0.4.0", "purl": "pkg:pypi/maxitor-notes@0.4.0",
                    "sha256": self.sha, "state": "active", "reason": None, "core_range": ">=4,<5", "schema_name": None,
                    "database_user": None, "passport_id": "run.aoa.maxitor.notes", "name": "notes", "title": "Notes",
                    "owner_organization_id": None}
        if "FROM plugin_build" in query:
            return self.found
        return None

    async def run(self) -> str:
        storage = DeployStorage(pool=self.pool)
        await storage.open()
        machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
        connections = {DEPLOY_CONNECTION_KEY: storage, WHEELS_CONNECTION_KEY: self.wheels, BUILDER_CONNECTION_KEY: self.builder}
        result = await machine.run(INSTALLER, BuildFrontendAction(), BuildParams(version_id=VERSION), connections)
        await storage.close()
        return str(result.state)

    def written(self) -> list[tuple[Any, ...]]:
        """The builds written, in order: (state, image, error)."""
        return [(p[3], p[4], p[5]) for q, p in self.connection.statements if q.startswith("INSERT INTO plugin_build")]


async def test_a_version_is_built_from_its_wheels_sources_and_its_image_kept(tmp_path: Path) -> None:
    world = World(tmp_path)
    assert await world.run() == "built"
    assert world.builder.built == [("notes_0_4_0", ["app/page.tsx", "package-lock.json", "package.json"])]
    assert world.written() == [
        ("building", None, None),
        ("built", f"maxitor-plugin/notes_0_4_0-frontend:{world.sha[:12]}-9.9.9", None),
    ]


async def test_a_build_that_fails_keeps_its_first_error(tmp_path: Path) -> None:
    world = World(tmp_path, builder=PretendBuilderController(tmp_path / "builds", fails="./app/page.tsx:3:7 Type error: Cannot find name 'x'."))
    assert await world.run() == "failed"
    assert world.written() == [("building", None, None), ("failed", None, "./app/page.tsx:3:7 Type error: Cannot find name 'x'.")]


async def test_a_version_built_for_this_core_is_left_alone(tmp_path: Path) -> None:
    world = World(tmp_path, found={"id": "b1", "state": "built"})
    assert await world.run() == "built"
    assert world.builder.built == [] and world.written() == []


async def test_a_failed_build_is_built_again_in_its_own_row(tmp_path: Path) -> None:
    world = World(tmp_path, found={"id": "b1", "state": "failed"})
    assert await world.run() == "built"
    ids = [p[0] for q, p in world.connection.statements if q.startswith("INSERT INTO plugin_build")]
    assert ids == ["b1", "b1"] and world.written()[-1][0] == "built"
