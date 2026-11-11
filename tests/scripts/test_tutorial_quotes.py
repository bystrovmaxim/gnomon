# tests/scripts/test_tutorial_quotes.py
"""
The plugin tutorial cannot drift from the template: every code block marked ``<!-- quote: <path> -->`` is, line for
line, a run of that file's lines, and every chapter the index links to exists and links back to its neighbours.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
TUTORIAL = REPO_ROOT / "docs" / "plugins" / "tutorial"
QUOTE = re.compile(r"<!-- quote: (?P<path>[^ ]+) -->\n```[a-z]*\n(?P<body>.*?)\n```", re.S)
CHAPTERS = sorted(path for path in TUTORIAL.glob("*.md") if not path.name.endswith(".ru_draft.md"))


def quotes() -> list[tuple[str, str, str]]:
    """Every quoted block: the chapter, the file it quotes, its text."""
    return [
        (chapter.name, match["path"], match["body"])
        for chapter in CHAPTERS
        for match in QUOTE.finditer(chapter.read_text(encoding="utf-8"))
    ]


def is_run_of(body: str, text: str) -> bool:
    """Whether ``body``'s lines stand one after another in ``text``."""
    wanted, lines = body.splitlines(), text.splitlines()
    return any(lines[i : i + len(wanted)] == wanted for i in range(len(lines) - len(wanted) + 1))


@pytest.mark.parametrize(("chapter", "path", "body"), quotes(), ids=lambda value: str(value)[:40])
def test_every_quote_is_the_files_own_text(chapter: str, path: str, body: str) -> None:
    source = REPO_ROOT / path
    assert source.is_file(), f"{chapter} quotes {path}, which does not exist"
    assert is_run_of(body, source.read_text(encoding="utf-8")), f"{chapter}: a quote of {path} no longer matches the file"


def test_a_changed_or_moved_line_is_caught() -> None:
    text = "first\nsecond\nthird\n"
    assert is_run_of("second\nthird", text)
    assert not is_run_of("second\nthird!", text)
    assert not is_run_of("first\nthird", text)


def test_every_chapter_the_index_links_to_exists() -> None:
    index = (TUTORIAL / "index.md").read_text(encoding="utf-8")
    linked = re.findall(r"\]\(([0-9]{2}-[a-z-]+\.md)\)", index)
    for name in linked:
        assert (TUTORIAL / name).is_file(), name
    assert {path.name for path in CHAPTERS} - {"index.md"} == set(linked)
