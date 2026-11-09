# specs/072-maxitor-core/model/build_graph.py
"""
Builds the graph of Maxitor core's data model and writes it to standard output.

Importing the model registers its domains, entities, events and storage; the standard coordinator prints the
graph. The output is saved to ``graph.json`` next to this file. The model is a design inside the
specification, so the repository's ``graph-builder.toml`` has no entry for it.
"""

from __future__ import annotations

import importlib
import sys

from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator


def main() -> None:
    """Write the model's graph document to standard output."""
    importlib.import_module("core_model")
    sys.stdout.write(create_node_graph_coordinator().to_json())


if __name__ == "__main__":
    main()
