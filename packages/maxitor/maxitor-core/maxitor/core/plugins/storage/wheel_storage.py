# packages/maxitor/maxitor-core/maxitor/core/plugins/storage/wheel_storage.py
"""
WheelStorage — every plugin wheel Maxitor has received, kept by its SHA-256 in one directory.

A file is written once, atomically, under its hash and never replaced (FR-026f); installing reads only from here, so
a source is needed only once and no access token to it is ever kept (FR-013a).
"""

from __future__ import annotations

import hashlib
import os
import re
import tempfile
from pathlib import Path

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseResource
from aoa.action_machine.resources.base_storage import BaseStorage

#: Connection key under which actions receive the store.
WHEELS_CONNECTION_KEY = "wheels"
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class WheelHashError(ValueError):
    """The bytes given do not hash to the name they are stored under."""


@meta(description="The plugin wheels Maxitor received, one file per SHA-256, never replaced")
class WheelStorage(BaseStorage):
    """
    AI-CORE-BEGIN
    ROLE: Keep wheels by their hash.
    CONTRACT: ``put`` writes the bytes once under their SHA-256 and answers it; ``read`` answers them or ``None``.
    INVARIANTS: A file's name is the hash of its bytes; an existing file is never overwritten.
    AI-CORE-END
    """

    def __init__(self, directory: Path) -> None:
        self._directory = directory

    @classmethod
    def get_wrapper_class(cls) -> type[BaseResource] | None:
        """No wrapper: a file store holds no transaction."""
        return None

    def _path(self, sha256: str) -> Path:
        if not _SHA256.match(sha256):
            raise WheelHashError(f"not a SHA-256: {sha256!r}")
        return self._directory / f"{sha256}.whl"

    def put(self, data: bytes, sha256: str | None = None) -> str:
        """Store ``data`` under its hash, checked against ``sha256`` when given; answer the hash."""
        digest = hashlib.sha256(data).hexdigest()
        if sha256 is not None and sha256 != digest:
            raise WheelHashError(f"the bytes hash to {digest}, not {sha256}")
        path = self._path(digest)
        if path.exists():
            return digest
        self._directory.mkdir(parents=True, exist_ok=True)
        handle, temporary = tempfile.mkstemp(dir=self._directory, prefix=".incoming-")
        try:
            with os.fdopen(handle, "wb") as out:
                out.write(data)
            os.chmod(temporary, 0o444)
            if not path.exists():
                os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
        return digest

    def read(self, sha256: str) -> bytes | None:
        """The wheel stored under ``sha256``, or ``None``."""
        path = self._path(sha256)
        return path.read_bytes() if path.exists() else None
