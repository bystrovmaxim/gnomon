# packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/checks.py
"""
What Maxitor checks in one plugin before installing it, as far as the plugin's own files show it: each file
against its schema, and the rules across fields a schema cannot express.

Whether a plugin fits a core and the other plugins is ``compat``'s; a check that needs Maxitor itself — the tree
of Maxitor's own nodes, the database catalog — stays with the installer.

Run from a plugin's folder::

    python -m maxitor_plugin_sdk.checks .
"""

from __future__ import annotations

import json
import re
import sys
import tomllib
from collections.abc import Iterable, Iterator, Mapping
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator

from maxitor_plugin_sdk.plugin_schema import PluginSchemaError, read_plugin_schema

SCHEMAS = Path(__file__).parent / "schemas"
PASSPORT_FILE = "maxitor-plugin.yaml"
# A plugin's YAML is read before anything is installed; a larger file is refused unread.
MAX_YAML_BYTES = 64 * 1024
PLACEHOLDER = re.compile(r"\{([a-z][a-z0-9_]*)\}")


def check_plugin(root: Path) -> list[str]:
    """Return every problem found in the plugin whose ``pyproject.toml`` lies in ``root``; empty when there is none."""
    return read_plugin(root)[1]


def read_plugin(root: Path) -> tuple[dict[str, Any] | None, list[str]]:
    """
    The plugin's passport and every problem of its files.

    The passport is answered when it keeps its schema, so a caller can still name the plugin; the problems list
    every file's.
    """
    problems: list[str] = []
    package = _package_folder(root, problems)
    if package is None:
        return None, problems
    passport = _read(package / PASSPORT_FILE, "plugin-passport-2", problems)
    if passport is None:
        return None, problems
    _check_version(root, passport, problems)
    navigation = _read(package.parent / passport["frontend"]["navigation"], "navigation-1", problems)
    if navigation is not None:
        problems.extend(navigation_problems(navigation))
    schema_file = passport.get("database", {}).get("schema")
    if schema_file is not None:
        problems.extend(_schema_problems(package.parent / schema_file))
    keys_file = passport.get("database", {}).get("foreign_keys")
    if keys_file is not None:
        keys = _read(package.parent / keys_file, "foreign-keys-1", problems)
        if keys is not None:
            problems.extend(foreign_key_problems(keys, own_schema=passport["name"]))
    return {**passport, "formats": _formats(passport, navigation, keys_file, schema_file)}, problems


def _schema_problems(path: Path) -> list[str]:
    """Every fault of the plugin's schema.yaml: Maxitor builds its tables only from a file that keeps every rule."""
    if not path.is_file():
        return [f"{path.name}: the file the passport's database.schema names is missing"]
    try:
        read_plugin_schema(path)
    except PluginSchemaError as error:
        return [f"{path.name}: {problem}" for problem in error.problems]
    return []


def _formats(
    passport: Mapping[str, Any], navigation: Mapping[str, Any] | None, keys_file: object, schema_file: object
) -> dict[str, int]:
    """
    The format of each of the plugin's files Maxitor reads.

    The passport, navigation.yaml and schema.yaml name their format; foreign-keys.yaml names none and is read by the
    one schema there is, format 1.
    """
    formats = {"plugin-passport": int(passport["passport"])}
    if schema_file is not None:
        formats["plugin-schema"] = 1
    if navigation is not None:
        formats["navigation"] = int(navigation["navigation"])
    if keys_file is not None:
        formats["foreign-keys"] = 1
    return formats


def find_cycle(dependencies: Mapping[str, Iterable[str]]) -> list[str] | None:
    """
    Return one dependency cycle as a closed path ``[a, b, a]``, or ``None`` when the graph has none.

    ``dependencies`` maps a plugin id to the ids it depends on; an id that is only depended on needs no entry.
    """
    edges = {plugin: sorted(set(needed)) for plugin, needed in dependencies.items()}
    state: dict[str, str] = {}
    path: list[str] = []

    def visit(plugin: str) -> list[str] | None:
        state[plugin] = "open"
        path.append(plugin)
        for needed in edges.get(plugin, []):
            if state.get(needed) == "open":
                return [*path[path.index(needed) :], needed]
            if needed not in state:
                cycle = visit(needed)
                if cycle is not None:
                    return cycle
        path.pop()
        state[plugin] = "done"
        return None

    for plugin in sorted(edges):
        if plugin not in state:
            cycle = visit(plugin)
            if cycle is not None:
                return cycle
    return None


