# packages/maxitor/tools/plugin-installer/maxitor/plugin_installer/settings.py
"""
InstallerSettings — the installer's process settings, read once from the environment.

The DSN carries the password of maxitor_installer: it lives in this process only, never in the core's web process
(FR-023), and never in a ``repr``, a log or an event.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class InstallerSettings:
    """
    AI-CORE-BEGIN
    ROLE: What the installer's process is configured with.
    CONTRACT: ``from_environment`` reads MAXITOR_INSTALLER_DSN (required), MAXITOR_WHEEL_STORE,
        MAXITOR_PLUGIN_RUNTIME, MAXITOR_WHEEL_MAX_BYTES, MAXITOR_WHEEL_TIMEOUT_SECONDS and
        MAXITOR_INSTALLER_PERIOD_SECONDS.
    INVARIANTS: The DSN is never in the ``repr``.
    AI-CORE-END
    """

    dsn: str = field(repr=False)
    wheel_store: Path = Path(".core-stand/wheels")
    runtime: Path = Path(".core-stand/plugins")
    wheel_max_bytes: int = 50 * 1024 * 1024
    wheel_timeout_seconds: float = 60.0
    period_seconds: float = 60.0

    @classmethod
    def from_environment(cls) -> InstallerSettings:
        """The settings the environment gives."""
        env = os.environ
        return cls(
            dsn=env["MAXITOR_INSTALLER_DSN"],
            wheel_store=Path(env.get("MAXITOR_WHEEL_STORE", ".core-stand/wheels")),
            runtime=Path(env.get("MAXITOR_PLUGIN_RUNTIME", ".core-stand/plugins")),
            wheel_max_bytes=int(env.get("MAXITOR_WHEEL_MAX_BYTES", str(50 * 1024 * 1024))),
            wheel_timeout_seconds=float(env.get("MAXITOR_WHEEL_TIMEOUT_SECONDS", "60")),
            period_seconds=float(env.get("MAXITOR_INSTALLER_PERIOD_SECONDS", "60")),
        )
