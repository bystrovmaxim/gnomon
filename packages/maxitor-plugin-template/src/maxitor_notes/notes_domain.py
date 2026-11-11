# packages/maxitor-plugin-template/src/maxitor_notes/notes_domain.py
"""NotesDomain — the business area of the plugin: notes people write on the plugin's own items."""

from __future__ import annotations

from aoa.action_machine.domain import BaseDomain
from maxitor_notes.events import ItemAddedEvent, ItemRenamedEvent


class NotesDomain(BaseDomain):
    """
    AI-CORE-BEGIN
    ROLE: The domain of the plugin's actions and entities.
    CONTRACT: ``name`` is ``notes``, the plugin's name; ``events`` every line its actions may write.
    INVARIANTS: Marker only.
    AI-CORE-END
    """

    name = "notes"
    events = (
        ItemAddedEvent,
        ItemRenamedEvent,
    )
    description = "Notes people write on the plugin's own items"
