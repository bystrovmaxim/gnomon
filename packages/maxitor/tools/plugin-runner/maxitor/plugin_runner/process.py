# packages/maxitor/tools/plugin-runner/maxitor/plugin_runner/process.py
"""
The runner's process: its connections, built once from its settings, the lock that lets one runner work at a time,
and its loop.
"""

from __future__ import annotations

import asyncio
from typing import Any, cast

from maxitor.core.plugins.plugin_processes import PROCESSES_CONNECTION_KEY, PluginProcessesController
from maxitor.core.plugins.storage.plugin_runtime_storage import PluginRuntimeStorage
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from maxitor.core.plugins.storage.wheel_storage import WheelStorage
from maxitor.plugin_runner.loop import run_forever
from maxitor.plugin_runner.settings import RunnerSettings

from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.resources import PerCallConnection
from aoa.action_machine.resources.postgres import PostgresPool
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine

#: The advisory lock one runner holds while it works.
RUNNER_LOCK = "plugin-runner"


def connections_of(settings: RunnerSettings, pool: PostgresPool) -> dict[str, Any]:
    """The runner's connections, declared in place."""
    return {
        PLUGINS_CONNECTION_KEY: PerCallConnection(
            factory=lambda: PluginsStorage(pool=pool),
            finalize=lambda storage: cast(PluginsStorage, storage).close(),
        ),
        PROCESSES_CONNECTION_KEY: PluginProcessesController(
            PluginRuntimeStorage(settings.runtime, settings.dsn),
            WheelStorage(settings.wheel_store),
            jwks_url=settings.jwks_url,
            gateway_url=settings.gateway_url,
            find_links=settings.find_links,
        ),
    }


async def hold_the_lock(settings: RunnerSettings) -> PluginsStorage:
    """A storage of its own holding the runner's lock; waits while another runner holds it."""
    holder = PluginsStorage(connection_params=settings.dsn)
    await holder.open()
    while not await holder.try_hold(RUNNER_LOCK):
        await asyncio.sleep(settings.period_seconds)
    return holder


async def run(settings: RunnerSettings | None = None) -> None:
    """Take the lock, open the pool and run the loop until the process is stopped."""
    settings = settings or RunnerSettings.from_environment()
    holder = await hold_the_lock(settings)
    try:
        machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
        async with PostgresPool(settings.dsn, min_size=1, max_size=4) as pool:
            await run_forever(machine, connections_of(settings, pool), settings.period_seconds)
    finally:
        await holder.close()
