# packages/maxitor/maxitor-core/maxitor/core/plugins/plugin_processes.py
"""
PluginProcessesController — a deployed version's own Python environment and its processes on the runner's host.

::

    <runtime>/<schema>/plugin.env      the version's database address and service key (written by the installer)
    <runtime>/<schema>/venv/           its environment: uv venv, then uv pip install <its wheel>
    backend   <venv>/bin/python -m uvicorn <backend.app> --factory --host 127.0.0.1 --port <p>
    frontend  node <purelib>/<frontend.build>/server.js        with PORT=<p>, HOSTNAME=127.0.0.1

A process gets its environment file, the core's JWKS address, its own backend's inner address and the gateway's —
and nothing of the core's own settings. It listens only on 127.0.0.1; the gateway is the only way to it.
"""

from __future__ import annotations

import asyncio
import io
import os
import shutil
import socket
import subprocess
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from maxitor.core.plugins.storage.plugin_runtime_storage import PluginRuntimeStorage
from maxitor.core.plugins.storage.wheel_storage import WheelStorage
from maxitor.core.plugins.wheel import read_wheel

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseController

#: Connection key under which the runner's actions receive the controller.
PROCESSES_CONNECTION_KEY = "processes"
#: The kinds of a version's processes, in the order they start.
KINDS = ("backend", "frontend")
#: The file whose presence says a version's environment is complete.
_READY = ".ready"
_LOOPBACK = "127.0.0.1"


class EnvironmentInstallError(RuntimeError):
    """A version's environment could not be made; ``reason`` is the last line the tool answered."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class Started:
    """A process that accepts on its inner address."""

    pid: int
    address: str


@dataclass(frozen=True)
class Plan:
    """How one version's processes start: the backend's factory and, when the wheel carries one, the frontend's build."""

    backend_app: str
    frontend_build: str | None


def free_port() -> int:
    """A port nothing listens on now, chosen by the system."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind((_LOOPBACK, 0))
        return int(probe.getsockname()[1])


def read_env_file(path: Path) -> dict[str, str]:
    """The ``KEY=value`` lines of a version's environment file."""
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.partition("=")
        if sep and key.strip():
            values[key.strip()] = value.strip()
    return values


def wheel_file_name(data: bytes) -> str:
    """The name a wheel must have for an installer: ``<dist-info>-<tag>.whl`` from its own ``WHEEL`` file."""
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        info = next(n for n in archive.namelist() if n.count("/") == 1 and n.endswith(".dist-info/WHEEL"))
        tags = [line.split(":", 1)[1].strip() for line in archive.read(info).decode("utf-8").splitlines() if line.startswith("Tag:")]
    stem = info.split("/", 1)[0].removesuffix(".dist-info")
    return f"{stem}-{tags[0] if tags else 'py3-none-any'}.whl"


