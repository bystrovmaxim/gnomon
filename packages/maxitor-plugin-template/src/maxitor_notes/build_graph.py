# packages/maxitor-plugin-template/src/maxitor_notes/build_graph.py
"""
Build the plugin's own graph and write it to standard output — the build command of its entry in ``graph-builder.toml``.

Importing the application module registers the plugin's actions, storage, entities and roles; nothing else
of the repository is imported, so the graph holds the plugin alone.
"""

from __future__ import annotations

import importlib
import sys

from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator


def main() -> None:
    """Write the plugin's graph document to standard output."""
    importlib.import_module("maxitor_notes.app")
    sys.stdout.write(create_node_graph_coordinator().to_json())


if __name__ == "__main__":
    main()
