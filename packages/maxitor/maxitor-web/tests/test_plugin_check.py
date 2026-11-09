# packages/maxitor/maxitor-web/tests/test_plugin_check.py
"""``maxitor plugin check``: the template fits the core it names; each kind of misfit is refused and named."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pytest
import yaml
from maxitor.web import launch
from maxitor.web.plugin_check import check

TEMPLATE = Path(__file__).resolve().parents[3] / "maxitor-plugin-template"
PACKAGE = Path("src/maxitor_notes")


@pytest.fixture
def plugin(tmp_path: Path) -> Path:
    """A copy of the plugin template's package and pyproject.toml."""
    root = tmp_path / "plugin"
    shutil.copytree(TEMPLATE / PACKAGE, root / PACKAGE, ignore=shutil.ignore_patterns("_web", "__pycache__"))
    shutil.copy(TEMPLATE / "pyproject.toml", root / "pyproject.toml")
    return root


def edit(plugin: Path, name: str, key: str, value: object) -> None:
    path = plugin / PACKAGE / name
    document = yaml.safe_load(path.read_text(encoding="utf-8"))
    document[key] = value
    path.write_text(yaml.safe_dump(document, sort_keys=False), encoding="utf-8")


def test_the_template_fits_maxitor_4(plugin: Path) -> None:
    assert check(plugin, "4.0.0") == []


def test_a_core_outside_the_range_is_refused(plugin: Path) -> None:
    assert check(plugin, "3.29.0") == [
        "core_range: io.github.bystrovmaxim.notes 0.2.0 needs maxitor >=4.0,<5; this core is maxitor 3.29.0"
    ]


def test_a_format_the_core_does_not_read_is_refused(plugin: Path) -> None:
    edit(plugin, "navigation.yaml", "navigation", 2)
    problems = check(plugin, "4.0.0")
    assert any(p.startswith("navigation.yaml: navigation:") for p in problems)


def test_a_foreign_sdk_major_is_refused(plugin: Path) -> None:
    edit(plugin, "maxitor-plugin.yaml", "sdk", 2)
    assert check(plugin, "4.0.0") == [
        "sdk_major: io.github.bystrovmaxim.notes 0.2.0 is built with SDK 2; maxitor 4.0.0 is built with SDK 1"
    ]


def test_a_domain_without_events_is_refused(plugin: Path) -> None:
    domain = plugin / PACKAGE / "notes_domain.py"
    domain.write_text(domain.read_text(encoding="utf-8").replace("    events = ()\n", ""), encoding="utf-8")
    assert check(plugin, "4.0.0") == ["maxitor_notes/notes_domain.py: the domain NotesDomain declares no events"]


def test_the_command_exits_with_the_check(
    plugin: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "argv", ["maxitor", "plugin", "check", str(plugin), "--core", "4.0.0"])
    with pytest.raises(SystemExit) as fits:
        launch.main()
    assert fits.value.code == 0 and "the plugin fits maxitor 4.0.0" in capsys.readouterr().out
    monkeypatch.setattr(sys, "argv", ["maxitor", "plugin", "check", str(plugin), "--core", "5.0.0"])
    with pytest.raises(SystemExit) as refused:
        launch.main()
    assert refused.value.code == 1 and "core_range:" in capsys.readouterr().out
