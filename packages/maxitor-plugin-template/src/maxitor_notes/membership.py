# packages/maxitor-plugin-template/src/maxitor_notes/membership.py
"""
The plugin's second lock on an organization: the person must be a member of the organization of the address.

Maxitor's gateway has checked membership before a request reaches the plugin. An action that touches an
organization's data checks it again, so that a call from another plugin, a bug in the gateway or a test
without it never yields another organization's data. The check moves into ``maxitor-plugin-sdk`` once it
exists (bystrovmaxim/gnomon#73).

::

    @access_decide ──► organization_access ──► Allowed | FORBIDDEN_OBJECT
                   ──► item_access ─────────► the same, and the item must be one of the organization's now
    summary aspect ──► member_organization_id ──► the organization's id
                                                  (AccessDenied(FORBIDDEN_OBJECT) if the membership ended meanwhile)

The decision gets no state, so the main step looks the organization's id up again: one light query.
Both answer a stranger with ``FORBIDDEN_OBJECT``, which does not tell whether the organization exists.
"""

from __future__ import annotations

from aoa.action_machine.exceptions.access_denied import AccessDenied
from aoa.action_machine.intents.access_control import FORBIDDEN_OBJECT, Allowed, Verdict
from maxitor_notes.storage.notes_storage import NotesStorage, NotesStorageWrapper


async def _organization_id(storage: NotesStorage | NotesStorageWrapper, code: object, user_id: object) -> str | None:
    """The id of the organization ``code`` when ``user_id`` belongs to it now; ``None`` otherwise."""
    if not isinstance(code, str) or not code or not isinstance(user_id, str) or not user_id:
        return None
    return await storage.organization_of(code, user_id)


async def organization_access(storage: NotesStorage | NotesStorageWrapper, code: object, user_id: object) -> Verdict:
    """``Allowed`` when ``user_id`` is a member of the organization ``code``; ``FORBIDDEN_OBJECT`` otherwise."""
    return FORBIDDEN_OBJECT if await _organization_id(storage, code, user_id) is None else Allowed()


async def item_access(storage: NotesStorage | NotesStorageWrapper, code: object, user_id: object, item_id: str) -> Verdict:
    """
    ``Allowed`` when ``user_id`` is a member of the organization ``code`` and ``item_id`` is one of its items now;
    ``FORBIDDEN_OBJECT`` otherwise: one answer for an item that does not exist and one of another organization.
    """
    organization_id = await _organization_id(storage, code, user_id)
    if organization_id is None or not await storage.item_of(organization_id, item_id):
        return FORBIDDEN_OBJECT
    return Allowed()


async def member_organization_id(storage: NotesStorage | NotesStorageWrapper, code: object, user_id: object) -> str:
    """
    The id of the organization ``code`` for the main step of an action whose decision has allowed ``user_id``.

    The membership may end between the decision and the main step; then the step refuses the same way the
    decision would, with ``AccessDenied`` carrying ``FORBIDDEN_OBJECT``, and touches nothing.
    """
    organization_id = await _organization_id(storage, code, user_id)
    if organization_id is None:
        raise AccessDenied(FORBIDDEN_OBJECT)
    return organization_id
