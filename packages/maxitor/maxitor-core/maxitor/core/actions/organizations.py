# packages/maxitor/maxitor-core/maxitor/core/actions/organizations.py
"""
Organizations: CheckAddressCodeAction, RegisterOrganizationAction, OpenOrganizationAction, ReadWatermarkAction.

::

    GET  /api/v1/organizations/code-check?code=&name=   free | taken | not_allowed, with suggestions
    POST /api/v1/organizations                          the organization and its administrator in one change
    GET  /api/v1/organizations/{code}                   the organization, the user and its tree, or 404 alike for a
                                                        stranger and a made-up code
    GET  /api/v1/organizations/{code}/watermark         the organization's watermark: "now" for every page
"""

from __future__ import annotations

import uuid
from typing import Any, Literal, cast

from maxitor.core import address
from maxitor.core.actions.common import storage
from maxitor.core.domains import OrganizationDomain
from maxitor.core.errors import ConflictError, CoreRefusalError
from maxitor.core.events import AddressCodeLostRaceEvent, ForeignOrganizationRefusedEvent, OrganizationRegisteredEvent
from maxitor.core.plugins.organization_tree import organization_tree
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from maxitor.core.plugins.tree_builder import visible
from maxitor.core.roles import AccountRole
from maxitor.core.storage.core_storage import CORE_CONNECTION_KEY, CoreStorage, UniqueRowError
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
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.model.base_schema import BaseSchema
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox

#: How many organizations one account may register.
ORGANIZATIONS_PER_ACCOUNT = 10

#: How many free codes the page offers for a taken one.
SUGGESTIONS = 2


class CodeNotAllowedError(CoreRefusalError):
    """The code has characters a code may not have, the wrong length, or is reserved."""

    status = 422


async def free_suggestions(store: CoreStorage, name: str, asked: str) -> list[str]:
    """Two free codes made from ``name``, nearest first."""
    found: list[str] = []
    for candidate in address.candidates(name, asked):
        if not await store.code_taken(candidate):
            found.append(candidate)
            if len(found) == SUGGESTIONS:
                break
    return found


class CodeCheckParams(BaseParams):
    """The code typed and the name it may be made from."""

    code: str = Field(max_length=200, description="The address code as typed")
    name: str = Field(default="", max_length=200, description="The organization's name, to suggest codes from")


class CodeCheckResult(BaseResult):
    """Whether the code may be registered."""

    state: Literal["free", "taken", "not_allowed"] = Field(description="free, taken or not_allowed")
    bad_chars: list[str] = Field(default_factory=list, description="The characters a code may not have, each once")
    suggestions: list[str] = Field(
        default_factory=list, description="Two free codes made from the name, for a taken one"
    )


