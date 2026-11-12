# packages/maxitor/tools/plugin-installer/maxitor/plugin_installer/process.py
"""
The installer's process: its connections, built once from its settings, and its loop.

Every connection is declared here in place: the installer's storage per call from one pool as maxitor_installer,
the wheel store and the environment files over their directories, the frontends' builds over Docker.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from maxitor.core.plugins.actions.add_marketplace_version_action import AddMarketplaceVersionAction, AddVersionParams
from maxitor.core.plugins.frontend_builder import BUILDER_CONNECTION_KEY, FrontendBuilderController
from maxitor.core.plugins.gateways.wheel_source_gateway import WHEEL_SOURCE_CONNECTION_KEY, WheelSourceGateway
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage
from maxitor.core.plugins.storage.plugin_runtime_storage import RUNTIME_CONNECTION_KEY, PluginRuntimeStorage
from maxitor.core.plugins.storage.wheel_storage import WHEELS_CONNECTION_KEY, WheelStorage
from maxitor.core.plugins.wheel import read_wheel
from maxitor.core.schemas import CoreSchemas
from maxitor.plugin_installer.loop import run_action, run_forever
from maxitor.plugin_installer.settings import InstallerSettings
from packageurl import PackageURL

from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.resources import PerCallConnection
from aoa.action_machine.resources.postgres import PostgresPool
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine


def connections_of(settings: InstallerSettings, pool: PostgresPool) -> dict[str, Any]:
    """The installer's connections, declared in place."""
    return {
        DEPLOY_CONNECTION_KEY: PerCallConnection(
            factory=lambda: DeployStorage(pool=pool, schemas=CoreSchemas.from_environment()),
            finalize=lambda storage: cast(DeployStorage, storage).close(),
        ),
        WHEELS_CONNECTION_KEY: WheelStorage(settings.wheel_store, settings.wheel_max_bytes),
        RUNTIME_CONNECTION_KEY: PluginRuntimeStorage(settings.runtime, settings.dsn),
        WHEEL_SOURCE_CONNECTION_KEY: WheelSourceGateway(settings.wheel_max_bytes, settings.wheel_timeout_seconds),
        BUILDER_CONNECTION_KEY: FrontendBuilderController(settings.builds),
    }


async def run(settings: InstallerSettings | None = None) -> None:
    """Open the pool and run the loop until the process is stopped."""
    settings = settings or InstallerSettings.from_environment()
    machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
    async with PostgresPool(settings.dsn, min_size=1, max_size=4) as pool:
        await run_forever(machine, connections_of(settings, pool), settings.period_seconds)


async def add_version(purl: str, sha256: str, settings: InstallerSettings | None = None) -> str:
    """Add a public version to the marketplace; the loop checks it on its next round. Answer the version's id."""
    settings = settings or InstallerSettings.from_environment()
    machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
    async with PostgresPool(settings.dsn, min_size=1, max_size=1) as pool:
        result = await run_action(
            machine, connections_of(settings, pool), AddMarketplaceVersionAction(), AddVersionParams(purl=purl, sha256=sha256)
        )
    return str(result.version_id)


async def add_wheel(path: Path, settings: InstallerSettings | None = None) -> str:
    """Keep a wheel at hand in the store and add it to the marketplace as pkg:generic. Answer the version's id."""
    settings = settings or InstallerSettings.from_environment()
    data = path.read_bytes()
    contents = read_wheel(data)
    sha256 = WheelStorage(settings.wheel_store, settings.wheel_max_bytes).put(data)
    purl = PackageURL(
        type="generic", name=contents.dist_name, version=contents.dist_version, qualifiers={"checksum": f"sha256:{sha256}"}
    ).to_string()
    return await add_version(purl, sha256, settings)
