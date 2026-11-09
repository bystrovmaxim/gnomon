# tests/test_list_entities_batched.py
"""
Tests that ``list-entities`` reads every domain of a request in a few queries and answers as if each were asked alone.

═══════════════════════════════════════════════════════════════════════════════
PURPOSE
═══════════════════════════════════════════════════════════════════════════════

The whole system's ERD asks for every domain at once. Reading each domain by its own queries made the request on a
model of 1 000 tables take two seconds (#85). The slices are now read together, tagged with the domain each row is
selected for. These tests pin that a slice read together equals the slice read alone — in a domain's own tables and
with its 1-hop neighbours, on the reference graph where neighbours of one domain are tables of another — and that the
number of queries does not grow with the number of domains.
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path
from typing import Any

import pytest
from maxitor.web.model.diagrams.actions.list_entities_action import ListEntitiesAction
from maxitor.web.model.diagrams.resources.duckdb_graph_storage import DuckDBGraphStorage

_REFERENCE_GRAPH = (
    Path(__file__).resolve().parents[4] / "specs/025-graph-index-memory/data/ref-graph-2026-10-26.json.gz"
)


@pytest.fixture(scope="module")
def duck() -> DuckDBGraphStorage:
    """The reference graph loaded into the store."""
    data = json.loads(gzip.decompress(_REFERENCE_GRAPH.read_bytes()))
    data = data.get("coordinator_json", data)
    return DuckDBGraphStorage.build_from_json(json.loads(data) if isinstance(data, str) else data)


def _domains(duck: DuckDBGraphStorage) -> list[str]:
    return [str(row["id"]) for row in duck.execute_fetch_dicts("SELECT id FROM domain ORDER BY id")]


@pytest.mark.parametrize("include_neighbors", [False, True])
def test_a_slice_read_together_equals_the_slice_read_alone(duck: DuckDBGraphStorage, include_neighbors: bool) -> None:
    quals = _domains(duck)
    together = ListEntitiesAction._slice_payloads(duck, quals, include_neighbors)
    assert len(quals) > 3
    assert list(together) == quals
    if include_neighbors:
        # A neighbour of one domain is a table of another, so some table is in two slices.
        shown = [entity["id"] for part in together.values() for entity in part["entities"]]
        assert len(shown) > len(set(shown))
    for qual in quals:
        alone = ListEntitiesAction._slice_payloads(duck, [qual], include_neighbors)[qual]
        assert together[qual] == alone, qual


def test_the_queries_do_not_grow_with_the_domains(duck: DuckDBGraphStorage, monkeypatch: pytest.MonkeyPatch) -> None:
    quals = _domains(duck)
    assert len(quals) > 3
    calls: list[str] = []
    read = duck.execute_fetch_dicts

    def counted(sql: str, params: Any = None) -> list[dict[str, Any]]:
        calls.append(sql)
        return read(sql, params) if params is not None else read(sql)

    monkeypatch.setattr(duck, "execute_fetch_dicts", counted)
    ListEntitiesAction._slice_payloads(duck, quals[:1], True)
    one = len(calls)
    calls.clear()
    ListEntitiesAction._slice_payloads(duck, quals, True)
    assert len(calls) == one


def test_every_domain_has_its_label(duck: DuckDBGraphStorage) -> None:
    quals = [*_domains(duck), "missing.NoSuchDomain"]
    labels = ListEntitiesAction._domain_labels(duck, quals)
    assert list(labels) == quals
    assert labels["missing.NoSuchDomain"] == "missing.NoSuchDomain"
    assert all(labels[qual] for qual in quals)
