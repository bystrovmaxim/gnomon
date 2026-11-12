# packages/maxitor/maxitor-core/tests/test_frontend_generation.py
"""
Upgrading the core: the site serves the frontend builds of one core version; the upgrade round answers what the
running core version still lacks and moves the site, every enabled version at once, only when nothing is missing or
failed; a disabled version stops holding the move; a failed build is built again after an hour.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from maxitor.core.plugins.actions.move_frontend_generation_action import MoveFrontendGenerationAction, MoveParams
from maxitor.core.plugins.frontend_builder import core_version
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage

from aoa.action_machine.context.context import Context
from aoa.action_machine.context.user_info import UserInfo
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine
from tests.recording_database import recording_pool

INSTALLER = Context(user=UserInfo(user_id="plugin-installer", roles=(InstallerRole,)))
OLD = "4.4.0"
LONG_AGO = datetime(2026, 1, 1, tzinfo=UTC)


def build(state: str, finished_at: datetime | None = None) -> dict[str, Any]:
    return {"state": state, "finished_at": finished_at or datetime.now(UTC)}


class World:
    """The installer's storage over a recording database: a generation, enabled versions and their builds."""

    def __init__(self, generation: dict[str, Any] | None, builds: dict[str, dict[str, Any] | None]) -> None:
        self.generation, self.builds = generation, builds
        self.pool, self.connection = recording_pool(self.answer)

    def answer(self, query: str, params: tuple[Any, ...]) -> Any:
        if "FROM frontend_generation" in query:
            return self.generation
        if "FROM plugin_version v JOIN plugin p" in query and "EXISTS" in query:
            return [{"version_id": version_id} for version_id in self.builds]
        if "FROM plugin_build" in query:
            return self.builds[params[0]]
        return None

    async def run(self) -> Any:
        storage = DeployStorage(pool=self.pool)
        await storage.open()
        machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
        result = await machine.run(INSTALLER, MoveFrontendGenerationAction(), MoveParams(), {DEPLOY_CONNECTION_KEY: storage})
        await storage.close()
        return result

    def generations(self) -> list[tuple[Any, ...]]:
        """The generation rows written, in order: (serving, target)."""
        return [p[:2] for q, p in self.connection.statements if q.startswith("INSERT INTO frontend_generation")]


async def test_the_first_round_serves_the_running_core_and_builds_what_it_lacks() -> None:
    world = World(None, {"v1": None, "v2": build("built")})
    result = await world.run()
    assert (result.state, result.to_build) == ("serving", ["v1"])
    assert world.generations() == [(core_version(), None)]


async def test_an_upgrade_waits_while_a_build_is_missing_and_names_it() -> None:
    world = World({"serving_core_version": OLD, "target_core_version": None, "moved_at": LONG_AGO}, {"v1": None, "v2": build("built")})
    result = await world.run()
    assert (result.state, result.to_build) == ("waiting", ["v1"])
    assert world.generations() == [(OLD, core_version())]


async def test_a_failed_build_holds_the_move_and_is_built_again_after_an_hour() -> None:
    generation = {"serving_core_version": OLD, "target_core_version": core_version(), "moved_at": LONG_AGO}
    fresh = await World(generation, {"v1": build("failed"), "v2": build("built")}).run()
    assert (fresh.state, fresh.to_build) == ("waiting", [])
    stale = await World(generation, {"v1": build("failed", LONG_AGO), "v2": build("built")}).run()
    assert (stale.state, stale.to_build) == ("waiting", ["v1"])


async def test_the_move_switches_every_enabled_version_at_once_when_all_are_built() -> None:
    world = World({"serving_core_version": OLD, "target_core_version": core_version(), "moved_at": LONG_AGO}, {"v1": build("built"), "v2": build("built")})
    result = await world.run()
    assert (result.state, result.to_build) == ("moved", [])
    assert world.generations() == [(core_version(), None)]
    assert "SELECT pg_advisory_xact_lock(hashtext($1))" in world.connection.queries()


async def test_a_disabled_version_no_longer_holds_the_move() -> None:
    # v1 failed and was disabled everywhere: it is not among the enabled versions any more.
    world = World({"serving_core_version": OLD, "target_core_version": core_version(), "moved_at": LONG_AGO}, {"v2": build("built")})
    assert (await world.run()).state == "moved"


async def test_no_upgrade_when_the_core_is_the_one_served() -> None:
    world = World({"serving_core_version": core_version(), "target_core_version": None, "moved_at": LONG_AGO}, {"v1": build("built")})
    result = await world.run()
    assert (result.state, result.to_build) == ("serving", []) and world.generations() == []
