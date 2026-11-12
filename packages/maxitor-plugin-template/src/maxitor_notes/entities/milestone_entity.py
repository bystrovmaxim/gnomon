# packages/maxitor-plugin-template/src/maxitor_notes/entities/milestone_entity.py
"""MilestoneCoreEntity — a point of the core's time scale: a publication of an item's notes."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from aoa.action_machine.domain import BaseCoreEntity
from aoa.action_machine.intents.entity import entity
from maxitor_notes.notes_domain import NotesDomain


@entity(description="A publication of an item's notes, as a point of the time scale", domain=NotesDomain)
class MilestoneCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One milestone list_note_history answers.
    CONTRACT: The shape of history-2.schema.json's milestone: ``kind`` one of the kinds Published declares —
    published, or rollback for a publication that brought back an earlier one —; one size, no flag.
    AI-CORE-END
    """

    id: str = Field(min_length=1, description="v<number>")
    at: str = Field(description="When it was published")
    ref: str = Field(min_length=1, description="Its short reference, v<number>")
    title: str = Field(min_length=1, description="Its first line")
    kind: Literal["published", "rollback"] = Field(description="Its kind: a publication, or a rollback to an earlier one")
    comment: str | None = Field(default=None, description="Its own words, shown under the scale while it is in force")
