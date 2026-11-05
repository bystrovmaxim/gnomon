# packages/maxitor/maxitor-web/tests/test_list_entities_resources.py
"""
The entity listing names resources (spec 061, FR-002, FR-009, FR-013).

Each entity row carries the resource that stores it, and the answer lists the resources of the whole
graph that store an entity, sorted by id, each coloured from the domain palette by its place in that
list — so a resource has one colour whatever domains a request asks for. A graph of 1.0–1.5 has none.
"""

from __future__ import annotations

from typing import Any

import jsonschema
from maxitor.web.model.diagrams.actions.list_domains_action import DOMAIN_PALETTE
from maxitor.web.model.diagrams.actions.list_entities_action import ListEntitiesAction
from maxitor.web.model.diagrams.actions.list_entities_action_schema import (
    ListEntitiesDomainSlicesJson,
    ListEntitiesResourcesJson,
)
from maxitor.web.model.diagrams.resources.duckdb_graph_resource import DUCKDB_GRAPH_CONNECTION_KEY, DuckDBGraphResource

from aoa.action_machine.model import BaseState
from tests.fixtures.resource_model import (
    BILLING,
    DOMAIN,
    INVOICE,
    ORDER,
    STOREFRONT,
    resource_model_graph,
    resource_model_graph_1_5,
)


async def _answer(graph: dict[str, Any], domains: list[str]) -> ListEntitiesAction.Result:
    """The action's answer for ``domains`` of ``graph``."""
    connections = {DUCKDB_GRAPH_CONNECTION_KEY: DuckDBGraphResource.build_from_json(graph)}
    params = ListEntitiesAction.Params(domain_qualnames=domains, include_one_hop_neighbors=True)
    return await ListEntitiesAction().build_domain_payload_summary(params, BaseState(), None, connections)  # type: ignore[arg-type]


def _entities(answer: ListEntitiesAction.Result) -> dict[str, dict[str, Any]]:
    return {row["id"]: row for slice_ in answer.domain_slices for row in slice_["list_entities"]["entities"]}


async def test_each_entity_names_the_resource_that_stores_it() -> None:
    rows = _entities(await _answer(resource_model_graph(), [DOMAIN]))
    assert (rows[INVOICE]["resource_id"], rows[INVOICE]["resource_label"]) == (BILLING, "BillingDatabase")
    assert rows[ORDER]["resource_id"] == STOREFRONT


async def test_the_resources_of_the_graph_are_sorted_by_id_and_coloured_by_their_place() -> None:
    answer = await _answer(resource_model_graph(), [DOMAIN])
    assert answer.resources == [
        {"id": BILLING, "label": "BillingDatabase", "color": DOMAIN_PALETTE[0]},
        {"id": STOREFRONT, "label": "StorefrontDatabase", "color": DOMAIN_PALETTE[1]},
    ]


async def test_a_resource_that_stores_nothing_is_not_listed() -> None:
    answer = await _answer(resource_model_graph(), [DOMAIN])
    assert "shop.SocketChannel" not in {row["id"] for row in answer.resources}


async def test_the_resources_do_not_depend_on_the_domains_asked_for() -> None:
    assert (await _answer(resource_model_graph(), [])).resources == (await _answer(resource_model_graph(), [DOMAIN])).resources


async def test_a_graph_of_1_5_has_no_resources() -> None:
    answer = await _answer(resource_model_graph_1_5(), [DOMAIN])
    assert answer.resources == []
    assert {(row["resource_id"], row["resource_label"]) for row in _entities(answer).values()} == {(None, None)}


async def test_the_answer_keeps_its_contract() -> None:
    answer = await _answer(resource_model_graph(), [DOMAIN])
    jsonschema.validate(answer.domain_slices, ListEntitiesDomainSlicesJson._json_schema)
    jsonschema.validate(answer.resources, ListEntitiesResourcesJson._json_schema)
