#!/usr/bin/env python3
"""
The released core at the lower bound of the plugin template's ``requires.maxitor``: the newest ``maxitor-v<x.y>.*`` tag
of the lowest minor the range allows. The upper bound is this checkout's own core, which the check run builds the
template with; CI builds it again with the release printed here. Nothing is printed while that minor has no release
yet: then the checkout is both bounds.

    uv run python scripts/template_bounds.py
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

import yaml
from packaging.version import Version

ROOT = Path(__file__).resolve().parent.parent
PASSPORT = ROOT / "packages/maxitor-plugin-template/src/maxitor_notes/maxitor-plugin.yaml"


def lower_minor(requirement: str) -> str:
    """``>=4.5,<5`` → ``4.5``: the lowest minor the range allows."""
    found = re.search(r">=\s*(\d+)\.(\d+)", requirement)
    if found is None:
        raise SystemExit(f"requires.maxitor {requirement!r} names no lower bound")
    return f"{found.group(1)}.{found.group(2)}"


def newest_release(minor: str, tags: list[str]) -> str | None:
    """The newest ``maxitor-v<minor>.<patch>`` among ``tags``, as a version."""
    versions = [Version(tag.removeprefix("maxitor-v")) for tag in tags if re.fullmatch(rf"maxitor-v{re.escape(minor)}\.\d+", tag)]
    return str(max(versions)) if versions else None


def main() -> int:
    requirement = str(yaml.safe_load(PASSPORT.read_text(encoding="utf-8"))["requires"]["maxitor"])
    tags = subprocess.run(["git", "tag", "--list", "maxitor-v*"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    release = newest_release(lower_minor(requirement), tags)
    if release:
        print(release)
    return 0


if __name__ == "__main__":
    sys.exit(main())
