# packages/maxitor/hatch_build.py — the maxitor package carries the core's own @maxitor/* packages.
"""
The core builds every plugin's frontend with its own ``@maxitor/panel`` and ``@maxitor/tokens``. Their sources live
beside this package, in ``packages/maxitor-panel`` and ``packages/maxitor-tokens``; this hook copies them into
``maxitor/core/plugins/builder/lib/`` of the sdist and of a wheel built from the repository. A wheel built from the
sdist finds them already in place.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from hatchling.builders.hooks.plugin.interface import BuildHookInterface

#: Each package of the core's library and the files of it a build needs.
LIBRARY = {"maxitor-panel": ("package.json", "src"), "maxitor-tokens": ("package.json", "index.ts", "tokens.css")}
#: Where the library lies inside the installed package.
TARGET = "maxitor/core/plugins/builder/lib"


class LibraryHook(BuildHookInterface):
    """Adds the library's files to the build when the repository holds them."""

    def initialize(self, version: str, build_data: dict[str, Any]) -> None:
        if version == "editable":
            # An editable install reads the library from the repository itself.
            return
        packages = Path(self.root).parent
        # The sdist keeps the parts' own folders; the wheel maps maxitor-core/ to the package's root.
        prefix = "maxitor-core/" if self.target_name == "sdist" else ""
        for folder, names in LIBRARY.items():
            for name in names:
                source = packages / folder / name
                if source.exists():
                    build_data["force_include"][str(source)] = f"{prefix}{TARGET}/{folder}/{name}"
