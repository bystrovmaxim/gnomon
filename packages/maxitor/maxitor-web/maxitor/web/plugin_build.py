# packages/maxitor/maxitor-web/maxitor/web/plugin_build.py
"""
``maxitor plugin build <path> --core <version>`` — build a plugin's frontend the way the core builds it.

The same step the installer runs: the lock checked, every ``@maxitor/*`` package replaced by the core's own, the
packages checked against the core's npm list, fetched, then built with no network in the core's builder image. It
answers the frontend's image, or the first error of the step that failed — the same error the installer would
record. ``--core`` must be the installed ``maxitor``: a build is always made with the core's own library.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import shutil
import sys
from collections.abc import Sequence
from importlib.metadata import version as package_version
from pathlib import Path

from maxitor.core.plugins.frontend_builder import FrontendBuilderController
from maxitor.core.plugins.plugin_processes import EnvironmentInstallError
from maxitor_plugin_sdk.checks import WEB_FOLDER, read_plugin

#: Where an author's builds work: npm's cache and the image's files, kept between builds.
WORK = Path.home() / ".cache" / "maxitor" / "plugin-builds"
DOCKER_HINT = "maxitor plugin build needs Docker: install Docker and start it"


def schema_of(passport: dict[str, object]) -> str:
    """The version's schema, as the installer names it: ``notes_0_9_1``."""
    return f"{passport['name']}_{str(passport['version']).replace('.', '_')}"


def build(path: Path, core: str, work: Path = WORK) -> tuple[int, str]:
    """Build the frontend of the plugin at ``path`` for the core ``core``; answer the exit code and the line to print."""
    installed = package_version("maxitor")
    if core != installed:
        return 2, f'maxitor {installed} is installed; pip install "maxitor[plugins]=={core}" to build for the core {core}'
    if shutil.which("docker") is None:
        return 2, DOCKER_HINT
    passport, problems = read_plugin(path)
    if passport is None:
        return 1, problems[0] if problems else "the plugin's passport could not be read"
    sources = path / WEB_FOLDER
    lock = sources / "package-lock.json"
    if not lock.is_file():
        return 1, "the lock file is missing or does not match package.json"
    digest = hashlib.sha256(lock.read_bytes() + (sources / "package.json").read_bytes()).hexdigest()
    try:
        image = asyncio.run(FrontendBuilderController(work, version=core).build(schema_of(passport), digest, sources))
    except EnvironmentInstallError as error:
        return 1, error.reason
    return 0, image


def main(argv: Sequence[str]) -> int:
    """``maxitor plugin build <path> --core <version>``: print the image, or the error; 0 when built."""
    parser = argparse.ArgumentParser(
        prog="maxitor plugin build", description="Build a plugin's frontend the way Maxitor's core builds it."
    )
    parser.add_argument("path", type=Path, help="the plugin's folder, the one with pyproject.toml and web/")
    parser.add_argument("--core", required=True, help="the core's version; must be the installed maxitor")
    arguments = parser.parse_args(list(argv))
    code, line = build(arguments.path, arguments.core)
    print(line, file=sys.stderr if code else sys.stdout)
    return code
