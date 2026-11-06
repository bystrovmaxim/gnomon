"""The test graph of spec 063: two resources share a data source and relate their entities; a third has none."""

from __future__ import annotations

import copy
from typing import Any

APP = "app.Application"
DOMAIN = "shop.ShopDomain"
SHOP_DB = "shop.ShopDataSource"
STOREFRONT = "shop.StorefrontDatabase"
SUPPORT = "shop.SupportDatabase"
BILLING = "shop.BillingDatabase"
ORDER = "shop.Order"
TICKET = "shop.Ticket"
INVOICE = "shop.Invoice"

#: Each entity and the resource that stores it.
STORED_BY = {ORDER: STOREFRONT, TICKET: SUPPORT, INVOICE: BILLING}
#: Each resource that names a data source, and that data source.
SHARES = {STOREFRONT: SHOP_DB, SUPPORT: SHOP_DB}


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


def data_source_model_graph() -> dict[str, Any]:
    """
    Protocol 1.7: ``ShopDataSource`` on the application, shared by ``StorefrontDatabase`` (``Order``)
    and ``SupportDatabase`` (``Ticket``); a ticket is about an order, across the two resources.
    ``BillingDatabase`` (``Invoice``) names no data source.
    """
    nodes: list[dict[str, Any]] = [
        {"id": APP, "type": "Application", "label": _short(APP), "properties": {"name": "app", "description": ""}},
        {"id": DOMAIN, "type": "Domain", "label": _short(DOMAIN), "properties": {"name": "shop", "description": "", "typed_events": False}},
        {"id": SHOP_DB, "type": "DataSource", "label": _short(SHOP_DB), "properties": {"description": "Main shop database"}},
        *(
            {"id": resource, "type": "Resource", "label": _short(resource), "properties": {"description": ""}}
            for resource in (STOREFRONT, SUPPORT, BILLING)
        ),
        *(
            {"id": entity, "type": "Entity", "label": _short(entity), "properties": {"description": "", "entity_kind": "core"}}
            for entity in STORED_BY
        ),
    ]
    edges: list[dict[str, Any]] = [
        _edge(DOMAIN, "application", APP),
        _edge(SHOP_DB, "application", APP),
        *(_edge(resource, "domain", DOMAIN) for resource in (STOREFRONT, SUPPORT, BILLING)),
        *(_edge(resource, "resource_data_source", source) for resource, source in SHARES.items()),
        *(_edge(entity, "domain", DOMAIN) for entity in STORED_BY),
        *(_edge(entity, "entity_resource", resource) for entity, resource in STORED_BY.items()),
        _edge(
            TICKET,
            "entity_relation",
            ORDER,
            relationship="Association",
            is_dag=False,
            field_name="order",
            cardinality="one",
            relation_type="association",
            description="The order the ticket is about",
            has_inverse=False,
            deprecated=False,
        ),
    ]
    return {"schema_version": "1.7", "nodes": nodes, "edges": edges}


def data_source_model_graph_1_6() -> dict[str, Any]:
    """The same model as protocol 1.6 writes it: no data source and no relation across resources."""
    graph = copy.deepcopy(data_source_model_graph())
    graph["schema_version"] = "1.6"
    graph["nodes"] = [node for node in graph["nodes"] if node["type"] != "DataSource"]
    graph["edges"] = [
        edge for edge in graph["edges"] if edge["type"] != "resource_data_source" and edge["source_id"] != SHOP_DB and edge["type"] != "entity_relation"
    ]
    return graph
