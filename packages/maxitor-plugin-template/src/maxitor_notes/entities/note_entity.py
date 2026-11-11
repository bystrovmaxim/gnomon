# packages/maxitor-plugin-template/src/maxitor_notes/entities/note_entity.py
"""NoteCoreEntity — a note on an item, as it read at one moment."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.domain import BaseCoreEntity
from aoa.action_machine.intents.entity import entity
from maxitor_notes.notes_domain import NotesDomain


@entity(description="A note a person wrote on an item", domain=NotesDomain)
class NoteCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One note of the table ``note``, read from ``note_versions`` at a moment.
    CONTRACT: ``id`` is the note's; ``item_id`` the item it is about; ``writer_id`` the member who wrote it.
    INVARIANTS: Immutable; the organization is not a field — every read is already bound to one.
    AI-CORE-END
    """

    id: str = Field(min_length=1, description="The note")
    item_id: str = Field(min_length=1, description="The item the note is about")
    writer_id: str = Field(min_length=1, description="The member of the organization who wrote the note")
    writer_name: str = Field(description="The writer's name as it read at the same moment")
    body: str = Field(min_length=1, description="The text of the note")
    updated_at: str = Field(description="When the note was last changed, ISO 8601 with microseconds")
    changed_by: str = Field(default="", description="Who opened the version read — the writer or the last editor — as their name read then")
    since: str = Field(description="When the version read began: the base_moment an editor sends back with a change")
