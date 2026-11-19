# packages/maxitor/maxitor-core/maxitor/core/actions/users.py
"""
Settings → Users: ListUsersAction, BlockUserAction, UnblockUserAction, SetAdministratorAction.

::

    GET  /api/v1/organizations/{code}/users                      the users and the invitations
    POST /api/v1/organizations/users/block                       {code, user_id}
    POST /api/v1/organizations/users/unblock                     {code, user_id}
    POST /api/v1/organizations/users/administrator               {code, user_id, is_admin}

Only an active administrator of the organization gets through; anyone else is refused as for an organization that
does not exist. Every change goes by the user's lifecycle under the organization's lock, and the organization always
keeps at least one active administrator. A user is never removed; a blocked user is a stranger from their next
request on: the organization's addresses and the gateway read the user's state every time.
"""

from __future__ import annotations

from typing import Any

from maxitor.core.actions.common import now, storage
from maxitor.core.actions.invitations import OrganizationParams
from maxitor.core.actions.invitations_flow import (
    INVITATION_FLOW_EVENTS,
    InvitationSchema,
    expire_due,
    invitation_schema,
)
from maxitor.core.actions.organization_settings import administrator, administrator_verdict
from maxitor.core.actions.users_flow import USER_FLOW_EVENTS, UserSchema, keep_last_administrator, user_schema
from maxitor.core.domains import OrganizationDomain
from maxitor.core.errors import ConflictError
from maxitor.core.events import AdministratorChangedEvent, UserStateChangedEvent
from maxitor.core.roles import AccountRole
from maxitor.core.storage.core_storage import CORE_CONNECTION_KEY, CoreStorage
from pydantic import Field

from aoa.action_machine.context.context_view import ContextView
from aoa.action_machine.context.ctx_constants import Ctx
from aoa.action_machine.exceptions.access_denied import AccessDenied
from aoa.action_machine.intents.access_control import FORBIDDEN_OBJECT, Verdict
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


class UserParams(OrganizationParams):
    """One user of the organization."""

    user_id: str = Field(min_length=1, max_length=64, description="The user")


class AdministratorParams(UserParams):
    """The administrator mark to set."""

    is_admin: bool = Field(description="Whether the user administers the organization")


class UsersResult(BaseResult):
    """The organization's users and invitations."""

    users: list[UserSchema] = Field(description="Every user, by name")
    invitations: list[InvitationSchema] = Field(description="Every invitation, newest first")


class UserResult(BaseResult):
    """The user as they are now."""

    user: UserSchema = Field(description="The user")


class _AdministratorAction:
    """The access decision every action of this page shares."""

    @access_decide("Let through only an active administrator of the organization, alike for a code that does not exist")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(
        self, params: OrganizationParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """An active administrator of the account in the organization of the address."""
        _ = box
        return await administrator_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))


