# packages/maxitor-plugin-template/src/maxitor_notes/actions/add_item_action.py
"""
AddItemAction — a member adds an item, what notes are written on.

::

    POST /p/notes/api/{organization}/items {title} ──► AddItemAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ add_summary: the organization's id again; the item and its version in one transaction, or a refusal:
           another item has the title now (409); the event "item added"
"""

from __future__ import annotations

from typing import cast

from maxitor_plugin_sdk.roles import MemberRole
from pydantic import Field, field_validator

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
from maxitor_notes.events import ItemAddedEvent
from maxitor_notes.membership import member_organization_id, organization_access
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class AddItemParams(BaseParams):
    """The new item's title."""

    title: str = Field(min_length=1, max_length=200, description="The item's title; the spaces at its ends are dropped")

    @field_validator("title", mode="before")
    @classmethod
    def _trimmed(cls, value: object) -> object:
        """A title without the spaces at its ends: "  Payments " is "Payments", and only spaces are empty."""
        return value.strip() if isinstance(value, str) else value


class AddItemResult(BaseResult):
    """The item written."""

    item_id: str = Field(description="The new item")
    changed_at: str = Field(description="The change time, ISO 8601 with microseconds; the client rereads at it")


@meta(description="Add an item, what notes are written on", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class AddItemAction(BaseAction[AddItemParams, AddItemResult]):
    """
    AI-CORE-BEGIN
    ROLE: Add one item to the organization of the address.
    CONTRACT: The title is unique among the organization's items now; the answer is the item's id and the change time.
    INVARIANTS: One transaction, one change; a refusal writes nothing and no event.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: AddItemParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Write the item and its version, and return its id and the change time")
    @emits(ItemAddedEvent)
    @context_requires(Ctx.User.user_id, "user.organization")
    async def add_summary(self, params: AddItemParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> AddItemResult:
        """The organization's id again, then one transaction under the organization's lock."""
        _ = state
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        item_id, changed_at = await storage.add_item(
            organization_id=organization_id,
            title=params.title,
            author_id=str(ctx.get(Ctx.User.user_id)),
            operation=type(self).__name__,
        )
        await box.info(Channel.business, "Item {%var.item_id} added: {%var.title}", ItemAddedEvent(item_id=item_id, title=params.title))
        return AddItemResult(item_id=item_id, changed_at=changed_at)
