# packages/maxitor/maxitor-core/maxitor/core/plugins/tree_builder.py
"""
The tree builder (spec 077, the plugin concept 7.3): the core's navigation.yaml and the enabled plugins' files joined
into one tree, or a refusal that says why.

::

    one version's file ──► nodes_of ──► every node with its full name and the node it stands under
                           check_version ──► the rules one file shows: attachments to the core, sources, schema
    an organization's set ──► build_tree ──► attachments found, only to the core or a direct dependency,
                                              every parameter defined in the scope, no list key twice in a line

A failed build raises ``TreeRefusedError``; the operation that asked for it is cancelled and the tree in force stays.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field, replace
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator
from maxitor_plugin_sdk.checks import PLACEHOLDER, SCHEMAS, navigation_problems, source_problems

#: The core's own file.
CORE_NAVIGATION = Path(__file__).resolve().parents[1] / "navigation.yaml"
#: The owner name of the core's nodes.
CORE = "core"
#: The parent of a node attached to the root of the tree.
ROOT = "root"


class TreeRefusedError(ValueError):
    """The tree would not hold; ``reason`` says why in words."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class Node:
    """One node of the tree as one file declares it, with its full name and the node it stands under."""

    full_name: str
    owner: str
    parent: str
    position: int
    order: int
    title: str | None
    icon: str | None
    page: str | None
    each_source: str | None
    each_key: str | None
    roles: tuple[str, ...]
    controls: Mapping[str, Any] | None
    room: Mapping[str, Any] | None
    #: The parameters the list nodes above it define, set by ``build_tree``: every node beneath a list node sees its key.
    scope: tuple[str, ...] = field(default=())


@dataclass(frozen=True)
class PluginFile:
    """One enabled plugin's nodes, its name and the names of its direct dependencies."""

    owner: str
    dependencies: frozenset[str]
    nodes: Sequence[Node]


def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads((SCHEMAS / "navigation-1.schema.json").read_text(encoding="utf-8")))


def _walk(
    owner: str, nodes: Iterable[Mapping[str, Any]], parent: str | None
) -> Iterator[tuple[Mapping[str, Any], str]]:
    """Every node of a file after its parent, with the full name of the node it stands under."""
    for node in nodes:
        attach = node.get("attach")
        here = str(attach) if attach is not None else parent
        yield node, here if here is not None else ROOT
        yield from _walk(owner, node.get("children", []), f"{owner}:{node['id']}")


def nodes_of(owner: str, navigation: Mapping[str, Any]) -> list[Node]:
    """Every node of one file, each after its parent, with its full name and the node it stands under."""
    found: list[Node] = []
    for position, (node, parent) in enumerate(_walk(owner, navigation.get("nodes") or [], None), start=1):
        each = node.get("each")
        found.append(
            Node(
                full_name=f"{owner}:{node['id']}",
                owner=owner,
                parent=parent,
                position=position,
                order=int(node.get("order", 0)),
                title=node.get("title"),
                icon=node.get("icon"),
                page=node.get("page"),
                each_source=None if each is None else str(each["source"]),
                each_key=None if each is None else str(each["key"]),
                roles=tuple(node.get("roles", [])),
                controls=node.get("controls"),
                room=node.get("room"),
            )
        )
    return found


def _one_file(owner: str, navigation: Any) -> list[str]:
    if not isinstance(navigation, Mapping):
        return ["navigation: the file is not a mapping"]
    problems = [f"navigation: {error.message}" for error in _validator().iter_errors(navigation)]
    return problems or navigation_problems(navigation)


@lru_cache(maxsize=1)
def core_nodes() -> tuple[Node, ...]:
    """The core's own nodes, read and checked once; raise ``TreeRefusedError`` when its file does not hold."""
    navigation = yaml.safe_load(CORE_NAVIGATION.read_text(encoding="utf-8"))
    problems = _one_file(CORE, navigation)
    if problems:
        raise TreeRefusedError(f"the core's {problems[0]}")
    return tuple(build_tree(nodes_of(CORE, navigation), []))


