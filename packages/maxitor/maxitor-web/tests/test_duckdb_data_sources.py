# packages/maxitor/maxitor-web/tests/test_duckdb_data_sources.py
"""
The ``DataSource`` node and the ``resource_data_source`` edge of protocol 1.7 in DuckDB (spec 063).

A graph of 1.7 may say which resources share a store; DuckDB keeps the stores in ``data_source`` and
each resource's store in ``resource_data_source_edges``. A graph of 1.0–1.6 has neither and loads as before.
"""

from __future__ import annotations

from maxitor.web.model.diagrams.resources.duckdb_graph_resource import DuckDBGraphResource

from tests.fixtures.data_source_model import (
    SHOP_DB,
    STOREFRONT,
    SUPPORT,
    data_source_model_graph,
    data_source_model_graph_1_6,
)


def test_a_graph_of_1_7_keeps_its_data_sources_and_their_resources() -> None:
    duck = DuckDBGraphResource.build_from_json(data_source_model_graph())
    assert duck.execute_fetch_dicts("SELECT id, label, description FROM data_source") == [
        {"id": SHOP_DB, "label": "ShopDataSource", "description": "Main shop database"}
    ]
    rows = duck.execute_fetch_dicts("SELECT source_id, target_id FROM resource_data_source_edges ORDER BY source_id")
    assert [(r["source_id"], r["target_id"]) for r in rows] == [(STOREFRONT, SHOP_DB), (SUPPORT, SHOP_DB)]


def test_the_views_show_the_data_source_and_its_edges() -> None:
    duck = DuckDBGraphResource.build_from_json(data_source_model_graph())
    assert duck.execute_fetch_dicts("SELECT count(*) AS n FROM nodes WHERE type = 'data_source'") == [{"n": 1}]
    assert duck.execute_fetch_dicts("SELECT count(*) AS n FROM edges WHERE type = 'resource_data_source_edges'") == [{"n": 2}]


def test_a_graph_of_1_6_loads_with_no_data_source() -> None:
    duck = DuckDBGraphResource.build_from_json(data_source_model_graph_1_6())
    assert duck.execute_fetch_dicts("SELECT count(*) AS n FROM data_source") == [{"n": 0}]
    assert duck.execute_fetch_dicts("SELECT count(*) AS n FROM resource_data_source_edges") == [{"n": 0}]
