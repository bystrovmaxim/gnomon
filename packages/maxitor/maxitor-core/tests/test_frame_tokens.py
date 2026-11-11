# packages/maxitor/maxitor-core/tests/test_frame_tokens.py
"""The frame and @maxitor/panel draw only with @maxitor/tokens: check-tokens.mjs refuses a colour code, a colour
function and a size number outside the tokens, and accepts a style written with them (spec 077, FR-002)."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "web" / "scripts" / "check-tokens.mjs"
NODE = shutil.which("node")


def _check(folder: Path) -> subprocess.CompletedProcess[str]:
    assert NODE, "node runs the frame's checks"
    return subprocess.run([NODE, str(SCRIPT), str(folder)], capture_output=True, text=True, check=False)


def test_a_style_written_with_tokens_is_accepted(tmp_path: Path) -> None:
    (tmp_path / "frame.css").write_text(
        "/* 44px high, as the mockup draws it */\n.row { height: var(--mx-top-row); color: var(--mx-ink); }\n",
        encoding="utf-8",
    )
    (tmp_path / "Row.tsx").write_text(
        'export const Row = () => <div style={{ padding: "var(--mx-space-4)" }} />; // 8px\n', encoding="utf-8"
    )
    answer = _check(tmp_path)
    assert answer.returncode == 0, answer.stderr


@pytest.mark.parametrize(
    ("line", "found"),
    [
        (".row { color: #0f172a; }", "a colour code"),
        (".row { background: rgba(15, 23, 42, 0.1); }", "a colour function"),
        (".row { height: 44px; }", "a size number"),
        (".row { gap: .5rem; }", "a size number"),
    ],
)
def test_a_colour_or_a_size_outside_the_tokens_is_refused(tmp_path: Path, line: str, found: str) -> None:
    (tmp_path / "frame.css").write_text(f"{line}\n", encoding="utf-8")
    answer = _check(tmp_path)
    assert answer.returncode == 1
    assert f"frame.css:1: {found}" in answer.stderr
