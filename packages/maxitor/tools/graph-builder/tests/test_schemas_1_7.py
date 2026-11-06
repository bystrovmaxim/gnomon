# packages/maxitor/tools/graph-builder/tests/test_schemas_1_7.py
"""Protocol 1.7: the ``DataSource`` node and the ``resource_data_source`` edge — what passes, what is refused."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator
from maxitor.graph_builder.schemas import check_graph

FIXTURES = Path(__file__).parent / "fixtures"


def _sample(version: str) -> dict[str, Any]:
    """The small graph of that version kept beside the tests."""
    document: dict[str, Any] = json.loads((FIXTURES / f"graph-{version}.json").read_text(encoding="utf-8"))
    return document


PROTOCOL_1_7 = Path(__file__).parents[4] / "open-gnomon-protocol" / "graph" / "1.7.json"
_DATA_SOURCE_ROWS = ("DataSource", "resource_data_source")


def _is_data_source_row(document: dict[str, Any], row: dict[str, Any]) -> bool:
    """A ``DataSource`` node, its ``application`` edge or a ``resource_data_source`` edge of ``document``."""
    sources = {node["id"] for node in document["nodes"] if node["type"] == "DataSource"}
    return row["type"] in _DATA_SOURCE_ROWS or row.get("source_id") in sources


def _errors_of_row(version: str, kind: str, row: dict[str, Any]) -> list[Any]:
    """The errors of ``row`` alone, put in place of the 1.7 sample's first row of the same type in ``kind`` (``nodes`` or ``edges``)."""
    document = _sample("1.7")
    document["schema_version"] = version
    rows = document[kind]
    first = next(index for index, existing in enumerate(rows) if existing["type"] == row["type"])
    rows[first] = row
    schema = json.loads((PROTOCOL_1_7.parent / f"{version}.json").read_text(encoding="utf-8"))
    return [error for error in Draft202012Validator(schema).iter_errors(document) if list(error.path)[:2] == [kind, first]]


def _data_source_node(**changes: Any) -> dict[str, Any]:
    """The ``DataSource`` node of the 1.7 sample, with ``changes`` applied."""
    node = next(node for node in _sample("1.7")["nodes"] if node["type"] == "DataSource")
    return {**node, **changes}


def _data_source_edge(**changes: Any) -> dict[str, Any]:
    """A ``resource_data_source`` edge of the 1.7 sample, with ``changes`` applied."""
    edge = next(edge for edge in _sample("1.7")["edges"] if edge["type"] == "resource_data_source")
    return {**edge, **changes}


def test_the_fixture_of_1_7_is_1_6_with_a_data_source() -> None:
    """The 1.7 sample has a data source on the application, a resource on it and a resource without one; without them it is the 1.6 sample."""
    document = _sample("1.7")
    check_graph(document)
    kinds = {node["id"]: node["type"] for node in document["nodes"]}
    on_source = [edge for edge in document["edges"] if edge["type"] == "resource_data_source"]
    assert {(kinds[edge["source_id"]], kinds[edge["target_id"]]) for edge in on_source} == {("Resource", "DataSource")}
    assert [kinds[edge["target_id"]] for edge in document["edges"] if kinds.get(edge["source_id"]) == "DataSource"] == ["Application"]
    assert {node_id for node_id, kind in kinds.items() if kind == "Resource"} - {edge["source_id"] for edge in on_source}
    older = _sample("1.6")
    assert [edge for edge in document["edges"] if not _is_data_source_row(document, edge)] == older["edges"]
    assert [node for node in document["nodes"] if node["type"] != "DataSource"] == older["nodes"]


def test_a_graph_of_1_7_with_no_data_source_passes() -> None:
    """A data source is optional: the 1.6 sample declared as 1.7 is a graph of 1.7."""
    check_graph({**_sample("1.6"), "schema_version": "1.7"})


def test_the_words_of_1_7_pass_and_1_6_does_not_know_them() -> None:
    """``DataSource`` and ``resource_data_source`` are 1.7 words: valid in 1.7, refused by 1.6."""
    assert _errors_of_row("1.7", "nodes", _data_source_node()) == []
    assert _errors_of_row("1.7", "edges", _data_source_edge()) == []
    assert _errors_of_row("1.6", "nodes", _data_source_node())
    assert _errors_of_row("1.6", "edges", _data_source_edge())


@pytest.mark.parametrize(
    "properties",
    [{}, {"description": "Billing database", "dsn": "postgres://"}, {"description": 7}],
    ids=["no description", "another property", "a description that is not a string"],
)
def test_a_data_source_of_another_shape_is_refused(properties: dict[str, Any]) -> None:
    """A data source carries exactly its string description; anything else is refused."""
    assert _errors_of_row("1.7", "nodes", _data_source_node(properties=properties))


@pytest.mark.parametrize(
    "changes",
    [{"properties": {"note": "x"}}, {"relationship": "Composition"}, {"is_dag": False}],
    ids=["a property", "another relationship", "not a DAG edge"],
)
def test_a_data_source_edge_of_another_shape_is_refused(changes: dict[str, Any]) -> None:
    """The edge has no properties, the relationship ``Aggregation`` and ``is_dag`` true; anything else is refused."""
    assert _errors_of_row("1.7", "edges", _data_source_edge(**changes))