@meta(
    description="Say whether an address code is free, taken or not allowed, and suggest free ones",
    domain=OrganizationDomain,
)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class CheckAddressCodeAction(BaseAction[CodeCheckParams, CodeCheckResult]):
    """
    AI-CORE-BEGIN
    ROLE: Answer the registration form while the person types.
    CONTRACT: ``not_allowed`` names the characters a code may not have; ``taken`` offers two free codes made from
        the name; the answer is advice — registering checks again.
    AI-CORE-END
    """

    @summary_aspect("Check the shape, the reserved words and the database")
    async def check_summary(
        self, params: CodeCheckParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> CodeCheckResult:
        """Shape first, then the database."""
        _ = (state, box)
        if not address.allowed(params.code):
            return CodeCheckResult(state="not_allowed", bad_chars=address.bad_chars(params.code))
        store = storage(connections)
        if await store.code_taken(params.code):
            return CodeCheckResult(state="taken", suggestions=await free_suggestions(store, params.name, params.code))
        return CodeCheckResult(state="free")


class RegisterParams(BaseParams):
    """The registration form."""

    name: str = Field(min_length=1, max_length=200, description="The organization's name")
    code: str = Field(min_length=1, max_length=200, description="The address code")


class RegisteredResult(BaseResult):
    """The new organization's address code."""

    code: str = Field(description="The address code; the organization opens at /w/<code>")


@meta(
    description="Register an organization with the account as its first user and administrator",
    domain=OrganizationDomain,
)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class RegisterOrganizationAction(BaseAction[RegisterParams, RegisteredResult]):
    """
    AI-CORE-BEGIN
    ROLE: Create a tenant.
    CONTRACT: A code that is not allowed is refused (422); the eleventh organization of an account is refused
        (409 ``limit``); a code taken before or at the same moment is refused (409 ``taken``) with suggestions and
        nothing created; otherwise the organization and its administrator are created in one change.
    INVARIANTS: The database's unique rule on the code decides a race; the action never trusts its own check alone.
    AI-CORE-END
    """

    @summary_aspect("Check the code and the limit, then create the organization and its administrator")
    @context_requires(Ctx.User.user_id)
    @emits(AddressCodeLostRaceEvent, OrganizationRegisteredEvent)
    async def register_summary(
        self, params: RegisterParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> RegisteredResult:
        """One change: the organization, its user, both versions."""
        _ = state
        name, code = params.name.strip(), params.code
        if not address.allowed(code):
            raise CodeNotAllowedError("not_allowed", bad_chars=address.bad_chars(code))
        store, account_id = storage(connections), str(ctx.get(Ctx.User.user_id))
        account = await store.account(account_id)
        if account is None:
            raise AccessDenied(FORBIDDEN_OBJECT)
        if await store.organizations_created(account_id) >= ORGANIZATIONS_PER_ACCOUNT:
            raise ConflictError("limit", limit=ORGANIZATIONS_PER_ACCOUNT)
        if await store.code_taken(code):
            raise ConflictError("taken", suggestions=await free_suggestions(store, name, code))
        organization_id = str(uuid.uuid4())

        async def work() -> None:
            changed_at = await store.organization_lock(organization_id)
            await store.insert(
                "organization",
                {
                    "id": organization_id,
                    "name": name,
                    "code": code,
                    "created_by": account_id,
                    "created_at": changed_at,
                    "updated_at": None,
                },
                changed_at,
                account_id,
                type(self).__name__,
            )
            await store.insert(
                '"user"',
                {
                    "organization_id": organization_id,
                    "id": str(uuid.uuid4()),
                    "account_id": account_id,
                    "name": account["name"],
                    "is_admin": True,
                    "status": "active",
                    "created_at": changed_at,
                    "updated_at": None,
                },
                changed_at,
                account_id,
                type(self).__name__,
            )

        try:
            await store.in_transaction(work)
        except UniqueRowError as error:
            if error.constraint != "organization_code_unique":
                raise
            await box.warning(
                Channel.business,
                "Code {%var.code} taken a moment before {%var.account_id}",
                AddressCodeLostRaceEvent(code=code, account_id=account_id),
            )
            raise ConflictError("taken", moment=True, suggestions=await free_suggestions(store, name, code)) from None
        await box.info(
            Channel.business,
            "Organization {%var.code} registered by {%var.account_id}",
            OrganizationRegisteredEvent(organization_id=organization_id, code=code, account_id=account_id),
        )
        return RegisteredResult(code=code)


class OpenParams(BaseParams):
    """The organization's address code, from the address."""

    code: str = Field(min_length=1, max_length=200, description="The address code")


class OrganizationUserSchema(BaseSchema):
    """The account's user in the organization."""

    name: str = Field(description="The user's name")
    is_admin: bool = Field(description="Whether the user administers the organization")


class TreeNodeSchema(BaseSchema):
    """One node of the organization's tree as the frame draws it (specs/077-core-frame/data-model.md)."""

    name: str = Field(description="Its full name, <owner>:<id>")
    owner: str = Field(description="core or the plugin's name")
    parent: str = Field(description="root or the full name of the node it stands under")
    order: int = Field(description="Its order among its parent's children")
    title: str = Field(description="An ordinary node's title; empty for a list node")
    icon: str = Field(description="A name of the core's icon set; empty for none")
    page: str | None = Field(description="Its page's path template inside its owner; empty for a node that only groups")
    each: dict[str, str] | None = Field(description="A list node's source and key; empty for an ordinary node")
    scope: list[str] = Field(description="The parameters the list nodes above it define")
    controls: dict[str, Any] | None = Field(description="Its page's controls; empty for none")


class OpenedResult(BaseResult):
    """The organization the frame shows."""

    code: str = Field(description="The address code")
    name: str = Field(description="The organization's name")
    user: OrganizationUserSchema = Field(description="The account's user in it")
    tree: list[TreeNodeSchema] = Field(default_factory=list, description="The nodes of its tree the user may see")
    owners: list[str] = Field(default_factory=list, description="Its enabled plugins in dependency order")
    dependencies: dict[str, list[str]] = Field(
        default_factory=dict, description="Each enabled plugin's direct dependencies: the plugins a page of it may open"
    )


@meta(description="Open an organization the account has an active user in", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins: the enabled plugins' nodes")
class OpenOrganizationAction(BaseAction[OpenParams, OpenedResult]):
    """
    AI-CORE-BEGIN
    ROLE: Give the frame its organization.
    CONTRACT: The access decision refuses an account with no active user in the organization exactly as it
        refuses a code that does not exist; the server answers both 404 "No such organization".
    AI-CORE-END
    """

    @access_decide("Refuse an account with no active user in the organization, alike for a code that does not exist")
    @context_requires(Ctx.User.user_id)
    @emits(ForeignOrganizationRefusedEvent)
    async def membership_access_decide(
        self, params: OpenParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """An active user of the account in the organization of the address, or a refusal that says nothing more."""
        account_id = str(ctx.get(Ctx.User.user_id))
        if await storage(connections).organization_for(params.code, account_id) is not None:
            return Allowed()
        await box.warning(
            Channel.security,
            "Organization {%var.code} refused to {%var.account_id}",
            ForeignOrganizationRefusedEvent(code=params.code, account_id=account_id),
        )
        return FORBIDDEN_OBJECT

    @summary_aspect("Read the organization and the account's user in it")
    @context_requires(Ctx.User.user_id)
    async def open_summary(
        self, params: OpenParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> OpenedResult:
        """The membership may end between the decision and this step; then it refuses alike."""
        _ = (state, box)
        found = await storage(connections).organization_for(params.code, str(ctx.get(Ctx.User.user_id)))
        if found is None:
            raise AccessDenied(FORBIDDEN_OBJECT)
        store = cast(PluginsStorage, connections[PLUGINS_CONNECTION_KEY])
        nodes, files = await organization_tree(store, found["id"])
        roles = frozenset({"member", "administrator"} if found["is_admin"] else {"member"})
        return OpenedResult(
            code=found["code"],
            name=found["name"],
            user=OrganizationUserSchema(name=found["user_name"], is_admin=found["is_admin"]),
            tree=[
                TreeNodeSchema(
                    name=node.full_name,
                    owner=node.owner,
                    parent=node.parent,
                    order=node.order,
                    title=node.title or "",
                    icon=node.icon or "",
                    page=node.page,
                    each=None if node.each_source is None else {"source": node.each_source, "key": str(node.each_key)},
                    scope=list(node.scope),
                    controls=None if node.controls is None else dict(node.controls),
                )
                for node in visible(nodes, roles)
            ],
            owners=[file.owner for file in files],
            dependencies={file.owner: sorted(file.dependencies) for file in files},
        )


class WatermarkResult(BaseResult):
    """The organization's "now"."""

    at: str | None = Field(description="Its watermark to the microsecond, in UTC; empty when it never changed")


@meta(description="Read an organization's watermark, the latest moment whose answer no longer changes", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class ReadWatermarkAction(BaseAction[OpenParams, WatermarkResult]):
    """
    AI-CORE-BEGIN
    ROLE: Tell the frame when "now" moved, so a page without a moment reads again (spec 077, FR-020).
    CONTRACT: Refuses a stranger exactly as OpenOrganizationAction does.
    AI-CORE-END
    """

    @access_decide("Refuse an account with no active user in the organization, alike for a code that does not exist")
    @context_requires(Ctx.User.user_id)
    async def membership_access_decide(
        self, params: OpenParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """An active user of the account in the organization of the address."""
        _ = box
        found = await storage(connections).organization_for(params.code, str(ctx.get(Ctx.User.user_id)))
        return Allowed() if found is not None else FORBIDDEN_OBJECT

    @summary_aspect("Read the organization's watermark")
    @context_requires(Ctx.User.user_id)
    async def watermark_summary(
        self, params: OpenParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> WatermarkResult:
        """The membership may end between the decision and this step; then it refuses alike."""
        _ = (state, box)
        found = await storage(connections).organization_for(params.code, str(ctx.get(Ctx.User.user_id)))
        if found is None:
            raise AccessDenied(FORBIDDEN_OBJECT)
        return WatermarkResult(at=await storage(connections).watermark(found["id"]))
