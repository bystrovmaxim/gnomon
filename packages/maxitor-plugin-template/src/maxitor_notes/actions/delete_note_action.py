# packages/maxitor-plugin-template/src/maxitor_notes/actions/delete_note_action.py
"""
DeleteNoteAction — a member deletes a note in their own draft, over the published version they saw.

::

    DELETE /p/notes/api/{organization}/notes/{note_id}?item_id=…&base_body=…&base_revision=… ──► DeleteNoteAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ delete_summary: the organization's id again; the draft's change written and its version, or nothing when the
           note is already gone
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
from maxitor_notes.membership import member_organization_id, organization_access
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class DeleteNoteParams(BaseParams):
    """Which note, and the published version the editor saw it in."""

    item_id: str = Field(min_length=1, max_length=64, description="The item the note is about")
    note_id: str = Field(min_length=1, max_length=64, description="The note")
    base_body: str | None = Field(default=None, max_length=10000, description="The published text the editor saw")
    base_revision: int | None = Field(default=None, ge=1, description="The revision in force the editor saw; empty before the first")


class DeleteNoteResult(BaseResult):
    """The change the deletion made."""

    changed_at: str = Field(description="The change time, ISO 8601 with microseconds; the client rereads at it")


@meta(description="Delete a note in the member's own draft, over the published version they saw", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class DeleteNoteAction(BaseAction[DeleteNoteParams, DeleteNoteResult]):
    """
    AI-CORE-BEGIN
    ROLE: Put a deletion in the editor's draft.
    CONTRACT: The published note is untouched; a new note is removed from the draft rather than marked deleted.
    INVARIANTS: One transaction; for everyone else the note stays as it is published.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: DeleteNoteParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Write the draft's deletion and its version, and return the change time")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def delete_summary(self, params: DeleteNoteParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> DeleteNoteResult:
        """The organization's id again, then one transaction under the organization's lock."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        changed_at = await storage.delete_note(
            organization_id=organization_id,
            item_id=params.item_id,
            note_id=params.note_id,
            base_body=params.base_body,
            base_revision=params.base_revision,
            editor_id=str(ctx.get(Ctx.User.user_id)),
            operation=type(self).__name__,
        )
        return DeleteNoteResult(changed_at=changed_at)
