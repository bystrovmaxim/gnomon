# packages/maxitor/maxitor-web/tests/test_duckdb_resource_entity_edges.py
"""
Where an entity lies, in DuckDB (spec 069, FR-005).

``resource_entity_edges`` holds one row per resource and entity it keeps, resource first. A graph of 2.0
fills it from ``resource_entity``; a graph of 1.6–1.8 from ``entity_resource`` turned around, so the same
model gives the same rows at either version; a graph of 1.0–1.5 leaves it empty.
"""

from __future__ import annotations

from typing import Any

from maxitor.web.model.diagrams.resources.duckdb_graph_resource import DuckDBGraphResource

from tests.fixtures.protocol_2_0 import as_2_0
from tests.fixtures.resource_model import (
    BILLING,
    INVOICE,
    ORDER,
    ORDER_LINE,
    STOREFRONT,
    resource_model_graph,
    resource_model_graph_1_5,
)

KEPT = [(BILLING, INVOICE), (STOREFRONT, ORDER), (STOREFRONT, ORDER_LINE)]


def _kept(graph: dict[str, Any]) -> list[tuple[str, str]]:
    duck = DuckDBGraphResource.build_from_json(graph)
    rows = duck.execute_fetch_dicts("SELECT source_id, target_id FROM resource_entity_edges ORDER BY source_id, target_id")
    return [(str(r["source_id"]), str(r["target_id"])) for r in rows]


def test_a_graph_of_2_0_keeps_each_resource_and_its_entities() -> None:
    assert _kept(as_2_0(resource_model_graph())) == KEPT


def test_a_graph_of_1_6_is_read_turned_around() -> None:
    assert _kept(resource_model_graph()) == KEPT


def test_an_entity_may_lie_in_two_resources_at_2_0() -> None:
    graph = as_2_0(resource_model_graph())
    graph["edges"].append({**graph["edges"][-1], "id": f"{BILLING}|resource_entity|{ORDER}", "source_id": BILLING, "target_id": ORDER, "type": "resource_entity", "relationship": "Aggregation", "is_dag": True, "properties": {}})
    assert _kept(graph) == sorted([*KEPT, (BILLING, ORDER)])


def test_the_entity_keeps_its_domain_edge_beside_its_resource() -> None:
    duck = DuckDBGraphResource.build_from_json(as_2_0(resource_model_graph()))
    assert len(duck.execute_fetch_dicts("SELECT source_id FROM domain_edges WHERE source_id = ?", [INVOICE])) == 1


def test_a_graph_of_1_5_loads_with_no_resource_edges() -> None:
    assert _kept(resource_model_graph_1_5()) == []


def test_the_edges_view_shows_the_resource_edges() -> None:
    duck = DuckDBGraphResource.build_from_json(as_2_0(resource_model_graph()))
    assert duck.execute_fetch_dicts("SELECT count(*) AS n FROM edges WHERE type = 'resource_entity_edges'") == [{"n": 3}]
