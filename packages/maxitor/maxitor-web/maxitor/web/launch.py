# packages/maxitor/maxitor-web/maxitor/web/launch.py
"""
Start a part of Maxitor from its command, or name the extra it needs.

═══════════════════════════════════════════════════════════════════════════════
PURPOSE
═══════════════════════════════════════════════════════════════════════════════

Every part's code is in the ``maxitor`` wheel, but only an extra brings a part's
dependencies. A command whose extra is missing says which one to install
instead of failing on an import.

═══════════════════════════════════════════════════════════════════════════════
ARCHITECTURE / DATA FLOW
═══════════════════════════════════════════════════════════════════════════════

The command ``maxitor`` → ``main()`` → imports the front's server inside the
function → runs it; ``maxitor plugin check`` imports only the plugin check and its ``plugins`` extra. A ``ModuleNotFoundError`` for a dependency the extra brings
becomes one line on standard error and exit code 2; any other error propagates.
Nothing heavy is imported at module level, so this module loads without any extra.
"""

from __future__ import annotations

import importlib
import sys

WEB_HINT = 'maxitor needs its web part: pip install "maxitor[web]"'
PLUGINS_HINT = 'maxitor plugin check needs its extra: pip install "maxitor[plugins]"'


def _brought_by_front(error: ModuleNotFoundError) -> bool:
    """Whether the missing module is one the ``web`` extra installs."""
    brought = {"aoa", "fastapi", "starlette", "uvicorn", "duckdb", "httpx", "websockets"}
    return (error.name or "").split(".")[0] in brought


def main() -> None:
    """
    AI-CORE-BEGIN
    ROLE: Entry point of the ``maxitor`` command: run Maxitor's server, or ``maxitor plugin check``.
    CONTRACT: ``maxitor plugin check <path> --core <version>`` exits with the check's code, or, without the
        ``plugins`` extra, writes ``PLUGINS_HINT`` and exits 2; otherwise, without the ``web`` extra, writes ``WEB_HINT`` to standard error and exits 2; any other error
        propagates.
    AI-CORE-END
    """
    if sys.argv[1:3] == ["plugin", "check"]:
        try:
            plugin_check = importlib.import_module("maxitor.web.plugin_check")
            importlib.import_module("maxitor_plugin_sdk.compat")
        except ModuleNotFoundError as error:
            if (error.name or "").split(".")[0] not in {"maxitor_plugin_sdk", "yaml", "packaging", "jsonschema"}:
                raise
            sys.stderr.write(PLUGINS_HINT + "\n")
            raise SystemExit(2) from None
        raise SystemExit(plugin_check.main(sys.argv[3:]))
    try:
        server = importlib.import_module("maxitor.web.api.main")
    except ModuleNotFoundError as error:
        if not _brought_by_front(error):
            raise
        sys.stderr.write(WEB_HINT + "\n")
        raise SystemExit(2) from None
    server.run()
