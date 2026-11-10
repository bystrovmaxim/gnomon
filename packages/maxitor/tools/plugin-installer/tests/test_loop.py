# packages/maxitor/tools/plugin-installer/tests/test_loop.py
"""
The installer's round: the queue first, then each install in a call of its own, every call as the installer and
with only the connections its action declares; the settings never show the installer's DSN.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from maxitor.core.plugins.actions.deploy_and_install_action import DeployAndInstallAction, DeployResult
from maxitor.core.plugins.actions.take_up_pending_action import PendingInstallSchema, TakeUpPendingAction, TakeUpResult
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.storage.deploy_storage import DeployStorage
from maxitor.core.plugins.storage.plugin_runtime_storage import PluginRuntimeStorage
from maxitor.core.plugins.storage.wheel_storage import WheelStorage
from maxitor.plugin_installer.loop import INSTALLER, declared, one_round
from maxitor.plugin_installer.settings import InstallerSettings


class Machine:
    """A machine that records what it is asked to run and answers from a script."""

    def __init__(self) -> None:
        self.runs: list[tuple[Any, Any, Any, set[str]]] = []

    async def run(self, context: Any, action: Any, params: Any, connections: Any) -> Any:
        self.runs.append((context, action, params, set(connections or {})))
        if isinstance(action, TakeUpPendingAction):
            return TakeUpResult(
                versions=["v1"],
                installs=[PendingInstallSchema(organization_id="o1", row_id="r1"), PendingInstallSchema(organization_id="o2", row_id="r2")],
            )
        return DeployResult(state="enabled")


async def test_a_round_takes_up_the_queue_then_each_install(tmp_path: Path) -> None:
    machine = Machine()
    connections = {
        "deploy": DeployStorage(connection_params="postgresql://unused"),
        "wheels": WheelStorage(tmp_path / "wheels"),
        "runtime": PluginRuntimeStorage(tmp_path / "runtime", "postgresql://u@db/maxitor"),
        "unused": WheelStorage(tmp_path / "unused"),
    }
    assert await one_round(machine, connections, started=True) == 3  # type: ignore[arg-type]
    actions = [type(action) for _ctx, action, _params, _keys in machine.runs]
    assert actions == [TakeUpPendingAction, DeployAndInstallAction, DeployAndInstallAction]
    assert machine.runs[0][2].started is True
    assert [(p.organization_id, p.row_id) for _c, _a, p, _k in machine.runs[1:]] == [("o1", "r1"), ("o2", "r2")]
    assert machine.runs[0][3] == {"deploy"} and machine.runs[1][3] == {"deploy", "wheels", "runtime"}
    assert all(context is INSTALLER for context, *_ in machine.runs)
    assert INSTALLER.user.roles == (InstallerRole,)


def test_declared_takes_only_what_an_action_names() -> None:
    assert set(declared(TakeUpPendingAction, {"deploy": 1, "wheels": 2})) == {"deploy"}


def test_the_settings_never_show_the_dsn(monkeypatch: Any) -> None:
    monkeypatch.setenv("MAXITOR_INSTALLER_DSN", "postgresql://maxitor_installer:s3cret@db/maxitor")
    settings = InstallerSettings.from_environment()
    assert "s3cret" not in repr(settings) and settings.period_seconds == 60.0 and settings.wheel_max_bytes == 50 * 1024 * 1024
