# tests/scripts/test_schema_copies.py
"""The Open Gnomon Protocol is a folder with no code; every Python copy of its schemas is byte for byte its source."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
PROTOCOL = REPO_ROOT / "packages" / "open-gnomon-protocol"
RAW_AOA = "https://raw.githubusercontent.com/bystrovmaxim/aoa/main/packages/open-gnomon-protocol/"
RAW_GNOMON = "https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/"
# 1.0-1.5 were published from aoa and keep that address; from 1.6 on the protocol is served from this repository.
SERVED_FROM_AOA = ("1.0", "1.1", "1.2", "1.3", "1.4", "1.5")

# Each copy a Python package keeps beside its code, and the protocol file it copies.
COPIES = {
    "packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.0.json": "graph/1.0.json",
    "packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.1.json": "graph/1.1.json",
    "packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.2.json": "graph/1.2.json",
    "packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.3.json": "graph/1.3.json",
    "packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.4.json": "graph/1.4.json",
    "packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.5.json": "graph/1.5.json",
    "packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.6.json": "graph/1.6.json",
    "packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.7.json": "graph/1.7.json",
}

# SHA-256 of each published schema without its ``$id``, as ``json.dumps(..., sort_keys=True)``.
# A published version never changes: a new shape of the graph is a new version, not an edit.
PUBLISHED = {
    "1.0": "77f1a7960a09dcb63b31d75e9d08467dd34c28e563281f959beb087c615b9bb4",
    "1.1": "4d5e7bbe4efadbbba63a03a598a8784c240db5d81322cd0fd794d726c2b5adde",
    "1.2": "8b442a13f523b27e07390626aa6ee150f85cacf1fbd54d0373fc4933fd5043ce",
    "1.3": "585ce2d71f85144a2e9269605d31873eabf43f5f9d140aa119b54a8ecf0962bd",
    "1.4": "6d8932035c3e77e8c8b16235dc8edf1926371a305fbb17e0249bfa6dc2de25ef",
    "1.5": "7154487120722a23482244f31112f4ddb999ed9a4df67d40b49533b2dd27d1f3",
    "1.6": "27aee187b33ea884d08b5f5b101c69c26b7524014a56a53cf33d74ee5591bb38",
    "1.7": "cc07ed10773c8f4174113c4962165d721e184caf891dc960d3b3c3a587c59069",
    "1.8": "816d238f7b4c3c327a3b758693c329993b6e7f015e562590dca60d15ac0c1ecb",
}


@pytest.mark.parametrize(("copy", "source"), sorted(COPIES.items()))
def test_a_copy_is_its_source_byte_for_byte(copy: str, source: str) -> None:
    """A copy that drifts from the protocol's file is named together with that file."""
    assert (REPO_ROOT / copy).read_bytes() == (PROTOCOL / source).read_bytes(), (
        f"{copy} differs from packages/open-gnomon-protocol/{source}; copy the protocol's file over it"
    )


def test_the_protocol_holds_no_code() -> None:
    """The protocol is its specification, its changelog, its version and its schemas — nothing any language would have to run."""
    held = sorted(str(p.relative_to(PROTOCOL)) for p in PROTOCOL.rglob("*") if p.is_file())
    assert held == ["CHANGELOG.md", "README.md", "graph/1.0.json", "graph/1.1.json", "graph/1.2.json", "graph/1.3.json", "graph/1.4.json", "graph/1.5.json", "graph/1.6.json", "graph/1.7.json", "graph/1.8.json", "version.toml"]


@pytest.mark.parametrize("version", sorted(PUBLISHED))
def test_a_published_version_never_changes(version: str) -> None:
    """Each schema's ``$id`` is the raw address of its own file, and its content has the hash it was published with."""
    schema = json.loads((PROTOCOL / "graph" / f"{version}.json").read_text(encoding="utf-8"))
    raw = RAW_AOA if version in SERVED_FROM_AOA else RAW_GNOMON
    assert schema.pop("$id") == f"{raw}graph/{version}.json"
    assert hashlib.sha256(json.dumps(schema, sort_keys=True).encode()).hexdigest() == PUBLISHED[version]


def test_1_6_is_1_5_with_the_entity_resource_edge() -> None:
    """1.6 keeps every rule of 1.5 and adds one edge type: nothing else differs."""
    old = json.loads((PROTOCOL / "graph" / "1.5.json").read_text(encoding="utf-8"))
    new = json.loads((PROTOCOL / "graph" / "1.6.json").read_text(encoding="utf-8"))
    for schema in (old, new):
        del schema["$id"]
        del schema["properties"]["schema_version"]
    added = new["$defs"].pop("entity_resource")
    assert new["$defs"]["link"]["oneOf"].pop() == {"$ref": "#/$defs/entity_resource"}
    assert new == old
    assert added == {
        "allOf": [
            {"$ref": "#/$defs/link_row"},
            {
                "properties": {
                    "type": {"const": "entity_resource"},
                    "relationship": {"const": "Aggregation"},
                    "is_dag": {"const": True},
                    "properties": {"type": "object", "additionalProperties": False, "maxProperties": 0},
                }
            },
        ]
    }


def test_1_7_is_1_6_with_the_data_source() -> None:
    """1.7 keeps every rule of 1.6 and adds one node type and one edge type: nothing else differs."""
    old = json.loads((PROTOCOL / "graph" / "1.6.json").read_text(encoding="utf-8"))
    new = json.loads((PROTOCOL / "graph" / "1.7.json").read_text(encoding="utf-8"))
    for schema in (old, new):
        del schema["$id"]
        del schema["properties"]["schema_version"]
    node = new["$defs"].pop("data_source")
    edge = new["$defs"].pop("resource_data_source")
    assert new["$defs"]["vertex"]["oneOf"].pop() == {"$ref": "#/$defs/data_source"}
    assert new["$defs"]["link"]["oneOf"].pop() == {"$ref": "#/$defs/resource_data_source"}
    assert new == old
    assert node == {
        "allOf": [
            {"$ref": "#/$defs/row"},
            {
                "properties": {
                    "type": {"const": "DataSource"},
                    "properties": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["description"],
                        "properties": {"description": {"type": "string"}},
                    },
                }
            },
        ]
    }
    assert edge == {
        "allOf": [
            {"$ref": "#/$defs/link_row"},
            {
                "properties": {
                    "type": {"const": "resource_data_source"},
                    "relationship": {"const": "Aggregation"},
                    "is_dag": {"const": True},
                    "properties": {"type": "object", "additionalProperties": False, "maxProperties": 0},
                }
            },
        ]
    }


def test_1_8_is_1_7_with_its_own_version() -> None:
    """1.8 changes only rules a schema cannot check, each joining several rows: its schema is 1.7's under a new version."""
    old = json.loads((PROTOCOL / "graph" / "1.7.json").read_text(encoding="utf-8"))
    new = json.loads((PROTOCOL / "graph" / "1.8.json").read_text(encoding="utf-8"))
    assert new["properties"]["schema_version"] == {**old["properties"]["schema_version"], "const": "1.8"}
    for schema in (old, new):
        del schema["$id"]
        del schema["properties"]["schema_version"]
    assert new == old
