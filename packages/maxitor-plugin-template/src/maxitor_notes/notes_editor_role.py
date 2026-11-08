# packages/maxitor-plugin-template/src/maxitor_notes/notes_editor_role.py
"""NotesEditorRole — writes notes; the role ``editor`` of the passport."""

from __future__ import annotations

from aoa.action_machine.auth import ApplicationRole
from aoa.action_machine.intents.check_roles import RoleMode, role_mode


@role_mode(RoleMode.ALIVE)
class NotesEditorRole(ApplicationRole):
    """
    AI-CORE-BEGIN
    ROLE: A person who may write notes in an organization.
    CONTRACT: Named ``editor``, as in the passport; the core's token carries it in ``roles`` for one organization.
    AI-CORE-END
    """

    name = "editor"
    description = "Writes notes"
