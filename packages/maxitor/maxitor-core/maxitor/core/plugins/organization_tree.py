# packages/maxitor/maxitor-core/maxitor/core/plugins/organization_tree.py
"""
An organization's tree (spec 077, R3 and R4): the core's nodes and the nodes of the plugin versions enabled in it,
joined by the tree builder in dependency order. Installing and enabling a plugin build it with that plugin added and
refuse when it would not hold; the tree action builds it as it is.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import Any

from maxitor.core.plugins.storage.plugins_storage import PluginsStorage
from maxitor.core.plugins.tree_builder import Node, PluginFile, build_tree, core_nodes


def node_from_row(owner: str, row: Mapping[str, Any]) -> Node:
    """A node as ``PluginsStorage.nodes`` reads it."""
    return Node(
        full_name=str(row["full_name"]),
        owner=owner,
        parent=str(row["parent"]),
        position=int(row["position"]),
        order=int(row["node_order"]),
        title=row["title"],
        icon=row["icon"],
        page=row["page"],
        each_source=row["each_source"],
        each_key=row["each_key"],
        roles=tuple(row["roles"] or ()),
        room=None if row["room"] is None else json.loads(row["room"]),
    )


def dependency_order(plugins: Sequence[Mapping[str, Any]], needs: Mapping[str, set[str]]) -> list[Mapping[str, Any]]:
    """The plugins with each one's dependencies before it; among equals by name."""
    remaining = sorted(plugins, key=lambda p: str(p["name"]))
    placed: list[Mapping[str, Any]] = []
    done: set[str] = set()
    while remaining:
        ready = [p for p in remaining if needs.get(str(p["passport_id"]), set()) <= done]
        # A cycle never reaches an organization (the installer refuses it); if one did, the rest keep their names' order.
        step = ready[0] if ready else remaining[0]
        placed.append(step)
        done.add(str(step["passport_id"]))
        remaining.remove(step)
    return placed


async def organization_tree(
    store: PluginsStorage, organization_id: str, adding: Mapping[str, Any] | None = None
) -> tuple[list[Node], list[PluginFile]]:
    """
    The organization's tree and its plugins in dependency order, each with its direct dependencies; raise
    ``TreeRefusedError``.

    ``adding`` is a plugin about to be installed or enabled (``passport_id``, ``name``, ``version_id``): the tree is
    built with it, so a plugin that would break the tree is refused before anyone sees it.
    """
    enabled: list[Mapping[str, Any]] = list(await store.enabled_plugins(organization_id))
    if adding is not None and all(p["passport_id"] != adding["passport_id"] for p in enabled):
        enabled.append(adding)
    versions = [str(p["version_id"]) for p in enabled]
    name_of = {str(p["passport_id"]): str(p["name"]) for p in enabled}
    owner_of = {str(p["version_id"]): str(p["name"]) for p in enabled}
    needs: dict[str, set[str]] = {}
    passport_of = {str(p["version_id"]): str(p["passport_id"]) for p in enabled}
    for dependency in await store.dependencies(versions):
        needs.setdefault(passport_of[str(dependency["version_id"])], set()).add(str(dependency["passport_id"]))
    rows: dict[str, list[Node]] = {}
    for row in await store.nodes(versions):
        version = str(row["version_id"])
        rows.setdefault(version, []).append(node_from_row(owner_of[version], row))
    ordered = dependency_order(enabled, needs)
    files = [
        PluginFile(
            owner=str(p["name"]),
            dependencies=frozenset(name_of[d] for d in needs.get(str(p["passport_id"]), set()) if d in name_of),
            nodes=rows.get(str(p["version_id"]), []),
        )
        for p in ordered
    ]
    return build_tree(list(core_nodes()), files), files
