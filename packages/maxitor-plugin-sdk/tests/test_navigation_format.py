# packages/maxitor-plugin-sdk/tests/test_navigation_format.py
"""Navigation format 2 (spec 078, FR-016): format 1 is refused by name, and no node declares controls."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator
from maxitor_plugin_sdk.checks import NAVIGATION_FORMAT_1, SCHEMAS, check_plugin

TEMPLATE = Path(__file__).resolve().parents[2] / "maxitor-plugin-template"
NAVIGATION = TEMPLATE / "src" / "maxitor_notes" / "navigation.yaml"


def _schema_errors(document: object) -> list[str]:
    validator = Draft202012Validator(json.loads((SCHEMAS / "navigation-2.schema.json").read_text(encoding="utf-8")))
    return [error.message for error in validator.iter_errors(document)]


def _template() -> dict:
    return yaml.safe_load(NAVIGATION.read_text(encoding="utf-8"))


def test_the_template_is_format_2_and_passes() -> None:
    assert _template()["navigation"] == 2
    assert _schema_errors(_template()) == []


def test_format_1_is_refused_by_name(tmp_path: Path) -> None:
    copy = tmp_path / "plugin"
    import shutil

    shutil.copytree(TEMPLATE, copy, ignore=shutil.ignore_patterns("node_modules", ".next", "_web", "__pycache__"))
    navigation = copy / "src" / "maxitor_notes" / "navigation.yaml"
    document = _template()
    document["navigation"] = 1
    navigation.write_text(yaml.safe_dump(document), encoding="utf-8")
    assert f"navigation.yaml: {NAVIGATION_FORMAT_1}" in check_plugin(copy)


def test_a_node_with_controls_is_refused() -> None:
    document = _template()
    document["nodes"][0]["controls"] = {"views": {"param": "view", "default": "list", "options": []}}
    assert any("controls" in message for message in _schema_errors(document))


@pytest.mark.parametrize("name", ["at", "mode", "from", "_room"])
def test_room_shared_may_not_name_the_cores_parameters(name: str) -> None:
    document = _template()
    document["nodes"][0]["room"] = {"shared": [name]}
    assert _schema_errors(document)
