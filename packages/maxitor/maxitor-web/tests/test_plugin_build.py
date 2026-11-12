# packages/maxitor/maxitor-web/tests/test_plugin_build.py
"""
``maxitor plugin build``: an author builds the frontend with the core's own step; the core named must be the one
installed; without Docker the command says what to install; the build's first error is the one printed.
"""

from __future__ import annotations

import shutil
import sys
from importlib.metadata import version as package_version
from pathlib import Path

import pytest
from maxitor.core.plugins.plugin_processes import EnvironmentInstallError
from maxitor.web import launch, plugin_build

TEMPLATE = Path(__file__).resolve().parents[3] / "maxitor-plugin-template"
CORE = package_version("maxitor")


@pytest.fixture
def plugin(tmp_path: Path) -> Path:
    """A copy of the plugin template without its installed packages."""
    root = tmp_path / "plugin"
    shutil.copytree(TEMPLATE, root, ignore=shutil.ignore_patterns("node_modules", ".next", "__pycache__"))
    return root


def test_another_core_than_the_installed_one_is_refused_with_what_to_install(plugin: Path) -> None:
    assert plugin_build.build(plugin, "9.9.9") == (
        2, f'maxitor {CORE} is installed; pip install "maxitor[plugins]==9.9.9" to build for the core 9.9.9'
    )


def test_without_docker_the_command_says_what_to_install(plugin: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(plugin_build.shutil, "which", lambda name: None)
    assert plugin_build.build(plugin, CORE) == (2, plugin_build.DOCKER_HINT)


def test_the_build_answers_the_image_or_the_first_error(plugin: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    given: list[tuple[str, Path]] = []

    async def built(self: object, schema: str, sha256: str, source: Path) -> str:
        given.append((schema, source))
        return f"maxitor-plugin/{schema}-frontend:{sha256[:12]}-{CORE}"

    monkeypatch.setattr(plugin_build.shutil, "which", lambda name: "/usr/bin/docker")
    monkeypatch.setattr(plugin_build.FrontendBuilderController, "build", built)
    code, image = plugin_build.build(plugin, CORE, tmp_path / "work")
    assert code == 0 and image.startswith("maxitor-plugin/notes_") and image.endswith(f"-{CORE}")
    assert given[0][1] == plugin / "web"

    async def failing(self: object, schema: str, sha256: str, source: Path) -> str:
        raise EnvironmentInstallError("app/[org]/page.tsx(12,7): error TS2322: Type 'number' is not assignable to type 'string'.")

    monkeypatch.setattr(plugin_build.FrontendBuilderController, "build", failing)
    assert plugin_build.build(plugin, CORE, tmp_path / "work") == (
        1, "app/[org]/page.tsx(12,7): error TS2322: Type 'number' is not assignable to type 'string'."
    )


def test_the_command_runs_through_maxitor_plugin_build(plugin: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setattr(sys, "argv", ["maxitor", "plugin", "build", str(plugin), "--core", "9.9.9"])
    with pytest.raises(SystemExit) as stopped:
        launch.main()
    assert stopped.value.code == 2 and "to build for the core 9.9.9" in capsys.readouterr().err
