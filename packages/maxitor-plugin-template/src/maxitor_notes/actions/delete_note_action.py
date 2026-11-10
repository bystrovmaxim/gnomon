# packages/maxitor-plugin-template/src/maxitor_notes/actions/delete_note_action.py
"""
DeleteNoteAction — an editor deletes a note they saw at ``base_moment``.

::

    DELETE /p/notes/api/{organization}/notes/{note_id}?base_moment=… ──► DeleteNoteAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ delete_summary: the organization's id again; the current row deleted and its version closed, or a refusal
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
from maxitor_notes.membership import member_organization_id, organization_access
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.notes_editor_role import NotesEditorRole
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class DeleteNoteParams(BaseParams):
    """Which note, and the moment the editor saw it."""

    note_id: str = Field(min_length=1, max_length=64, description="The note")
    base_moment: str = Field(pattern=MOMENT_PATTERN, description="The start of the version the editor saw; a later version is a conflict")


class DeleteNoteResult(BaseResult):
    """The change the deletion made."""

    changed_at: str = Field(description="The change time, ISO 8601 with microseconds; the client rereads at it")


@meta(description="Delete a note, refusing when someone changed it after the editor saw it", domain=NotesDomain)
@check_roles(NotesEditorRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class DeleteNoteAction(BaseAction[DeleteNoteParams, DeleteNoteResult]):
    """
    AI-CORE-BEGIN
    ROLE: Delete one note from now on.
    CONTRACT: The last version closes with who deleted it and by which action; no new version opens.
    INVARIANTS: At every earlier moment the note is still there; a refusal writes nothing.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: DeleteNoteParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Delete the note's row and close its version, and return the change time")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def delete_summary(self, params: DeleteNoteParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> DeleteNoteResult:
        """The organization's id again, then one transaction under the organization's lock."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        changed_at = await storage.delete_note(
            organization_id=organization_id,
            note_id=params.note_id,
            base_moment=params.base_moment,
            editor_id=str(ctx.get(Ctx.User.user_id)),
            operation=type(self).__name__,
        )
        return DeleteNoteResult(changed_at=changed_at)
