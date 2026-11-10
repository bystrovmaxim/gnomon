# packages/maxitor-plugin-template/src/maxitor_notes/actions/list_note_authors_action.py
"""
ListNoteAuthorsAction — the options of the author filter Maxitor draws over an item's notes page.

It keeps the contract of a list Maxitor calls for a tree's list node or a control's ``source``:
the scope's parameters, ``at``, ``limit`` and ``after`` in; ``entries`` of ``key`` and ``title`` and ``next`` out.

::

    GET /p/notes/api/{organization}/lists/list_note_authors?item_id=…&at=…&limit=…&after=…
        ├─ organization_access_decide: the person is a member of {organization}
        └─ list_summary: the organization's id again; the writers of the item's notes at the moment, a page of them
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
from aoa.action_machine.model.base_schema import BaseSchema
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox
from maxitor_notes.membership import member_organization_id, organization_access
from maxitor_notes.notes_domain import NotesDomain
from maxitor_notes.notes_reader_role import NotesReaderRole
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


class ListNoteAuthorsParams(BaseParams):
    """The list's input: the scope's parameters, the moment and a page."""

    item_id: str = Field(min_length=1, max_length=64, description="The catalog item, a parameter of the page's scope")
    at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The panel's moment; none means now, the watermark")
    limit: int = Field(default=50, ge=1, le=200, description="How many options one page holds")
    after: str | None = Field(default=None, max_length=64, description="The key the previous page ended with")


class ListEntry(BaseSchema):
    """One option of a list."""

    key: str = Field(description="The option's value, written into the address")
    title: str = Field(description="The option's label, plain text")


class ListNoteAuthorsResult(BaseResult):
    """A page of options."""

    entries: list[ListEntry] = Field(description="The options of this page, ordered by key")
    next: str | None = Field(default=None, description="The key to ask the next page after; none on the last page")


@meta(description="List the writers of a catalog item's notes for the page's author filter", domain=NotesDomain)
@check_roles(NotesReaderRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class ListNoteAuthorsAction(BaseAction[ListNoteAuthorsParams, ListNoteAuthorsResult]):
    """
    AI-CORE-BEGIN
    ROLE: Give the options of the author filter of an item's notes page.
    CONTRACT: Maxitor's list contract; read at the panel's moment.
    INVARIANTS: ``next`` is set only when a full page came back.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: ListNoteAuthorsParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Read a page of the item's writers at the moment")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def list_summary(self, params: ListNoteAuthorsParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> ListNoteAuthorsResult:
        """One page of writers, and where the next one starts."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        authors = await storage.note_authors(organization_id, params.item_id, params.at, params.limit, params.after)
        entries = [ListEntry(key=author.id, title=author.name or author.id) for author in authors]
        return ListNoteAuthorsResult(entries=entries, next=entries[-1].key if len(entries) == params.limit else None)
