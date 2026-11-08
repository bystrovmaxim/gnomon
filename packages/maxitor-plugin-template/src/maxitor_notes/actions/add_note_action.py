# packages/maxitor-plugin-template/src/maxitor_notes/actions/add_note_action.py
"""
AddNoteAction — a member writes a note on a catalog item.

::

    POST /p/notes/api/{organization}/notes {item_id, body} ──► AddNoteAction
        ├─ organization_aspect: the person is a member of {organization}, which the context carries
        └─ write_summary: the note and its version in one transaction, the change time back
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
from maxitor_notes.membership import organization_id_or_refuse
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.notes_editor_role import NotesEditorRole
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class AddNoteParams(BaseParams):
    """Where the note goes and what it says."""

    item_id: str = Field(min_length=1, max_length=64, description="The catalog item the note is about")
    body: str = Field(min_length=1, max_length=10000, description="The text of the note")


class AddNoteResult(BaseResult):
    """The change the note made."""

    changed_at: str = Field(description="The change time, ISO 8601 with microseconds; the client rereads at it")


@meta(description="Write a note on a catalog item", domain=NotesDomain)
@check_roles(NotesEditorRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class AddNoteAction(BaseAction[AddNoteParams, AddNoteResult]):
    """
    AI-CORE-BEGIN
    ROLE: Write one note of a member on a catalog item.
    CONTRACT: The organization is the one of the address; the writer is the person of the token; the answer is the change time.
    INVARIANTS: One transaction, one change; nothing is written for a person outside the organization.
    AI-CORE-END
    """

    @result_string("organization_id", required=True, not_empty=True)
    @regular_aspect("Check that the person belongs to the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_aspect(self, params: AddNoteParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> dict[str, Any]:
        """Turn the organization's code into its id, refusing a person who is not a member."""
        _ = (params, state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return {"organization_id": await organization_id_or_refuse(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))}

    @summary_aspect("Write the note and its version, and return the change time")
    @context_requires(Ctx.User.user_id)
    async def write_summary(self, params: AddNoteParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> AddNoteResult:
        """One transaction: the organization's lock, the time, the row, its version."""
        _ = box
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        changed_at = await storage.add_note(
            organization_id=str(state["organization_id"]),
            item_id=params.item_id,
            writer_id=str(ctx.get(Ctx.User.user_id)),
            body=params.body,
            operation=type(self).__name__,
        )
        return AddNoteResult(changed_at=changed_at)
