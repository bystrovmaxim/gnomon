# packages/maxitor-plugin-template/src/maxitor_notes/actions/rollback_publication_action.py
"""
RollbackPublicationAction — a member brings back the notes of a past publication as the item's next revision.

::

    POST /p/notes/api/{organization}/revisions/rollback {item_id, to_revision, title, comment}
        ├─ item_access_decide: the person is a member of {organization}, and the item is an item of it now
        └─ rollback_summary: the organization's id again; the notes of v<to_revision> published as the next number with
           back set, under the lock; a revision that is not older than the one in force is refused (422)
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
from maxitor_notes.membership import item_access, member_organization_id
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class RollbackPublicationParams(BaseParams):
    """Which item, which publication to bring back, and what the new revision says."""

    item_id: str = Field(min_length=1, max_length=64, description="The item whose notes are rolled back")
    to_revision: int = Field(ge=1, description="The number of the past revision whose notes are published again")
    title: str = Field(min_length=1, max_length=200, description="The new revision's first line: Back to v<number>")
    comment: str = Field(min_length=1, max_length=2000, description="Why, shown under the time scale when the rollback is in force")


class RollbackPublicationResult(BaseResult):
    """The revision written."""

    number: int = Field(ge=2, description="The new revision's number")
    back: int = Field(ge=1, description="The revision it brought back")
    changed_at: str = Field(description="The change time, ISO 8601 with microseconds: the revision's moment")


@meta(description="Publish the notes of a past revision again as the item's next revision", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class RollbackPublicationAction(BaseAction[RollbackPublicationParams, RollbackPublicationResult]):
    """
    AI-CORE-BEGIN
    ROLE: Roll the published notes back to a past publication without losing anything.
    CONTRACT: The notes the past revision held become the published notes and the next revision is written with
        back_revision naming it; the revisions between stay in the history and on the scale; no draft is touched.
    INVARIANTS: A revision is written once and never changed; only a revision older than the one in force is brought back.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address, and an item that is not one of it")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def item_access_decide(self, params: RollbackPublicationParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be the person's, and the item one of its items now."""
        _ = box
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await item_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id), params.item_id)

    @summary_aspect("Publish the past revision's notes as the next revision and return its number")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def rollback_summary(self, params: RollbackPublicationParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> RollbackPublicationResult:
        """The organization's id again, then one transaction under the organization's lock."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        person_id = str(ctx.get(Ctx.User.user_id))
        number, changed_at = await storage.rollback_publication(
            organization_id=organization_id,
            item_id=params.item_id,
            to_revision=params.to_revision,
            title=params.title,
            comment=params.comment,
            publisher_id=person_id,
            operation=type(self).__name__,
        )
        return RollbackPublicationResult(number=number, back=params.to_revision, changed_at=changed_at)
