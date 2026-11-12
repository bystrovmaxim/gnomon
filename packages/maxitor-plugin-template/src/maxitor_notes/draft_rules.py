# packages/maxitor-plugin-template/src/maxitor_notes/draft_rules.py
"""
The rule of a draft's change against the published notes: apply it, drop it, or meet it as a conflict.

The comparison is by value, never by a version's identity: a change is in conflict when the published note now reads
otherwise than the change's base or is deleted, and a change whose own text has come to equal the published text leaves
the draft. Pure functions, so the rule is checked without a database.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

from maxitor_notes.entities.note_change_entity import NoteChangeCoreEntity
from maxitor_notes.entities.note_conflict_entity import NoteConflictCoreEntity


@dataclass(frozen=True)
class PublishedNote:
    """The published note now: its text, or nothing when it is deleted, and who made it so and when."""

    body: str | None
    by_name: str
    at: str


@dataclass(frozen=True)
class DraftDecision:
    """What the draft's change does at publishing: applies as it is, meets a conflict, or has nothing left to do."""

    change: NoteChangeCoreEntity
    kind: Literal["apply", "conflict", "drop"]
    conflict: NoteConflictCoreEntity | None = None


def decide(changes: list[NoteChangeCoreEntity], published: Mapping[str, PublishedNote]) -> list[DraftDecision]:
    """Decide every change of one person's draft against the published notes now, in the draft's order."""
    return [_decide(change, published.get(change.note_id)) for change in changes]


def _decide(change: NoteChangeCoreEntity, published: PublishedNote | None) -> DraftDecision:
    """One change's decision."""
    if change.state == "new":
        return DraftDecision(change=change, kind="apply")
    if published is None or published.body is None:
        if change.state == "deleted":
            return DraftDecision(change=change, kind="drop")
        return DraftDecision(change=change, kind="conflict", conflict=_conflict(change, published))
    if change.state == "changed" and published.body == change.body:
        return DraftDecision(change=change, kind="drop")
    if published.body == change.base_body:
        return DraftDecision(change=change, kind="apply")
    return DraftDecision(change=change, kind="conflict", conflict=_conflict(change, published))


def _conflict(change: NoteChangeCoreEntity, published: PublishedNote | None) -> NoteConflictCoreEntity:
    """The conflict's other side, as the member reads it."""
    return NoteConflictCoreEntity(
        note_id=change.note_id,
        state=change.state,
        body=change.body,
        base_body=change.base_body,
        published_body=None if published is None else published.body,
        published_by_name="" if published is None else published.by_name,
        published_at="" if published is None else published.at,
    )
