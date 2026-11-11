# packages/maxitor-plugin-template/src/maxitor_notes/history/list_note_history_action.py
"""
ListNoteHistoryAction — the milestones of an item's notes in a stretch: its published revisions, and the draft as a
proposal. The core's time scale draws them as points; navigation.yaml names this action ``list_note_history``.

::

    GET /p/notes/api/{organization}/history/list_note_history?item_id=…&from_at=…&to_at=… ──► ListNoteHistoryAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ list_summary: the organization's id again; the revisions published in the stretch, the draft last
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
from maxitor_notes.entities.milestone_entity import MilestoneCoreEntity
from maxitor_notes.membership import member_organization_id, organization_access
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class ListNoteHistoryParams(BaseParams):
    """Which item, over which stretch."""

    item_id: str = Field(min_length=1, max_length=64, description="The item")
    from_at: str = Field(pattern=MOMENT_PATTERN, description="The stretch's start")
    to_at: str = Field(pattern=MOMENT_PATTERN, description="The stretch's end; cut to the watermark")


class ListNoteHistoryResult(BaseResult):
    """The milestones of the stretch."""

    milestones: list[MilestoneCoreEntity] = Field(description="The revisions in time order, the draft last")


@meta(description="List the milestones of an item's notes in a stretch, for the core's time scale", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class ListNoteHistoryAction(BaseAction[ListNoteHistoryParams, ListNoteHistoryResult]):
    """
    AI-CORE-BEGIN
    ROLE: Answer the core's time scale with the item's milestones.
    CONTRACT: The shape of history-1.schema.json's milestones; a revision that added and removed no note is minor.
    INVARIANTS: Revisions are not filtered by author: a page's author filter narrows its notes and bars, not its milestones.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: ListNoteHistoryParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Read the milestones of the stretch")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def list_summary(self, params: ListNoteHistoryParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> ListNoteHistoryResult:
        """The organization's id again, then the milestones."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        return ListNoteHistoryResult(milestones=await storage.milestones(organization_id, params.item_id, params.from_at, params.to_at))
