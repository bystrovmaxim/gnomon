# packages/maxitor-plugin-template/tests/test_shell.py
"""The template's pages lie in the shell of @maxitor/panel (spec 078): Maxitor's check passes it, and refuses a copy whose page steps out."""

import shutil
from pathlib import Path

from maxitor_plugin_sdk.checks import check_plugin

TEMPLATE = Path(__file__).resolve().parents[1]
NOTES_PAGE = Path("web/app/[org]/items/[item_id]/page.tsx")


def _with_web(plugin: Path) -> Path:
    """The copied plugin with the template's pages, without what npm and Next.js build."""
    shutil.copytree(TEMPLATE / "web", plugin / "web", ignore=shutil.ignore_patterns("node_modules", ".next", "out"))
    return plugin


def test_the_templates_pages_keep_the_shells_boundary(plugin) -> None:
    assert check_plugin(_with_web(plugin)) == []


def test_a_page_that_places_an_element_fixed_is_refused(plugin) -> None:
    page = _with_web(plugin) / NOTES_PAGE
    page.write_text(page.read_text(encoding="utf-8") + 'const banner = { position: "fixed" };\n', encoding="utf-8")
    assert any("an element placed fixed lies over Maxitor's frame" in problem for problem in check_plugin(plugin))
