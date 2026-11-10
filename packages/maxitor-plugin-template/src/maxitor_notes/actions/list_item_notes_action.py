# packages/maxitor-plugin-template/src/maxitor_notes/actions/list_item_notes_action.py
"""
ListItemNotesAction — the notes of a catalog item at one moment, for the item's notes page; and, over a stretch, the
page's bars for the core's time scale.

::

    GET /p/notes/api/{organization}/items/{item_id}/notes?at=…&author=… ──► ListItemNotesAction
        ├─ organization_access_decide: the person is a member of {organization}
        └─ list_summary: the organization's id again; note_versions at the moment (the watermark without one)

    GET …/notes?from_at=…&to_at=…&bar=…&author=… ──► the same action, the same query and filter over the stretch:
        the versions it finds grouped into bars by maxitor_plugin_sdk.history.bars_of

The page declares this action as its ``read`` in navigation.yaml and names no bars of its own: its bars count
exactly what it shows.
"""

from __future__ import annotations

from typing import cast

from maxitor_plugin_sdk.history import bars_of
from maxitor_plugin_sdk.moments import MOMENT_PATTERN
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
from maxitor_notes.membership import member_organization_id, organization_access
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.notes_reader_role import NotesReaderRole
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage



class ListItemNotesParams(BaseParams):
    """Which item, at which moment, of which writer."""

    item_id: str = Field(min_length=1, max_length=64, description="The catalog item")
    at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The panel's moment; none means now, the watermark")
    author: str | None = Field(default=None, max_length=64, description="The author filter: one writer's id; none means every writer")
    from_at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The stretch's start, for the scale's bars")
    to_at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The stretch's end; cut to the watermark")
    bar: int | None = Field(default=None, ge=60, le=2592000, description="A bar's width in seconds")

    @model_validator(mode="after")
    def _one_question(self) -> ListItemNotesParams:
        """Either a moment or a whole stretch: from_at, to_at and bar come together, and never with at."""
        stretch = (self.from_at, self.to_at, self.bar)
        if any(value is not None for value in stretch) and (any(value is None for value in stretch) or self.at is not None):
            raise ValueError("from_at, to_at and bar come together, and never with at")
        if self.from_at is not None and self.to_at is not None and self.from_at >= self.to_at:
            raise ValueError("A stretch ends after it starts")
        return self


class ListItemNotesResult(BaseResult):
    """The item's notes at the moment."""

    notes: list[NoteCoreEntity] = Field(default_factory=list, description="The notes in the order they were last changed; none over a stretch")
    bars: list[BarCoreEntity] = Field(default_factory=list, description="Over a stretch: the bars with a change, in time order")


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

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: ListItemNotesParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Read the item's notes at the moment")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def list_summary(self, params: ListItemNotesParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> ListItemNotesResult:
        """The notes of the item at the moment, of one writer when the filter names one."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        if params.from_at is not None and params.to_at is not None and params.bar is not None:
            end, versions = await storage.note_versions_between(organization_id, params.item_id, params.from_at, params.to_at, params.author)
            bars = bars_of(versions, params.from_at, end, params.bar) if params.from_at < end else []
            return ListItemNotesResult(bars=[BarCoreEntity(start=bar.start, added=bar.added, changed=bar.changed, removed=bar.removed) for bar in bars])
        notes = await storage.notes_of_item(organization_id, params.item_id, params.at, params.author)
        return ListItemNotesResult(notes=notes)
