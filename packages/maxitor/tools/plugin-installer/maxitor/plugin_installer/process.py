# packages/maxitor/tools/plugin-installer/maxitor/plugin_installer/process.py
"""
The installer's process: its connections, built once from its settings, and its loop.

Every connection is declared here in place: the installer's storage per call from one pool as maxitor_installer,
the wheel store and the environment files over their directories.
"""

from __future__ import annotations

from typing import Any, cast

from maxitor.core.plugins.gateways.wheel_source_gateway import WHEEL_SOURCE_CONNECTION_KEY, WheelSourceGateway
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage
from maxitor.core.plugins.storage.plugin_runtime_storage import RUNTIME_CONNECTION_KEY, PluginRuntimeStorage
from maxitor.core.plugins.storage.wheel_storage import WHEELS_CONNECTION_KEY, WheelStorage
from maxitor.core.schemas import CoreSchemas
from maxitor.plugin_installer.loop import run_forever
from maxitor.plugin_installer.settings import InstallerSettings

from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.resources import PerCallConnection
from aoa.action_machine.resources.postgres import PostgresPool
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine


async def run(settings: InstallerSettings | None = None) -> None:
    """Open the pool and run the loop until the process is stopped."""
    settings = settings or InstallerSettings.from_environment()
    machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
    async with PostgresPool(settings.dsn, min_size=1, max_size=4) as pool:
        connections: dict[str, Any] = {
            DEPLOY_CONNECTION_KEY: PerCallConnection(
                factory=lambda: DeployStorage(pool=pool, schemas=CoreSchemas.from_environment()),
                finalize=lambda storage: cast(DeployStorage, storage).close(),
            ),
            WHEELS_CONNECTION_KEY: WheelStorage(settings.wheel_store),
            RUNTIME_CONNECTION_KEY: PluginRuntimeStorage(settings.runtime, settings.dsn),
            WHEEL_SOURCE_CONNECTION_KEY: WheelSourceGateway(settings.wheel_max_bytes, settings.wheel_timeout_seconds),
        }
        await run_forever(machine, connections, settings.period_seconds)
