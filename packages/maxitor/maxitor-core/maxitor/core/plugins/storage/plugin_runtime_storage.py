# packages/maxitor/maxitor-core/maxitor/core/plugins/storage/plugin_runtime_storage.py
"""
PluginRuntimeStorage — the directory where each deployed version keeps the environment file its process starts with.

The file ``<runtime>/<schema>/plugin.env`` holds the version's connection string with its user's password and its
service key, readable by its owner only (mode 0600). It is the only place they exist (FR-026); the runner starts the
version's processes with it.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseResource
from aoa.action_machine.resources.base_storage import BaseStorage

#: Connection key under which actions receive the runtime directory.
RUNTIME_CONNECTION_KEY = "runtime"
_SCHEMA = re.compile(r"^[a-z][a-z0-9_]{0,62}$")


@meta(description="The environment files of deployed plugin versions, one per schema, readable by their owner only")
class PluginRuntimeStorage(BaseStorage):
    """
    AI-CORE-BEGIN
    ROLE: Write and remove a version's environment file.
    CONTRACT: ``write_env`` makes ``<schema>/plugin.env`` with mode 0600 from the database's address, the version's
        user and password and its service key; ``remove_env`` deletes it.
    INVARIANTS: The password is written nowhere else; the repr names no password.
    AI-CORE-END
    """

    def __init__(self, directory: Path, database_url: str) -> None:
        self._directory = directory
        parts = urlsplit(database_url)
        self._host = parts.hostname or "127.0.0.1"
        self._port = parts.port
        self._database = parts.path

    def __repr__(self) -> str:
        return f"PluginRuntimeStorage({str(self._directory)!r})"

    @classmethod
    def get_wrapper_class(cls) -> type[BaseResource] | None:
        """No wrapper: a file store holds no transaction."""
        return None

    def env_path(self, schema: str) -> Path:
        """The environment file of the version whose schema is ``schema``."""
        if not _SCHEMA.match(schema):
            raise ValueError(f"not a schema name: {schema!r}")
        return self._directory / schema / "plugin.env"

    def write_env(self, schema: str, user: str, password: str, service_key: str) -> Path:
        """Write the version's environment file, readable by its owner only; answer its path."""
        path = self.env_path(schema)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        netloc = f"{quote(user)}:{quote(password)}@{self._host}" + (f":{self._port}" if self._port else "")
        url = urlunsplit(("postgresql", netloc, self._database, "", ""))
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as out:
            out.write(f"MAXITOR_PLUGIN_DSN={url}\nMAXITOR_PLUGIN_SCHEMA={schema}\nMAXITOR_PLUGIN_SERVICE_KEY={service_key}\n")
        os.chmod(path, 0o600)
        return path

    def remove_env(self, schema: str) -> None:
        """Delete the version's environment file if it is there."""
        self.env_path(schema).unlink(missing_ok=True)
