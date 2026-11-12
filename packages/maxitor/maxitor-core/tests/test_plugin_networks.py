# packages/maxitor/maxitor-core/tests/test_plugin_networks.py
"""
A plugin version's Docker network goes with the version: Docker gives a host about thirty networks, and one left
behind by every version stopped once used them up so that no plugin could start.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from maxitor.core.plugins.plugin_processes import RUNNER_LABEL, VERSION_LABEL, PluginProcessesController
from maxitor.core.plugins.storage.plugin_runtime_storage import PluginRuntimeStorage
from maxitor.core.plugins.storage.wheel_storage import WheelStorage


def _docker_answering(monkeypatch: pytest.MonkeyPatch, answers: dict[tuple[str, ...], tuple[int, str]]) -> list[tuple[str, ...]]:
    """Docker pretended: each call is recorded; one beginning with a key of ``answers`` gets its answer, any other succeeds."""
    calls: list[tuple[str, ...]] = []

    async def docker(*args: str) -> tuple[int, str]:
        calls.append(args)
        return next((answer for start, answer in answers.items() if args[: len(start)] == start), (0, ""))

    monkeypatch.setattr("maxitor.core.plugins.plugin_processes.docker", docker)
    return calls


def _runner_with_database() -> PluginProcessesController:
    return PluginProcessesController(
        PluginRuntimeStorage(Path("/nowhere"), "postgresql://u@db/maxitor"), WheelStorage(Path("/nowhere")),
        gateway_url="http://host.docker.internal:3010", db_container="stand-pg", runner="second",
    )


async def test_a_stopped_version_takes_its_network_with_it_so_dockers_networks_never_run_out(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _docker_answering(monkeypatch, {("network", "ls"): (0, "maxitor-second-notes_0_15_7")})
    await _runner_with_database().stop("v7")
    listed = next(call for call in calls if call[:2] == ("network", "ls"))
    assert f"label={VERSION_LABEL}=v7" in listed and f"label={RUNNER_LABEL}=second" in listed
    # The database's container is let go first: while it is joined, Docker counts the network as in use.
    assert calls[-2:] == [("network", "disconnect", "--force", "maxitor-second-notes_0_15_7", "stand-pg"), ("network", "rm", "maxitor-second-notes_0_15_7")]


async def test_a_version_whose_containers_are_gone_but_whose_network_is_left_is_still_seen_so_the_round_stops_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _docker_answering(monkeypatch, {("ps",): (0, "v6"), ("network", "ls"): (0, "v6\nv7")})
    assert await _runner_with_database().running_versions() == {"v6", "v7"}


async def test_a_runner_starting_afresh_removes_every_network_of_its_own(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _docker_answering(monkeypatch, {("network", "ls"): (0, "maxitor-second-notes_0_15_6\nmaxitor-second-notes_0_15_7")})
    await _runner_with_database().stop_all()
    listed = next(call for call in calls if call[:2] == ("network", "ls"))
    assert f"label={VERSION_LABEL}" in listed and f"label={RUNNER_LABEL}=second" in listed
    assert [call[-1] for call in calls if call[:2] == ("network", "rm")] == ["maxitor-second-notes_0_15_6", "maxitor-second-notes_0_15_7"]


async def test_a_versions_network_is_labelled_with_it_and_its_runner(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _docker_answering(monkeypatch, {("network", "inspect"): (1, "No such network")})
    processes = _runner_with_database()
    monkeypatch.setattr(processes._runtime, "env_path", lambda schema: Path("/nowhere") / schema / ".env")
    monkeypatch.setattr("maxitor.core.plugins.plugin_processes.read_env_file", lambda path: {})
    with pytest.raises(RuntimeError):
        await processes.start("v7", "backend", "notes_0_15_7", "image")
    created = next(call for call in calls if call[:2] == ("network", "create"))
    assert created == ("network", "create", "--label", f"{VERSION_LABEL}=v7", "--label", f"{RUNNER_LABEL}=second", "maxitor-second-notes_0_15_7")


async def test_a_network_docker_cannot_make_stops_the_start_in_dockers_own_words(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _docker_answering(monkeypatch, {
        ("network", "inspect"): (1, "No such network"),
        ("network", "create"): (1, "Error response from daemon: all predefined address pools have been fully subnetted"),
    })
    with pytest.raises(RuntimeError, match=r"the network maxitor-second-notes_0_15_7 could not be made: .*address pools have been fully subnetted"):
        await _runner_with_database().start("v7", "backend", "notes_0_15_7", "image")
    assert not any(call[0] == "run" for call in calls)
