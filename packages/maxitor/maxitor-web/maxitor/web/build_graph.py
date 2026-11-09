# packages/maxitor/maxitor-web/maxitor/web/build_graph.py
"""
Build Maxitor's graph — the front and the core — and write it to standard output: the build command of the ``maxitor``
entry in ``graph-builder.toml``.

═══════════════════════════════════════════════════════════════════════════════
PURPOSE
═══════════════════════════════════════════════════════════════════════════════

Maxitor is itself an AOA service. ``graph-builder write`` runs
``python -m maxitor.web.build_graph`` and saves what it prints in
``packages/maxitor/maxitor-web/graph.json``, so every change to the front or the core carries its graph.
The core (``maxitor.core``) is in the same graph, so the file's history goes on unbroken from before the core
existed; ``repo-graph-port`` keeps its own file beside it.

═══════════════════════════════════════════════════════════════════════════════
ARCHITECTURE / DATA FLOW
═══════════════════════════════════════════════════════════════════════════════

Importing the front's application and the core's server and migrator registers
their actions, gateways, storages, entities and events; the graph is then written
to standard output and nothing else. Run in a process of its own, apart from the demo's graph.
"""

from __future__ import annotations

import importlib
import sys

from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator


def main() -> None:
    """Write Maxitor's graph document to standard output."""
    importlib.import_module("maxitor.web.api.app")
    importlib.import_module("maxitor.core.server")
    importlib.import_module("maxitor.core.storage.migrations_storage")
    sys.stdout.write(create_node_graph_coordinator().to_json())


if __name__ == "__main__":
    main()
