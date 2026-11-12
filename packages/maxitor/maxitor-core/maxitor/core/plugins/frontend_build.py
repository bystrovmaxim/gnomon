# packages/maxitor/maxitor-core/maxitor/core/plugins/frontend_build.py
"""
The checks a plugin's frontend sources pass before the core builds them, and the copy the build runs on.

::

    prepare(source, work)       copy the sources, check the lock, point @maxitor/* at the core's copy, check the list

The core builds every plugin's frontend with its own ``@maxitor/*`` packages, strictly by the plugin's lock file,
and lets npm download only the packages on its list. Everything here is a pure function over the plugin's
``package.json`` and ``package-lock.json``, except ``prepare``, which also copies files. The first check that fails
raises ``EnvironmentInstallError`` with a sentence naming what to fix; nothing of the plugin is run here.
"""

from __future__ import annotations

import json
import shutil
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any

from maxitor.core.plugins.plugin_processes import EnvironmentInstallError

#: The folder of the builder image's files: its Dockerfile and the npm list.
BUILDER = Path(__file__).resolve().parent / "builder"
#: The core's list of npm packages a plugin's frontend may install.
NPM_LIST = BUILDER / "npm-packages.txt"
#: Where the builder image keeps the core's ``@maxitor/*`` packages.
LIBRARY_IN_IMAGE = "/maxitor/lib"
#: The core's packages, by their npm name, and the folder each lives in, beside the others.
LIBRARY = {"@maxitor/panel": "maxitor-panel", "@maxitor/tokens": "maxitor-tokens"}
#: The only registry the lock may resolve packages from.
REGISTRY = "https://registry.npmjs.org/"
#: What the build never takes from the plugin's folder: installed packages, a past build, npm's own settings.
NOT_COPIED = ("node_modules", ".next", ".npmrc")
#: The sections of ``package.json`` that name packages to install.
SECTIONS = ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies")

PACKAGE = "package.json"
LOCK = "package-lock.json"


def library_root() -> Path:
    """
    The folder holding the core's ``@maxitor/*`` packages: ``builder/lib`` inside the ``maxitor`` wheel, which
    copies them there; the repository's ``packages/`` when the core runs from its checkout.
    """
    packed = BUILDER / "lib"
    if packed.is_dir():
        return packed
    return Path(__file__).resolve().parents[5]


def library_manifests(root: Path | None = None) -> dict[str, dict[str, Any]]:
    """The ``package.json`` of each of the core's packages, by its npm name."""
    base = root or library_root()
    return {name: json.loads((base / folder / PACKAGE).read_text(encoding="utf-8")) for name, folder in LIBRARY.items()}


def read_list(path: Path = NPM_LIST) -> frozenset[str]:
    """The names on the core's npm list: one per line, ``#`` lines skipped."""
    lines = path.read_text(encoding="utf-8").splitlines()
    return frozenset(line.strip() for line in lines if line.strip() and not line.startswith("#"))


def entry_name(path: str, entry: Mapping[str, Any]) -> str:
    """The package name of one lock entry: its ``name``, else the last folder after ``node_modules/``."""
    return str(entry.get("name") or path.rsplit("node_modules/", 1)[1])


def check_lock(package: dict[str, Any] | None, lock: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, Any]]:
    """``package.json`` and its lock, when the lock exists and its root entry asks for exactly what the package does."""
    root = ((lock or {}).get("packages") or {}).get("")
    if package is None or lock is None or root is None:
        raise EnvironmentInstallError("the lock file is missing or does not match package.json")
    for section in SECTIONS:
        if dict(package.get(section) or {}) != dict(root.get(section) or {}):
            raise EnvironmentInstallError("the lock file is missing or does not match package.json")
    return package, lock


def _link(name: str) -> str:
    return f"file:{LIBRARY_IN_IMAGE}/{LIBRARY[name]}"


