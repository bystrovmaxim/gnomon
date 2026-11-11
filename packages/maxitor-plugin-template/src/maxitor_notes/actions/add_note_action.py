# packages/maxitor-plugin-template/src/maxitor_notes/actions/add_note_action.py
"""
AddNoteAction — a member writes a note on a catalog item.

::

    POST /p/notes/api/{organization}/notes {item_id, body} ──► AddNoteAction
        ├─ organization_access_decide: the person is a member of {organization}, which the context carries
        └─ write_summary: the organization's id again; the note and its version in one transaction, the change time back
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


class AddNoteParams(BaseParams):
    """Where the note goes and what it says."""

    item_id: str = Field(min_length=1, max_length=64, description="The catalog item the note is about")
    body: str = Field(min_length=1, max_length=10000, description="The text of the note")


class AddNoteResult(BaseResult):
    """The change the note made."""

    changed_at: str = Field(description="The change time, ISO 8601 with microseconds; the client rereads at it")


@meta(description="Write a note on a catalog item", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class AddNoteAction(BaseAction[AddNoteParams, AddNoteResult]):
    """
    AI-CORE-BEGIN
    ROLE: Write one note of a member on a catalog item.
    CONTRACT: The organization is the one of the address; the writer is the person of the token; the answer is the change time.
    INVARIANTS: One transaction, one change; nothing is written for a person outside the organization.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: AddNoteParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Write the note and its version, and return the change time")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def write_summary(self, params: AddNoteParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> AddNoteResult:
        """The organization's id again, then one transaction: the organization's lock, the time, the row, its version."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        changed_at = await storage.add_note(
            organization_id=organization_id,
            item_id=params.item_id,
            writer_id=str(ctx.get(Ctx.User.user_id)),
            body=params.body,
            operation=type(self).__name__,
        )
        return AddNoteResult(changed_at=changed_at)
