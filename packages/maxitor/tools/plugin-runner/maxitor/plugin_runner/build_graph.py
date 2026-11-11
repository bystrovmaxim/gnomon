# packages/maxitor/tools/plugin-runner/maxitor/plugin_runner/build_graph.py
"""
Build the runner's own graph and write it to standard output — the build command of the ``plugin-runner`` entry in
``graph-builder.toml``.

The runner is a service (constitution rule 60): it keeps its graph beside its code, built from what its process
loads — the loop, the process and through them the runner's actions of the domain plugins.
"""

from __future__ import annotations

import importlib
import sys

from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator


def main() -> None:
    """Write the runner's graph document to standard output."""
    importlib.import_module("maxitor.plugin_runner.process")
    sys.stdout.write(create_node_graph_coordinator().to_json())


if __name__ == "__main__":
    main()
