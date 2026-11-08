# packages/maxitor-plugin-template/src/maxitor_notes/membership.py
"""
The plugin's second lock on an organization: the person must be a member of the organization of the address.

Maxitor's gateway has checked membership before a request reaches the plugin. An action that touches an
organization's data checks it again, so that a call from another plugin, a bug in the gateway or a test
without it never yields another organization's data. The check moves into ``maxitor-plugin-sdk`` once it
exists (bystrovmaxim/gnomon#73).
"""

from __future__ import annotations

from aoa.action_machine.exceptions import AuthorizationError
from maxitor_notes.storage.notes_storage import NotesStorage, NotesStorageWrapper

#: The refusal says no more than this: it does not tell whether the organization exists.
_REFUSAL = "No access to this organization"


async def organization_id_or_refuse(storage: NotesStorage | NotesStorageWrapper, code: object, user_id: object) -> str:
    """The id of the organization ``code`` when ``user_id`` belongs to it; ``AuthorizationError`` otherwise."""
    if not isinstance(code, str) or not code or not isinstance(user_id, str) or not user_id:
        raise AuthorizationError(_REFUSAL)
    organization_id = await storage.organization_of(code, user_id)
    if organization_id is None:
        raise AuthorizationError(_REFUSAL)
    return organization_id
