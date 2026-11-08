# packages/maxitor-plugin-template/src/maxitor_notes/notes_domain.py
"""NotesDomain — the business area of the plugin: notes people write on catalog items."""

from __future__ import annotations

from aoa.action_machine.domain import BaseDomain


class NotesDomain(BaseDomain):
    """
    AI-CORE-BEGIN
    ROLE: The domain of the plugin's actions and entities.
    CONTRACT: ``name`` is ``notes``, the plugin's name.
    INVARIANTS: Marker only.
    AI-CORE-END
    """

    name = "notes"
    description = "Notes people write on catalog items"
