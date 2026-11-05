# packages/maxitor/maxitor-web/tests/test_own_graph_json.py
"""
Maxitor serves its own model as graph-json, like any AOA service (spec 029, FR-060, FR-061).

═══════════════════════════════════════════════════════════════════════════════
PURPOSE
═══════════════════════════════════════════════════════════════════════════════

``GET /examples/model/graph-json`` answers without a ``source``, with Maxitor's own
actions in the graph, an ``ETag``, and ``304`` to a request naming it; the answer is a
graph Maxitor itself can build, so its own address opens its own diagram.

═══════════════════════════════════════════════════════════════════════════════
ARCHITECTURE / DATA FLOW
═══════════════════════════════════════════════════════════════════════════════

::

    TestClient ──GET /examples/model/graph-json──► GetOwnGraphJsonAction ──► OwnModelGraphResource
"""

from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from maxitor.web.api.app import create_app
from maxitor.web.model.diagrams.resources.duckdb_graph_resource import DuckDBGraphResource


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    """A Maxitor application."""
    with TestClient(create_app()) as test_client:
        yield test_client


def test_maxitor_answers_with_its_own_model_and_no_source(client: TestClient) -> None:
    """No ``source`` is needed, and the room and diagram actions are in the graph."""
    answer = client.get("/examples/model/graph-json")
    actions = {node["label"] for node in json.loads(answer.json()["coordinator_json"])["nodes"] if node["type"] == "Action"}
    assert answer.status_code == 200
    assert {"JoinRoomAction", "SeedPageSettingsAction", "GetOwnGraphJsonAction", "ListEntitiesAction"} <= actions


def test_a_repeated_read_naming_the_tag_gets_304_and_no_body(client: TestClient) -> None:
    """The adapter's freshness headers: an ``ETag``, and ``304`` when nothing changed."""
    first = client.get("/examples/model/graph-json")
    again = client.get("/examples/model/graph-json", headers={"If-None-Match": first.headers["etag"]})
    assert first.headers["etag"].startswith('"') and (again.status_code, again.content) == (304, b"")


def test_the_answer_is_a_graph_maxitor_can_build(client: TestClient) -> None:
    """What Maxitor serves about itself, Maxitor reads like any service's graph-json."""
    payload = json.loads(client.get("/examples/model/graph-json").json()["coordinator_json"])
    graph = DuckDBGraphResource.build_from_json(payload)
    domains = {row["label"] for row in graph.execute_fetch_dicts("SELECT label FROM domain")}
    assert {"RoomsDomain", "CoreDomain"} <= domains


def test_maxitor_s_own_entity_is_stored_by_the_duckdb_graph(client: TestClient) -> None:
    """Protocol 1.6: ``NodeCoreEntity`` has one ``entity_resource`` edge, to ``DuckDBGraphResource`` (spec 061, FR-015)."""
    payload = json.loads(client.get("/examples/model/graph-json").json()["coordinator_json"])
    entity = next(node["id"] for node in payload["nodes"] if node["type"] == "Entity" and node["label"] == "NodeCoreEntity")
    targets = [edge["target_id"] for edge in payload["edges"] if edge["type"] == "entity_resource" and edge["source_id"] == entity]
    labels = {node["id"]: node["label"] for node in payload["nodes"]}
    assert payload["schema_version"] == "1.6"
    assert [labels[target] for target in targets] == ["DuckDBGraphResource"]
