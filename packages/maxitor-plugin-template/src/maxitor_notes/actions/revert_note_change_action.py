# packages/maxitor-plugin-template/src/maxitor_notes/actions/revert_note_change_action.py
"""
RevertNoteChangeAction — a member gives one change of their own draft up.

::

    DELETE /p/notes/api/{organization}/draft/{note_id} ──► RevertNoteChangeAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ revert_summary: the organization's id again; the draft's change removed and its version closed
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


class RevertNoteChangeParams(BaseParams):
    """Which change of the member's draft."""

    note_id: str = Field(min_length=1, max_length=64, description="The note whose change is given up")


class RevertNoteChangeResult(BaseResult):
    """The change the revert made."""

    changed_at: str = Field(description="The change time, ISO 8601 with microseconds; the client rereads at it")


@meta(description="Give one change of the member's own draft up", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class RevertNoteChangeAction(BaseAction[RevertNoteChangeParams, RevertNoteChangeResult]):
    """
    AI-CORE-BEGIN
    ROLE: Give one change of the person's draft up.
    CONTRACT: A new note is removed; a changed or deleted note leaves the draft as it was published.
    INVARIANTS: The published notes are untouched; one transaction; only the person's own draft is read.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: RevertNoteChangeParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Remove the draft's change and close its version, and return the change time")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def revert_summary(self, params: RevertNoteChangeParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> RevertNoteChangeResult:
        """The organization's id again, then one transaction under the organization's lock."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        changed_at = await storage.revert_note_change(
            organization_id=organization_id,
            note_id=params.note_id,
            person_id=str(ctx.get(Ctx.User.user_id)),
            operation=type(self).__name__,
        )
        return RevertNoteChangeResult(changed_at=changed_at)
