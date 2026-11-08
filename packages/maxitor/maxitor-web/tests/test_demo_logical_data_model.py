# packages/maxitor/maxitor-web/tests/test_demo_logical_data_model.py
"""
The AOA demo's graph at protocol 2.0, as the ERD reads it (specs 067, 069, 070).

A relation knows no store: the Billing ERD, with its neighbours, draws the chargeback ticket's line to
the shop's customer order, two tables kept by two resources. The store reads the demo's ``resource_entity``
edges as they are, and the graph names no data source.
"""

from __future__ import annotations

import json
from pathlib import Path

from maxitor.web.model.diagrams.actions.list_entities_action import ListEntitiesAction
from maxitor.web.model.diagrams.resources.duckdb_graph_storage import DuckDBGraphStorage

DEMO_GRAPH = Path(__file__).resolve().parents[4] / "external" / "aoa" / "packages" / "aoa-demo" / "graph.json"
BILLING = "aoa.demo.model.billing.domain.BillingDomain"


def _demo() -> dict:
    graph: dict = json.loads(DEMO_GRAPH.read_text(encoding="utf-8"))
    return graph


def _resource_of(duck: DuckDBGraphStorage) -> dict[str, str]:
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


def test_the_demo_graph_is_2_0() -> None:
    assert _demo()["schema_version"] == "2.0"


def test_the_billing_erd_draws_a_line_from_one_resource_to_another() -> None:
    """The chargeback ticket, in the billing warehouse, points at the order the shop keeps."""
    duck = DuckDBGraphStorage.build_from_json(_demo())
    payload = ListEntitiesAction._slice_payload(duck, BILLING, include_neighbors=True)
    labels = {entity["id"]: entity["label"] for entity in payload["entities"]}
    lines = {(labels.get(rel["source"]), labels.get(rel["target"])) for rel in payload["relations"]}
    assert ("ChargebackTicketCoreEntity", "SalesOrderCoreEntity") in lines
    resource = _resource_of(duck)
    assert resource["ChargebackTicketCoreEntity"] != resource["SalesOrderCoreEntity"]


def test_every_entity_the_demo_stores_keeps_its_resource() -> None:
    """Each ``resource_entity`` edge of the demo becomes one row of the store."""
    graph = _demo()
    stored = {(e["source_id"], e["target_id"]) for e in graph["edges"] if e["type"] == "resource_entity"}
    duck = DuckDBGraphStorage.build_from_json(graph)
    rows = duck.execute_fetch_dicts("SELECT source_id, target_id FROM resource_entity_edges")
    assert {(str(r["source_id"]), str(r["target_id"])) for r in rows} == stored
    assert stored
    assert not any(node["type"] == "DataSource" for node in graph["nodes"])
