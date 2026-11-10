# packages/maxitor-plugin-template/src/maxitor_notes/actions/list_published_notes_action.py
"""
ListPublishedNotesAction — the published notes of a catalog item at one moment.

::

    GET /p/notes/api/{organization}/items/{item_id}/published?at=… ──► ListPublishedNotesAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ list_summary: the organization's id again; read at the moment (the watermark without one)
"""

from __future__ import annotations

from typing import cast

from maxitor_plugin_sdk.moments import MOMENT_PATTERN
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
from maxitor_notes.entities.note_entity import NoteCoreEntity
from maxitor_notes.entities.revision_entity import RevisionCoreEntity
from maxitor_notes.membership import member_organization_id, organization_access
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.notes_reader_role import NotesReaderRole
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage




class ListPublishedNotesParams(BaseParams):
    """Which item, at which moment."""

    item_id: str = Field(min_length=1, max_length=64, description="The catalog item")
    at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The panel's moment; none means now, the watermark")


class ListPublishedNotesResult(BaseResult):
    """The revision in force and its notes."""

    revision: RevisionCoreEntity | None = Field(description="The revision in force at the moment; none before the first")
    notes: list[NoteCoreEntity] = Field(description="Its notes as they read when it was published")


@meta(description="The published notes of a catalog item at one moment", domain=NotesDomain)
@check_roles(NotesReaderRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class ListPublishedNotesAction(BaseAction[ListPublishedNotesParams, ListPublishedNotesResult]):
    """
    AI-CORE-BEGIN
    ROLE: Answer the item's published page.
    CONTRACT: Between two revisions the answer is the earlier one's, whatever is edited in between.
    INVARIANTS: The answer for (organization, moment, parameters) never changes once the moment is not later than the watermark.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: ListPublishedNotesParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Read at the moment")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def list_summary(self, params: ListPublishedNotesParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> ListPublishedNotesResult:
        """The organization's id again, then the read at the moment."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        revision, found = await storage.published_notes(organization_id, params.item_id, params.at)
        return ListPublishedNotesResult(revision=revision, notes=found)
