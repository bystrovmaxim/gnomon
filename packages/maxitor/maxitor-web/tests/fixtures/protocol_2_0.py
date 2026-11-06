"""A test graph of protocol 1.6–1.8 rewritten as protocol 2.0 writes the same model."""

from __future__ import annotations

import copy
from typing import Any


def as_2_0(graph: dict[str, Any]) -> dict[str, Any]:
    """
    The same model at 2.0: no ``DataSource`` and none of its edges, each ``entity_resource`` edge turned into
    ``resource_entity`` from the resource, and no ``domain`` edge of a resource.
    """
    document = copy.deepcopy(graph)
    gone = {node["id"] for node in document["nodes"] if node["type"] == "DataSource"}
    resources = {node["id"] for node in document["nodes"] if node["type"] == "Resource"}
    edges: list[dict[str, Any]] = []
    for edge in document["edges"]:
        if edge["source_id"] in gone or edge["target_id"] in gone:
            continue
        if edge["type"] == "domain" and edge["source_id"] in resources:
            continue
        if edge["type"] == "entity_resource":
            resource, entity = edge["target_id"], edge["source_id"]
            edge = {**edge, "id": f"{resource}|resource_entity|{entity}", "source_id": resource, "target_id": entity, "type": "resource_entity"}
        edges.append(edge)
    document.update(schema_version="2.0", nodes=[node for node in document["nodes"] if node["id"] not in gone], edges=edges)
    return document
