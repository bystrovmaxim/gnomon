# packages/maxitor/tools/graph-builder/tests/test_schemas_1_8.py
"""Protocol 1.8: the vocabulary and schema of 1.7 under a new version; its sample is a graph AOA writes at 1.8."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from maxitor.graph_builder.schemas import SCHEMA_VERSIONS, check_graph

FIXTURES = Path(__file__).parent / "fixtures"


def _sample(version: str) -> dict[str, Any]:
    """The small graph of that version kept beside the tests."""
    document: dict[str, Any] = json.loads((FIXTURES / f"graph-{version}.json").read_text(encoding="utf-8"))
    return document


def _targets(document: dict[str, Any], edge_type: str) -> dict[str, str]:
    """Each source of an ``edge_type`` edge, mapped to its target."""
    return {edge["source_id"]: edge["target_id"] for edge in document["edges"] if edge["type"] == edge_type}


def test_1_8_is_a_known_version() -> None:
    """``graph-builder`` reads 1.8 after every earlier version."""
    assert SCHEMA_VERSIONS[-2:] == ("1.7", "1.8")


def test_the_sample_of_1_8_passes() -> None:
    """The 1.8 sample passes the schema of 1.8."""
    check_graph(_sample("1.8"))


def test_the_sample_of_1_8_keeps_the_rules_of_1_8() -> None:
    """Every resource that stores an entity names a data source, and an entity specializes one stored in another data source."""
    document = _sample("1.8")
    stored_in = _targets(document, "entity_resource")
    source_of = _targets(document, "resource_data_source")
    assert set(stored_in.values()) <= set(source_of)
    parent = _targets(document, "parent_entity")
    assert any(source_of[stored_in[child]] != source_of[stored_in[head]] for child, head in parent.items())


def test_the_sample_of_1_8_is_1_7_with_a_second_data_source() -> None:
    """Without its second data source, that data source's edges and its version, the 1.8 sample is the 1.7 sample."""
    document = _sample("1.8")
    second = "aoa.demo.model.billing.data_sources.ledger_archive_data_source.LedgerArchiveDataSource"
    document["schema_version"] = "1.7"
    document["nodes"] = [node for node in document["nodes"] if node["id"] != second]
    document["edges"] = [edge for edge in document["edges"] if second not in (edge["source_id"], edge["target_id"])]
    assert document == _sample("1.7")
