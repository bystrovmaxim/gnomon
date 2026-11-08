"""The test graph of spec 061: one domain whose entities live in two resources, and a resource with none."""

from __future__ import annotations

import copy
from typing import Any

DOMAIN = "shop.ShopDomain"
STOREFRONT = "shop.StorefrontDatabase"
BILLING = "shop.BillingDatabase"
SOCKET = "shop.SocketChannelController"
ORDER = "shop.Order"
ORDER_LINE = "shop.OrderLine"
INVOICE = "shop.Invoice"

#: Each entity and the resource that stores it.
STORED_BY = {ORDER: STOREFRONT, ORDER_LINE: STOREFRONT, INVOICE: BILLING}


def _short(identifier: str) -> str:
    return identifier.rsplit(".", 1)[-1]


def _edge(source: str, edge_type: str, target: str, relationship: str = "Aggregation", is_dag: bool = True, **properties: Any) -> dict[str, Any]:
    return {
        "id": f"{source}|{edge_type}|{target}",
        "source_id": source,
        "target_id": target,
        "type": edge_type,
        "relationship": relationship,
        "is_dag": is_dag,
        "properties": properties,
    }


def resource_model_graph() -> dict[str, Any]:
    """
    Protocol 1.6: ``Order`` and ``OrderLine`` (an order has many lines) stored by ``StorefrontDatabase``,
    ``Invoice`` by ``BillingDatabase``, and ``SocketChannelController`` storing nothing; all in ``ShopDomain``.
    Every entity has one ``entity_resource`` edge and keeps its ``domain`` edge.
    """
    nodes: list[dict[str, Any]] = [
        {"id": DOMAIN, "type": "Domain", "label": _short(DOMAIN), "properties": {"name": "shop", "description": ""}},
        *(
            {"id": resource, "type": "Resource", "label": _short(resource), "properties": {"description": ""}}
            for resource in (STOREFRONT, BILLING, SOCKET)
        ),
        *(
            {"id": entity, "type": "Entity", "label": _short(entity), "properties": {"description": "", "entity_kind": "core"}}
            for entity in STORED_BY
        ),
    ]
    edges: list[dict[str, Any]] = [
        *(_edge(resource, "domain", DOMAIN) for resource in (STOREFRONT, BILLING, SOCKET)),
        *(_edge(entity, "domain", DOMAIN) for entity in STORED_BY),
        *(_edge(entity, "entity_resource", resource) for entity, resource in STORED_BY.items()),
        _edge(
            ORDER,
            "entity_relation",
            ORDER_LINE,
            relationship="Composition",
            is_dag=False,
            field_name="lines",
            cardinality="many",
            relation_type="composition",
            description="",
            has_inverse=False,
            deprecated=False,
        ),
    ]
    return {"schema_version": "1.6", "nodes": nodes, "edges": edges}


def resource_model_graph_1_5() -> dict[str, Any]:
    """The same model as protocol 1.5 writes it: no ``entity_resource`` edges."""
    graph = copy.deepcopy(resource_model_graph())
    graph["schema_version"] = "1.5"
    graph["edges"] = [edge for edge in graph["edges"] if edge["type"] != "entity_resource"]
    return graph
