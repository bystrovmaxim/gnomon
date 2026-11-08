# packages/maxitor-plugin-template/src/maxitor_notes/passport.py
"""The plugin's own passport, read once: the backend takes its id and name from it rather than repeating them."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

PASSPORT = Path(__file__).with_name("maxitor-plugin.yaml")


def read_passport() -> dict[str, Any]:
    """The passport ``maxitor-plugin.yaml`` beside this module, as a mapping."""
    document = yaml.safe_load(PASSPORT.read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError(f"{PASSPORT.name} is not a mapping")
    return document
