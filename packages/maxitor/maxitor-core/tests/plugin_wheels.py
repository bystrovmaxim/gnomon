# packages/maxitor/maxitor-core/tests/plugin_wheels.py
"""Plugin wheels for tests: the template's shape as bytes, any file replaced or added."""

from __future__ import annotations

import io
import zipfile

PASSPORT = """passport: 3
id: run.aoa.maxitor.notes
name: notes
title: Notes
description: Notes of an organization.
version: 0.4.0
sdk: 1
requires:
  maxitor: ">=4.0,<5"
dependencies: []
backend:
  app: maxitor_notes.app:create_app
frontend:
  source: maxitor_notes/web
  navigation: maxitor_notes/navigation.yaml
database:
  schema: maxitor_notes/schema.yaml
  foreign_keys: maxitor_notes/foreign-keys.yaml
"""
SCHEMA = """schema: 1
tables:
  note:
    description: A note.
    columns:
      writer_id: {type: uuid, nullable: false, description: The user who wrote it.}
      body: {type: text, nullable: false, description: The text.}
"""
KEYS = """foreign_keys:
  - from: { table: note, columns: [organization_id, writer_id] }
    to:   { schema: core, table: user, columns: [organization_id, id] }
"""
NAVIGATION = """navigation: 2
nodes:
  - id: tags
    attach: root
    title: Tags
    order: 20
    page: /tags
  - id: notes
    attach: root
    title: All notes
    order: 10
    page: /
"""


#: The frontend's sources the wheel carries: the core builds them strictly by the lock.
PACKAGE = '{"name": "maxitor-notes-web", "private": true, "dependencies": {"next": "^16.4.6"}}\n'
LOCK = '{"lockfileVersion": 3, "packages": {"": {"name": "maxitor-notes-web", "dependencies": {"next": "^16.4.6"}}}}\n'


def wheel(files: dict[str, str | None] | None = None) -> bytes:
    """The template's wheel; a file mapped to ``None`` is left out."""
    contents: dict[str, str | None] = {
        "maxitor_notes-0.4.0.dist-info/METADATA": "Metadata-Version: 2.1\nName: maxitor-notes\nVersion: 0.4.0\n",
        "maxitor_notes/maxitor-plugin.yaml": PASSPORT,
        "maxitor_notes/schema.yaml": SCHEMA,
        "maxitor_notes/foreign-keys.yaml": KEYS,
        "maxitor_notes/navigation.yaml": NAVIGATION,
        "maxitor_notes/web/package.json": PACKAGE,
        "maxitor_notes/web/package-lock.json": LOCK,
        "maxitor_notes/web/app/page.tsx": "export default function Page() { return null; }\n",
    } | (files or {})
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, text in contents.items():
            if text is not None:
                archive.writestr(name, text)
    return buffer.getvalue()
