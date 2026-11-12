# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/take_up_pending_action.py
"""
TakeUpPendingAction — the installer's queue: the versions waiting for their check and the installs waiting for it.

The installer calls it when it starts and then every minute, and runs the check or the deploy of each row in a call
of its own. On start it says what it found: every row left by an earlier run is taken up, so a crash leaves nothing
stuck (FR-009a).
"""

from __future__ import annotations

from typing import cast

from maxitor.core.plugins.events import InstallerStartedEvent, RowTakenUpEvent
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage
from pydantic import Field

from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.emits import emits
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging import Channel
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.model.base_schema import BaseSchema
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class TakeUpParams(BaseParams):
    """Whether the installer has just started."""

    started: bool = Field(default=False, description="True on the installer's first call after it started")


class PendingInstallSchema(BaseSchema):
    """One install waiting for the installer."""

    organization_id: str = Field(description="The organization")
    row_id: str = Field(description="The organization's plugin row")
    version_id: str = Field(description="The version the row installs")


class TakeUpResult(BaseResult):
    """The installer's work for this round."""

    versions: list[str] = Field(description="The versions to check, oldest first")
    installs: list[PendingInstallSchema] = Field(description="The installs to finish, oldest first")


@meta(description="List the versions to check and the installs to finish", domain=PluginsDomain)
@check_roles(InstallerRole)
@connection(DeployStorage, key=DEPLOY_CONNECTION_KEY, description="The schema plugins, as maxitor_installer")
class TakeUpPendingAction(BaseAction[TakeUpParams, TakeUpResult]):
    """
    AI-CORE-BEGIN
    ROLE: Give the installer its round of work.
    CONTRACT: Answers every draft version and every installing row; on start writes what it found.
    AI-CORE-END
    """

    @summary_aspect("Read the queue; on start say what was left")
    @emits(InstallerStartedEvent, RowTakenUpEvent)
    async def take_up_summary(
        self, params: TakeUpParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> TakeUpResult:
        """Two readings of the queue; the events only on start."""
        _ = state
        store = cast(DeployStorage, connections[DEPLOY_CONNECTION_KEY])
        versions = await store.pending_versions()
        installs = await store.pending_installs()
        if params.started:
            await box.info(
                Channel.business,
                "The installer started: {%var.pending_versions} versions to check, {%var.pending_installs} installs",
                InstallerStartedEvent(pending_versions=len(versions), pending_installs=len(installs)),
            )
            for version_id in versions:
                await box.info(
                    Channel.business,
                    "Version {%var.row_id} taken up after a stop",
                    RowTakenUpEvent(kind="version", row_id=version_id),
                )
            for _organization_id, row_id, _version_id in installs:
                await box.info(
                    Channel.business,
                    "Install {%var.row_id} taken up after a stop",
                    RowTakenUpEvent(kind="install", row_id=row_id),
                )
        return TakeUpResult(
            versions=versions,
            installs=[PendingInstallSchema(organization_id=org, row_id=row, version_id=version) for org, row, version in installs],
        )
