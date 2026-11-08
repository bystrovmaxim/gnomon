# packages/maxitor-plugin-template/src/maxitor_notes/notes_reader_role.py
"""NotesReaderRole — reads notes; the role ``reader`` of the passport."""

from __future__ import annotations

from aoa.action_machine.auth import ApplicationRole
from aoa.action_machine.intents.check_roles import RoleMode, role_mode


@role_mode(RoleMode.ALIVE)
class NotesReaderRole(ApplicationRole):
    """
    AI-CORE-BEGIN
    ROLE: A person who may read the notes of an organization.
    CONTRACT: Named ``reader``, as in the passport; the core's token carries it in ``roles`` for one organization.
    AI-CORE-END
    """

    name = "reader"
    description = "Reads notes"
