# packages/maxitor/maxitor-web/tests/test_list_entities_resources.py
"""
The entity listing names resources (spec 061; spec 070, FR-009).

Each entity row lists every resource that keeps it, sorted by id, and the answer lists every resource of
the whole graph — one that keeps nothing too — sorted by id, each coloured from the domain palette by its
place in that list, so a resource has one colour whatever domains a request asks for. ``storage_known``
says whether the graph tells where any entity lies: a graph of 1.0–1.5 does not.
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
from maxitor.web.model.diagrams.resources.duckdb_graph_storage import DUCKDB_GRAPH_CONNECTION_KEY, DuckDBGraphStorage

from aoa.action_machine.model import BaseState
from tests.fixtures.protocol_2_0 import as_2_0
from tests.fixtures.resource_model import (
    BILLING,
    DOMAIN,
    INVOICE,
    ORDER,
    SOCKET,
    STOREFRONT,
    resource_model_graph,
    resource_model_graph_1_5,
)


async def _answer(graph: dict[str, Any], domains: list[str]) -> ListEntitiesAction.Result:
    """The action's answer for ``domains`` of ``graph``."""
    connections = {DUCKDB_GRAPH_CONNECTION_KEY: DuckDBGraphStorage.build_from_json(graph)}
    params = ListEntitiesAction.Params(domain_qualnames=domains, include_one_hop_neighbors=True)
    return await ListEntitiesAction().build_domain_payload_summary(params, BaseState(), None, connections)  # type: ignore[arg-type]


def _entities(answer: ListEntitiesAction.Result) -> dict[str, dict[str, Any]]:
    return {row["id"]: row for slice_ in answer.domain_slices for row in slice_["list_entities"]["entities"]}


def _kept_twice() -> dict[str, Any]:
    """The model at 2.0, with the invoice kept by the storefront's database as well as by billing's."""
    graph = as_2_0(resource_model_graph())
    graph["edges"].append({**next(edge for edge in graph["edges"] if edge["type"] == "resource_entity"), "id": f"{STOREFRONT}|resource_entity|{INVOICE}", "source_id": STOREFRONT, "target_id": INVOICE})
    return graph


async def test_each_entity_lists_the_resources_that_keep_it() -> None:
    rows = _entities(await _answer(resource_model_graph(), [DOMAIN]))
    assert rows[INVOICE]["resource_ids"] == [BILLING]
    assert rows[ORDER]["resource_ids"] == [STOREFRONT]


async def test_an_entity_kept_by_two_resources_lists_both_by_id() -> None:
    rows = _entities(await _answer(_kept_twice(), [DOMAIN]))
    assert rows[INVOICE]["resource_ids"] == sorted([BILLING, STOREFRONT])


async def test_every_resource_of_the_graph_is_listed_sorted_and_coloured_by_its_place() -> None:
    answer = await _answer(resource_model_graph(), [DOMAIN])
    assert answer.resources == [
        {"id": BILLING, "label": "BillingDatabase", "color": DOMAIN_PALETTE[0]},
        {"id": SOCKET, "label": "SocketChannelController", "color": DOMAIN_PALETTE[1]},
        {"id": STOREFRONT, "label": "StorefrontDatabase", "color": DOMAIN_PALETTE[2]},
    ]


async def test_the_resources_do_not_depend_on_the_domains_asked_for() -> None:
    assert (await _answer(resource_model_graph(), [])).resources == (await _answer(resource_model_graph(), [DOMAIN])).resources


async def test_a_graph_that_says_where_entities_lie_knows_its_storage() -> None:
    assert (await _answer(resource_model_graph(), [DOMAIN])).storage_known is True
    assert (await _answer(resource_model_graph(), [])).storage_known is True


async def test_a_graph_of_1_5_lists_its_resources_but_not_where_entities_lie() -> None:
    answer = await _answer(resource_model_graph_1_5(), [DOMAIN])
    assert [row["id"] for row in answer.resources] == [BILLING, SOCKET, STOREFRONT]
    assert answer.storage_known is False
    assert {tuple(row["resource_ids"]) for row in _entities(answer).values()} == {()}


async def test_the_answer_keeps_its_contract() -> None:
    answer = await _answer(_kept_twice(), [DOMAIN])
    jsonschema.validate(answer.domain_slices, ListEntitiesDomainSlicesJson._json_schema)
    jsonschema.validate(answer.resources, ListEntitiesResourcesJson._json_schema)
