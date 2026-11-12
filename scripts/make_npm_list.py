#!/usr/bin/env python3
"""
Write the core's list of npm packages: the names a plugin's frontend may install when the core builds it.

The core builds every plugin's frontend with its own ``@maxitor/panel``. Before anything is downloaded, every
package name in the plugin's lock file must be on this list. The list is the names the template's frontend
installs, nested dependencies included, since that is what a page drawn with the core's library needs. The
``@maxitor/*`` packages are left out: the build points them at the core's own copy.

Run it after changing the template's frontend dependencies:

    uv run python scripts/make_npm_list.py

``--check`` writes nothing and exits 1 when the file differs from what it would write.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCKS = (ROOT / "packages/maxitor-plugin-template/web/package-lock.json",)
LIST = ROOT / "packages/maxitor/maxitor-core/maxitor/core/plugins/builder/npm-packages.txt"
HEADER = (
    "# The npm packages a plugin's frontend may install when the core builds it, one name per line.\n"
    "# Made by scripts/make_npm_list.py from the template's lock file; do not edit by hand.\n"
)


def names_in_lock(lock: dict) -> set[str]:
    """Every package name a lock file installs, nested ones included, without ``@maxitor/*``."""
    names: set[str] = set()
    for path, entry in (lock.get("packages") or {}).items():
        if "node_modules/" not in path:
            continue
        name = entry.get("name") or path.rsplit("node_modules/", 1)[1]
        if not name.startswith("@maxitor/"):
            names.add(name)
    return names


def render(locks: tuple[Path, ...] = LOCKS) -> str:
    """The list's text: the header, then the names sorted."""
    names: set[str] = set()
    for lock in locks:
        names |= names_in_lock(json.loads(lock.read_text(encoding="utf-8")))
    return HEADER + "".join(f"{name}\n" for name in sorted(names))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--check", action="store_true", help="exit 1 when the list is not up to date")
    args = parser.parse_args(argv)
    text = render()
    current = LIST.read_text(encoding="utf-8") if LIST.is_file() else ""
    if args.check:
        if current != text:
            print(f"{LIST.relative_to(ROOT)} is not up to date; run: uv run python scripts/make_npm_list.py", file=sys.stderr)
            return 1
        return 0
    LIST.parent.mkdir(parents=True, exist_ok=True)
    LIST.write_text(text, encoding="utf-8")
    print(f"{LIST.relative_to(ROOT)}: {text.count(chr(10)) - HEADER.count(chr(10))} names")
    return 0


if __name__ == "__main__":
    sys.exit(main())
