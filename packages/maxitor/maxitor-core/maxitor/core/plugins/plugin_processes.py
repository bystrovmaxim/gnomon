# packages/maxitor/maxitor-core/maxitor/core/plugins/plugin_processes.py
"""
PluginProcessesController — a deployed version's images and its containers on the runner's host, through Docker.

::

    <runtime>/<schema>/plugin.env         the version's database address and service key (written by the installer)
    image  maxitor-plugin/<schema>-backend:<sha>    python:<x.y>-slim, the wheel and its requirements installed
    image  maxitor-plugin/<schema>-frontend:<sha>   node:22-slim, the wheel's built pages   (when it carries them)
    network maxitor-<schema>                         the version's own; the database joins it when it is a container
    container maxitor-<schema>-<kind>   user 65534, no capabilities, no new privileges, read-only, its limits,
                                        its port published on 127.0.0.1 of the host only

A container gets its environment file — with the database's address as the containers see it — the gateway's
address as the containers see it, the core's JWKS through that gateway, and its backend's address; nothing of the
core's own settings. It cannot read another version's file or the core's process, and reaches another plugin
only through the gateway.
"""

from __future__ import annotations

import asyncio
import io
import shutil
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from maxitor.core.plugins.storage.plugin_runtime_storage import PluginRuntimeStorage
from maxitor.core.plugins.storage.wheel_storage import WheelStorage
from maxitor.core.plugins.wheel import read_wheel

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseController

#: Connection key under which the runner's actions receive the controller.
PROCESSES_CONNECTION_KEY = "processes"
#: The kinds of a version's processes, in the order they start.
KINDS = ("backend", "frontend")
#: The labels every plugin container carries: the version it runs and its kind.
VERSION_LABEL = "maxitor.plugin.version"
KIND_LABEL = "maxitor.plugin.kind"
#: The port each kind listens on inside its container.
INNER_PORTS = {"backend": 8000, "frontend": 3000}
#: Nobody: the user every plugin container runs as.
UNPRIVILEGED = "65534:65534"
_LOOPBACK = "127.0.0.1"

BACKEND_DOCKERFILE = """FROM python:{python}-slim
COPY wheels/ /wheels/
RUN pip install --no-cache-dir --disable-pip-version-check --find-links /wheels /wheels/{wheel} && rm -rf /wheels
USER {user}
CMD ["python", "-m", "uvicorn", "{app}", "--factory", "--host", "0.0.0.0", "--port", "{port}"]
"""
FRONTEND_DOCKERFILE = """FROM node:22-slim
COPY web/ /app/
USER {user}
ENV HOSTNAME=0.0.0.0 PORT={port}
CMD ["node", "/app/server.js"]
"""


class EnvironmentInstallError(RuntimeError):
    """A version's image could not be built; ``reason`` is the last line Docker answered."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class Started:
    """A container that answers on its published address."""

    container: str
    address: str


@dataclass(frozen=True)
class Plan:
    """How one version runs: the backend's factory and, when the wheel carries one, the frontend's build."""

    backend_app: str
    frontend_build: str | None


@dataclass(frozen=True)
class Images:
    """The version's images: the backend's always, the frontend's when the wheel carries its build."""

    backend: str
    frontend: str | None


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
        lines = archive.read(info).decode("utf-8").splitlines()
    tags = [line.split(":", 1)[1].strip() for line in lines if line.startswith("Tag:")]
    stem = info.split("/", 1)[0].removesuffix(".dist-info")
    return f"{stem}-{tags[0] if tags else 'py3-none-any'}.whl"


def frontend_files(data: bytes, build: str) -> dict[str, bytes]:
    """The files of the wheel under the frontend's build folder, by their path inside it."""
    prefix = build.rstrip("/") + "/"
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        return {
            name[len(prefix) :]: archive.read(name)
            for name in archive.namelist()
            if name.startswith(prefix) and not name.endswith("/") and ".." not in name.split("/")
        }


def moved_dsn(dsn: str, address: str | None) -> str:
    """The version's database address as the containers reach it: ``address`` (host:port) in place of the host's."""
    if not address:
        return dsn
    parts = urlsplit(dsn)
    credentials = parts.netloc.rpartition("@")[0]
    netloc = f"{credentials}@{address}" if credentials else address
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, ""))


