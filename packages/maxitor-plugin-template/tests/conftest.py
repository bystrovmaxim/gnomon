# packages/maxitor-plugin-template/tests/conftest.py
"""A fresh copy of the template per test, so a test can break one file and see the check refuse it."""

import shutil
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
import yaml

TEMPLATE = Path(__file__).resolve().parents[1]
PACKAGE = Path("src/maxitor_notes")


@pytest.fixture
def plugin(tmp_path: Path) -> Path:
    """The template's pyproject.toml and Python package, copied into a temporary folder."""
    root = tmp_path / "plugin"
    shutil.copytree(TEMPLATE / PACKAGE, root / PACKAGE, ignore=shutil.ignore_patterns("_web"))
    shutil.copy(TEMPLATE / "pyproject.toml", root / "pyproject.toml")
    return root


@pytest.fixture
def edit(plugin: Path) -> Callable[[str, Callable[[dict[str, Any]], None]], None]:
    """Change one YAML file of the copied plugin: ``edit("navigation.yaml", lambda doc: ...)``."""

    def change(name: str, apply: Callable[[dict[str, Any]], None]) -> None:
        path = plugin / PACKAGE / name
        document = yaml.safe_load(path.read_text(encoding="utf-8"))
        apply(document)
        path.write_text(yaml.safe_dump(document, allow_unicode=True, sort_keys=False), encoding="utf-8")

    return change


@pytest.fixture
def action(plugin: Path) -> Callable[[str], None]:
    """Give the copied plugin an action file ``actions/<name>_action.py``, so its navigation may read it."""

    def add(name: str) -> None:
        (plugin / PACKAGE / "actions" / f"{name}_action.py").write_text("", encoding="utf-8")

    return add
