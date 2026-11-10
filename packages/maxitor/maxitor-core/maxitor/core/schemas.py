# packages/maxitor/maxitor-core/maxitor/core/schemas.py
"""
The core's schemas by their logical names, read from the environment.

No SQL of the core names a schema: the role's ``search_path`` finds the tables. The one place a schema's name
enters SQL is a ``SET LOCAL search_path`` of the migrator, and it enters only through ``identifier``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def identifier(name: str) -> str:
    """Quote ``name`` as a PostgreSQL identifier, doubling any double quote inside it."""
    if not name or "\x00" in name:
        raise ValueError("An identifier must be a non-empty name without NUL.")
    return '"' + name.replace('"', '""') + '"'


@dataclass(frozen=True)
class CoreSchemas:
    """
    AI-CORE-BEGIN
    ROLE: The names of the core's schemas in this database.
    CONTRACT: ``from_environment`` reads MAXITOR_SCHEMA_PLATFORM, MAXITOR_SCHEMA_ORGANIZATION,
        MAXITOR_SCHEMA_PLUGINS and MAXITOR_SCHEMA_EXTENSIONS, defaulting to the logical names.
    AI-CORE-END
    """

    platform: str = "platform"
    organization: str = "organization"
    plugins: str = "plugins"
    extensions: str = "extensions"

    @classmethod
    def from_environment(cls) -> CoreSchemas:
        """The schemas the environment names, or the logical names."""
        return cls(
            platform=os.environ.get("MAXITOR_SCHEMA_PLATFORM", "platform"),
            organization=os.environ.get("MAXITOR_SCHEMA_ORGANIZATION", "organization"),
            plugins=os.environ.get("MAXITOR_SCHEMA_PLUGINS", "plugins"),
            extensions=os.environ.get("MAXITOR_SCHEMA_EXTENSIONS", "extensions"),
        )

    def search_path(self, folder: str) -> str:
        """The ``search_path`` a migration folder runs under: its own schema first."""
        if folder == "platform":
            names = [self.platform, self.extensions]
        elif folder == "organization":
            names = [self.organization, self.platform, self.extensions]
        elif folder == "plugins":
            names = [self.plugins, self.organization, self.platform, self.extensions]
        else:
            raise ValueError(f"Unknown migration folder {folder!r}.")
        return ", ".join(identifier(name) for name in names)
