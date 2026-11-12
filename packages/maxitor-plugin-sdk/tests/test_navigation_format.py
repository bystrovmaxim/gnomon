"""
Navigation format 3 (spec 082, FR-006, FR-007): the tree only. Formats 1 and 2 are refused by name, and a node that
declares what its page gives — its history, its controls — or a room is refused naming the node.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator
from maxitor_plugin_sdk.checks import NAVIGATION_FORMAT_1, NAVIGATION_FORMAT_2, SCHEMAS, check_plugin

TEMPLATE = Path(__file__).resolve().parents[2] / "maxitor-plugin-template"
NAVIGATION = Path("src") / "maxitor_notes" / "navigation.yaml"


def _template() -> dict:
    return yaml.safe_load((TEMPLATE / NAVIGATION).read_text(encoding="utf-8"))


def _copy(tmp_path: Path, document: dict) -> Path:
    copy = tmp_path / "plugin"
    shutil.copytree(TEMPLATE, copy, ignore=shutil.ignore_patterns("node_modules", ".next", "__pycache__"))
    (copy / NAVIGATION).write_text(yaml.safe_dump(document), encoding="utf-8")
    return copy


def _item_notes(document: dict) -> dict:
    return document["nodes"][0]["children"][0]["children"][0]


def test_the_template_is_format_3_and_passes() -> None:
    validator = Draft202012Validator(json.loads((SCHEMAS / "navigation-3.schema.json").read_text(encoding="utf-8")))
    assert _template()["navigation"] == 3
    assert list(validator.iter_errors(_template())) == []


@pytest.mark.parametrize(("format_", "refusal"), [(1, NAVIGATION_FORMAT_1), (2, NAVIGATION_FORMAT_2)])
def test_older_formats_are_refused_by_name(tmp_path: Path, format_: int, refusal: str) -> None:
    document = _template()
    document["navigation"] = format_
    assert check_plugin(_copy(tmp_path, document)) == [f"navigation.yaml: {refusal}"]


@pytest.mark.parametrize(("key", "value"), [("history", {"read": "list_item_notes"}), ("room", {"shared": ["view"]}), ("controls", {"views": {}})])
def test_a_node_that_declares_what_its_page_gives_is_refused_naming_it(tmp_path: Path, key: str, value: dict) -> None:
    document = _template()
    _item_notes(document)[key] = value
    assert check_plugin(_copy(tmp_path, document)) == [
        f"navigation.yaml: 'item-notes' declares {key}; the page gives its history and controls, and a room shares nothing"
    ]