@meta(description="Installs a deployed version's Python environment from its wheel and starts, watches and stops its processes")
class PluginProcessesController(BaseController):
    """
    AI-CORE-BEGIN
    ROLE: Every operating-system step of running a plugin version.
    CONTRACT: ``plan`` reads how a version starts from its wheel's passport; ``ensure_environment`` makes the version's
        environment once; ``start`` runs one process and answers its pid and address once it accepts, or raises;
        ``exit_code`` tells whether a process this controller started has exited; ``stop`` ends a version's processes.
    INVARIANTS: A process listens only on 127.0.0.1 and gets no setting of the core but the JWKS and gateway addresses.
    AI-CORE-END
    """

    def __init__(
        self,
        runtime: PluginRuntimeStorage,
        wheels: WheelStorage,
        *,
        jwks_url: str,
        gateway_url: str,
        find_links: Path | None = None,
        start_timeout: float = 30.0,
    ) -> None:
        self._runtime = runtime
        self._wheels = wheels
        self._jwks_url = jwks_url
        self._gateway_url = gateway_url
        self._find_links = find_links
        self._start_timeout = start_timeout
        self._children: dict[tuple[str, str], asyncio.subprocess.Process] = {}

    def __repr__(self) -> str:
        return "PluginProcessesController()"

    @classmethod
    def get_wrapper_class(cls) -> None:
        """No wrapper: the processes belong to the runner, not to one call."""
        return None

    # ── what a version needs ──────────────────────────────────────────────────

    def plan(self, sha256: str) -> Plan:
        """The backend's factory and the frontend's build path, from the version's wheel."""
        data = self._wheel(sha256)
        passport: dict[str, Any] = read_wheel(data).passport
        backend = passport.get("backend") or {}
        frontend = passport.get("frontend") or {}
        build = frontend.get("build")
        return Plan(str(backend["app"]), str(build) if isinstance(build, str) else None)

    def ensure_environment(self, schema: str, sha256: str) -> Path:
        """The version's environment, made from its wheel the first time; raise ``EnvironmentInstallError``."""
        home = self._runtime.env_path(schema).parent
        venv = home / "venv"
        if (venv / _READY).exists():
            return venv
        shutil.rmtree(venv, ignore_errors=True)
        data = self._wheel(sha256)
        wheel_dir = home / "wheel"
        wheel_dir.mkdir(parents=True, exist_ok=True)
        wheel = wheel_dir / wheel_file_name(data)
        wheel.write_bytes(data)
        create = ["uv", "venv", "--quiet", "--python", _interpreter(), str(venv)]
        install = ["uv", "pip", "install", "--quiet", "--python", str(venv / "bin" / "python"), str(wheel)]
        if self._find_links is not None:
            install += ["--find-links", str(self._find_links)]
        for command in (create, install):
            done = subprocess.run(command, capture_output=True, check=False, env=_tool_environment())
            if done.returncode != 0:
                lines = (done.stderr or done.stdout).decode("utf-8", "replace").strip().splitlines()
                raise EnvironmentInstallError((lines[-1] if lines else f"exit {done.returncode}")[:500])
        (venv / _READY).write_text("", encoding="utf-8")
        return venv

    def frontend_path(self, venv: Path, build: str) -> Path | None:
        """The frontend's ``server.js`` inside the environment, when the wheel carried a build."""
        purelib = subprocess.run(
            [str(venv / "bin" / "python"), "-c", "import sysconfig; print(sysconfig.get_paths()['purelib'])"],
            capture_output=True,
            check=True,
        ).stdout.decode("utf-8").strip()
        server = Path(purelib) / build / "server.js"
        return server if server.is_file() else None

    # ── processes ─────────────────────────────────────────────────────────────

    async def start(self, version_id: str, kind: str, schema: str, command: list[str], backend: str | None) -> Started:
        """Run one process with its own environment and wait until it accepts; raise ``RuntimeError`` otherwise."""
        await self.stop_one(version_id, kind)
        port = free_port()
        environment = self._environment(schema, port, backend if kind == "frontend" else f"http://{_LOOPBACK}:{port}")
        if kind == "backend":
            command = [*command, "--host", _LOOPBACK, "--port", str(port)]
        child = await asyncio.create_subprocess_exec(
            *command,
            cwd=str(self._runtime.env_path(schema).parent),
            env=environment,
            stdin=asyncio.subprocess.DEVNULL,
            start_new_session=True,
        )
        self._children[(version_id, kind)] = child
        if not await _accepts(port, child, self._start_timeout):
            code = child.returncode
            await self.stop_one(version_id, kind)
            raise RuntimeError("not_listening" if code is None else f"exited {code}")
        return Started(child.pid, f"http://{_LOOPBACK}:{port}")

    def exit_code(self, version_id: str, kind: str) -> int | None:
        """``None`` while the process this controller started runs; its exit code once it ended, or -1 if unknown."""
        child = self._children.get((version_id, kind))
        if child is None:
            return -1
        return child.returncode

    async def stop_one(self, version_id: str, kind: str) -> None:
        """End one process this controller started, if it runs."""
        child = self._children.pop((version_id, kind), None)
        if child is None or child.returncode is not None:
            return
        child.terminate()
        try:
            await asyncio.wait_for(child.wait(), timeout=10)
        except TimeoutError:
            child.kill()
            await child.wait()

    async def stop(self, version_id: str) -> None:
        """End every process of a version."""
        for kind in KINDS:
            await self.stop_one(version_id, kind)

    def running_versions(self) -> set[str]:
        """The versions with a process this controller started."""
        return {version_id for version_id, _kind in self._children}

    async def stop_all(self) -> None:
        """End every process this controller started: the runner is stopping."""
        for version_id in self.running_versions():
            await self.stop(version_id)

    # ── inside ────────────────────────────────────────────────────────────────

    def _wheel(self, sha256: str) -> bytes:
        data = self._wheels.read(sha256)
        if data is None:
            raise EnvironmentInstallError(f"the wheel {sha256} is not in the wheel store")
        return data

    def _environment(self, schema: str, port: int, backend: str | None) -> dict[str, str]:
        values = read_env_file(self._runtime.env_path(schema))
        values.update(
            {
                "MAXITOR_CORE_JWKS_URL": self._jwks_url,
                "MAXITOR_GATEWAY_URL": self._gateway_url,
                "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
                "LANG": os.environ.get("LANG", "C.UTF-8"),
                "PORT": str(port),
                "HOSTNAME": _LOOPBACK,
            }
        )
        if backend is not None:
            values["MAXITOR_PLUGIN_API"] = backend
        return values


def _interpreter() -> str:
    """The Python the core runs on: a plugin's environment uses the same version."""
    return sys.executable


def _tool_environment() -> dict[str, str]:
    """What ``uv`` needs to run, and nothing of the core's settings."""
    keep = ("PATH", "HOME", "LANG", "UV_CACHE_DIR", "UV_PYTHON", "UV_INDEX_URL", "UV_EXTRA_INDEX_URL", "SSL_CERT_FILE")
    return {key: os.environ[key] for key in keep if key in os.environ}


async def _accepts(port: int, child: asyncio.subprocess.Process, timeout: float) -> bool:
    """Whether the process accepts a connection on ``port`` within ``timeout``, while it has not exited."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        if child.returncode is not None:
            return False
        try:
            _reader, writer = await asyncio.open_connection(_LOOPBACK, port)
        except OSError:
            await asyncio.sleep(0.2)
            continue
        writer.close()
        await writer.wait_closed()
        return True
    return False
