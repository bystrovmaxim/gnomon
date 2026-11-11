# packages/maxitor/tools/plugin-runner/maxitor/plugin_runner/settings.py
"""
RunnerSettings — the runner's process settings, read once from the environment.

The DSN carries the password of maxitor_core; it lives in the runner and never reaches a plugin's process, whose
environment holds only its own file and the two addresses below.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class RunnerSettings:
    """
    AI-CORE-BEGIN
    ROLE: What the runner's process is configured with.
    CONTRACT: ``from_environment`` reads MAXITOR_CORE_DSN (required), MAXITOR_CORE_JWKS_URL, MAXITOR_GATEWAY_URL,
        MAXITOR_PLUGIN_RUNTIME, MAXITOR_WHEEL_STORE, MAXITOR_PLUGIN_FIND_LINKS and MAXITOR_RUNNER_PERIOD_SECONDS.
    INVARIANTS: The DSN is never in the ``repr``.
    AI-CORE-END
    """

    dsn: str = field(repr=False)
    jwks_url: str = "http://127.0.0.1:8020/api/v1/jwks"
    gateway_url: str = "http://127.0.0.1:3000"
    runtime: Path = Path(".core-stand/plugins")
    wheel_store: Path = Path(".core-stand/wheels")
    find_links: Path | None = None
    period_seconds: float = 10.0

    @classmethod
    def from_environment(cls) -> RunnerSettings:
        """The settings the environment gives."""
        env = os.environ
        links = env.get("MAXITOR_PLUGIN_FIND_LINKS")
        return cls(
            dsn=env["MAXITOR_CORE_DSN"],
            jwks_url=env.get("MAXITOR_CORE_JWKS_URL", "http://127.0.0.1:8020/api/v1/jwks"),
            gateway_url=env.get("MAXITOR_GATEWAY_URL", "http://127.0.0.1:3000").rstrip("/"),
            runtime=Path(env.get("MAXITOR_PLUGIN_RUNTIME", ".core-stand/plugins")),
            wheel_store=Path(env.get("MAXITOR_WHEEL_STORE", ".core-stand/wheels")),
            find_links=Path(links) if links else None,
            period_seconds=float(env.get("MAXITOR_RUNNER_PERIOD_SECONDS", "10")),
        )
