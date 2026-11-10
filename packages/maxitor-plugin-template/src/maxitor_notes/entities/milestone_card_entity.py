# packages/maxitor-plugin-template/src/maxitor_notes/entities/milestone_card_entity.py
"""MilestoneCardCoreEntity — what the time scale shows about one milestone, as data the core draws."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from aoa.action_machine.domain import BaseCoreEntity
from aoa.action_machine.intents.entity import entity
from maxitor_notes.notes_domain import NotesDomain


@entity(description="The card of a milestone of the time scale", domain=NotesDomain)
class MilestoneCardCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One card note_milestone_card answers.
    CONTRACT: The shape of history-1.schema.json's card: the milestone's fields, its author, what it changed against
    the revision before it, the number of its notes, and its comment shown under the scale.
    AI-CORE-END
    """

    id: str = Field(min_length=1, description="v<number> for a revision, draft for the draft")
    at: str = Field(description="When it was published, or the watermark for the draft")
    kind: Literal["revision", "proposal"] = Field(description="The look of its point")
    ref: str = Field(min_length=1, description="Its short reference")
    title: str = Field(min_length=1, description="Its first line")
    minor: bool = Field(description="A revision that added and removed no note")
    release: str | None = Field(default=None, description="The release label it carries")
    link: str | None = Field(default=None, description="Where choosing it leads")
    author_id: str | None = Field(default=None, description="Who published it; none for the draft")
    author_name: str | None = Field(default=None, description="Their name as it read then")
    summary: dict[str, int] = Field(description="Notes added, changed and removed against the revision before")
    chips: list[str] = Field(description="Short counts: the number of its notes")
    comment: str = Field(description="Its own words, shown under the scale when it is chosen")
