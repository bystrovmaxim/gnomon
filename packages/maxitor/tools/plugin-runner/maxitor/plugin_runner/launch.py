# packages/maxitor/tools/plugin-runner/maxitor/plugin_runner/launch.py
"""
``maxitor-plugin-runner`` — the process that runs every plugin version enabled in at least one organization.

``maxitor-plugin-runner run`` keeps them running on start and every period. The code is in every ``maxitor`` wheel;
only the extra ``plugin-runner`` brings its dependencies, and without them the command names the extra.
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import sys

#: The extra that brings the runner's dependencies.
EXTRA = 'pip install "maxitor[plugin-runner]"'


def main(argv: list[str] | None = None) -> None:
    """Parse the command and run it."""
    parser = argparse.ArgumentParser(prog="maxitor-plugin-runner", description="Run Maxitor's plugin processes.")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("run", help="Keep every enabled plugin version running ($MAXITOR_CORE_DSN)")
    parser.parse_args(argv)
    try:
        process = importlib.import_module("maxitor.plugin_runner.process")
    except ModuleNotFoundError:
        sys.stderr.write(f"maxitor-plugin-runner needs its extra: {EXTRA}\n")
        raise SystemExit(2) from None
    asyncio.run(process.run())
