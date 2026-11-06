# packages/maxitor/maxitor-web/tests/test_duckdb_without_data_sources.py
"""
A graph of 1.7–1.8 loads without its data sources (spec 069, FR-005).

The store knows no data source: a ``DataSource`` node, its ``application`` edge and ``resource_data_source``
are not loaded, so a 1.8 graph and the same model at 2.0 fill the store alike.
"""

from __future__ import annotations

import pytest
from maxitor.web.model.diagrams.resources.duckdb_graph_resource import DuckDBGraphResource

from tests.fixtures.data_source_model import APP, DOMAIN, SHOP_DB, data_source_model_graph
from tests.fixtures.protocol_2_0 import as_2_0


def _graph_1_8() -> DuckDBGraphResource:
    graph = data_source_model_graph()
    graph["schema_version"] = "1.8"
    return DuckDBGraphResource.build_from_json(graph)


@pytest.mark.parametrize("table", ["data_source", "resource_data_source_edges", "entity_resource_edges"])
def test_the_store_has_no_table_of_the_data_source(table: str) -> None:
    duck = _graph_1_8()
    assert duck.execute_fetch_dicts("SELECT count(*) AS n FROM information_schema.tables WHERE table_name = ?", [table]) == [{"n": 0}]


def test_a_graph_of_1_8_shows_no_data_source() -> None:
    duck = _graph_1_8()
    assert duck.execute_fetch_dicts("SELECT count(*) AS n FROM nodes WHERE id = ?", [SHOP_DB]) == [{"n": 0}]
    assert duck.execute_fetch_dicts("SELECT source_id FROM application_edges") == [{"source_id": DOMAIN}]
    assert duck.execute_fetch_dicts("SELECT target_id FROM application_edges") == [{"target_id": APP}]


def test_a_graph_of_1_8_and_the_same_model_at_2_0_keep_the_same_entities() -> None:
    query = "SELECT source_id, target_id FROM resource_entity_edges ORDER BY ALL"
    at_2_0 = DuckDBGraphResource.build_from_json(as_2_0(data_source_model_graph()))
    assert _graph_1_8().execute_fetch_dicts(query) == at_2_0.execute_fetch_dicts(query)
    assert len(at_2_0.execute_fetch_dicts(query)) == 3