def _library_names(package: Mapping[str, Any], lock: Mapping[str, Any], core_version: str) -> set[str]:
    """The ``@maxitor/*`` names the plugin asks for, each one of the core's; raise for any other."""
    asked = {name for section in SECTIONS for name in package.get(section) or {} if name.startswith("@maxitor/")}
    asked |= {
        entry_name(path, entry)
        for path, entry in (lock.get("packages") or {}).items()
        if "node_modules/" in path and entry_name(path, entry).startswith("@maxitor/")
    }
    for name in sorted(asked):
        if name not in LIBRARY:
            raise EnvironmentInstallError(f"{name} is not a package of the core {core_version}")
    return asked


def _with_library_dependencies(names: set[str], manifests: Mapping[str, Mapping[str, Any]]) -> set[str]:
    """The names asked for and every core package they need in turn: the panel brings the tokens."""
    found = set(names)
    pending = list(names)
    while pending:
        for dependency in manifests[pending.pop()].get("dependencies") or {}:
            if dependency in LIBRARY and dependency not in found:
                found.add(dependency)
                pending.append(dependency)
    return found


def rewrite(
    package: dict[str, Any], lock: dict[str, Any], manifests: Mapping[str, Mapping[str, Any]], core_version: str
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    ``package.json`` and its lock with every ``@maxitor/*`` entry pointed at the core's copy, and nothing else
    changed: each one the plugin names becomes a ``file:`` link to ``/maxitor/lib/<folder>``, each of its copies in
    the lock is replaced by the core's, and a nested copy is dropped, so the site has one library.
    """
    names = _library_names(package, lock, core_version)
    package = json.loads(json.dumps(package))
    lock = json.loads(json.dumps(lock))
    packages: dict[str, Any] = lock.setdefault("packages", {})
    for document in (package, packages.get("") or {}):
        for section in SECTIONS:
            for name in list((document.get(section) or {}).keys()):
                if name in LIBRARY:
                    document[section][name] = _link(name)
    top = {f"node_modules/{name}" for name in LIBRARY}
    for path in list(packages):
        folders = [segment.rstrip("/") for segment in path.split("node_modules/")[1:]]
        if path not in top and any(folder in LIBRARY for folder in folders):
            del packages[path]
    for name in sorted(_with_library_dependencies(names, manifests)):
        manifest = manifests[name]
        entry: dict[str, Any] = {"version": str(manifest["version"]), "resolved": _link(name)}
        for field in ("license", "dependencies", "peerDependencies"):
            if manifest.get(field):
                entry[field] = manifest[field]
        packages[f"node_modules/{name}"] = entry
    return package, lock


def check_names(lock: Mapping[str, Any], allowed: Iterable[str]) -> None:
    """Every package the lock installs, but the core's own, is on the list and downloaded from npm."""
    allowed = frozenset(allowed)
    for path, entry in sorted((lock.get("packages") or {}).items()):
        if "node_modules/" not in path:
            continue
        name = entry_name(path, entry)
        if name in LIBRARY or entry.get("inBundle"):
            continue
        if name not in allowed:
            raise EnvironmentInstallError(f"{name} is not on the core's list of npm packages")
        resolved = str(entry.get("resolved") or "")
        if entry.get("link") or not resolved.startswith(REGISTRY):
            raise EnvironmentInstallError(f"{name} is resolved from {_host(resolved)}, not from npm")


def _host(resolved: str) -> str:
    if not resolved:
        return "nowhere"
    if "://" in resolved:
        return resolved.split("://", 1)[1].split("/", 1)[0]
    return resolved


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return document if isinstance(document, dict) else None


def prepare(source: Path, work: Path, core_version: str, *, library: Path | None = None) -> None:
    """
    The copy of a frontend's sources the build runs on: ``source`` copied to ``work`` without ``node_modules``,
    ``.next`` and ``.npmrc``, the lock checked, ``@maxitor/*`` pointed at the core's copy and the names checked
    against the core's list. Raise ``EnvironmentInstallError`` at the first check that fails.
    """
    package, lock = check_lock(_read_json(source / PACKAGE), _read_json(source / LOCK))
    package, lock = rewrite(package, lock, library_manifests(library), core_version)
    check_names(lock, read_list())
    shutil.rmtree(work, ignore_errors=True)
    shutil.copytree(source, work, ignore=shutil.ignore_patterns(*NOT_COPIED))
    (work / PACKAGE).write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")
    (work / LOCK).write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
