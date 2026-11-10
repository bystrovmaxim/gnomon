# packages/maxitor/tools/plugin-installer/maxitor/plugin_installer/launch.py
"""
``maxitor-plugin-installer`` — the process that checks and deploys plugin versions as the role maxitor_installer.

``maxitor-plugin-installer run`` takes up the queue on start and every period; ``add-version <purl> <sha256>`` and
``add-wheel <file.whl>`` fill the marketplace with a public version, which the loop then checks. The code is in every ``maxitor``
wheel; only the extra ``plugin-installer`` brings its dependencies, and without them the command names the extra.
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import sys
from pathlib import Path

#: The extra that brings the installer's dependencies.
EXTRA = 'pip install "maxitor[plugin-installer]"'


def main(argv: list[str] | None = None) -> None:
    """Parse the command and run it."""
    parser = argparse.ArgumentParser(
        prog="maxitor-plugin-installer", description="Check and deploy Maxitor plugin versions."
    )
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("run", help="Take up the queue on start and every period ($MAXITOR_INSTALLER_DSN)")
    version = commands.add_parser("add-version", help="Add a public version on PyPI to the marketplace")
    version.add_argument("purl", help="pkg:pypi/<name>@<version>")
    version.add_argument("sha256", help="The wheel's SHA-256")
    wheel = commands.add_parser("add-wheel", help="Add a wheel at hand to the marketplace, kept in the wheel store")
    wheel.add_argument("path", type=Path, help="The .whl file")
    args = parser.parse_args(argv)
    try:
        process = importlib.import_module("maxitor.plugin_installer.process")
    except ModuleNotFoundError:
        sys.stderr.write(f"maxitor-plugin-installer needs its extra: {EXTRA}\n")
        raise SystemExit(2) from None
    if args.command == "run":
        asyncio.run(process.run())
    elif args.command == "add-version":
        print(asyncio.run(process.add_version(args.purl, args.sha256)))
    else:
        print(asyncio.run(process.add_wheel(args.path)))