@meta(description="List the organization's users and invitations for its administrator", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class ListUsersAction(BaseAction[OrganizationParams, UsersResult]):
    """
    AI-CORE-BEGIN
    ROLE: Give Settings → Users its two tabs.
    CONTRACT: Only an active administrator; the invitations past their time are written expired first.
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

    @summary_aspect("Write the expiries due, then read the users and the invitations")
    @context_requires(Ctx.User.user_id)
    @emits(*INVITATION_FLOW_EVENTS)
    async def list_summary(
        self, params: OrganizationParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> UsersResult:
        """The organization as it is now."""
        _ = state
        store, at = storage(connections), now()
        found = await administrator(connections, params.code, str(ctx.get(Ctx.User.user_id)))
        organization_id, operation = found["id"], type(self).__name__

        async def work() -> None:
            changed_at = await store.organization_lock(organization_id)
            await expire_due(box, store, organization_id, at, changed_at, operation)

        await store.in_transaction(work)
        return UsersResult(
            users=[user_schema(row) for row in await store.users_of_organization(organization_id)],
            invitations=[invitation_schema(row, at) for row in await store.invitations_of_organization(organization_id)],
        )


async def change_user(
    self: BaseAction[Any, Any],
    box: ToolsBox,
    connections: Connections,
    ctx: ContextView,
    params: UserParams,
    *,
    from_state: str,
    to_state: str,
    refusal: str,
) -> UserResult:
    """One move of the lifecycle under the organization's lock, the last administrator kept."""
    store, account_id = storage(connections), str(ctx.get(Ctx.User.user_id))
    found = await administrator(connections, params.code, account_id)
    organization_id, by_user_id, operation = found["id"], found["user_id"], type(self).__name__

    async def work() -> None:
        changed_at = await store.organization_lock(organization_id)
        target = await store.user(organization_id, params.user_id)
        if target is None:
            raise AccessDenied(FORBIDDEN_OBJECT)
        if target["status"] != from_state:
            raise ConflictError(refusal, state=target["status"])
        await keep_last_administrator(box, store, organization_id, target, by_user_id)
        await store.update(
            '"user"',
            {"organization_id": organization_id, "id": params.user_id},
            {"status": to_state, "updated_at": changed_at},
            changed_at,
            account_id,
            operation,
        )

    await store.in_transaction(work)
    await box.info(
        Channel.business,
        "User {%var.user_id} of {%var.organization_id} is {%var.status}",
        UserStateChangedEvent(organization_id=organization_id, user_id=params.user_id, status=to_state, by_user_id=by_user_id),
    )
    row = await store.user(organization_id, params.user_id)
    assert row is not None
    return UserResult(user=user_schema(row))


@meta(description="Block a user: they cannot enter the organization until unblocked", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class BlockUserAction(_AdministratorAction, BaseAction[UserParams, UserResult]):
    """
    AI-CORE-BEGIN
    ROLE: Active → Blocked.
    CONTRACT: Only an active administrator; a user not active is refused (409 ``not_active``); the last active
        administrator is refused (409 ``last_administrator``).
    AI-CORE-END
    """

    @summary_aspect("Block the user under the organization's lock")
    @context_requires(Ctx.User.user_id)
    @emits(*USER_FLOW_EVENTS)
    async def block_summary(
        self, params: UserParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> UserResult:
        """One change of the user."""
        _ = state
        return await change_user(
            self, box, connections, ctx, params, from_state="active", to_state="blocked", refusal="not_active"
        )


@meta(description="Unblock a user", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class UnblockUserAction(_AdministratorAction, BaseAction[UserParams, UserResult]):
    """
    AI-CORE-BEGIN
    ROLE: Blocked → Active.
    CONTRACT: Only an active administrator; a user not blocked is refused (409 ``not_blocked``).
    AI-CORE-END
    """

    @summary_aspect("Unblock the user under the organization's lock")
    @context_requires(Ctx.User.user_id)
    @emits(*USER_FLOW_EVENTS)
    async def unblock_summary(
        self, params: UserParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> UserResult:
        """One change of the user."""
        _ = state
        return await change_user(
            self, box, connections, ctx, params, from_state="blocked", to_state="active", refusal="not_blocked"
        )


@meta(description="Appoint or dismiss an administrator", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class SetAdministratorAction(_AdministratorAction, BaseAction[AdministratorParams, UserResult]):
    """
    AI-CORE-BEGIN
    ROLE: The administrator mark.
    CONTRACT: Only an active administrator, on an active user (409 ``not_active`` otherwise); dismissing the last
        active administrator is refused (409 ``last_administrator``), also when two administrators step down at once.
    AI-CORE-END
    """

    @summary_aspect("Set the mark under the organization's lock")
    @context_requires(Ctx.User.user_id)
    @emits(*USER_FLOW_EVENTS)
    async def mark_summary(
        self, params: AdministratorParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> UserResult:
        """One change of the user."""
        _ = state
        store, account_id = storage(connections), str(ctx.get(Ctx.User.user_id))
        found = await administrator(connections, params.code, account_id)
        organization_id, by_user_id, operation = found["id"], found["user_id"], type(self).__name__

        async def work() -> None:
            changed_at = await store.organization_lock(organization_id)
            target = await store.user(organization_id, params.user_id)
            if target is None:
                raise AccessDenied(FORBIDDEN_OBJECT)
            if target["status"] != "active":
                raise ConflictError("not_active", state=target["status"])
            if bool(target["is_admin"]) == params.is_admin:
                return
            if not params.is_admin:
                await keep_last_administrator(box, store, organization_id, target, by_user_id)
            await store.update(
                '"user"',
                {"organization_id": organization_id, "id": params.user_id},
                {"is_admin": params.is_admin, "updated_at": changed_at},
                changed_at,
                account_id,
                operation,
            )

        await store.in_transaction(work)
        await box.info(
            Channel.business,
            "User {%var.user_id} of {%var.organization_id} administrator: {%var.is_admin}",
            AdministratorChangedEvent(
                organization_id=organization_id, user_id=params.user_id, is_admin=params.is_admin, by_user_id=by_user_id
            ),
        )
        row = await store.user(organization_id, params.user_id)
        assert row is not None
        return UserResult(user=user_schema(row))


class JobTitleParams(UserParams):
    """An organization-specific title, or null to clear it."""

    job_title: str | None = Field(default=None, max_length=160, description="Job title, independent of access permissions")


@meta(description="Change a user's job title in the organization", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class SetJobTitleAction(_AdministratorAction, BaseAction[JobTitleParams, UserResult]):
    @summary_aspect("Version the job title under the organization's lock")
    @context_requires(Ctx.User.user_id)
    async def title_summary(
        self, params: JobTitleParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> UserResult:
        store, account_id = storage(connections), str(ctx.get(Ctx.User.user_id))
        found = await administrator(connections, params.code, account_id)
        organization_id = found["id"]
        title = (params.job_title.strip() or None) if params.job_title else None

        async def work() -> None:
            changed_at = await store.organization_lock(organization_id)
            target = await store.user(organization_id, params.user_id)
            if target is None:
                raise AccessDenied(FORBIDDEN_OBJECT)
            if target.get("job_title") == title:
                return
            await store.update(
                '"user"', {"organization_id": organization_id, "id": params.user_id},
                {"job_title": title, "updated_at": changed_at}, changed_at, account_id, type(self).__name__,
            )

        await store.in_transaction(work)
        row = await store.user(organization_id, params.user_id)
        assert row is not None
        return UserResult(user=user_schema(row))
