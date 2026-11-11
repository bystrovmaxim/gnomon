# packages/maxitor-plugin-sdk/tests/test_frontend_boundary.py
"""The shell's boundary in a plugin's frontend (spec 078, FR-019): what steps out of it is refused, the content field is the plugin's."""

from __future__ import annotations

from pathlib import Path

import pytest
from maxitor_plugin_sdk.frontend import frontend_problems

TEMPLATE = Path(__file__).resolve().parents[2] / "maxitor-plugin-template"
PAGE = 'import { PanelPage } from "@maxitor/panel";\nexport default function P() { return <PanelPage title="X"><div /></PanelPage>; }\n'


def _plugin(tmp_path: Path, files: dict[str, str]) -> Path:
    for name, text in files.items():
        path = tmp_path / "web" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    return tmp_path


def test_the_template_keeps_the_boundary() -> None:
    assert frontend_problems(TEMPLATE) == []


def test_a_page_without_the_shell_is_refused(tmp_path: Path) -> None:
    root = _plugin(tmp_path, {"app/page.tsx": "export default function P() { return <main />; }\n"})
    assert frontend_problems(root) == ["web/app/page.tsx: the page does not render <PanelPage>, the shell every page of Maxitor lies in"]


def test_a_page_whose_own_component_renders_the_shell_passes(tmp_path: Path) -> None:
    root = _plugin(tmp_path, {"app/x/page.tsx": 'import { View } from "./View";\nexport default () => <View />;\n', "app/x/View.tsx": PAGE})
    assert frontend_problems(root) == []


@pytest.mark.parametrize("line", ["const s = { position: \"fixed\" };", ".bar { position: fixed; }", "style={{ position: 'fixed' }}"])
def test_an_element_placed_fixed_is_refused_with_its_line(tmp_path: Path, line: str) -> None:
    root = _plugin(tmp_path, {"app/page.tsx": PAGE, "components/Bar.tsx": f"// a bar\n{line}\n"})
    assert frontend_problems(root) == [
        "web/components/Bar.tsx:2: an element placed fixed lies over Maxitor's frame; place it in the content field"
    ]


@pytest.mark.parametrize(("line", "refused"), [(".card { z-index: 30; }", True), ("style={{ zIndex: 200 }}", True), (".card { z-index: 29; }", False)])
def test_a_layer_at_or_above_the_shell_is_refused(tmp_path: Path, line: str, refused: bool) -> None:
    root = _plugin(tmp_path, {"app/page.tsx": PAGE, "app/style.css": line + "\n"})
    assert bool(frontend_problems(root)) is refused


def test_the_content_field_is_the_plugins(tmp_path: Path) -> None:
    root = _plugin(
        tmp_path,
        {
            "app/page.tsx": PAGE,
            "components/Graph.tsx": 'import Box from "@mui/material/Box";\nconst s = { position: "absolute", left: 4, color: "#3b82f6", zIndex: 2 };\n',
        },
    )
    assert frontend_problems(root) == []
