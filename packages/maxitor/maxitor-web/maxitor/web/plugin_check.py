# packages/maxitor/maxitor-web/maxitor/web/plugin_check.py
"""
``maxitor plugin check <path> --core <version>`` — whether a plugin fits a version of Maxitor's core.

::

    the plugin's files  ──► maxitor_plugin_sdk.checks.read_plugin   each file against its schema
    the plugin's domain ──► domain_problems                          a domain class must declare its events
    the core's passport ──► maxitor_plugin_sdk.compat.decide         formats, range, SDK major, dependencies

The core's passport is the one this ``maxitor`` package ships, with the version asked for: the check answers
"would this plugin fit that core". The plugin's code is read, never run.
"""

from __future__ import annotations

import argparse
import ast
from collections.abc import Sequence
from pathlib import Path

import yaml

#: The core's passport file inside the maxitor package.
CORE_PASSPORT = Path(__file__).resolve().parents[3] / "maxitor-core" / "maxitor" / "core" / "maxitor-core.yaml"


def core_passport_file() -> Path:
    """The core passport of the installed package: beside this module in a wheel, in the core's folder in the repository."""
    installed = Path(__file__).resolve().parents[1] / "core" / "maxitor-core.yaml"
    return installed if installed.is_file() else CORE_PASSPORT


def domain_problems(package: Path) -> list[str]:
    """
    Every domain class of the plugin that declares no ``events``.

    A domain is a class whose base is named ``BaseDomain``; its body must assign ``events``, an empty tuple
    included, so the plugin writes only typed events.
    """
    problems: list[str] = []
    for source in sorted(package.rglob("*.py")):
        try:
            tree = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
        except SyntaxError as error:
            problems.append(f"{source.relative_to(package.parent)}: not Python ({error.msg})")
            continue
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.ClassDef)
                and any(_named(base) == "BaseDomain" for base in node.bases)
                and not _declares_events(node)
            ):
                problems.append(f"{source.relative_to(package.parent)}: the domain {node.name} declares no events")
    return problems


def _named(base: ast.expr) -> str:
    """The name a base class is written with: ``BaseDomain`` or ``x.BaseDomain``."""
    if isinstance(base, ast.Name):
        return base.id
    if isinstance(base, ast.Attribute):
        return base.attr
    return ""


def _declares_events(cls: ast.ClassDef) -> bool:
    for statement in cls.body:
        targets = (
            statement.targets
            if isinstance(statement, ast.Assign)
            else [statement.target]
            if isinstance(statement, ast.AnnAssign)
            else []
        )
        if any(isinstance(t, ast.Name) and t.id == "events" for t in targets):
            return True
    return False


def check(path: Path, core_version: str) -> list[str]:
    """
    AI-CORE-BEGIN
    ROLE: Decide one plugin's folder against one core version.
    CONTRACT: Every problem as a line: the plugin's files, its domain, then each refusal of ``compat`` with every side.
        Empty when the plugin fits.
    AI-CORE-END
    """
    from maxitor_plugin_sdk.checks import read_plugin  # pylint: disable=import-outside-toplevel
    from maxitor_plugin_sdk.compat import CorePassport, PluginPassport, decide  # pylint: disable=import-outside-toplevel

    passport, problems = read_plugin(path)
    packages = sorted(p.parent for p in (path / "src").glob("*/maxitor-plugin.yaml"))
    for package in packages:
        problems += domain_problems(package)
    if passport is None:
        return problems
    core_document = yaml.safe_load(core_passport_file().read_text(encoding="utf-8"))
    core = CorePassport.of({**core_document, "version": core_version})
    problems += [f"{refusal.kind}: {refusal.message}" for refusal in decide(core, [PluginPassport.of(passport)])]
    return problems


def main(argv: Sequence[str]) -> int:
    """``maxitor plugin check <path> --core <version>``: print each problem; 0 when the plugin fits."""
    parser = argparse.ArgumentParser(
        prog="maxitor plugin check", description="Check a plugin against a version of Maxitor's core."
    )
    parser.add_argument("path", type=Path, help="the plugin's folder, the one with pyproject.toml")
    parser.add_argument("--core", required=True, help="the core's version, for example 4.0.0")
    arguments = parser.parse_args(list(argv))
    problems = check(arguments.path, arguments.core)
    for problem in problems:
        print(problem)
    if not problems:
        print(f"the plugin fits maxitor {arguments.core}")
    return 1 if problems else 0
