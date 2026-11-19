# packages/maxitor/maxitor-core/maxitor/core/actions/organization_settings.py
"""
Settings → Organization: ReadOrganizationSettingsAction, SetWhoMayInviteAction.

::

    GET  /api/v1/organizations/{code}/settings               the setting, the invitation's days, what a switch withdraws
    POST /api/v1/organizations/settings/who-may-invite      {code, who_may_invite}: any_user or administrators

Only an active administrator of the organization gets through; anyone else is refused as for an organization that
does not exist. Switching to administrators only withdraws, in the same change, every invitation still sent whose
inviter is not an active administrator at that moment.
"""

from __future__ import annotations

from typing import Any, Literal

from maxitor.core.actions.common import now, storage, tokens
from maxitor.core.actions.invitations import OrganizationParams, member
from maxitor.core.actions.invitations_flow import (
    INVITATION_FLOW_EVENTS,
    InvitationSchema,
    expire_due,
    invitation_schema,
    state_of,
)
from maxitor.core.domains import OrganizationDomain
from maxitor.core.events import InvitationWithdrawnEvent, WhoMayInviteChangedEvent
from maxitor.core.roles import AccountRole
from maxitor.core.storage.core_storage import CORE_CONNECTION_KEY, CoreStorage
from maxitor.core.tokens import TOKENS_CONNECTION_KEY, SessionTokensController
from pydantic import Field

from aoa.action_machine.context.context_view import ContextView
from aoa.action_machine.context.ctx_constants import Ctx
from aoa.action_machine.exceptions.access_denied import AccessDenied
from aoa.action_machine.intents.access_control import FORBIDDEN_OBJECT, Allowed, Verdict
from aoa.action_machine.intents.access_decide import access_decide
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.context_requires import context_requires
from aoa.action_machine.intents.emits import emits
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging import Channel
from aoa.action_machine.model import BaseAction, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox

WhoMayInvite = Literal["any_user", "administrators"]


class SettingsResult(BaseResult):
    """The organization's settings as its administrator sees them."""

    code: str = Field(description="The address code")
    name: str = Field(description="The organization's name")
    who_may_invite: str = Field(description="any_user or administrators")
    invitation_days: int = Field(description="How many days an invitation waits: MAXITOR_INVITATION_DAYS")
    pending_by_users: list[InvitationSchema] = Field(
        description="The invitations still sent by ordinary users: what a switch to administrators withdraws"
    )


class SetWhoMayInviteParams(OrganizationParams):
    """The new value."""

    who_may_invite: WhoMayInvite = Field(description="any_user or administrators")


class WhoMayInviteResult(BaseResult):
    """The setting after the change and what the change withdrew."""

    who_may_invite: str = Field(description="The value now")
    withdrawn: list[InvitationSchema] = Field(description="The invitations the switch withdrew")


async def administrator_verdict(connections: Connections, code: str, account_id: str) -> Verdict:
    """``Allowed`` for an active administrator of the organization; the same refusal as for a made-up address."""
    found = await storage(connections).organization_for(code, account_id)
    return Allowed() if found is not None and found["is_admin"] else FORBIDDEN_OBJECT


async def administrator(connections: Connections, code: str, account_id: str) -> dict[str, Any]:
    """The organization and the account's user in it, read again in the main step, when an active administrator."""
    found = await member(connections, code, account_id)
    if not found["is_admin"]:
        raise AccessDenied(FORBIDDEN_OBJECT)
    return found


def by_ordinary_user(row: dict[str, Any], users: dict[str, dict[str, Any]]) -> bool:
    """Whether an invitation's inviter is not an active administrator now."""
    inviter = users.get(str(row["invited_by"]))
    return inviter is None or not inviter["is_admin"] or inviter["status"] != "active"


