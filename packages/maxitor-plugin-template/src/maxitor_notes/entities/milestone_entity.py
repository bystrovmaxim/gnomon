# packages/maxitor-plugin-template/src/maxitor_notes/entities/milestone_entity.py
"""MilestoneCoreEntity — a point of the core's time scale: a published revision, or the draft as a proposal."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from aoa.action_machine.domain import BaseCoreEntity
from aoa.action_machine.intents.entity import entity
from maxitor_notes.notes_domain import NotesDomain


@entity(description="A published revision, or the draft, as a point of the time scale", domain=NotesDomain)
class MilestoneCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One milestone list_note_history answers.
    CONTRACT: The shape of history-1.schema.json's milestone; ``kind`` revision or proposal; ``minor`` for a revision
    that only edited notes; ``link`` the draft's page for the proposal.
    AI-CORE-END
    """

    id: str = Field(min_length=1, description="v<number> for a revision, draft for the draft")
    at: str = Field(description="When it was published, or the watermark for the draft")
    kind: Literal["revision", "proposal"] = Field(description="The look of its point: a revision or the draft")
    ref: str = Field(min_length=1, description="Its short reference")
    title: str = Field(min_length=1, description="Its first line")
    minor: bool = Field(description="A revision that added and removed no note: a small point")
    release: str | None = Field(default=None, description="The release label it carries; a flag over its point")
    link: str | None = Field(default=None, description="Where choosing it leads: the draft's page for the proposal")
