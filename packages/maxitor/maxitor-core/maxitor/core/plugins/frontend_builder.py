# packages/maxitor/maxitor-core/maxitor/core/plugins/frontend_builder.py
"""
FrontendBuilderController — a plugin version's frontend built into an image with the core's own ``@maxitor/*``.

::

    image  maxitor-plugin-builder:<core version>     Node and the core's packages under /maxitor/lib
    <work>/<schema>/source       the plugin's sources, checked and pointed at the core's packages (frontend_build)
    <work>/<schema>/npm-cache    what the fetch downloaded
    container  fetch    npm ci --ignore-scripts: npm downloads the lock's packages; no plugin code runs
    container  build    no network: npm ci --offline, then next build
    image  maxitor-plugin/<schema>-frontend:<sha12>-<core version>   node:22-slim, the standalone server

Both containers run as nobody, with no capabilities and a read-only root. The build's variables are the core's
alone. A step that fails ends the build with the first error it printed.
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import os
import re
import shutil
from collections.abc import Sequence
from pathlib import Path

from maxitor.core.plugins.frontend_build import BUILDER, LIBRARY, REGISTRY, library_root, prepare
from maxitor.core.plugins.plugin_processes import (
    INNER_PORTS,
    UNPRIVILEGED,
    EnvironmentInstallError,
    build_failure,
    docker,
)

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseController

#: Connection key under which actions receive the controller.
BUILDER_CONNECTION_KEY = "frontend_builder"
#: The label of a builder image that says which files it was built from.
CONTEXT_LABEL = "maxitor.builder.context"
#: What the build runs once its packages are installed: Next.js's own command, not the plugin's scripts.
NEXT_BUILD = "node node_modules/next/dist/bin/next build"
#: A Next.js type error is printed under the line naming its file: ``./app/page.tsx:3:7``.
_FILE_LINE = re.compile(r"^\.?/?[\w@./-]+\.\w+:\d+:\d+$")
#: The lines that say what failed: npm's, Next.js's and Node's.
_FIRST_ERROR = re.compile(r"^(npm error .*|npm ERR! .*|Type error: .*|Error: .*|Failed to compile.*)$")
#: npm's lines that only classify an error it states on another line.
_NPM_DETAIL = re.compile(r"^npm (error|ERR!) (code|errno|syscall) ")

FRONTEND_DOCKERFILE = """FROM {base}
COPY app/ /app/
USER {user}
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT={port} NEXT_TELEMETRY_DISABLED=1 TZ=UTC LANG=C.UTF-8
CMD ["node", "/app/server.js"]
"""


def core_version() -> str:
    """The version of the installed ``maxitor``: the core every build belongs to."""
    return importlib.metadata.version("maxitor")


def base_image(dockerfile: Path = BUILDER / "Dockerfile") -> str:
    """The Node image the builder starts from, pinned by digest; the frontend's image starts from the same."""
    for line in dockerfile.read_text(encoding="utf-8").splitlines():
        if line.startswith("FROM "):
            return line.split()[1]
    raise EnvironmentInstallError("the builder's Dockerfile names no image")


def first_error(output: str, code: int) -> str:
    """
    Why a build container failed: the first error line it printed — npm's ``npm error …``, Next.js's
    ``Type error: …`` with the file and line printed above it, Node's ``Error: …`` — else its last line; at most
    500 characters.
    """
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    for index, line in enumerate(lines):
        if _FIRST_ERROR.match(line) and not _NPM_DETAIL.match(line):
            if line.startswith("Type error:") and index and _FILE_LINE.match(lines[index - 1]):
                line = f"{lines[index - 1]} {line}"
            return line[:500]
    return (lines[-1] if lines else f"exit {code}")[:500]


