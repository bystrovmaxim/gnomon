# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/request_install_action.py
"""
RequestInstallAction — an administrator asks to install a plugin of the marketplace.

::

    POST /api/v1/plugins/install  {code, passport_id} {state: "installing"} | 409 with the reason

The checks the installer would make are made here first, so a refusal names what is missing before anything is
written: the version fits this core, and every plugin it needs is installed — enabled or disabled — in the
organization (FR-014). Then a row in ``installing`` waits for the installer (FR-009a).
"""

from __future__ import annotations

import uuid

from maxitor.core.errors import ConflictError, OrganizationNotFoundError
from maxitor.core.plugins.actions.administrator import administered, administrator_verdict, fits_core, plugins
from maxitor.core.plugins.events import InstallRefusedEvent
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from maxitor.core.roles import AccountRole
from maxitor.core.storage.core_storage import UniqueRowError
from pydantic import Field

from aoa.action_machine.context.context_view import ContextView
from aoa.action_machine.context.ctx_constants import Ctx
from aoa.action_machine.intents.access_control import Verdict
from aoa.action_machine.intents.access_decide import access_decide
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.context_requires import context_requires
from aoa.action_machine.intents.emits import emits
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging import Channel
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class PluginParams(BaseParams):
    """A plugin of an organization, from the address."""

    code: str = Field(min_length=1, max_length=200, description="The organization's address code")
    passport_id: str = Field(min_length=1, max_length=200, description="The plugin's id from its passport")


class PluginStateResult(BaseResult):
    """The plugin's state in the organization after the action."""

    state: str = Field(description="installing, enabled, disabled or removed")


@meta(description="Ask to install a plugin of the marketplace into the organization", domain=PluginsDomain)
@check_roles(AccountRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
class RequestInstallAction(BaseAction[PluginParams, PluginStateResult]):
    """
    AI-CORE-BEGIN
    ROLE: Start an install the installer will finish.
    CONTRACT: 404 for a plugin the organization cannot see; 409 already_installed, not_installable, core_range or
        missing_dependency; otherwise a row in installing.
    INVARIANTS: The database's partial unique index decides two installs at once.
    AI-CORE-END
    """

    @access_decide("Let through only an active administrator of the organization")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(
        self, params: PluginParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """The same refusal as for a made-up address."""
        _ = box
        return await administrator_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Check the version and its dependencies, then write the row in installing")
    @context_requires(Ctx.User.user_id)
    @emits(InstallRefusedEvent)
    async def install_summary(
        self, params: PluginParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> PluginStateResult:
        """Refusals first, each written as an event; then one change."""
        _ = state
        account_id = str(ctx.get(Ctx.User.user_id))
        organization = await administered(connections, params.code, account_id)
        store = plugins(connections)
        found = await store.plugin_for(organization["id"], params.passport_id)
        if found is None:
            raise OrganizationNotFoundError("not_found")

        async def refuse(reason: str, **details: object) -> ConflictError:
            await box.warning(
                Channel.business,
                "Install of {%var.passport_id} refused in {%var.organization_id}: {%var.reason}",
                InstallRefusedEvent(
                    organization_id=organization["id"], passport_id=params.passport_id, account_id=account_id, reason=reason
                ),
            )
            return ConflictError(reason, **details)

        if found["row_id"] is not None:
            raise await refuse("already_installed", state=found["row_state"])
        if found["plugin_state"] != "listed" or found["version_state"] != "active":
            raise await refuse("not_installable")
        if not fits_core(found["core_range"]):
            raise await refuse("core_range", range=found["core_range"])
        states = await store.live_states(organization["id"])
        needed = await store.dependencies([found["version_id"]])
        missing = [d["passport_id"] for d in needed if states.get(d["passport_id"]) not in ("enabled", "disabled")]
        if missing:
            raise await refuse("missing_dependency", missing=missing)
        row_id = str(uuid.uuid4())

        async def work() -> None:
            changed = await store.organization_lock(organization["id"])
            await store.insert(
                "organization_plugin",
                {
                    "organization_id": organization["id"],
                    "id": row_id,
                    "plugin_id": found["plugin_id"],
                    "plugin_version_id": found["version_id"],
                    "state": "installing",
                    "reason": None,
                    "installed_by": organization["user_id"],
                    "created_at": changed,
                    "updated_at": None,
                },
                changed,
                account_id,
                type(self).__name__,
            )

        try:
            await store.in_transaction(work)
        except UniqueRowError:
            raise await refuse("already_installed", state="installing") from None
        return PluginStateResult(state="installing")
