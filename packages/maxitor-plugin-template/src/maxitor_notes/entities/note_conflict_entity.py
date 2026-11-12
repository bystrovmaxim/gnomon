# packages/maxitor-plugin-template/src/maxitor_notes/entities/note_conflict_entity.py
"""NoteConflictCoreEntity — one change that meets someone else's publication, as the publishing dialog shows it."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from aoa.action_machine.domain import BaseCoreEntity
from aoa.action_machine.intents.entity import entity
from maxitor_notes.notes_domain import NotesDomain


@entity(description="A change whose published note no longer reads as its base", domain=NotesDomain)
class NoteConflictCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One conflict of the publishing dialog: my value against the one I would overwrite.
    CONTRACT: ``body`` is mine; ``published_body`` theirs, empty when they deleted the note; ``published_by_name`` and
    ``published_at`` who changed or deleted it and when; ``base_body`` the text both were measured against.
    INVARIANTS: A conflict names one note; the choice is overwrite or give up for that note alone.
    AI-CORE-END
    """

    note_id: str = Field(min_length=1, description="The note")
    state: Literal["new", "changed", "deleted"] = Field(description="What the change does to the note")
    body: str = Field(description="The member's text, or the base text for a deletion")
    base_body: str | None = Field(default=None, description="The published text the change was made over")
    published_body: str | None = Field(default=None, description="The other side's text; empty when it deleted the note")
    published_by_name: str = Field(default="", description="Who changed or deleted the note since the base")
    published_at: str = Field(default="", description="When they changed or deleted it, ISO 8601 with microseconds")
