# packages/maxitor/maxitor-core/tests/test_frontend_build.py
"""
The core's build of a plugin's frontend: each check refuses the sources by name before anything is downloaded;
every @maxitor/* entry is pointed at the core's own copy and only those; the fetch reaches npm without running the
plugin's code and the build runs the plugin's code without a network; the error is the first line that says what
failed.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from maxitor.core.plugins.frontend_build import LIBRARY, check_lock, check_names, library_manifests, prepare, rewrite
from maxitor.core.plugins.frontend_builder import FrontendBuilderController, first_error
from maxitor.core.plugins.plugin_processes import EnvironmentInstallError

REPO = Path(__file__).resolve().parents[4]
TEMPLATE_WEB = REPO / "packages" / "maxitor-plugin-template" / "web"
CORE = "9.9.9"


def template() -> tuple[dict[str, Any], dict[str, Any]]:
    """The template's package.json and lock, as a plugin's copy of it carries them."""
    package = json.loads((TEMPLATE_WEB / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((TEMPLATE_WEB / "package-lock.json").read_text(encoding="utf-8"))
    return package, lock


def refusal(call: Any) -> str:
    with pytest.raises(EnvironmentInstallError) as caught:
        call()
    return caught.value.reason


def test_a_missing_lock_is_refused() -> None:
    package, _ = template()
    assert refusal(lambda: check_lock(package, None)) == "the lock file is missing or does not match package.json"


def test_a_lock_that_does_not_match_the_package_is_refused() -> None:
    package, lock = template()
    package["dependencies"]["left-pad"] = "^1.3.0"
    assert refusal(lambda: check_lock(package, lock)) == "the lock file is missing or does not match package.json"


def test_the_templates_lock_matches_its_package() -> None:
    package, lock = template()
    assert check_lock(package, lock) == (package, lock)


def test_a_maxitor_package_the_core_does_not_carry_is_refused() -> None:
    package, lock = template()
    package["dependencies"]["@maxitor/charts"] = "^1.0.0"
    assert refusal(lambda: rewrite(package, lock, library_manifests(), CORE)) == "@maxitor/charts is not a package of the core 9.9.9"


def test_every_maxitor_entry_points_at_the_cores_copy_and_nothing_else_changes() -> None:
    package, lock = template()
    manifests = library_manifests()
    new_package, new_lock = rewrite(package, lock, manifests, CORE)
    assert new_package["dependencies"]["@maxitor/panel"] == "file:/maxitor/lib/maxitor-panel"
    assert new_lock["packages"][""]["dependencies"]["@maxitor/tokens"] == "file:/maxitor/lib/maxitor-tokens"
    panel = new_lock["packages"]["node_modules/@maxitor/panel"]
    assert (panel["version"], panel["resolved"]) == (manifests["@maxitor/panel"]["version"], "file:/maxitor/lib/maxitor-panel")
    untouched = {path: entry for path, entry in lock["packages"].items() if "@maxitor/" not in path and path}
    assert {path: new_lock["packages"][path] for path in untouched} == untouched
    assert new_package["dependencies"]["next"] == package["dependencies"]["next"]


def test_a_nested_copy_of_the_library_is_dropped_and_its_dependency_brought() -> None:
    package = {"name": "p", "dependencies": {"@maxitor/panel": "^0.1.0"}}
    lock = {
        "packages": {
            "": {"name": "p", "dependencies": {"@maxitor/panel": "^0.1.0"}},
            "node_modules/@maxitor/panel": {"version": "0.1.0", "resolved": "https://registry.npmjs.org/@maxitor/panel/-/panel-0.1.0.tgz"},
            "node_modules/@maxitor/panel/node_modules/@maxitor/tokens": {"version": "0.1.0"},
            "node_modules/other/node_modules/@maxitor/panel": {"version": "0.0.9"},
        }
    }
    _, new_lock = rewrite(package, lock, library_manifests(), CORE)
    assert sorted(path for path in new_lock["packages"] if path) == [f"node_modules/{name}" for name in sorted(LIBRARY)]


def test_a_package_off_the_list_is_refused_by_name() -> None:
    _, lock = template()
    lock["packages"]["node_modules/left-pad"] = {"version": "1.3.0", "resolved": "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz"}
    allowed = {"next", "react", "react-dom", "typescript"} | {path.rsplit("node_modules/", 1)[1] for path in lock["packages"] if path} - {"left-pad"}
    assert refusal(lambda: check_names(lock, allowed)) == "left-pad is not on the core's list of npm packages"


def test_a_package_from_another_registry_is_refused_by_name() -> None:
    _, lock = template()
    lock["packages"]["node_modules/react"]["resolved"] = "https://npm.evil.example/react/-/react-19.3.1.tgz"
    allowed = {path.rsplit("node_modules/", 1)[1] for path in lock["packages"] if path}
    assert refusal(lambda: check_names(lock, allowed)) == "react is resolved from npm.evil.example, not from npm"


def test_the_templates_packages_are_all_on_the_cores_list(tmp_path: Path) -> None:
    prepare(TEMPLATE_WEB, tmp_path / "work", CORE)
    assert sorted(path.name for path in (tmp_path / "work").iterdir()) == sorted(
        path.name for path in TEMPLATE_WEB.iterdir() if path.name not in ("node_modules", ".next", ".npmrc")
    )


def test_the_build_copy_leaves_installed_packages_a_past_build_and_npm_settings_behind(tmp_path: Path) -> None:
    source = tmp_path / "web"
    source.mkdir()
    for name in ("package.json", "package-lock.json"):
        (source / name).write_text((TEMPLATE_WEB / name).read_text(encoding="utf-8"), encoding="utf-8")
    (source / ".npmrc").write_text("registry=https://npm.evil.example/\n", encoding="utf-8")
    (source / "node_modules" / "next").mkdir(parents=True)
    (source / ".next").mkdir()
    (source / "app").mkdir()
    prepare(source, tmp_path / "work", CORE)
    assert sorted(path.name for path in (tmp_path / "work").iterdir()) == ["app", "package-lock.json", "package.json"]


def test_a_type_error_is_named_with_its_file_and_line() -> None:
    output = "Creating an optimized production build ...\n./app/page.tsx:3:7\nType error: Type 'number' is not assignable to type 'string'.\n"
    assert first_error(output, 1) == "./app/page.tsx:3:7 Type error: Type 'number' is not assignable to type 'string'."


def test_npms_error_is_the_line_that_states_it() -> None:
    output = "npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/nope\n"
    assert first_error(output, 1) == "npm error 404 Not Found - GET https://registry.npmjs.org/nope"


async def test_the_fetch_runs_no_plugin_code_and_the_build_has_no_network(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, ...]] = []

    async def docker(*args: str) -> tuple[int, str]:
        calls.append(args)
        if args[0] == "run" and "--network" in args:
            (tmp_path / "work" / "notes" / "source" / ".next" / "standalone").mkdir(parents=True)
            (tmp_path / "work" / "notes" / "source" / ".next" / "standalone" / "server.js").write_text("", encoding="utf-8")
            (tmp_path / "work" / "notes" / "source" / ".next" / "static").mkdir()
        return (1, "") if args[:2] == ("image", "inspect") else (0, "")

    monkeypatch.setattr("maxitor.core.plugins.frontend_builder.docker", docker)
    builder = FrontendBuilderController(tmp_path / "work", version=CORE)
    image = await builder.build("notes", "a" * 64, TEMPLATE_WEB)
    assert image == "maxitor-plugin/notes-frontend:aaaaaaaaaaaa-9.9.9"
    fetch, build = [call for call in calls if call[0] == "run"]
    for container in (fetch, build):
        assert container[container.index("--user") + 1] == "65534:65534"
        assert "maxitor-plugin-builder:9.9.9" in container
    assert "--ignore-scripts" in fetch and "--network" not in fetch
    assert build[build.index("--network") + 1] == "none" and "--offline" in build[-1]
    assert [call[call.index("--tag") + 1] for call in calls if call[0] == "build"] == ["maxitor-plugin-builder:9.9.9", image]


async def test_a_failing_step_ends_the_build_with_its_first_error(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    async def docker(*args: str) -> tuple[int, str]:
        if args[0] == "run" and "--network" in args:
            return 1, "./app/page.tsx:3:7\nType error: Cannot find name 'x'.\n"
        return (1, "") if args[:2] == ("image", "inspect") else (0, "")

    monkeypatch.setattr("maxitor.core.plugins.frontend_builder.docker", docker)
    builder = FrontendBuilderController(tmp_path / "work", version=CORE)
    with pytest.raises(EnvironmentInstallError) as caught:
        await builder.build("notes", "a" * 64, TEMPLATE_WEB)
    assert caught.value.reason == "./app/page.tsx:3:7 Type error: Cannot find name 'x'."
