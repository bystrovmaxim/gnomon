# packages/maxitor-plugin-template/src/maxitor_notes/entities/bar_entity.py
"""BarCoreEntity — one bar of the core's time scale: a stretch of time and the changes the page shows in it."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.domain import BaseCoreEntity
from aoa.action_machine.intents.entity import entity
from maxitor_notes.notes_domain import NotesDomain


@entity(description="A stretch of time and the changes of the page's notes in it", domain=NotesDomain)
class BarCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One bar the page's reading action answers over a stretch.
    CONTRACT: The shape of history-1.schema.json's bar; counted by maxitor_plugin_sdk.history.bars_of.
    AI-CORE-END
    """

    start: str = Field(description="When the bar starts, ISO 8601 with microseconds")
    added: int = Field(ge=0, description="Notes added in the bar")
    changed: int = Field(ge=0, description="Notes changed in the bar")
    removed: int = Field(ge=0, description="Notes removed in the bar")
