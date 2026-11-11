# packages/maxitor-plugin-template/src/maxitor_notes/history/note_milestone_card_action.py
"""
NoteMilestoneCardAction — the card of one milestone of an item's notes, as data the core's time scale draws; asked
on hover and when the milestone is chosen. navigation.yaml names this action ``note_milestone_card``.

::

    GET /p/notes/api/{organization}/history/note_milestone_card?item_id=…&id=v3&at=… ──► NoteMilestoneCardAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ card_summary: the organization's id again; the milestone's card at the moment, or not found (404)
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
from maxitor_notes.entities.milestone_card_entity import MilestoneCardCoreEntity
from maxitor_notes.membership import member_organization_id, organization_access
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class NoteMilestoneCardParams(BaseParams):
    """Which item, which milestone, at which moment."""

    item_id: str = Field(min_length=1, max_length=64, description="The item")
    id: str = Field(pattern=r"^(v[1-9][0-9]{0,8}|draft)$", description="v<number> for a revision, draft for the draft")
    at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The moment the card is read at; none means now")


class NoteMilestoneCardResult(BaseResult):
    """The milestone's card."""

    card: MilestoneCardCoreEntity = Field(description="Author, what it changed, the number of notes, its comment")


@meta(description="Answer one milestone's card of an item's notes, for the core's time scale", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class NoteMilestoneCardAction(BaseAction[NoteMilestoneCardParams, NoteMilestoneCardResult]):
    """
    AI-CORE-BEGIN
    ROLE: Answer the core's time scale with one milestone's card.
    CONTRACT: The shape of history-1.schema.json's card; the comment is the revision's own words.
    INVARIANTS: The card is data; the core draws it, and no control of the plugin runs in the core's frame.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: NoteMilestoneCardParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Read the milestone's card at the moment")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def card_summary(self, params: NoteMilestoneCardParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> NoteMilestoneCardResult:
        """The organization's id again, then the card."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        return NoteMilestoneCardResult(card=await storage.milestone_card(organization_id, params.item_id, params.id, params.at))
