# packages/maxitor-plugin-template/src/maxitor_notes/actions/list_items_action.py
"""
ListItemsAction — the organization's items, the source of the list node ``item`` in Maxitor's tree.

It keeps the contract of a list Maxitor calls for a tree's list node or a control's ``source``:
the scope's parameters (none: the node stands under the plugin's root), ``at``, ``limit`` and ``after`` in;
``entries`` of ``key``, ``title`` and ``icon`` and ``next`` out.

::

    GET /p/notes/api/{organization}/lists/list_items?at=…&limit=…&after=… ──► ListItemsAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ list_summary: the organization's id again; item_versions at the moment, by title, a part of them
"""

from __future__ import annotations

from typing import cast

from maxitor_plugin_sdk.moments import MOMENT_PATTERN
from maxitor_plugin_sdk.roles import MemberRole
from pydantic import Field

from aoa.action_machine.context.context_view import ContextView
from aoa.action_machine.context.ctx_constants import Ctx
from aoa.action_machine.intents.access_control import Verdict
from aoa.action_machine.intents.access_decide import access_decide
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.context_requires import context_requires
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox
from maxitor_notes.entities.item_entry_entity import ItemEntryCoreEntity
from maxitor_notes.membership import member_organization_id, organization_access
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage

#: A uuid, as the key of an entry is; ``after`` is the key of the last entry of the part before.
UUID_PATTERN = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"


class ListItemsParams(BaseParams):
    """Which moment, and which part of the list."""

    at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The panel's moment; none means now, the watermark")
    limit: int = Field(default=50, ge=1, le=200, description="How many entries one part holds")
    after: str | None = Field(default=None, pattern=UUID_PATTERN, description="The key of the last entry of the part before")


class ListItemsResult(BaseResult):
    """One part of the list."""

    entries: list[ItemEntryCoreEntity] = Field(default_factory=list, description="The items of the part, by title")
    next: str | None = Field(default=None, description="The ``after`` of the next part; none when this part is the last")


@meta(description="List the organization's items at one moment, the source of the tree's list of items", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class ListItemsAction(BaseAction[ListItemsParams, ListItemsResult]):
    """
    AI-CORE-BEGIN
    ROLE: Answer the list node ``item``: one entry per item of the organization at the panel's moment.
    CONTRACT: Reads only item_versions at one moment; every item comes once across the parts.
    INVARIANTS: The answer for (organization, moment, parameters) never changes once the moment is not later than the watermark.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: ListItemsParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Read the organization's items at the moment, a part of them")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def list_summary(self, params: ListItemsParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> ListItemsResult:
        """One more entry than the part holds tells whether a next part exists."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        found = await storage.items_at(organization_id, params.at, params.limit + 1, params.after)
        entries = found[: params.limit]
        return ListItemsResult(entries=entries, next=entries[-1].key if len(found) > params.limit else None)
