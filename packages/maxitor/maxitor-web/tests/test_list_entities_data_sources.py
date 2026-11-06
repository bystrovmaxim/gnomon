# packages/maxitor/maxitor-web/tests/test_list_entities_data_sources.py
"""
The entity listing names the data source each resource shares (spec 063).

Each listed resource carries its data source, or null; the answer lists the data sources the listed
resources name, sorted by id and coloured by their place, whatever domains are asked for. A graph of
1.0–1.6 has none, and its resources name none.
"""

from __future__ import annotations

from typing import Any

import jsonschema
from maxitor.web.model.diagrams.actions.list_domains_action import DOMAIN_PALETTE
from maxitor.web.model.diagrams.actions.list_entities_action import ListEntitiesAction
from maxitor.web.model.diagrams.actions.list_entities_action_schema import (
    ListEntitiesDataSourcesJson,
    ListEntitiesResourcesJson,
)
from maxitor.web.model.diagrams.resources.duckdb_graph_resource import DUCKDB_GRAPH_CONNECTION_KEY, DuckDBGraphResource

from aoa.action_machine.model import BaseState
from tests.fixtures.data_source_model import (
    BILLING,
    DOMAIN,
    SHOP_DB,
    STOREFRONT,
    SUPPORT,
    data_source_model_graph,
    data_source_model_graph_1_6,
)


async def _answer(graph: dict[str, Any], domains: list[str]) -> ListEntitiesAction.Result:
    connections = {DUCKDB_GRAPH_CONNECTION_KEY: DuckDBGraphResource.build_from_json(graph)}
    params = ListEntitiesAction.Params(domain_qualnames=domains, include_one_hop_neighbors=True)
    return await ListEntitiesAction().build_domain_payload_summary(params, BaseState(), None, connections)  # type: ignore[arg-type]


async def test_each_resource_names_its_data_source_or_none() -> None:
    answer = await _answer(data_source_model_graph(), [DOMAIN])
    assert {row["id"]: row["data_source_id"] for row in answer.resources} == {BILLING: None, STOREFRONT: SHOP_DB, SUPPORT: SHOP_DB}


async def test_the_data_sources_are_listed_with_their_colour() -> None:
    answer = await _answer(data_source_model_graph(), [DOMAIN])
    assert answer.data_sources == [{"id": SHOP_DB, "label": "ShopDataSource", "color": DOMAIN_PALETTE[0]}]
    assert (await _answer(data_source_model_graph(), [])).data_sources == answer.data_sources


async def test_a_graph_of_1_6_has_no_data_source() -> None:
    answer = await _answer(data_source_model_graph_1_6(), [DOMAIN])
    assert answer.data_sources == []
    assert {row["data_source_id"] for row in answer.resources} == {None}


async def test_the_answer_keeps_its_contract() -> None:
    answer = await _answer(data_source_model_graph(), [DOMAIN])
    jsonschema.validate(answer.resources, ListEntitiesResourcesJson._json_schema)
    jsonschema.validate(answer.data_sources, ListEntitiesDataSourcesJson._json_schema)
