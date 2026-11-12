# packages/maxitor-plugin-template/src/maxitor_notes/app.py
"""
The plugin's backend: the application Maxitor runs as a process of its own, behind its gateway.

═══════════════════════════════════════════════════════════════════════════════
ARCHITECTURE / DATA FLOW
═══════════════════════════════════════════════════════════════════════════════

::

    gateway ──► /p/notes/api/{organization}/...  (the core's token in Authorization)
                   │
                   ▼
    OrganizationAuthCoordinator ── the token checked by the core's JWKS; the address's organization
                   │
                   ▼
    an action ── NotesStorage, one per call, from the pool opened in the lifespan

The process gets its settings from Maxitor, through its environment and nothing else: the address of the
plugin's database as its version's own role (``MAXITOR_PLUGIN_DSN``) and the address of the core's JWKS
(``MAXITOR_CORE_JWKS_URL``), through the gateway. Maxitor's runner starts it in a container of its own as
``uvicorn maxitor_notes.app:create_app --factory``.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from maxitor_plugin_sdk.roles import CORE_ROLES

from aoa.action_machine.auth.jwt_auth.jwt_auth_coordinator import JwtAuthCoordinator
from aoa.action_machine.exceptions.access_denied import AccessDenied
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.intents.access_control import Gate
from aoa.action_machine.resources.base_resource import BaseResource
from aoa.action_machine.resources.per_call_connection import PerCallConnection
from aoa.action_machine.resources.postgres import PostgresPool
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine
from aoa.fastapi import FastApiAdapter
from maxitor_notes.actions.add_item_action import AddItemAction
from maxitor_notes.actions.add_note_action import AddNoteAction
from maxitor_notes.actions.delete_note_action import DeleteNoteAction
from maxitor_notes.actions.edit_note_action import EditNoteAction
from maxitor_notes.actions.list_item_notes_action import ListItemNotesAction
from maxitor_notes.actions.list_items_action import ListItemsAction
from maxitor_notes.actions.list_note_authors_action import ListNoteAuthorsAction
from maxitor_notes.actions.list_note_draft_action import ListNoteDraftAction
from maxitor_notes.actions.list_published_notes_action import ListPublishedNotesAction
from maxitor_notes.actions.publish_notes_action import PublishNotesAction
from maxitor_notes.actions.rename_item_action import RenameItemAction
from maxitor_notes.actions.revert_note_change_action import RevertNoteChangeAction
from maxitor_notes.history.list_note_history_action import ListNoteHistoryAction
from maxitor_notes.history.note_milestone_card_action import NoteMilestoneCardAction
from maxitor_notes.notes_refusal_error import NotesRefusalError
from maxitor_notes.organization_auth_coordinator import OrganizationAuthCoordinator
from maxitor_notes.passport import read_passport
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


def create_app(dsn: str | None = None, jwks_url: str | None = None) -> FastAPI:
    """
    AI-CORE-BEGIN
    ROLE: Build the plugin's backend.
    CONTRACT: ``dsn`` defaults to ``$MAXITOR_PLUGIN_DSN``, ``jwks_url`` to ``$MAXITOR_CORE_JWKS_URL``;
    every route lies under ``/p/<name>/api/{organization}`` and is an action.
    INVARIANTS: Accepts only the core's EdDSA token issued for this plugin's id, with the core's roles; one storage per
        call, from one pool.
    AI-CORE-END
    """
    passport = read_passport()
    address = dsn or os.environ["MAXITOR_PLUGIN_DSN"]
    keys = jwks_url or os.environ["MAXITOR_CORE_JWKS_URL"]
    pools: dict[str, PostgresPool] = {}

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        async with PostgresPool(address, min_size=1, max_size=10) as pool:
            pools["notes"] = pool
            yield

    def open_storage() -> BaseResource:
        return NotesStorage(pool=pools["notes"])

    async def close_storage(storage: BaseResource) -> None:
        if isinstance(storage, NotesStorage):
            await storage.close()

    connections = {NOTES_CONNECTION_KEY: PerCallConnection(factory=open_storage, finalize=close_storage)}
    tokens = JwtAuthCoordinator(
        jwks_url=keys,
        algorithm="EdDSA",
        audience=passport["id"],
        issuer="maxitor",
        role_registry=CORE_ROLES,
        session_id_claim="sid",
    )
    adapter = FastApiAdapter(
        machine=ActionProductMachine(graph_coordinator=create_node_graph_coordinator()),
        auth_coordinator=OrganizationAuthCoordinator(tokens),
        title=passport["title"],
        version=passport["version"],
    )
    prefix = f"/p/{passport['name']}/api/{{organization}}"
    adapter.post(f"{prefix}/items", AddItemAction, connections=connections)
    adapter.patch(f"{prefix}/items", RenameItemAction, connections=connections)
    adapter.get(f"{prefix}/lists/list_items", ListItemsAction, connections=connections)
    adapter.post(f"{prefix}/notes", AddNoteAction, connections=connections)
    adapter.patch(f"{prefix}/notes", EditNoteAction, connections=connections)
    adapter.delete(f"{prefix}/notes/{{note_id}}", DeleteNoteAction, connections=connections)
    adapter.delete(f"{prefix}/draft/{{note_id}}", RevertNoteChangeAction, connections=connections)
    adapter.get(f"{prefix}/items/{{item_id}}/notes", ListItemNotesAction, connections=connections)
    adapter.get(f"{prefix}/lists/list_note_authors", ListNoteAuthorsAction, connections=connections)
    adapter.post(f"{prefix}/revisions", PublishNotesAction, connections=connections)
    adapter.get(f"{prefix}/items/{{item_id}}/published", ListPublishedNotesAction, connections=connections)
    adapter.get(f"{prefix}/items/{{item_id}}/draft", ListNoteDraftAction, connections=connections)
    adapter.get(f"{prefix}/history/list_note_history", ListNoteHistoryAction, connections=connections)
    adapter.get(f"{prefix}/history/note_milestone_card", NoteMilestoneCardAction, connections=connections)
    app = adapter.build(lifespan=lifespan)

    @app.exception_handler(NotesRefusalError)
    async def refused(_request: Request, error: NotesRefusalError) -> JSONResponse:
        """A refusal of an action becomes its status and its reason, as the core's refusals do."""
        return JSONResponse(status_code=error.status, content=error.body)

    @app.exception_handler(AccessDenied)
    async def denied(_request: Request, error: AccessDenied) -> JSONResponse:
        """A role the token lacks is 403; another organization's object is 404, as if it did not exist."""
        if error.verdict.gate == Gate.ACCESS_DECIDE:
            return JSONResponse(status_code=404, content={"error": "not_found"})
        return JSONResponse(status_code=403, content={"error": "forbidden"})

    return app
