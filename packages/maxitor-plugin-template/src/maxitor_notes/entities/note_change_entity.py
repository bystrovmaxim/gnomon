# packages/maxitor-plugin-template/src/maxitor_notes/entities/note_change_entity.py
"""NoteChangeCoreEntity — one note in one person's draft of an item's notes, and how it meets the published one."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from aoa.action_machine.domain import BaseCoreEntity
from aoa.action_machine.intents.entity import entity
from maxitor_notes.notes_domain import NotesDomain


@entity(description="A note added, changed or deleted in one person's draft", domain=NotesDomain)
class NoteChangeCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One card of the draft.
    CONTRACT: ``state`` is new, changed or deleted; ``body`` the text the change gives the note; ``base_body`` and
    ``base_revision`` the published version it was made over, empty for a new note; ``writer_name`` whose note it is;
    ``conflict`` and the ``published_*`` fields the other side, when the published note no longer reads as the base.
    INVARIANTS: A change is one person's; the draft is read by that person alone.
    AI-CORE-END
    """

    note_id: str = Field(min_length=1, description="The note")
    state: Literal["new", "changed", "deleted"] = Field(description="What the change does to the note")
    body: str = Field(description="The text the change gives the note")
    base_body: str | None = Field(default=None, description="The published text the change was made over; empty for a new note")
    base_revision: int | None = Field(default=None, description="The revision in force when the change was made; empty before the first")
    writer_id: str = Field(min_length=1, description="The note's writer")
    writer_name: str = Field(description="The writer's name as it read when the change was made")
    changed_at: str = Field(description="When the change was last made, ISO 8601 with microseconds")
    conflict: bool = Field(default=False, description="Whether the published note now reads otherwise than the base or is deleted")
    published_body: str | None = Field(default=None, description="The other side's text; empty when it deleted the note")
    published_by_name: str = Field(default="", description="Who changed or deleted the note since the base")
    published_at: str = Field(default="", description="When they changed or deleted it, ISO 8601 with microseconds")
