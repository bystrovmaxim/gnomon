# packages/maxitor/maxitor-core/maxitor/core/plugins/runner_role.py
"""RunnerRole — the role of the process maxitor-plugin-runner, the only caller of the runner's actions."""

from __future__ import annotations

from aoa.action_machine.auth import ApplicationRole


class RunnerRole(ApplicationRole):
    """
    AI-CORE-BEGIN
    ROLE: The runner process, running the domain plugins' actions in itself.
    CONTRACT: Never granted by a token: the runner builds its own context; no HTTP route admits it.
    AI-CORE-END
    """

    name = "plugin-runner"
    description = "The process maxitor-plugin-runner, which starts, watches and stops plugin processes"
