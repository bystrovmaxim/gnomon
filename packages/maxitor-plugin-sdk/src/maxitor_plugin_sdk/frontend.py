# packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/frontend.py
"""
The shell's boundary in a plugin's frontend (spec 078, FR-019).

Every page of a plugin is drawn inside the shell of ``@maxitor/panel``, which owns the panel's edges: the filters,
the layer pills, the bottom bar and the page's actions. A page may lay out its own content field as it likes —
absolute positions, another component kit, its own colours — and may not step out of it. Three rules keep that:

1. every ``page.tsx`` renders ``<PanelPage``, itself or through a component of its own folder that does;
2. nothing is placed ``fixed``, which would lie over the frame whatever the shell lays out;
3. no layer is raised to the shell's (``--mx-layer-shell``, 30) or above it.

Each refusal names the file and the line.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from pathlib import Path

#: The shell's layer in @maxitor/tokens; a page's own layers stay below it.
SHELL_LAYER = 30
#: The folders of a plugin's frontend that hold its pages and components.
SOURCE_FOLDERS = ("app", "components")
SOURCE_FILE = re.compile(r"\.(tsx?|jsx?|css|scss)$")
SKIPPED = {"node_modules", ".next", "_web", "out"}
FIXED = re.compile(r"""position\s*:\s*["']?fixed\b""")
LAYER = re.compile(r"""z-?index\s*:\s*["']?(-?\d+)""", re.IGNORECASE)
SHELL = re.compile(r"<PanelPage\b")
LOCAL_IMPORT = re.compile(r"""from\s+["']\./([\w./-]+)["']""")
COMMENT = re.compile(r"^\s*(//|\*|/\*)")


def _sources(web: Path) -> Iterator[Path]:
    for folder in SOURCE_FOLDERS:
        base = web / folder
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if path.is_file() and SOURCE_FILE.search(path.name) and not SKIPPED.intersection(path.relative_to(web).parts):
                yield path


def _renders_shell(page: Path) -> bool:
    """The page renders the shell itself, or imports a component of its own folder that does."""
    text = page.read_text(encoding="utf-8")
    if SHELL.search(text):
        return True
    for name in LOCAL_IMPORT.findall(text):
        for candidate in (page.parent / f"{name}.tsx", page.parent / f"{name}.jsx", page.parent / name / "index.tsx"):
            if candidate.is_file() and SHELL.search(candidate.read_text(encoding="utf-8")):
                return True
    return False


def frontend_problems(root: Path) -> list[str]:
    """Every place a plugin's frontend in ``root/web`` steps out of the shell; empty when there is none."""
    web = root / "web"
    problems: list[str] = []
    for path in _sources(web):
        where = path.relative_to(root).as_posix()
        if path.name == "page.tsx" and not _renders_shell(path):
            problems.append(f"{where}: the page does not render <PanelPage>, the shell every page of Maxitor lies in")
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if COMMENT.match(line):
                continue
            if FIXED.search(line):
                problems.append(f"{where}:{number}: an element placed fixed lies over Maxitor's frame; place it in the content field")
            for value in LAYER.findall(line):
                if int(value) >= SHELL_LAYER:
                    problems.append(f"{where}:{number}: the layer {value} reaches the shell's ({SHELL_LAYER}); a page's layers stay below it")
    return problems
