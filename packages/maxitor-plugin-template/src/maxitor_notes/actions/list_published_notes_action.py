# packages/maxitor-plugin-template/src/maxitor_notes/actions/list_published_notes_action.py
"""
ListPublishedNotesAction — the published notes of an item at one moment.

::

    GET /p/notes/api/{organization}/items/{item_id}/published?at=… ──► ListPublishedNotesAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ list_summary: the organization's id again; read at the moment (the watermark without one)
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

from maxitor_plugin_sdk import date_bounds
from maxitor_plugin_sdk.history import bars_of
from maxitor_plugin_sdk.moments import MOMENT_PATTERN
from maxitor_plugin_sdk.roles import MemberRole
from pydantic import Field, model_validator

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
from maxitor_notes.entities.bar_entity import BarCoreEntity
from maxitor_notes.entities.note_entity import NoteCoreEntity
from maxitor_notes.entities.revision_entity import RevisionCoreEntity
from maxitor_notes.membership import member_organization_id, organization_access
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class ListPublishedNotesParams(BaseParams):
    """Which item, at which moment."""

    item_id: str = Field(min_length=1, max_length=64, description="The item")
    at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The panel's moment; none means now, the watermark")
    written: str | None = Field(default=None, max_length=64, description="The filter Written: a range of days the note was first written in, as the shell writes it")
    changed: str | None = Field(default=None, max_length=64, description="The filter Last change: a range of days the note last changed in, as the shell writes it")
    from_at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The stretch's start, for the scale's bars")
    to_at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The stretch's end; cut to the watermark")
    width: int | None = Field(default=None, ge=1, le=2592000, description="A bar's width in seconds, from one second to thirty days")

    @model_validator(mode="after")
    def _one_question(self) -> ListPublishedNotesParams:
        """Either a moment or a whole stretch: from_at, to_at and width come together, and never with at."""
        stretch = (self.from_at, self.to_at, self.width)
        if any(value is not None for value in stretch) and (any(value is None for value in stretch) or self.at is not None):
            raise ValueError("from_at, to_at and width come together, and never with at")
        if self.from_at is not None and self.to_at is not None and self.from_at >= self.to_at:
            raise ValueError("A stretch ends after it starts")
        return self


class ListPublishedNotesResult(BaseResult):
    """The revision in force and its notes."""

    revision: RevisionCoreEntity | None = Field(default=None, description="The revision in force at the moment; none before the first")
    notes: list[NoteCoreEntity] = Field(default_factory=list, description="Its notes as they read when it was published; none over a stretch")
    bars: list[BarCoreEntity] = Field(default_factory=list, description="Over a stretch: the bars of the published notes' changes, in time order")


@meta(description="The published notes of an item at one moment", domain=NotesDomain)
@check_roles(MemberRole)
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
        if params.from_at is not None and params.to_at is not None and params.width is not None:
            # The core's time scale asks for bars: the published notes' versions over the stretch, by what they say.
            end, versions = await storage.note_versions_between(organization_id, params.item_id, params.from_at, params.to_at, None)
            bars = bars_of(versions, params.from_at, end, params.width) if params.from_at < end else []
            return ListPublishedNotesResult(bars=[BarCoreEntity(start=found.start, added=found.added, changed=found.changed, removed=found.removed) for found in bars])
        revision, found = await storage.published_notes(organization_id, params.item_id, params.at)
        # The filters of dates choose among the notes the page shows, as the shell's ranges read them (spec 079, FR-046).
        today = datetime.now(UTC).date()
        written, changed = date_bounds.parse(params.written, today), date_bounds.parse(params.changed, today)
        kept = [note for note in found if date_bounds.within(note.written, written) and date_bounds.within(note.updated_at, changed)]
        return ListPublishedNotesResult(revision=revision, notes=kept)
