# packages/maxitor-plugin-template/src/maxitor_notes/actions/list_item_notes_action.py
"""
ListItemNotesAction — the notes of a catalog item at one moment, for the item's notes page.

::

    GET /p/notes/api/{organization}/items/{item_id}/notes?at=…&author=… ──► ListItemNotesAction
        ├─ organization_aspect: the person is a member of {organization}
        └─ list_summary: note_versions at the moment (the watermark without one)
"""

from __future__ import annotations

from typing import Any, cast

from pydantic import Field

from aoa.action_machine.context.context_view import ContextView
from aoa.action_machine.context.ctx_constants import Ctx
from aoa.action_machine.intents.aspects import regular_aspect, summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.checkers import result_string
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.context_requires import context_requires
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox
from maxitor_notes.entities.note_entity import NoteCoreEntity
from maxitor_notes.membership import organization_id_or_refuse
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.notes_reader_role import NotesReaderRole
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage

#: A moment as the address carries it: ISO 8601 in UTC with microseconds.
MOMENT_PATTERN = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$"


class ListItemNotesParams(BaseParams):
    """Which item, at which moment, of which writer."""

    item_id: str = Field(min_length=1, max_length=64, description="The catalog item")
    at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The panel's moment; none means now, the watermark")
    author: str | None = Field(default=None, max_length=64, description="The author filter: one writer's id; none means every writer")


class ListItemNotesResult(BaseResult):
    """The item's notes at the moment."""

    notes: list[NoteCoreEntity] = Field(description="The notes in the order they were last changed")


@meta(description="List the notes of a catalog item at one moment", domain=NotesDomain)
@check_roles(NotesReaderRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class ListItemNotesAction(BaseAction[ListItemNotesParams, ListItemNotesResult]):
    """
    AI-CORE-BEGIN
    ROLE: Answer the item's notes page.
    CONTRACT: Reads only note_versions and the core's member versions, all at one moment.
    INVARIANTS: The answer for (organization, moment, parameters) never changes once the moment is not later than the watermark.
    AI-CORE-END
    """

    @result_string("organization_id", required=True, not_empty=True)
    @regular_aspect("Check that the person belongs to the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_aspect(self, params: ListItemNotesParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> dict[str, Any]:
        """Turn the organization's code into its id, refusing a person who is not a member."""
        _ = (params, state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return {"organization_id": await organization_id_or_refuse(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))}

    @summary_aspect("Read the item's notes at the moment")
    async def list_summary(self, params: ListItemNotesParams, state: BaseState, box: ToolsBox, connections: Connections) -> ListItemNotesResult:
        """The notes of the item at the moment, of one writer when the filter names one."""
        _ = box
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        notes = await storage.notes_of_item(str(state["organization_id"]), params.item_id, params.at, params.author)
        return ListItemNotesResult(notes=notes)
