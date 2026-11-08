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
    OrganizationAuthCoordinator ── the token checked against the core's public key; the address's organization
                   │
                   ▼
    an action ── NotesStorage, one per call, from the pool opened in the lifespan

The process gets two settings from Maxitor, through its environment and nothing else: the address of
the plugin's database as the role ``plg_notes`` (``MAXITOR_PLUGIN_DSN``) and the file of the core's public
key (``MAXITOR_CORE_PUBLIC_KEY``). Run: ``uvicorn maxitor_notes.app:create_app --factory``.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from aoa.action_machine.auth.jwt_auth.jwt_auth_coordinator import JwtAuthCoordinator
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.resources.base_resource import BaseResource
from aoa.action_machine.resources.per_call_connection import PerCallConnection
from aoa.action_machine.resources.postgres import PostgresPool
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine
from aoa.fastapi import FastApiAdapter
from maxitor_notes.actions.add_note_action import AddNoteAction
from maxitor_notes.actions.list_item_notes_action import ListItemNotesAction
from maxitor_notes.actions.list_note_authors_action import ListNoteAuthorsAction
from maxitor_notes.notes_editor_role import NotesEditorRole
from maxitor_notes.notes_reader_role import NotesReaderRole
from maxitor_notes.organization_auth_coordinator import OrganizationAuthCoordinator
from maxitor_notes.passport import read_passport
from maxitor_notes.storage.notes_storage import NOTES_CONNECTION_KEY, NotesStorage


def create_app(dsn: str | None = None, core_public_key: str | None = None) -> FastAPI:
    """
    AI-CORE-BEGIN
    ROLE: Build the plugin's backend.
    CONTRACT: ``dsn`` defaults to ``$MAXITOR_PLUGIN_DSN``, ``core_public_key`` to the text of the file ``$MAXITOR_CORE_PUBLIC_KEY``;
    every route lies under ``/p/<name>/api/{organization}`` and is an action.
    INVARIANTS: Accepts only the core's EdDSA token issued for this plugin's id; one storage per call, from one pool.
    AI-CORE-END
    """
    passport = read_passport()
    address = dsn or os.environ["MAXITOR_PLUGIN_DSN"]
    key = core_public_key or Path(os.environ["MAXITOR_CORE_PUBLIC_KEY"]).read_text(encoding="utf-8")
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
        secret_key=key,
        algorithm="EdDSA",
        audience=passport["id"],
        issuer="maxitor",
        role_registry={NotesReaderRole.name: NotesReaderRole, NotesEditorRole.name: NotesEditorRole},
        session_id_claim="sid",
    )
    adapter = FastApiAdapter(
        machine=ActionProductMachine(graph_coordinator=create_node_graph_coordinator()),
        auth_coordinator=OrganizationAuthCoordinator(tokens),
        title=passport["title"],
        version=passport["version"],
    )
    prefix = f"/p/{passport['name']}/api/{{organization}}"
    adapter.post(f"{prefix}/notes", AddNoteAction, connections=connections)
    adapter.get(f"{prefix}/items/{{item_id}}/notes", ListItemNotesAction, connections=connections)
    adapter.get(f"{prefix}/lists/list_note_authors", ListNoteAuthorsAction, connections=connections)
    return adapter.build(lifespan=lifespan)
