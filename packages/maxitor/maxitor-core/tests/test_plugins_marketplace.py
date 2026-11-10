# packages/maxitor/maxitor-core/tests/test_plugins_marketplace.py
"""The operator fills the marketplace: a public version waits in draft under a plugin of no owner; only PyPI or a
wheel kept in the store is taken."""

from __future__ import annotations

from typing import Any

import pytest
from maxitor.core.plugins.actions.add_marketplace_version_action import AddMarketplaceVersionAction, AddVersionParams
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage

from aoa.action_machine.context.context import Context
from aoa.action_machine.context.user_info import UserInfo
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine
from tests.recording_database import recording_pool

SHA = "a" * 64
INSTALLER = Context(user=UserInfo(user_id="plugin-installer", roles=(InstallerRole,)))


async def _run(purl: str) -> tuple[Any, list[tuple[str, tuple[Any, ...]]]]:
    pool, connection = recording_pool(lambda q, p: None)
    storage = DeployStorage(pool=pool)
    await storage.open()
    machine = ActionProductMachine(graph_coordinator=create_node_graph_coordinator())
    try:
        result = await machine.run(INSTALLER, AddMarketplaceVersionAction(), AddVersionParams(purl=purl, sha256=SHA), {DEPLOY_CONNECTION_KEY: storage})
    finally:
        await storage.close()
    return result, connection.statements


async def test_a_public_version_waits_under_a_plugin_of_no_owner() -> None:
    result, statements = await _run("pkg:pypi/maxitor-notes@0.4.0")
    plugin = next(p for q, p in statements if q.startswith("INSERT INTO plugin ("))
    version = next(p for q, p in statements if q.startswith("INSERT INTO plugin_version ("))
    assert plugin[1] == f"pending.{result.version_id}" and plugin[5] is None  # no owner: public
    assert version[2:7] == ("0.4.0", "pkg:pypi/maxitor-notes@0.4.0", SHA, None, "draft")


@pytest.mark.parametrize("purl", ["pkg:github/acme/n@v1?file=n.whl", "pkg:npm/n@1.0.0", "pkg:pypi/n"])
async def test_only_pypi_or_a_kept_wheel_is_taken(purl: str) -> None:
    with pytest.raises(ValueError):
        await _run(purl)
