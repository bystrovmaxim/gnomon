# packages/maxitor/maxitor-web/tests/test_list_entities_data_sources.py
"""
The entity listing names no data source (spec 069).

The store knows no data source, so for a graph of any version every listed resource carries a null data
source and the answer lists none; the fields keep their contract until the views of data sources go.
"""

from __future__ import annotations

from typing import Any

import jsonschema
import pytest
from maxitor.web.model.diagrams.actions.list_entities_action import ListEntitiesAction
from maxitor.web.model.diagrams.actions.list_entities_action_schema import (
    ListEntitiesDataSourcesJson,
    ListEntitiesResourcesJson,
)
from maxitor.web.model.diagrams.resources.duckdb_graph_storage import DUCKDB_GRAPH_CONNECTION_KEY, DuckDBGraphStorage

from aoa.action_machine.model import BaseState
from tests.fixtures.data_source_model import (
    BILLING,
    DOMAIN,
    STOREFRONT,
    SUPPORT,
    data_source_model_graph,
    data_source_model_graph_1_6,
)
from tests.fixtures.protocol_2_0 import as_2_0


async def _answer(graph: dict[str, Any], domains: list[str]) -> ListEntitiesAction.Result:
    connections = {DUCKDB_GRAPH_CONNECTION_KEY: DuckDBGraphStorage.build_from_json(graph)}
    params = ListEntitiesAction.Params(domain_qualnames=domains, include_one_hop_neighbors=True)
    return await ListEntitiesAction().build_domain_payload_summary(params, BaseState(), None, connections)  # type: ignore[arg-type]


@pytest.mark.parametrize("graph", [data_source_model_graph(), as_2_0(data_source_model_graph()), data_source_model_graph_1_6()], ids=["1.7", "2.0", "1.6"])
async def test_no_resource_names_a_data_source(graph: dict[str, Any]) -> None:
    answer = await _answer(graph, [DOMAIN])
    assert {row["id"]: row["data_source_id"] for row in answer.resources} == {BILLING: None, STOREFRONT: None, SUPPORT: None}
    assert answer.data_sources == []


async def test_each_entity_names_its_resource_at_2_0() -> None:
    answer = await _answer(as_2_0(data_source_model_graph()), [DOMAIN])
    entities = answer.domain_slices[0]["list_entities"]["entities"]
    assert {entity["label"]: entity["resource_label"] for entity in entities} == {"Order": "StorefrontDatabase", "Ticket": "SupportDatabase", "Invoice": "BillingDatabase"}


async def test_the_answer_keeps_its_contract() -> None:
    answer = await _answer(data_source_model_graph(), [DOMAIN])
    jsonschema.validate(answer.resources, ListEntitiesResourcesJson._json_schema)
    jsonschema.validate(answer.data_sources, ListEntitiesDataSourcesJson._json_schema)