def check_version(owner: str, navigation: Any, actions: Iterable[str]) -> list[Node]:
    """
    The nodes of one version's file, when every rule one file shows holds; raise ``TreeRefusedError`` otherwise.

    A node attached to the core must find its node there; one attached to a dependency is checked when an
    organization installs or enables the version, against the dependency it has.
    """
    problems = _one_file(owner, navigation)
    if not problems:
        problems = source_problems(navigation, actions)
    if problems:
        raise TreeRefusedError(problems[0])
    nodes = nodes_of(owner, navigation)
    core = {node.full_name for node in core_nodes()}
    for node in nodes:
        if node.parent.startswith(f"{CORE}:") and node.parent not in core:
            raise TreeRefusedError(
                f"navigation: {node.full_name!r} attaches to {node.parent!r}, which the core does not have"
            )
        if (
            node.parent.startswith(f"{owner}:")
            and node.parent != node.full_name
            and not any(n.full_name == node.parent for n in nodes)
        ):
            raise TreeRefusedError(
                f"navigation: {node.full_name!r} attaches to {node.parent!r}, which its own file does not have"
            )
    return nodes


def build_tree(core: Sequence[Node], plugins: Sequence[PluginFile]) -> list[Node]:
    """
    The tree of the core's nodes and the plugins' nodes, each node with its whole scope; raise ``TreeRefusedError``.

    ``plugins`` come in dependency order: a plugin's dependencies before it.
    """
    built: dict[str, Node] = {}
    for owner, dependencies, nodes in [
        (CORE, frozenset[str](), core),
        *((p.owner, p.dependencies, p.nodes) for p in plugins),
    ]:
        for node in nodes:
            if node.full_name in built:
                raise TreeRefusedError(f"navigation: two nodes are named {node.full_name!r}")
            attached = node.parent.partition(":")[0]
            if node.parent != ROOT and attached != owner:
                if attached != CORE and attached not in dependencies:
                    raise TreeRefusedError(
                        f"navigation: {node.full_name!r} attaches to {node.parent!r}; a plugin attaches only to the core"
                        " or to a direct dependency"
                    )
                if node.parent not in built:
                    raise TreeRefusedError(
                        f"navigation: {node.full_name!r} attaches to {node.parent!r}, which does not exist"
                    )
            parent = built.get(node.parent)
            scope = () if parent is None else (*parent.scope, *((parent.each_key,) if parent.each_key else ()))
            if node.each_key is not None and node.each_key in scope:
                raise TreeRefusedError(
                    f"navigation: {node.full_name!r} defines {node.each_key!r}, which a list node above it already defines"
                )
            own = (*scope, *((node.each_key,) if node.each_key else ()))
            for name in PLACEHOLDER.findall(node.page or ""):
                if name not in own:
                    raise TreeRefusedError(
                        f"navigation: {node.full_name!r} uses {{{name}}}, which nothing above it defines"
                    )
            built[node.full_name] = replace(node, scope=scope)
    _check_pages(built.values())
    return list(built.values())


def _check_pages(nodes: Iterable[Node]) -> None:
    """An address points at one node: two nodes of one owner never open the same page template."""
    seen: dict[tuple[str, str], str] = {}
    for node in nodes:
        if node.page is None:
            continue
        shape = (node.owner, PLACEHOLDER.sub("{}", node.page))
        if shape in seen:
            raise TreeRefusedError(
                f"navigation: {node.full_name!r} and {seen[shape]!r} open the same page {node.page!r}"
            )
        seen[shape] = node.full_name


def visible(nodes: Sequence[Node], roles: frozenset[str]) -> list[Node]:
    """The nodes a person with ``roles`` sees: a node asks for any of its roles, and a hidden node hides its branch."""
    by_name = {node.full_name: node for node in nodes}

    def sees(node: Node) -> bool:
        if node.roles and not roles.intersection(node.roles):
            return False
        parent = by_name.get(node.parent)
        return parent is None or sees(parent)

    shown = [node for node in nodes if sees(node)]
    names = {node.full_name for node in shown}

    # A parent with no visible child and no page is hidden; a list node counts as visible, its records come later.
    def keeps(node: Node) -> bool:
        if node.page is not None or node.each_source is not None:
            return True
        return any(keeps(child) for child in shown if child.parent == node.full_name)

    return [node for node in shown if keeps(node) and (node.parent == ROOT or node.parent in names)]
