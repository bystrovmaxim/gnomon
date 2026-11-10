# packages/maxitor/maxitor-core/maxitor/core/plugins/installer_role.py
"""InstallerRole — the role of the process maxitor-plugin-installer, the only caller of the installer's actions."""

from __future__ import annotations

from aoa.action_machine.auth import ApplicationRole


class InstallerRole(ApplicationRole):
    """
    AI-CORE-BEGIN
    ROLE: The installer process, running the domain plugins' actions in itself.
    CONTRACT: Never granted by a token: the installer builds its own context; no HTTP route admits it.
    AI-CORE-END
    """

    name = "plugin-installer"
    description = "The process maxitor-plugin-installer, which checks and deploys plugin versions"
