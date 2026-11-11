# packages/maxitor/tools/plugin-runner/tests/test_loop.py
"""
The runner's round: the versions first, then each one kept running in a call of its own, then a stop for every
version running or recorded but no longer wanted — every call as the runner, with only the connections its action
declares; the settings never show the DSN.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from maxitor.core.plugins.actions.run_version_action import RunVersionAction, RunVersionResult
from maxitor.core.plugins.actions.stop_version_action import StopVersionAction, StopVersionResult
from maxitor.core.plugins.actions.take_up_running_action import RunnableSchema, TakeUpRunningAction, TakeUpRunningResult
from maxitor.core.plugins.plugin_processes import PluginProcessesController
from maxitor.core.plugins.runner_role import RunnerRole
from maxitor.core.plugins.storage.plugin_runtime_storage import PluginRuntimeStorage
from maxitor.core.plugins.storage.plugins_storage import PluginsStorage
from maxitor.core.plugins.storage.wheel_storage import WheelStorage
from maxitor.plugin_runner.loop import RUNNER, one_round
from maxitor.plugin_runner.settings import RunnerSettings

NOTES = RunnableSchema(version_id="v1", version="1.0.0", sha256="a" * 64, schema_name="notes_1_0_0", passport_id="io.x.notes", name="notes")


class Machine:
    """A machine that records what it is asked to run and answers from a script."""

    def __init__(self) -> None:
        self.runs: list[tuple[Any, Any, Any, set[str]]] = []

    async def run(self, context: Any, action: Any, params: Any, connections: Any) -> Any:
        self.runs.append((context, action, params, set(connections or {})))
        if isinstance(action, TakeUpRunningAction):
            return TakeUpRunningResult(versions=[NOTES], recorded=["v1", "v-old"])
        if isinstance(action, RunVersionAction):
            return RunVersionResult(running=["backend"])
        return StopVersionResult(stopped=True)


async def test_a_round_runs_each_wanted_version_and_stops_the_rest(tmp_path: Path) -> None:
    machine = Machine()
    processes = PluginProcessesController(
        PluginRuntimeStorage(tmp_path, "postgresql://u@db/maxitor"), WheelStorage(tmp_path),
        jwks_url="http://127.0.0.1:8020/api/v1/jwks", gateway_url="http://127.0.0.1:3000",
    )
    connections = {"plugins": PluginsStorage(connection_params="postgresql://unused"), "processes": processes}
    known = {"v-old": ("io.x.tasks", "2.0.0")}
    assert await one_round(machine, connections, known, started=True) == {"v1"}  # type: ignore[arg-type]
    actions = [type(action) for _ctx, action, _params, _keys in machine.runs]
    assert actions == [TakeUpRunningAction, RunVersionAction, StopVersionAction]
    assert machine.runs[0][2].started is True and machine.runs[1][2].schema_name == "notes_1_0_0"
    stop = machine.runs[2][2]
    assert (stop.version_id, stop.passport_id, stop.version) == ("v-old", "io.x.tasks", "2.0.0")
    assert machine.runs[0][3] == {"plugins"} and machine.runs[1][3] == {"plugins", "processes"}
    assert all(context is RUNNER for context, *_ in machine.runs) and RUNNER.user.roles == (RunnerRole,)


def test_the_settings_never_show_the_dsn() -> None:
    assert "secret" not in repr(RunnerSettings(dsn="postgresql://maxitor_core:secret@db/maxitor"))
