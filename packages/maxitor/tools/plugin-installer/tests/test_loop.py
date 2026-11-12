# packages/maxitor/tools/plugin-installer/tests/test_loop.py
"""
The installer's round: the queue first, then each install in calls of its own — its frontend's build, then its
deployment — every call as the installer and with only the connections its action declares; the settings never show
the installer's DSN.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from maxitor.core.plugins.actions.build_frontend_action import BuildFrontendAction, BuildResult
from maxitor.core.plugins.actions.check_version_action import CheckResult, CheckVersionAction
from maxitor.core.plugins.actions.deploy_and_install_action import DeployAndInstallAction, DeployResult
from maxitor.core.plugins.actions.move_frontend_generation_action import MoveFrontendGenerationAction, MoveResult
from maxitor.core.plugins.actions.take_up_pending_action import PendingInstallSchema, TakeUpPendingAction, TakeUpResult
from maxitor.core.plugins.frontend_builder import FrontendBuilderController
from maxitor.core.plugins.gateways.wheel_source_gateway import WheelSourceGateway
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.storage.deploy_storage import DeployStorage
from maxitor.core.plugins.storage.plugin_runtime_storage import PluginRuntimeStorage
from maxitor.core.plugins.storage.wheel_storage import WheelStorage
from maxitor.plugin_installer.loop import INSTALLER, declared, one_round
from maxitor.plugin_installer.settings import InstallerSettings


class Machine:
    """A machine that records what it is asked to run and answers from a script."""

    def __init__(self, to_build: list[str] | None = None) -> None:
        self.runs: list[tuple[Any, Any, Any, set[str]]] = []
        self.to_build = to_build or []

    async def run(self, context: Any, action: Any, params: Any, connections: Any) -> Any:
        self.runs.append((context, action, params, set(connections or {})))
        if isinstance(action, TakeUpPendingAction):
            return TakeUpResult(
                versions=["v1"],
                installs=[
                    PendingInstallSchema(organization_id="o1", row_id="r1", version_id="v1"),
                    PendingInstallSchema(organization_id="o2", row_id="r2", version_id="v2"),
                ],
            )
        if isinstance(action, CheckVersionAction):
            return CheckResult(state="active")
        if isinstance(action, BuildFrontendAction):
            return BuildResult(state="built")
        if isinstance(action, MoveFrontendGenerationAction):
            moves = sum(isinstance(a, MoveFrontendGenerationAction) for _c, a, _p, _k in self.runs)
            return MoveResult(state="waiting", to_build=self.to_build) if moves == 1 else MoveResult(state="moved", to_build=[])
        return DeployResult(state="enabled")


async def test_a_round_takes_up_the_queue_then_each_install(tmp_path: Path) -> None:
    machine = Machine()
    connections = {
        "deploy": DeployStorage(connection_params="postgresql://unused"),
        "wheels": WheelStorage(tmp_path / "wheels"),
        "runtime": PluginRuntimeStorage(tmp_path / "runtime", "postgresql://u@db/maxitor"),
        "wheel_source": WheelSourceGateway(1024, 1.0),
        "frontend_builder": FrontendBuilderController(tmp_path / "builds", version="9.9.9"),
        "unused": WheelStorage(tmp_path / "unused"),
    }
    assert await one_round(machine, connections, started=True) == 3  # type: ignore[arg-type]
    actions = [type(action) for _ctx, action, _params, _keys in machine.runs]
    assert actions == [
        TakeUpPendingAction, CheckVersionAction, BuildFrontendAction, DeployAndInstallAction, BuildFrontendAction, DeployAndInstallAction,
        MoveFrontendGenerationAction,
    ]
    assert machine.runs[0][2].started is True and machine.runs[1][2].version_id == "v1"
    assert [p.version_id for _c, a, p, _k in machine.runs if isinstance(a, BuildFrontendAction)] == ["v1", "v2"]
    deploys = [(p.organization_id, p.row_id) for _c, a, p, _k in machine.runs if isinstance(a, DeployAndInstallAction)]
    assert deploys == [("o1", "r1"), ("o2", "r2")]
    assert machine.runs[0][3] == {"deploy"} and machine.runs[3][3] == {"deploy", "wheels", "runtime"}
    assert machine.runs[2][3] == {"deploy", "wheels", "frontend_builder"}
    assert machine.runs[1][3] == {"deploy", "wheels", "wheel_source"}
    assert all(context is INSTALLER for context, *_ in machine.runs)
    assert INSTALLER.user.roles == (InstallerRole,)


async def test_the_upgrade_round_builds_what_the_core_lacks_one_at_a_time_then_moves(tmp_path: Path) -> None:
    from maxitor.plugin_installer.loop import upgrade_round

    machine = Machine(to_build=["v3", "v4"])
    connections = {
        "deploy": DeployStorage(connection_params="postgresql://unused"),
        "wheels": WheelStorage(tmp_path / "wheels"),
        "frontend_builder": FrontendBuilderController(tmp_path / "builds", version="9.9.9"),
    }
    await upgrade_round(machine, connections)  # type: ignore[arg-type]
    steps = [(type(a).__name__, getattr(p, "version_id", None)) for _c, a, p, _k in machine.runs]
    assert steps == [
        ("MoveFrontendGenerationAction", None),
        ("BuildFrontendAction", "v3"),
        ("BuildFrontendAction", "v4"),
        ("MoveFrontendGenerationAction", None),
    ]
    assert machine.runs[0][3] == {"deploy"}


def test_declared_takes_only_what_an_action_names() -> None:
    assert set(declared(TakeUpPendingAction, {"deploy": 1, "wheels": 2})) == {"deploy"}


def test_the_settings_never_show_the_dsn(monkeypatch: Any) -> None:
    monkeypatch.setenv("MAXITOR_INSTALLER_DSN", "postgresql://maxitor_installer:s3cret@db/maxitor")
    settings = InstallerSettings.from_environment()
    assert "s3cret" not in repr(settings) and settings.period_seconds == 60.0 and settings.wheel_max_bytes == 50 * 1024 * 1024


async def test_an_install_cut_off_by_a_stop_is_finished_by_the_next_start(tmp_path: Path) -> None:
    """The installer dies in the middle of a deploy; started again, it takes the same row up and finishes it."""

    class Dying(Machine):
        async def run(self, context: Any, action: Any, params: Any, connections: Any) -> Any:
            if isinstance(action, DeployAndInstallAction):
                raise SystemExit("the installer's process stops")
            return await super().run(context, action, params, connections)

    connections = {
        "deploy": DeployStorage(connection_params="postgresql://unused"),
        "wheels": WheelStorage(tmp_path / "wheels"),
        "runtime": PluginRuntimeStorage(tmp_path / "runtime", "postgresql://u@db/maxitor"),
        "wheel_source": WheelSourceGateway(1024, 1.0),
        "frontend_builder": FrontendBuilderController(tmp_path / "builds", version="9.9.9"),
    }
    import pytest

    with pytest.raises(SystemExit):
        await one_round(Dying(), connections, started=True)  # type: ignore[arg-type]
    again = Machine()
    await one_round(again, connections, started=True)  # type: ignore[arg-type]
    finished = [(p.organization_id, p.row_id) for _c, a, p, _k in again.runs if isinstance(a, DeployAndInstallAction)]
    assert finished == [("o1", "r1"), ("o2", "r2")]


async def test_a_refused_connection_is_reported_and_the_next_round_starts_again(tmp_path: Path, monkeypatch: Any) -> None:
    """The database refuses: the round writes the critical event and the loop goes on, still taking up as a start."""
    from maxitor.core.plugins.actions.report_connection_refused_action import ReportConnectionRefusedAction
    from maxitor.plugin_installer import loop

    from aoa.action_machine.exceptions.handle_error import HandleError

    class Refusing(Machine):
        rounds = 0

        async def run(self, context: Any, action: Any, params: Any, connections: Any) -> Any:
            if isinstance(action, TakeUpPendingAction):
                Refusing.rounds += 1
                if Refusing.rounds == 1:
                    raise HandleError("PostgreSQL connection error: password authentication failed")
                self.runs.append((context, action, params, set()))
                raise SystemExit("stop the test")
            self.runs.append((context, action, params, set()))
            return None

    async def no_wait(_seconds: float) -> None:
        return None

    monkeypatch.setattr(loop.asyncio, "sleep", no_wait)
    machine = Refusing()
    import pytest

    with pytest.raises(SystemExit):
        await loop.run_forever(machine, {"deploy": DeployStorage(connection_params="postgresql://unused")}, 60)  # type: ignore[arg-type]
    reported = [p for _c, a, p, _k in machine.runs if isinstance(a, ReportConnectionRefusedAction)]
    assert [p.reason for p in reported] == ["PostgreSQL connection error: password authentication failed"]
    assert machine.runs[-1][2].started is True
