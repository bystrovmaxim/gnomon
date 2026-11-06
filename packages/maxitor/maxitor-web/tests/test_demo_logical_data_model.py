# packages/maxitor/maxitor-web/tests/test_demo_logical_data_model.py
"""
The AOA demo's graph at protocol 1.8, as the ERD reads it (specs 067, 069).

A relation knows no store: the Billing ERD, with its neighbours, draws the chargeback ticket's line to
the shop's customer order, two tables kept by two resources. The store reads the demo's ``entity_resource``
turned around and leaves its data sources out, so every stored entity has its resource and no data source.
"""

from __future__ import annotations

import json
from pathlib import Path

from maxitor.web.model.diagrams.actions.list_entities_action import ListEntitiesAction
from maxitor.web.model.diagrams.resources.duckdb_graph_resource import DuckDBGraphResource

DEMO_GRAPH = Path(__file__).resolve().parents[4] / "external" / "aoa" / "packages" / "aoa-demo" / "graph.json"
BILLING = "aoa.demo.model.billing.domain.BillingDomain"


def _demo() -> dict:
    graph: dict = json.loads(DEMO_GRAPH.read_text(encoding="utf-8"))
    return graph


def _resource_of(duck: DuckDBGraphResource) -> dict[str, str]:
    """Each stored entity's label, mapped to the label of the resource that keeps it."""
    rows = duck.execute_fetch_dicts(
        """
        SELECT e.label AS entity, r.label AS resource
        FROM entity e
        JOIN resource_entity_edges rre ON rre.target_id = e.id
        JOIN resource r ON r.id = rre.source_id
        """
    )
    return {str(row["entity"]): str(row["resource"]) for row in rows}


def test_the_demo_graph_is_1_8() -> None:
    assert _demo()["schema_version"] == "1.8"


def test_the_billing_erd_draws_a_line_from_one_resource_to_another() -> None:
    """The chargeback ticket, in the billing warehouse, points at the order the shop keeps."""
    duck = DuckDBGraphResource.build_from_json(_demo())
    payload = ListEntitiesAction._slice_payload(duck, BILLING, include_neighbors=True)
    labels = {entity["id"]: entity["label"] for entity in payload["entities"]}
    lines = {(labels.get(rel["source"]), labels.get(rel["target"])) for rel in payload["relations"]}
    assert ("ChargebackTicketCoreEntity", "SalesOrderCoreEntity") in lines
    resource = _resource_of(duck)
    assert resource["ChargebackTicketCoreEntity"] != resource["SalesOrderCoreEntity"]


def test_every_entity_the_demo_stores_keeps_its_resource() -> None:
    """Each ``entity_resource`` edge of the demo becomes one row of the store, turned around."""
    graph = _demo()
    stored = {(e["target_id"], e["source_id"]) for e in graph["edges"] if e["type"] == "entity_resource"}
    duck = DuckDBGraphResource.build_from_json(graph)
    rows = duck.execute_fetch_dicts("SELECT source_id, target_id FROM resource_entity_edges")
    assert {(str(r["source_id"]), str(r["target_id"])) for r in rows} == stored
    assert any(node["type"] == "DataSource" for node in graph["nodes"])
