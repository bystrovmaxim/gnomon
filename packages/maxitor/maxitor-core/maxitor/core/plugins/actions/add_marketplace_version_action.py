# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/add_marketplace_version_action.py
"""
AddMarketplaceVersionAction — the operator adds a public plugin's version to the marketplace (FR-004).

Run by the installer's command, never over HTTP:

::

    maxitor-plugin-installer add-version <purl> <sha256>    a wheel on PyPI, downloaded when it is checked
    maxitor-plugin-installer add-wheel <file.whl>           a wheel at hand, kept in the store, named pkg:generic

The version waits in draft under a plugin of no owner; the installer's check gives it the passport's id and name, or
moves it under the public plugin that already has that id.
"""

from __future__ import annotations

from typing import cast

from maxitor.core.plugins.actions.private_plugin import add_waiting, version_of
from maxitor.core.plugins.events import VersionAddedEvent
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage
from packageurl import PackageURL
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


class AddVersionParams(BaseParams):
    """A public version's source and its wheel's hash."""

    purl: str = Field(min_length=1, max_length=500, description="pkg:pypi/<name>@<version>, or pkg:generic for a wheel in the store")
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$", description="The wheel's SHA-256")


class AddVersionResult(BaseResult):
    """The version waiting for its check."""

    version_id: str = Field(description="The version added")


@meta(description="Add a public plugin's version to the marketplace, waiting for its check", domain=PluginsDomain)
@check_roles(InstallerRole)
@connection(DeployStorage, key=DEPLOY_CONNECTION_KEY, description="The schema plugins, as maxitor_installer")
class AddMarketplaceVersionAction(BaseAction[AddVersionParams, AddVersionResult]):
    """
    AI-CORE-BEGIN
    ROLE: Fill the marketplace, by the operator's command.
    CONTRACT: Only pkg:pypi or pkg:generic; a draft version under a waiting public plugin.
    AI-CORE-END
    """

    @summary_aspect("Add the waiting public plugin and its draft version")
    @emits(VersionAddedEvent)
    async def add_summary(
        self, params: AddVersionParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> AddVersionResult:
        """One change; the check decides the rest."""
        _ = state
        parsed = PackageURL.from_string(params.purl)
        if parsed.type not in ("pypi", "generic") or not parsed.version:
            raise ValueError("The public marketplace takes pkg:pypi/<name>@<version> or a wheel kept as pkg:generic.")
        purl = parsed.to_string()
        version_id = await add_waiting(
            cast(DeployStorage, connections[DEPLOY_CONNECTION_KEY]),
            None,
            None,
            title=parsed.name,
            version=version_of(parsed.version),
            purl=purl,
            sha256=params.sha256,
            operation=type(self).__name__,
        )
        await box.info(
            Channel.business,
            "Version {%var.purl} added to the marketplace, waiting for its check",
            VersionAddedEvent(version_id=version_id, purl=purl, sha256=params.sha256),
        )
        return AddVersionResult(version_id=version_id)
