# packages/maxitor-plugin-template/src/maxitor_notes/actions/list_note_draft_action.py
"""
ListNoteDraftAction — the draft of an item's notes at one moment.

::

    GET /p/notes/api/{organization}/items/{item_id}/draft?at=… ──► ListNoteDraftAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ list_summary: the organization's id again; read at the moment (the watermark without one)
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
from maxitor_notes.entities.note_change_entity import NoteChangeCoreEntity
from maxitor_notes.entities.revision_entity import RevisionCoreEntity
from maxitor_notes.membership import member_organization_id, organization_access
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class ListNoteDraftParams(BaseParams):
    """Which item, at which moment."""

    item_id: str = Field(min_length=1, max_length=64, description="The item")
    at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The panel's moment; none means now, the watermark")


class ListNoteDraftResult(BaseResult):
    """The revision in force, and the person's changes."""

    revision: RevisionCoreEntity | None = Field(description="The revision the draft counts from; none before the first")
    changes: list[NoteChangeCoreEntity] = Field(description="Every note added, changed or removed since it, in time order")


@meta(description="The draft of an item's notes at one moment", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class ListNoteDraftAction(BaseAction[ListNoteDraftParams, ListNoteDraftResult]):
    """
    AI-CORE-BEGIN
    ROLE: Answer the item's draft page.
    CONTRACT: Every note added, changed or removed between the revision in force and the moment, with who and when.
    INVARIANTS: The answer for (organization, moment, parameters) never changes once the moment is not later than the watermark.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: ListNoteDraftParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Read at the moment")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def list_summary(self, params: ListNoteDraftParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> ListNoteDraftResult:
        """The organization's id again, then the read at the moment."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        revision, found = await storage.draft(organization_id, params.item_id, str(ctx.get(Ctx.User.user_id)), params.at)
        return ListNoteDraftResult(revision=revision, changes=found)
