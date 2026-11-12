# packages/maxitor-plugin-sdk/tests/test_passport_3.py
"""
Passport format 3 (spec 080): the frontend travels as sources, which the core builds; format 2 and its
``frontend.build`` are refused by name, and the sources must carry the lock they are built by.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import yaml
from maxitor_plugin_sdk.checks import FRONTEND_BUILD, PASSPORT_FORMAT_2, check_plugin

TEMPLATE = Path(__file__).resolve().parents[2] / "maxitor-plugin-template"
PASSPORT = Path("src") / "maxitor_notes" / "maxitor-plugin.yaml"


def _copy(tmp_path: Path) -> Path:
    copy = tmp_path / "plugin"
    shutil.copytree(TEMPLATE, copy, ignore=shutil.ignore_patterns("node_modules", ".next", "__pycache__"))
    return copy


def _rewrite(plugin: Path, change) -> None:
    passport = yaml.safe_load((plugin / PASSPORT).read_text(encoding="utf-8"))
    change(passport)
    (plugin / PASSPORT).write_text(yaml.safe_dump(passport), encoding="utf-8")


def test_the_template_is_format_3_with_its_sources_and_passes(tmp_path: Path) -> None:
    plugin = _copy(tmp_path)
    passport = yaml.safe_load((plugin / PASSPORT).read_text(encoding="utf-8"))
    assert passport["passport"] == 3 and passport["frontend"]["source"] == "maxitor_notes/web"
    assert check_plugin(plugin) == []


def test_format_2_is_refused_by_name(tmp_path: Path) -> None:
    plugin = _copy(tmp_path)
    _rewrite(plugin, lambda p: p.update(passport=2))
    assert check_plugin(plugin) == [f"maxitor-plugin.yaml: {PASSPORT_FORMAT_2}"]


def test_frontend_build_is_refused_by_name(tmp_path: Path) -> None:
    plugin = _copy(tmp_path)
    _rewrite(plugin, lambda p: p["frontend"].update(build="maxitor_notes/_web"))
    assert check_plugin(plugin) == [f"maxitor-plugin.yaml: {FRONTEND_BUILD}"]


def test_sources_without_their_lock_are_refused(tmp_path: Path) -> None:
    plugin = _copy(tmp_path)
    (plugin / "web" / "package-lock.json").unlink()
    assert check_plugin(plugin) == ["web/package-lock.json: missing; the core builds the frontend strictly by it"]
