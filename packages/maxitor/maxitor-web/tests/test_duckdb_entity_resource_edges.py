# packages/maxitor/maxitor-web/tests/test_duckdb_entity_resource_edges.py
"""
The ``entity_resource`` edge of protocol 1.6 in DuckDB (spec 061, FR-001, FR-013).

A graph of 1.6 gives every entity one edge to the resource that stores it; DuckDB keeps those edges in
``entity_resource_edges`` beside ``domain_edges``. A graph of 1.0–1.5 has none and loads as before.
"""

from __future__ import annotations

from maxitor.web.model.diagrams.resources.duckdb_graph_resource import DuckDBGraphResource
from tests.fixtures.resource_model import BILLING, INVOICE, ORDER, ORDER_LINE, STOREFRONT, resource_model_graph, resource_model_graph_1_5


def test_a_graph_of_1_6_keeps_each_entity_and_its_resource() -> None:
    duck = DuckDBGraphResource.build_from_json(resource_model_graph())
    rows = duck.execute_fetch_dicts("SELECT source_id, target_id FROM entity_resource_edges ORDER BY source_id")
    assert [(r["source_id"], r["target_id"]) for r in rows] == [(INVOICE, BILLING), (ORDER, STOREFRONT), (ORDER_LINE, STOREFRONT)]


def test_the_entity_keeps_its_domain_edge_beside_its_resource() -> None:
    duck = DuckDBGraphResource.build_from_json(resource_model_graph())
    rows = duck.execute_fetch_dicts("SELECT source_id FROM domain_edges WHERE source_id = ?", [INVOICE])
    assert len(rows) == 1


def test_a_graph_of_1_5_loads_with_no_resource_edges() -> None:
    duck = DuckDBGraphResource.build_from_json(resource_model_graph_1_5())
    assert duck.execute_fetch_dicts("SELECT count(*) AS n FROM entity_resource_edges") == [{"n": 0}]


def test_the_edges_view_shows_the_resource_edges() -> None:
    duck = DuckDBGraphResource.build_from_json(resource_model_graph())
    rows = duck.execute_fetch_dicts("SELECT count(*) AS n FROM edges WHERE type = 'entity_resource_edges'")
    assert rows == [{"n": 3}]
