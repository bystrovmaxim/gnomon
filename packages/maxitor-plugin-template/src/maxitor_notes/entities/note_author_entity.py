# packages/maxitor-plugin-template/src/maxitor_notes/entities/note_author_entity.py
"""NoteAuthorCoreEntity — a person who has written notes, as an option of the page's author filter."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.domain import BaseCoreEntity
from aoa.action_machine.intents.entity import entity
from maxitor_notes.notes_domain import NotesDomain


@entity(description="A person who has written notes on an item", domain=NotesDomain)
class NoteAuthorCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One option of the author filter Maxitor draws over the item's notes page.
    CONTRACT: ``id`` is the person's, the option's value; ``name`` its label, as it read at the panel's moment.
    AI-CORE-END
    """

    id: str = Field(min_length=1, description="The person")
    name: str = Field(description="The person's name at the panel's moment")
