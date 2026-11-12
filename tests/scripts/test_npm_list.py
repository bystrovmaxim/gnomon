# tests/scripts/test_npm_list.py
"""The core's list of npm packages is what scripts/make_npm_list.py makes from the template's lock file today."""

from __future__ import annotations

import importlib.util
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("make_npm_list", REPO_ROOT / "scripts" / "make_npm_list.py")
assert spec is not None and spec.loader is not None
make_npm_list = importlib.util.module_from_spec(spec)
spec.loader.exec_module(make_npm_list)


def test_the_list_is_up_to_date() -> None:
    assert make_npm_list.LIST.read_text(encoding="utf-8") == make_npm_list.render()


def test_the_list_holds_every_name_of_the_lock_but_the_cores_own() -> None:
    names = make_npm_list.names_in_lock(
        {"packages": {"": {}, "node_modules/next": {}, "node_modules/@maxitor/panel": {}, "node_modules/a/node_modules/b": {}}}
    )
    assert names == {"next", "b"}


def test_check_fails_on_a_stale_list(tmp_path: Path, monkeypatch) -> None:
    stale = tmp_path / "npm-packages.txt"
    stale.write_text(make_npm_list.HEADER + "left-pad\n", encoding="utf-8")
    monkeypatch.setattr(make_npm_list, "LIST", stale)
    monkeypatch.setattr(make_npm_list, "ROOT", tmp_path)
    assert make_npm_list.main(["--check"]) == 1
