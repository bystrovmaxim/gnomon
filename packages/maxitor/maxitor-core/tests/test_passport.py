# packages/maxitor/maxitor-core/tests/test_passport.py
"""The core's passport: valid against its schema and answered with the package's version."""

from __future__ import annotations

import json
from importlib.metadata import version
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from maxitor.core.actions.passport import PASSPORT_FILE

from tests.fakes import World

SCHEMA = Path(PASSPORT_FILE).parent / "schemas" / "core-passport-1.schema.json"


def test_the_passport_file_keeps_its_schema() -> None:
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    document = yaml.safe_load(PASSPORT_FILE.read_text(encoding="utf-8"))
    assert list(Draft202012Validator(schema).iter_errors(document)) == []


def test_the_action_answers_the_package_version_to_anyone() -> None:
    answer = World().client.get("/api/v1/core/passport")
    assert answer.status_code == 200
    assert answer.json() == {
        "passport": 1,
        "id": "maxitor",
        "version": version("maxitor"),
        "reads": {"plugin-passport": [3], "plugin-schema": [1], "navigation": [2], "foreign-keys": [1]},
        "sdk": 1,
    }