def navigation_problems(navigation: Mapping[str, Any]) -> list[str]:
    """Rules of ``navigation.yaml`` across nodes, which a schema cannot express."""
    problems: list[str] = []
    seen_ids: set[str] = set()
    seen_pages: dict[str, str] = {}
    for node, scope in _walk(navigation["nodes"]):
        node_id = node["id"]
        if node_id in seen_ids:
            problems.append(f"navigation: the id {node_id!r} is used twice")
        seen_ids.add(node_id)
        each = node.get("each")
        if each is not None and scope is not None and each["key"] in scope:
            problems.append(
                f"navigation: {node_id!r} defines {each['key']!r}, which a list node above it already defines"
            )
        # A list node's own page belongs to one instance, so it already sees the key that instance adds.
        page_scope = scope if each is None or scope is None else scope | {each["key"]}
        path_params = frozenset(PLACEHOLDER.findall(node.get("page", "")))
        problems.extend(_control_problems(node_id, node.get("controls", {}), path_params))
        page = node.get("page")
        if page is not None:
            # Parameter names do not matter for telling two addresses apart: /items/{a} and /items/{b} are one address.
            shape = PLACEHOLDER.sub("{}", page)
            if shape in seen_pages:
                problems.append(f"navigation: {node_id!r} and {seen_pages[shape]!r} open the same page {page!r}")
            seen_pages[shape] = node_id
            if page_scope is not None:
                for name in PLACEHOLDER.findall(page):
                    if name not in page_scope:
                        problems.append(
                            f"navigation: {node_id!r} uses {{{name}}}, which neither it nor a list node above it defines"
                        )
    return problems


def _control_problems(node_id: str, controls: Mapping[str, Any], path_params: frozenset[str]) -> list[str]:
    """A control's parameter is its own on the page, and a default is one of the control's options."""
    problems: list[str] = []
    seen: set[str] = set()
    choices = [controls[kind] for kind in ("mode", "views") if kind in controls]
    for control in [*choices, *controls.get("filters", [])]:
        param = control["param"]
        if param in seen:
            problems.append(f"navigation: {node_id!r} has two controls on the parameter {param!r}")
        seen.add(param)
        if param in path_params:
            problems.append(f"navigation: {node_id!r} has a control on {param!r}, which is a parameter of its path")
    for control in choices:
        if control["default"] not in {option["value"] for option in control["options"]}:
            problems.append(
                f"navigation: {node_id!r}: the default {control['default']!r} of {control['param']!r} is not one of its options"
            )
    return problems


def foreign_key_problems(keys: Mapping[str, Any], own_schema: str) -> list[str]:
    """Rules of ``foreign-keys.yaml`` across fields, which a schema cannot express."""
    problems: list[str] = []
    for number, key in enumerate(keys["foreign_keys"], start=1):
        if key["to"]["schema"] == own_schema:
            problems.append(f"foreign key {number}: a key inside the plugin's own schema belongs to its schema.yaml")
        if len(key["from"]["columns"]) != len(key["to"]["columns"]):
            problems.append(
                f"foreign key {number}: {len(key['from']['columns'])} columns refer to {len(key['to']['columns'])}"
            )
    return problems


def _walk(
    nodes: Iterable[Mapping[str, Any]], scope: frozenset[str] | None = None
) -> Iterator[tuple[Mapping[str, Any], frozenset[str] | None]]:
    """
    Every node with the parameters in scope at its place.

    A node attached to the root starts with an empty scope. A node attached to a node of Maxitor or of a
    dependency starts with a scope only the installer knows; its parameters are not checked here (``None``).
    """
    for node in nodes:
        start = scope
        if "attach" in node:
            start = frozenset() if node["attach"] == "root" else None
        yield node, start
        each = node.get("each")
        inner = start if each is None or start is None else start | {each["key"]}
        yield from _walk(node.get("children", []), inner)


def _package_folder(root: Path, problems: list[str]) -> Path | None:
    """The folder of the Python package holding the passport: ``src/<package>/maxitor-plugin.yaml``."""
    found = sorted(path.parent for path in (root / "src").glob(f"*/{PASSPORT_FILE}"))
    if len(found) != 1:
        problems.append(f"expected one src/<package>/{PASSPORT_FILE}, found {len(found)}")
        return None
    return found[0]


def _read(path: Path, schema: str, problems: list[str]) -> dict[str, Any] | None:
    """Read a YAML file safely and check it against its schema; ``None`` and the reasons in ``problems`` if it fails."""
    name = path.name
    if not path.is_file():
        problems.append(f"{name}: no such file")
        return None
    if path.stat().st_size > MAX_YAML_BYTES:
        problems.append(f"{name}: larger than {MAX_YAML_BYTES} bytes")
        return None
    try:
        document = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as unreadable:
        problems.append(f"{name}: not YAML ({unreadable.__class__.__name__})")
        return None
    validator = Draft202012Validator(json.loads((SCHEMAS / f"{schema}.schema.json").read_text(encoding="utf-8")))
    errors = sorted(validator.iter_errors(document), key=lambda error: list(error.absolute_path))
    for error in errors:
        where = "/".join(str(part) for part in error.absolute_path) or "(top)"
        problems.append(f"{name}: {where}: {error.message}")
    return None if errors or not isinstance(document, dict) else document


def _check_version(root: Path, passport: Mapping[str, Any], problems: list[str]) -> None:
    """The passport's version is the package's version."""
    project = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))["project"]
    if project["version"] != passport["version"]:
        problems.append(
            f"{PASSPORT_FILE}: version {passport['version']} differs from pyproject.toml's {project['version']}"
        )


def main(argv: list[str] | None = None) -> int:
    """Check the plugin in the folder given (the current one by default); print each problem; 0 when there is none."""
    arguments = sys.argv[1:] if argv is None else argv
    problems = check_plugin(Path(arguments[0] if arguments else "."))
    for problem in problems:
        print(problem)
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