async def docker(*args: str) -> tuple[int, str]:
    """Run ``docker`` with ``args``; answer its exit code and its output, the error output when it failed."""
    process = await asyncio.create_subprocess_exec(
        "docker",
        *args,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await process.communicate()
    code = process.returncode if process.returncode is not None else -1
    return code, (out if code == 0 else err or out).decode("utf-8", "replace").strip()


@meta(description="Builds a deployed version's Docker images and starts, watches and stops its containers")
class PluginProcessesController(BaseController):
    """
    AI-CORE-BEGIN
    ROLE: Every Docker step of running a plugin version.
    CONTRACT: ``plan`` reads how a version runs from its wheel; ``ensure_images`` builds its images once; ``start``
        runs one container and answers its name and address once it answers HTTP, or raises; ``exit_code`` tells
        whether a container runs; ``stop`` removes a version's containers; ``stop_all`` every plugin container.
    INVARIANTS: A container runs unprivileged, with its limits and its own network, its port on 127.0.0.1 only, and
        gets no setting of the core.
    AI-CORE-END
    """

    def __init__(
        self,
        runtime: PluginRuntimeStorage,
        wheels: WheelStorage,
        *,
        gateway_url: str,
        db_address: str | None = None,
        db_container: str | None = None,
        find_links: Path | None = None,
        memory: str = "512m",
        cpus: str = "1",
        start_timeout: float = 60.0,
    ) -> None:
        self._runtime = runtime
        self._wheels = wheels
        self._gateway_url = gateway_url.rstrip("/")
        self._db_address = db_address
        self._db_container = db_container
        self._find_links = find_links
        self._memory = memory
        self._cpus = cpus
        self._start_timeout = start_timeout

    def __repr__(self) -> str:
        return "PluginProcessesController(docker)"

    @classmethod
    def get_wrapper_class(cls) -> None:
        """No wrapper: the containers belong to the runner, not to one call."""
        return None

    # ── what a version needs ──────────────────────────────────────────────────

    def plan(self, sha256: str) -> Plan:
        """The backend's factory and, when the wheel carries its ``server.js``, the frontend's build path."""
        data = self._wheel(sha256)
        passport: dict[str, Any] = read_wheel(data).passport
        build = (passport.get("frontend") or {}).get("build")
        carries = isinstance(build, str) and "server.js" in frontend_files(data, build)
        return Plan(str((passport.get("backend") or {})["app"]), str(build) if carries else None)

    async def ensure_images(self, schema: str, sha256: str, plan: Plan) -> Images:
        """The version's images, built the first time; raise ``EnvironmentInstallError``."""
        backend = f"maxitor-plugin/{schema}-backend:{sha256[:12]}"
        frontend = f"maxitor-plugin/{schema}-frontend:{sha256[:12]}" if plan.frontend_build else None
        if not await self._has_image(backend):
            await self._build(backend, self._backend_context(schema, sha256, plan))
        if frontend is not None and plan.frontend_build is not None and not await self._has_image(frontend):
            await self._build(frontend, self._frontend_context(schema, sha256, plan.frontend_build))
        return Images(backend, frontend)

    # ── containers ────────────────────────────────────────────────────────────

    async def start(self, version_id: str, kind: str, schema: str, image: str) -> Started:
        """Run one container and wait until it answers HTTP; raise ``RuntimeError`` otherwise."""
        name = f"maxitor-{schema}-{kind}"
        await docker("rm", "--force", name)
        network = await self._network(schema)
        inner = INNER_PORTS[kind]
        command = [
            "run", "--detach", "--name", name,
            "--label", f"{VERSION_LABEL}={version_id}", "--label", f"{KIND_LABEL}={kind}",
            "--network", network, "--add-host", "host.docker.internal:host-gateway",
            "--user", UNPRIVILEGED, "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--read-only", "--tmpfs", "/tmp",
            "--memory", self._memory, "--cpus", self._cpus, "--pids-limit", "256",
            "--publish", f"{_LOOPBACK}::{inner}",
        ]
        for key, value in self._environment(schema, kind).items():
            command += ["--env", f"{key}={value}"]
        code, output = await docker(*command, image)
        if code != 0:
            raise RuntimeError(f"not_started: {output.splitlines()[-1] if output else code}")
        code, published = await docker("port", name, f"{inner}/tcp")
        if code != 0 or not published:
            await docker("rm", "--force", name)
            raise RuntimeError("not_published")
        address = f"http://{_LOOPBACK}:{published.splitlines()[0].rsplit(':', 1)[1]}"
        if not await self._answers(name, address):
            state = await self.exit_code(version_id, kind)
            await docker("rm", "--force", name)
            raise RuntimeError("not_listening" if state is None else f"exited {state}")
        return Started(name, address)

    async def exit_code(self, version_id: str, kind: str) -> int | None:
        """``None`` while the container runs; its exit code once it stopped; -1 when there is no such container."""
        container = await self._container(version_id, kind)
        if container is None:
            return -1
        code, output = await docker("inspect", "--format", "{{.State.Running}} {{.State.ExitCode}}", container)
        if code != 0 or not output:
            return -1
        running, _, exit_code = output.partition(" ")
        return None if running == "true" else int(exit_code or "-1")

    async def stop_one(self, version_id: str, kind: str) -> None:
        """Remove one container of a version, running or not."""
        container = await self._container(version_id, kind)
        if container is not None:
            await docker("rm", "--force", container)

    async def stop(self, version_id: str) -> None:
        """Remove every container of a version."""
        await self._remove(f"label={VERSION_LABEL}={version_id}")

    async def running_versions(self) -> set[str]:
        """The versions with a plugin container on this host."""
        code, output = await docker("ps", "--all", "--filter", f"label={VERSION_LABEL}", "--format", f'{{{{.Label "{VERSION_LABEL}"}}}}')
        return set(output.split()) if code == 0 else set()

    async def stop_all(self) -> None:
        """Remove every plugin container: the runner starts from nothing, or it is stopping."""
        await self._remove(f"label={VERSION_LABEL}")

    # ── inside ────────────────────────────────────────────────────────────────

    async def _container(self, version_id: str, kind: str) -> str | None:
        code, output = await docker(
            "ps", "--all", "--quiet", "--filter", f"label={VERSION_LABEL}={version_id}", "--filter", f"label={KIND_LABEL}={kind}"
        )
        return output.split()[0] if code == 0 and output else None

    async def _remove(self, label: str) -> None:
        code, output = await docker("ps", "--all", "--quiet", "--filter", label)
        if code == 0 and output:
            await docker("rm", "--force", *output.split())

    def _wheel(self, sha256: str) -> bytes:
        data = self._wheels.read(sha256)
        if data is None:
            raise EnvironmentInstallError(f"the wheel {sha256} is not in the wheel store")
        return data

    def _home(self, schema: str) -> Path:
        return self._runtime.env_path(schema).parent

    def _backend_context(self, schema: str, sha256: str, plan: Plan) -> Path:
        data = self._wheel(sha256)
        context = self._home(schema) / "image-backend"
        shutil.rmtree(context, ignore_errors=True)
        (context / "wheels").mkdir(parents=True)
        wheel = wheel_file_name(data)
        (context / "wheels" / wheel).write_bytes(data)
        if self._find_links is not None:
            for extra in self._find_links.glob("*.whl"):
                shutil.copy(extra, context / "wheels" / extra.name)
        dockerfile = BACKEND_DOCKERFILE.format(
            python=f"{sys.version_info.major}.{sys.version_info.minor}",
            wheel=wheel,
            user=UNPRIVILEGED,
            app=plan.backend_app,
            port=INNER_PORTS["backend"],
        )
        (context / "Dockerfile").write_text(dockerfile, encoding="utf-8")
        return context

    def _frontend_context(self, schema: str, sha256: str, build: str) -> Path:
        context = self._home(schema) / "image-frontend"
        shutil.rmtree(context, ignore_errors=True)
        for path, content in frontend_files(self._wheel(sha256), build).items():
            target = context / "web" / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        dockerfile = FRONTEND_DOCKERFILE.format(user=UNPRIVILEGED, port=INNER_PORTS["frontend"])
        (context / "Dockerfile").write_text(dockerfile, encoding="utf-8")
        return context

    async def _has_image(self, tag: str) -> bool:
        return (await docker("image", "inspect", tag))[0] == 0

    async def _build(self, tag: str, context: Path) -> None:
        code, output = await docker("build", "--quiet", "--tag", tag, str(context))
        if code != 0:
            lines = output.splitlines()
            raise EnvironmentInstallError((lines[-1] if lines else f"exit {code}")[:500])

    async def _network(self, schema: str) -> str:
        """The version's own network; the database's container joins it under the name ``maxitor-db``."""
        name = f"maxitor-{schema}"
        if (await docker("network", "inspect", name))[0] != 0:
            await docker("network", "create", name)
        if self._db_container:
            await docker("network", "connect", "--alias", "maxitor-db", name, self._db_container)
        return name

    def _environment(self, schema: str, kind: str) -> dict[str, str]:
        """What one container is given: its version's file, the database and the gateway as containers see them."""
        values = read_env_file(self._runtime.env_path(schema))
        values["MAXITOR_PLUGIN_DSN"] = moved_dsn(values.get("MAXITOR_PLUGIN_DSN", ""), self._db_address)
        values["MAXITOR_GATEWAY_URL"] = self._gateway_url
        values["MAXITOR_CORE_JWKS_URL"] = f"{self._gateway_url}/api/v1/jwks"
        values["MAXITOR_PLUGIN_API"] = f"http://maxitor-{schema}-backend:{INNER_PORTS['backend']}"
        if kind == "frontend":
            # The frontend talks to its backend with the incoming token; it keeps no secret of its own.
            values.pop("MAXITOR_PLUGIN_DSN", None)
            values.pop("MAXITOR_PLUGIN_SERVICE_KEY", None)
        return values

    async def _answers(self, name: str, address: str) -> bool:
        """Whether the container answers HTTP at ``address`` within the timeout, while it runs."""
        port = int(address.rsplit(":", 1)[1])
        loop = asyncio.get_running_loop()
        deadline = loop.time() + self._start_timeout
        while loop.time() < deadline:
            code, running = await docker("inspect", "--format", "{{.State.Running}}", name)
            if code != 0 or running != "true":
                return False
            try:
                reader, writer = await asyncio.open_connection(_LOOPBACK, port)
                writer.write(b"GET / HTTP/1.0\r\nHost: plugin\r\n\r\n")
                await writer.drain()
                first = await asyncio.wait_for(reader.read(12), timeout=2)
                writer.close()
                await writer.wait_closed()
                if first.startswith(b"HTTP/"):
                    return True
            except (OSError, TimeoutError):
                pass
            await asyncio.sleep(0.5)
        return False
