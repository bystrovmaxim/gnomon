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
    CONTRACT: What a publication's card says: the milestone's fields, who published it, what it changed against the
    revision before it, the number of its notes, its release and its comment; note_milestone_card turns it into the
    blocks of history-2.schema.json.
    AI-CORE-END
    """

    id: str = Field(min_length=1, description="v<number>")
    at: str = Field(description="When it was published")
    kind: Literal["published", "rollback"] = Field(description="Its kind: a publication, or a rollback to an earlier one")
    ref: str = Field(min_length=1, description="Its short reference")
    title: str = Field(min_length=1, description="Its first line")
    release: str | None = Field(default=None, description="The release label it carries")
    author_id: str | None = Field(default=None, description="Who published it")
    author_name: str | None = Field(default=None, description="Their name as it read then")
    summary: dict[str, int] = Field(description="Notes added, changed and removed against the revision before")
    notes: int = Field(ge=0, description="How many notes it holds")
    comment: str = Field(description="Its own words, shown under the scale when it is in force")
