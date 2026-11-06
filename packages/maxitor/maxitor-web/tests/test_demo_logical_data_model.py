# packages/maxitor/maxitor-web/tests/test_demo_logical_data_model.py
"""
The AOA demo's graph at protocol 1.8, as the ERD reads it (spec 067).

A relation knows no store: the Billing ERD, with its neighbours, draws the chargeback ticket's line to
the shop database's customer order, two tables of two data sources, so the line leaves one data source
contour for another. Every resource that stores an entity names a data source, so the ERD has no
"No data source" row on a 1.8 graph.
"""

from __future__ import annotations

import json
from pathlib import Path

from maxitor.web.model.diagrams.actions.list_entities_action import ListEntitiesAction
from maxitor.web.model.diagrams.resources.duckdb_graph_resource import DuckDBGraphResource

DEMO_GRAPH = Path(__file__).resolve().parents[4] / "external" / "aoa" / "packages" / "aoa-demo" / "graph.json"
BILLING = "aoa.demo.model.billing.domain.BillingDomain"


def _duck() -> DuckDBGraphResource:
    return DuckDBGraphResource.build_from_json(json.loads(DEMO_GRAPH.read_text(encoding="utf-8")))


def _data_source_of(duck: DuckDBGraphResource) -> dict[str, str | None]:
    """Each stored entity's label, mapped to the label of its resource's data source."""
    rows = duck.execute_fetch_dicts(
        """
        SELECT e.label AS entity, ds.label AS data_source
        FROM entity e
        JOIN entity_resource_edges rre ON rre.source_id = e.id
        LEFT JOIN resource_data_source_edges rds ON rds.source_id = rre.target_id
        LEFT JOIN data_source ds ON ds.id = rds.target_id
        """
    )
    return {str(row["entity"]): None if row["data_source"] is None else str(row["data_source"]) for row in rows}


def test_the_demo_graph_is_1_8() -> None:
    assert json.loads(DEMO_GRAPH.read_text(encoding="utf-8"))["schema_version"] == "1.8"


def test_the_billing_erd_draws_a_line_from_one_data_source_to_another() -> None:
    """The chargeback ticket, in the billing warehouse, points at the order of the shop database."""
    duck = _duck()
    payload = ListEntitiesAction._slice_payload(duck, BILLING, include_neighbors=True)
    labels = {entity["id"]: entity["label"] for entity in payload["entities"]}
    lines = {(labels.get(rel["source"]), labels.get(rel["target"])) for rel in payload["relations"]}
    assert ("ChargebackTicketCoreEntity", "SalesOrderCoreEntity") in lines
    data_source = _data_source_of(duck)
    assert (data_source["ChargebackTicketCoreEntity"], data_source["SalesOrderCoreEntity"]) == ("BillingWarehouseDataSource", "ShopDataSource")


def test_every_stored_entity_has_a_data_source() -> None:
    """At 1.8 no entity's resource is without a data source, so no "No data source" row appears."""
    assert [entity for entity, source in _data_source_of(_duck()).items() if source is None] == []
