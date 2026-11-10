# packages/maxitor/tools/plugin-installer/maxitor/plugin_installer/launch.py
"""
``maxitor-plugin-installer`` — the process that checks and deploys plugin versions as the role maxitor_installer.

``maxitor-plugin-installer run`` takes up the queue on start and every period. The code is in every ``maxitor``
wheel; only the extra ``plugin-installer`` brings its dependencies, and without them the command names the extra.
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import sys

#: The extra that brings the installer's dependencies.
EXTRA = 'pip install "maxitor[plugin-installer]"'


def main(argv: list[str] | None = None) -> None:
    """Parse the command and run it."""
    parser = argparse.ArgumentParser(
        prog="maxitor-plugin-installer", description="Check and deploy Maxitor plugin versions."
    )
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("run", help="Take up the queue on start and every period ($MAXITOR_INSTALLER_DSN)")
    args = parser.parse_args(argv)
    try:
        process = importlib.import_module("maxitor.plugin_installer.process")
    except ModuleNotFoundError:
        sys.stderr.write(f"maxitor-plugin-installer needs its extra: {EXTRA}\n")
        raise SystemExit(2) from None
    if args.command == "run":
        asyncio.run(process.run())
