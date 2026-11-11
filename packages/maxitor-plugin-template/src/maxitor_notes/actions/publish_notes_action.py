# packages/maxitor-plugin-template/src/maxitor_notes/actions/publish_notes_action.py
"""
PublishNotesAction — an editor publishes an item's notes as its next revision.

::

    POST /p/notes/api/{organization}/revisions {item_id, title, comment, release?} ──► PublishNotesAction
        ├─ item_access_decide: the person is a member of {organization}, and the item is an item of it now
        └─ publish_summary: the organization's id again; the next number under the lock, or nothing to publish (409)
"""

from __future__ import annotations

from typing import cast

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
from maxitor_notes.membership import item_access, member_organization_id
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class PublishNotesParams(BaseParams):
    """Which item, and what the revision says."""

    item_id: str = Field(min_length=1, max_length=64, description="The item whose notes are published")
    title: str = Field(min_length=1, max_length=200, description="The revision's first line")
    comment: str = Field(min_length=1, max_length=2000, description="The revision's own words, shown under the time scale")
    release: str | None = Field(default=None, min_length=1, max_length=80, description="A release label; none when the revision carries none")


class PublishNotesResult(BaseResult):
    """The revision written."""

    number: int = Field(ge=1, description="The revision's number for its item")
    changed_at: str = Field(description="The change time, ISO 8601 with microseconds: the revision's moment")


@meta(description="Publish an item's notes as its next numbered revision", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class PublishNotesAction(BaseAction[PublishNotesParams, PublishNotesResult]):
    """
    AI-CORE-BEGIN
    ROLE: Publish the item's notes as they are now under the next number.
    CONTRACT: Numbers are consecutive per item; with nothing changed since the last revision the answer is a refusal.
    INVARIANTS: A revision is written once and never changed.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address, and an item that is not one of it")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def item_access_decide(self, params: PublishNotesParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be the person's, and the item one of its items now."""
        _ = box
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await item_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id), params.item_id)

    @summary_aspect("Write the next revision and return its number and moment")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def publish_summary(self, params: PublishNotesParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> PublishNotesResult:
        """The organization's id again, then one transaction under the organization's lock."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        number, changed_at = await storage.publish_notes(
            organization_id=organization_id,
            item_id=params.item_id,
            title=params.title,
            comment=params.comment,
            release=params.release,
            publisher_id=str(ctx.get(Ctx.User.user_id)),
            operation=type(self).__name__,
        )
        return PublishNotesResult(number=number, changed_at=changed_at)
