# packages/maxitor-plugin-template/src/maxitor_notes/entities/revision_entity.py
"""RevisionCoreEntity — an item's notes published under a number, as it read at one moment."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.domain import BaseCoreEntity
from aoa.action_machine.intents.entity import entity
from maxitor_notes.notes_domain import NotesDomain


@entity(description="An item's notes published under a number", domain=NotesDomain)
class RevisionCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One row of the table ``revision``, read from ``revision_versions`` at a moment.
    CONTRACT: ``number`` is consecutive per item; ``at`` is when it was published, and it holds the notes as they read then.
    INVARIANTS: Immutable, and never changed once written.
    AI-CORE-END
    """

    number: int = Field(ge=1, description="The revision's number for its item")
    ref: str = Field(min_length=2, description="Its short reference, v<number>")
    title: str = Field(min_length=1, description="The revision's first line")
    comment: str = Field(description="The revision's own words")
    release: str | None = Field(default=None, description="The release label it was published as; none when it carries none")
    publisher_id: str = Field(min_length=1, description="The member who published it")
    publisher_name: str = Field(description="The publisher's name as it read when the revision was published")
    at: str = Field(description="When it was published, ISO 8601 with microseconds")
    first_at: str = Field(default="", description="When the item's first revision was published: the page's ready stretch starts there")
