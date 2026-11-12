# packages/maxitor-plugin-template/src/maxitor_notes/actions/edit_note_action.py
"""
EditNoteAction — a member changes a note in their own draft, over the published version they saw.

::

    PATCH /p/notes/api/{organization}/notes {item_id, note_id, body, base_body, base_revision} ──► EditNoteAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ edit_summary: the organization's id again; the draft's change written and its version, or a refusal: a note
           that never was (404)
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


class EditNoteParams(BaseParams):
    """Which note, its new text, and the published version the editor saw it in."""

    item_id: str = Field(min_length=1, max_length=64, description="The item the note is about")
    note_id: str = Field(min_length=1, max_length=64, description="The note")
    body: str = Field(min_length=1, max_length=10000, description="The new text of the note")
    base_body: str | None = Field(default=None, min_length=1, max_length=10000, description="The published text the editor saw; empty for a note that is new")
    base_revision: int | None = Field(default=None, ge=1, description="The revision in force the editor saw; empty before the first")


class EditNoteResult(BaseResult):
    """The change the edit made."""

    changed_at: str = Field(description="The change time, ISO 8601 with microseconds; the client rereads at it")


@meta(description="Change a note in the member's own draft, over the published version they saw", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class EditNoteAction(BaseAction[EditNoteParams, EditNoteResult]):
    """
    AI-CORE-BEGIN
    ROLE: Change one note in the editor's draft, keeping the published text it was made over.
    CONTRACT: The published note is never written; a change that leaves the note as published leaves the draft.
    INVARIANTS: One transaction, one change; the base of the first change of a note is kept by the later ones.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: EditNoteParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Write the draft's change and its version, and return the change time")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def edit_summary(self, params: EditNoteParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> EditNoteResult:
        """The organization's id again, then one transaction under the organization's lock."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        changed_at = await storage.edit_note(
            organization_id=organization_id,
            item_id=params.item_id,
            note_id=params.note_id,
            body=params.body,
            base_body=params.base_body,
            base_revision=params.base_revision,
            editor_id=str(ctx.get(Ctx.User.user_id)),
            operation=type(self).__name__,
        )
        return EditNoteResult(changed_at=changed_at)
