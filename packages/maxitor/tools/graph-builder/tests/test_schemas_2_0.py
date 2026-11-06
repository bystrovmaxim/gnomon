# packages/maxitor/tools/graph-builder/tests/test_schemas_2_0.py
"""Protocol 2.0: a resource names its entities, and there is no data source; its sample is the 1.8 sample written at 2.0."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from maxitor.graph_builder.schemas import SCHEMA_VERSIONS, GraphRefused, check_graph

FIXTURES = Path(__file__).parent / "fixtures"


def _sample(version: str) -> dict[str, Any]:
    """The small graph of that version kept beside the tests."""
    document: dict[str, Any] = json.loads((FIXTURES / f"graph-{version}.json").read_text(encoding="utf-8"))
    return document


def _pairs(document: dict[str, Any], edge_type: str) -> set[tuple[str, str]]:
    """The ends of every ``edge_type`` edge, source first."""
    return {(edge["source_id"], edge["target_id"]) for edge in document["edges"] if edge["type"] == edge_type}


def test_2_0_is_known_after_every_earlier_version() -> None:
    """``graph-builder`` reads 2.0 and still reads every 1.x version."""
    assert SCHEMA_VERSIONS[-3:] == ("1.7", "1.8", "2.0")


def test_the_sample_of_2_0_passes() -> None:
    """The 2.0 sample passes the schema of 2.0."""
    check_graph(_sample("2.0"))


def test_the_sample_of_2_0_turns_the_links_of_1_8_around() -> None:
    """Each entity's resource of 1.8 keeps it in 2.0, and one entity lies in a second resource as well."""
    kept = _pairs(_sample("2.0"), "resource_entity")
    turned = {(resource, entity) for entity, resource in _pairs(_sample("1.8"), "entity_resource")}
    assert turned < kept
    assert len({entity for _, entity in kept}) < len(kept)


@pytest.mark.parametrize(
    "element",
    [
        {"id": "a.Store", "type": "DataSource", "label": "Store", "properties": {"description": "A store."}},
        {"id": "a.E|entity_resource|a.R", "source_id": "a.E", "target_id": "a.R", "type": "entity_resource", "relationship": "Aggregation", "is_dag": True, "properties": {}},
        {"id": "a.R|resource_data_source|a.S", "source_id": "a.R", "target_id": "a.S", "type": "resource_data_source", "relationship": "Aggregation", "is_dag": True, "properties": {}},
    ],
)
def test_the_words_of_the_data_source_are_refused(element: dict[str, Any]) -> None:
    """A data source node, and the edges of an entity to its resource and of a resource to its data source, are no words of 2.0."""
    array = "edges" if "source_id" in element else "nodes"
    document = {"schema_version": "2.0", "nodes": [], "edges": [], array: [element]}
    with pytest.raises(GraphRefused) as refused:
        check_graph(document)
    assert refused.value.path.startswith(f"{array}/0")


@pytest.mark.parametrize("changes", [{"relationship": "Composition"}, {"is_dag": False}, {"properties": {"note": "x"}}])
def test_a_resource_entity_edge_of_another_shape_is_refused(changes: dict[str, Any]) -> None:
    """``resource_entity`` is an ``Aggregation``, ``is_dag`` ``true``, with no properties."""
    edge = {"id": "a.R|resource_entity|a.E", "source_id": "a.R", "target_id": "a.E", "type": "resource_entity", "relationship": "Aggregation", "is_dag": True, "properties": {}}
    check_graph({"schema_version": "2.0", "nodes": [], "edges": [edge]})
    with pytest.raises(GraphRefused):
        check_graph({"schema_version": "2.0", "nodes": [], "edges": [{**edge, **changes}]})
