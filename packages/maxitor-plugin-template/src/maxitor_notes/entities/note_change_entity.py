# packages/maxitor-plugin-template/src/maxitor_notes/entities/note_change_entity.py
"""NoteChangeCoreEntity — what happened to one note between the revision in force and a moment: the draft's line."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from aoa.action_machine.domain import BaseCoreEntity
from aoa.action_machine.intents.entity import entity
from maxitor_notes.notes_domain import NotesDomain


@entity(description="A note added, changed or removed since the revision in force", domain=NotesDomain)
class NoteChangeCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One line of the draft.
    CONTRACT: ``kind`` is added, changed or removed; ``body`` the text at the moment (the last text for a removed note);
    ``before`` the text in the revision; ``by_name`` and ``at`` who made the last change and when.
    AI-CORE-END
    """

    note_id: str = Field(min_length=1, description="The note")
    kind: Literal["added", "changed", "removed"] = Field(description="What happened to the note since the revision")
    body: str = Field(description="The text at the moment, or the last text of a removed note")
    before: str | None = Field(default=None, description="The text in the revision; none for an added note")
    by_name: str = Field(description="Who made the last change, as their name read then")
    at: str = Field(description="When the last change was made, ISO 8601 with microseconds")
