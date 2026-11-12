# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/build_frontend_action.py
"""
BuildFrontendAction — the installer builds one plugin version's frontend for the running core version.

::

    built for this core version ──► nothing to do
    otherwise ──► building ──► the sources out of the wheel ──► the builder image ──► the build ──► built (its image)
                                                                                         └────► failed (its error)

Nothing is locked while it builds: a build takes minutes, and the row it writes is the version's alone. The
deployment that follows takes a version only with a ``built`` row for the running core version.
"""

from __future__ import annotations

import shutil
import time
import uuid
from datetime import UTC, datetime
from typing import Any, Literal, cast

from maxitor.core.plugins.actions.deploy_and_install_action import schema_name_of
from maxitor.core.plugins.events import BuilderImageBuiltEvent, FrontendBuildFailedEvent, FrontendBuiltEvent
from maxitor.core.plugins.frontend_builder import BUILDER_CONNECTION_KEY, FrontendBuilderController
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.plugin_processes import EnvironmentInstallError
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage
from maxitor.core.plugins.storage.wheel_storage import WHEELS_CONNECTION_KEY, WheelStorage
from maxitor.core.plugins.wheel import WheelRefusedError, extract_sources, read_wheel
from pydantic import Field

from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.emits import emits
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging import Channel
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class BuildParams(BaseParams):
    """One plugin version whose frontend is to be built."""

    version_id: str = Field(description="The version")


class BuildResult(BaseResult):
    """How the build ended."""

    state: Literal["built", "failed", "gone"] = Field(
        description="built, now or before; failed with the error kept in the build's row; gone when there is no such version"
    )


@meta(description="Build a plugin version's frontend with the core's own @maxitor packages", domain=PluginsDomain)
@check_roles(InstallerRole)
@connection(DeployStorage, key=DEPLOY_CONNECTION_KEY, description="The schema plugins, as maxitor_installer")
@connection(WheelStorage, key=WHEELS_CONNECTION_KEY, description="The wheels Maxitor keeps, by SHA-256")
@connection(FrontendBuilderController, key=BUILDER_CONNECTION_KEY, description="Docker on the installer's host")
class BuildFrontendAction(BaseAction[BuildParams, BuildResult]):
    """
    AI-CORE-BEGIN
    ROLE: Build one version's frontend for the running core version, once.
    CONTRACT: A version with a built build for this core version is left alone; otherwise its row goes building, then
        built with the image or failed with the first error; a failed row is built again on the next call.
    INVARIANTS: No lock is held while it builds; the plugin's code runs only in the builder's container without a
        network.
    AI-CORE-END
    """

    @summary_aspect("Build the version's frontend unless it is built for this core version")
    @emits(BuilderImageBuiltEvent, FrontendBuiltEvent, FrontendBuildFailedEvent)
    async def build_summary(self, params: BuildParams, state: BaseState, box: ToolsBox, connections: Connections) -> BuildResult:
        """The row, the build, the row again."""
        _ = state
        store = cast(DeployStorage, connections[DEPLOY_CONNECTION_KEY])
        builder = cast(FrontendBuilderController, connections[BUILDER_CONNECTION_KEY])
        version = await store.version(params.version_id)
        if version is None:
            return BuildResult(state="gone")
        core = builder.version
        found = await store.build(params.version_id, core)
        if found is not None and found["state"] == "built":
            return BuildResult(state="built")
        row = {
            "id": found["id"] if found else str(uuid.uuid4()),
            "version_id": params.version_id,
            "core_version": core,
            "state": "building",
            "image": None,
            "error": None,
            "started_at": datetime.now(UTC),
            "finished_at": None,
        }
        await store.put_build(row)
        began = time.monotonic()
        try:
            image = await self._build(version, builder, cast(WheelStorage, connections[WHEELS_CONNECTION_KEY]), box)
        except (EnvironmentInstallError, WheelRefusedError, OSError) as error:
            reason = str(getattr(error, "reason", None) or getattr(error, "detail", None) or error)[:500]
            await store.put_build({**row, "state": "failed", "error": reason, "finished_at": datetime.now(UTC)})
            await box.critical(
                Channel.business,
                "The frontend of {%var.passport_id} {%var.version} could not be built for the core {%var.core_version}:"
                " {%var.error}",
                FrontendBuildFailedEvent(passport_id=version["passport_id"], version=version["version"], core_version=core, error=reason),
            )
            return BuildResult(state="failed")
        await store.put_build({**row, "state": "built", "image": image, "finished_at": datetime.now(UTC)})
        await box.info(
            Channel.business,
            "The frontend of {%var.passport_id} {%var.version} built for the core {%var.core_version} as {%var.image}",
            FrontendBuiltEvent(
                passport_id=version["passport_id"],
                version=version["version"],
                core_version=core,
                image=image,
                seconds=round(time.monotonic() - began, 1),
            ),
        )
        return BuildResult(state="built")

    @staticmethod
    async def _build(version: dict[str, Any], builder: FrontendBuilderController, wheels: WheelStorage, box: ToolsBox) -> str:
        """The builder image, then the version's sources out of its wheel, then the build."""
        began = time.monotonic()
        if await builder.ensure_builder():
            await box.info(
                Channel.business,
                "The builder image of the core {%var.core_version} built in {%var.seconds} s",
                BuilderImageBuiltEvent(core_version=builder.version, seconds=round(time.monotonic() - began, 1)),
            )
        data = wheels.read(version["sha256"])
        if data is None:
            raise EnvironmentInstallError(f"the wheel {version['sha256']} is not in the wheel store")
        source = (read_wheel(data).passport.get("frontend") or {}).get("source")
        if not isinstance(source, str):
            raise EnvironmentInstallError("the passport names no frontend.source")
        schema = schema_name_of(version["name"], version["version"])
        sources = builder.work / schema / "wheel-source"
        shutil.rmtree(sources, ignore_errors=True)
        extract_sources(data, source, sources)
        return await builder.build(schema, version["sha256"], sources)