def _context_digest(folder: Path) -> str:
    """One hash of every file of the builder's context, by path and content."""
    digest = hashlib.sha256()
    for path in sorted(p for p in folder.rglob("*") if p.is_file()):
        digest.update(str(path.relative_to(folder)).encode() + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()[:16]


@meta(description="Builds a plugin version's frontend into an image with the core's own @maxitor packages")
class FrontendBuilderController(BaseController):
    """
    AI-CORE-BEGIN
    ROLE: Every Docker step of building a plugin's frontend.
    CONTRACT: ``ensure_builder`` builds the builder image of the running core version once and answers whether it
        built it now; ``build`` checks a version's frontend sources, fetches its packages, builds it without a
        network and answers the frontend's image, or raises ``EnvironmentInstallError`` with the first error.
    INVARIANTS: The plugin's code runs only in the build container, which has no network; npm downloads only the
        packages of the checked lock, from npm; no setting of the core reaches either container.
    AI-CORE-END
    """

    def __init__(
        self, work: Path, *, version: str | None = None, memory: str = "2g", cpus: str = "2", library: Path | None = None
    ) -> None:
        self._work = work
        self._version = version or core_version()
        self._memory = memory
        self._cpus = cpus
        self._library = library or library_root()

    def __repr__(self) -> str:
        return "FrontendBuilderController(docker)"

    @classmethod
    def get_wrapper_class(cls) -> None:
        """No wrapper: a build belongs to the installer, not to one call."""
        return None

    @property
    def version(self) -> str:
        """The core version the builds are made for."""
        return self._version

    @property
    def builder_image(self) -> str:
        """``maxitor-plugin-builder:<core version>``."""
        return f"maxitor-plugin-builder:{self._version}"

    def frontend_image(self, schema: str, sha256: str) -> str:
        """``maxitor-plugin/<schema>-frontend:<sha12>-<core version>``."""
        return f"maxitor-plugin/{schema}-frontend:{sha256[:12]}-{self._version}"

    async def ensure_builder(self) -> bool:
        """Build the builder image when it is missing or was built from other files; answer whether it was built now."""
        context = self._work / "builder-image"
        shutil.rmtree(context, ignore_errors=True)
        context.mkdir(parents=True)
        shutil.copy(BUILDER / "Dockerfile", context / "Dockerfile")
        for name, folder in LIBRARY.items():
            shutil.copytree(
                self._library / folder, context / "lib" / folder, ignore=shutil.ignore_patterns("node_modules", "tests")
            )
            if not (context / "lib" / folder / "package.json").is_file():
                raise EnvironmentInstallError(f"the core's copy of {name} has no package.json")
        digest = _context_digest(context)
        code, label = await docker("image", "inspect", "--format", f'{{{{index .Config.Labels "{CONTEXT_LABEL}"}}}}', self.builder_image)
        if code == 0 and label == digest:
            return False
        await self._docker_build(self.builder_image, context, "--label", f"{CONTEXT_LABEL}={digest}")
        return True

    async def build(self, schema: str, sha256: str, source: Path) -> str:
        """Build the frontend at ``source`` of the version ``sha256``; answer its image or raise ``EnvironmentInstallError``."""
        home = self._work / schema
        work = home / "source"
        cache = home / "npm-cache"
        prepare(source, work, self._version, library=self._library)
        shutil.rmtree(cache, ignore_errors=True)
        cache.mkdir(parents=True)
        for folder in (home, work, cache):
            _open_to_nobody(folder)
        await self.ensure_builder()
        install = ["npm", "ci", "--include=dev", "--install-links", f"--registry={REGISTRY}", "--cache=/npm-cache", "--no-audit", "--no-fund"]
        await self._run(work, cache, network=True, command=[*install, "--ignore-scripts"])
        await self._run(work, cache, network=False, command=["sh", "-c", f"{' '.join([*install, '--offline'])} && {NEXT_BUILD}"])
        standalone = work / ".next" / "standalone"
        if not (standalone / "server.js").is_file():
            raise EnvironmentInstallError('the build has no standalone server; next.config must set output: "standalone"')
        image = self.frontend_image(schema, sha256)
        await self._docker_build(image, self._frontend_context(home, work))
        return image

    # ── inside ────────────────────────────────────────────────────────────────

    async def _run(self, work: Path, cache: Path, *, network: bool, command: Sequence[str]) -> None:
        """One container of the builder image on the version's sources; raise with its first error."""
        args = [
            "run", "--rm", "--user", UNPRIVILEGED, "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--read-only", "--tmpfs", "/tmp", "--env", "HOME=/tmp",
            "--memory", self._memory, "--cpus", self._cpus, "--pids-limit", "512",
            "--volume", f"{work}:/build", "--volume", f"{cache}:/npm-cache",
        ]
        if not network:
            args += ["--network", "none"]
        code, output = await docker(*args, self.builder_image, *command)
        if code != 0:
            raise EnvironmentInstallError(first_error(output, code))

    def _frontend_context(self, home: Path, work: Path) -> Path:
        context = home / "image-frontend"
        shutil.rmtree(context, ignore_errors=True)
        shutil.copytree(work / ".next" / "standalone", context / "app", symlinks=True)
        shutil.copytree(work / ".next" / "static", context / "app" / ".next" / "static")
        if (work / "public").is_dir():
            shutil.copytree(work / "public", context / "app" / "public")
        dockerfile = FRONTEND_DOCKERFILE.format(base=base_image(), user=UNPRIVILEGED, port=INNER_PORTS["frontend"])
        (context / "Dockerfile").write_text(dockerfile, encoding="utf-8")
        return context

    async def _docker_build(self, tag: str, context: Path, *extra: str) -> None:
        code, output = await docker("build", "--progress=plain", "--tag", tag, *extra, str(context))
        if code != 0:
            raise EnvironmentInstallError(build_failure(output, code))


def _open_to_nobody(folder: Path) -> None:
    """Let the containers' user write the folder: they run as nobody, the host's folder belongs to the installer."""
    os.chmod(folder, 0o777)
    for path in folder.rglob("*"):
        os.chmod(path, 0o777 if path.is_dir() else 0o666)

