# packages/maxitor/tools/plugin-runner/maxitor/plugin_runner/settings.py
"""
RunnerSettings — the runner's process settings, read once from the environment.

The DSN carries the password of maxitor_core; it lives in the runner and never reaches a plugin's container, whose
environment holds only its own file and the addresses below, as the containers see them.
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
    CONTRACT: ``from_environment`` reads MAXITOR_CORE_DSN (required), MAXITOR_PLUGIN_GATEWAY_URL,
        MAXITOR_PLUGIN_DB_ADDRESS, MAXITOR_PLUGIN_DB_CONTAINER, MAXITOR_PLUGIN_MEMORY, MAXITOR_PLUGIN_CPUS,
        MAXITOR_PLUGIN_RUNTIME, MAXITOR_WHEEL_STORE, MAXITOR_PLUGIN_FIND_LINKS, MAXITOR_RUNNER_PERIOD_SECONDS and
        MAXITOR_RUNNER_NAME (the runner's own containers on a host shared by two stands).
    INVARIANTS: The DSN is never in the ``repr``.
    AI-CORE-END
    """

    dsn: str = field(repr=False)
    gateway_url: str = "http://host.docker.internal:3000"
    db_address: str | None = None
    db_container: str | None = None
    memory: str = "512m"
    cpus: str = "1"
    runtime: Path = Path(".core-stand/plugins")
    wheel_store: Path = Path(".core-stand/wheels")
    find_links: Path | None = None
    period_seconds: float = 10.0
    name: str = "maxitor"

    @classmethod
    def from_environment(cls) -> RunnerSettings:
        """The settings the environment gives."""
        env = os.environ
        links = env.get("MAXITOR_PLUGIN_FIND_LINKS")
        return cls(
            dsn=env["MAXITOR_CORE_DSN"],
            gateway_url=env.get("MAXITOR_PLUGIN_GATEWAY_URL", "http://host.docker.internal:3000").rstrip("/"),
            db_address=env.get("MAXITOR_PLUGIN_DB_ADDRESS") or None,
            db_container=env.get("MAXITOR_PLUGIN_DB_CONTAINER") or None,
            memory=env.get("MAXITOR_PLUGIN_MEMORY", "512m"),
            cpus=env.get("MAXITOR_PLUGIN_CPUS", "1"),
            runtime=Path(env.get("MAXITOR_PLUGIN_RUNTIME", ".core-stand/plugins")),
            wheel_store=Path(env.get("MAXITOR_WHEEL_STORE", ".core-stand/wheels")),
            find_links=Path(links) if links else None,
            period_seconds=float(env.get("MAXITOR_RUNNER_PERIOD_SECONDS", "10")),
            name=env.get("MAXITOR_RUNNER_NAME") or "maxitor",
        )
