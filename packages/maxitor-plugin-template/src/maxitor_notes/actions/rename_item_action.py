# packages/maxitor-plugin-template/src/maxitor_notes/actions/rename_item_action.py
"""
RenameItemAction — a member gives an item they saw at ``base_moment`` a new title.

::

    PATCH /p/notes/api/{organization}/items {item_id, title, base_moment} ──► RenameItemAction
        ├─ item_access_decide: the person is a member of {organization}, and the item is an item of it now
        └─ rename_summary: the organization's id again; the item's open version closed and a new one opened, or a
           refusal: changed by someone else after base_moment (409), the title another item's (409), base_moment not
           come (422); the event "item renamed" when the title changed
"""

from __future__ import annotations

from typing import cast

from maxitor_plugin_sdk.moments import MOMENT_PATTERN
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
from maxitor_notes.events import ItemRenamedEvent
from maxitor_notes.membership import item_access, member_organization_id
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class RenameItemParams(BaseParams):
    """Which item, its new title, and the moment the member saw it."""

    item_id: str = Field(min_length=1, max_length=64, description="The item")
    title: str = Field(min_length=1, max_length=200, description="The item's new title; the spaces at its ends are dropped")
    base_moment: str = Field(pattern=MOMENT_PATTERN, description="The moment the member saw the item; a later change is a conflict")

    @field_validator("title", mode="before")
    @classmethod
    def _trimmed(cls, value: object) -> object:
        """A title without the spaces at its ends, as an added item's."""
        return value.strip() if isinstance(value, str) else value


class RenameItemResult(BaseResult):
    """The change the rename made."""

    changed_at: str = Field(description="The change time, ISO 8601 with microseconds; the open version's start when nothing changed")


@meta(description="Give an item a new title, refusing when someone changed it after the member saw it", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class RenameItemAction(BaseAction[RenameItemParams, RenameItemResult]):
    """
    AI-CORE-BEGIN
    ROLE: Rename one item without overwriting someone else's change.
    CONTRACT: ``base_moment`` is the moment the member saw; a later change is a conflict naming who and when.
    INVARIANTS: One transaction, one change; the title it has writes nothing and no event; the old title stays readable at every earlier moment.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address, and an item that is not one of it")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def item_access_decide(self, params: RenameItemParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be the person's, and the item one of its items now."""
        _ = box
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await item_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id), params.item_id)

    @summary_aspect("Close the item's open version and open the new one, and return the change time")
    @emits(ItemRenamedEvent)
    @context_requires(Ctx.User.user_id, "user.organization")
    async def rename_summary(self, params: RenameItemParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> RenameItemResult:
        """The organization's id again, then one transaction under the organization's lock."""
        _ = state
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        old_title, changed_at, changed = await storage.rename_item(
            organization_id=organization_id,
            item_id=params.item_id,
            title=params.title,
            base_moment=params.base_moment,
            editor_id=str(ctx.get(Ctx.User.user_id)),
            operation=type(self).__name__,
        )
        if changed:
            await box.info(
                Channel.business,
                "Item {%var.item_id} renamed from {%var.old_title} to {%var.new_title}",
                ItemRenamedEvent(item_id=params.item_id, old_title=old_title, new_title=params.title),
            )
        return RenameItemResult(changed_at=changed_at)