@meta(description="Read the organization's settings for its administrator", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The invitation's days")
class ReadOrganizationSettingsAction(BaseAction[OrganizationParams, SettingsResult]):
    """
    AI-CORE-BEGIN
    ROLE: Give Settings → Organization its page.
    CONTRACT: Only an active administrator; the answer names what a switch to administrators would withdraw.
    AI-CORE-END
    """

    @access_decide("Let through only an active administrator of the organization, alike for a code that does not exist")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(
        self, params: OrganizationParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """An active administrator of the account in the organization of the address."""
        _ = box
        return await administrator_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Read the setting and the invitations a switch would withdraw")
    @context_requires(Ctx.User.user_id)
    async def settings_summary(
        self, params: OrganizationParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> SettingsResult:
        """The organization as it is now."""
        _ = (state, box)
        store, keys, at = storage(connections), tokens(connections), now()
        found = await administrator(connections, params.code, str(ctx.get(Ctx.User.user_id)))
        users = {u["id"]: u for u in await store.users_of_organization(found["id"])}
        pending = [
            invitation_schema(row, at)
            for row in await store.invitations_of_organization(found["id"])
            if state_of(row, at) == "sent" and by_ordinary_user(row, users)
        ]
        return SettingsResult(
            code=found["code"],
            name=found["name"],
            who_may_invite=found["who_may_invite"],
            invitation_days=keys.invitation_days,
            pending_by_users=pending,
        )


@meta(description="Change who may invite into the organization", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class SetWhoMayInviteAction(BaseAction[SetWhoMayInviteParams, WhoMayInviteResult]):
    """
    AI-CORE-BEGIN
    ROLE: The organization's gate.
    CONTRACT: Only an active administrator. Under the organization's lock the setting changes, and a switch to
        administrators withdraws every invitation still sent whose inviter is not an active administrator at that
        moment, each marked by the setting and by the administrator who switched; administrators' invitations and
        users who already accepted stay.
    AI-CORE-END
    """

    @access_decide("Let through only an active administrator of the organization, alike for a code that does not exist")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(
        self, params: SetWhoMayInviteParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """An active administrator of the account in the organization of the address."""
        _ = box
        return await administrator_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Change the setting and withdraw what it closes, under the organization's lock")
    @context_requires(Ctx.User.user_id)
    @emits(WhoMayInviteChangedEvent, InvitationWithdrawnEvent, *INVITATION_FLOW_EVENTS)
    async def switch_summary(
        self, params: SetWhoMayInviteParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> WhoMayInviteResult:
        """One change: the organization's version and one per invitation withdrawn."""
        _ = state
        store, account_id, at = storage(connections), str(ctx.get(Ctx.User.user_id)), now()
        found = await administrator(connections, params.code, account_id)
        organization_id, user_id, operation = found["id"], found["user_id"], type(self).__name__

        async def work() -> list[dict[str, Any]]:
            changed_at = await store.organization_lock(organization_id)
            organization = await store.organization(organization_id)
            if organization is None:
                raise AccessDenied(FORBIDDEN_OBJECT)
            withdrawn: list[dict[str, Any]] = []
            if organization["who_may_invite"] != params.who_may_invite:
                await store.update(
                    "organization",
                    {"id": organization_id},
                    {"who_may_invite": params.who_may_invite, "updated_at": changed_at},
                    changed_at,
                    account_id,
                    operation,
                )
            if params.who_may_invite == "administrators":
                await expire_due(box, store, organization_id, at, changed_at, operation)
                users = {u["id"]: u for u in await store.users_of_organization(organization_id)}
                for row in await store.invitations_of_organization(organization_id):
                    if row["status"] != "sent" or not by_ordinary_user(row, users):
                        continue
                    await store.update(
                        "invitation",
                        {"organization_id": organization_id, "id": row["id"]},
                        {
                            "status": "withdrawn",
                            "decided_at": changed_at,
                            "decided_by": user_id,
                            "by_setting": True,
                            "updated_at": changed_at,
                        },
                        changed_at,
                        account_id,
                        operation,
                    )
                    withdrawn.append(row)
            return withdrawn

        withdrawn = await store.in_transaction(work)
        for row in withdrawn:
            await box.info(
                Channel.business,
                "Invitation {%var.invitation_id} withdrawn by the setting",
                InvitationWithdrawnEvent(
                    organization_id=organization_id, invitation_id=str(row["id"]), user_id=user_id, by_setting=True
                ),
            )
        await box.info(
            Channel.business,
            "Who may invite in {%var.organization_id} is {%var.who_may_invite}",
            WhoMayInviteChangedEvent(
                organization_id=organization_id,
                who_may_invite=params.who_may_invite,
                by_user_id=user_id,
                withdrawn=len(withdrawn),
            ),
        )
        fresh = []
        for row in withdrawn:
            found_row = await store.invitation(str(row["id"]))
            if found_row is not None:
                fresh.append(invitation_schema(found_row, at))
        return WhoMayInviteResult(who_may_invite=params.who_may_invite, withdrawn=fresh)
