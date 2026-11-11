# packages/maxitor/maxitor-core/maxitor/core/plugins/wheel.py
"""
Reading a plugin's wheel as a zip archive — and only reading it: nothing in it is imported or run (FR-026e).

A wheel is refused when it is not a zip, holds a path outside its root, expands beyond the limit, or lacks its
``.dist-info``, its passport or the files its passport names.
"""

from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass, field
from email.parser import HeaderParser
from pathlib import PurePosixPath
from typing import Any

import yaml

#: A wheel may expand to at most this many bytes.
MAX_EXPANDED_BYTES = 200 * 1024 * 1024
#: One YAML file of a plugin is read only up to this size.
MAX_YAML_BYTES = 256 * 1024
#: The passport's file name inside the plugin's package.
PASSPORT_FILE = "maxitor-plugin.yaml"


class WheelRefusedError(ValueError):
    """The archive is not a wheel Maxitor reads; ``reason`` is the code a rejected version keeps."""

    def __init__(self, reason: str, detail: str) -> None:
        super().__init__(detail)
        self.reason = reason
        self.detail = detail


@dataclass(frozen=True)
class WheelContents:
    """What Maxitor reads of a wheel: its distribution, its passport and the files the passport names."""

    dist_name: str
    dist_version: str
    passport: dict[str, Any]
    files: dict[str, str] = field(default_factory=dict)
    #: The actions the plugin's package holds, one per file actions/<name>_action.py or history/<name>_action.py.
    actions: frozenset[str] = frozenset()

    def file(self, path: str | None) -> str | None:
        """The text of ``path`` inside the wheel, as the passport names it; ``None`` when absent."""
        return None if path is None else self.files.get(path)


def _safe(name: str) -> bool:
    path = PurePosixPath(name)
    return not path.is_absolute() and ".." not in path.parts and "\\" not in name and not name.startswith("/")


def _open(data: bytes) -> zipfile.ZipFile:
    """The archive, when ``data`` is a zip."""
    try:
        return zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise WheelRefusedError("not_a_wheel", "the file is not a zip archive") from None


def _check_entries(archive: zipfile.ZipFile, max_expanded: int) -> set[str]:
    """The archive's names, when every path is safe and the archive expands within the limit."""
    entries = archive.infolist()
    unsafe = [e.filename for e in entries if not _safe(e.filename)]
    if unsafe:
        raise WheelRefusedError("unsafe_path", f"a path outside the archive's root: {unsafe[0]}")
    if sum(e.file_size for e in entries) > max_expanded:
        raise WheelRefusedError("too_large", f"the archive expands beyond {max_expanded} bytes")
    return {e.filename for e in entries}


def _top_level(names: set[str], suffix: str) -> list[str]:
    """The names one folder deep that end with ``suffix``."""
    return sorted(n for n in names if n.count("/") == 1 and n.endswith(suffix))


def _text(archive: zipfile.ZipFile, name: str) -> str:
    """A small text file of the archive; a larger one is refused unread."""
    if archive.getinfo(name).file_size > MAX_YAML_BYTES:
        raise WheelRefusedError("too_large", f"{name} is larger than {MAX_YAML_BYTES} bytes")
    return archive.read(name).decode("utf-8")


def _named_files(passport: dict[str, Any]) -> list[str]:
    """The files the passport names: schema.yaml, foreign-keys.yaml, navigation.yaml."""
    database = passport.get("database") or {}
    frontend = passport.get("frontend") or {}
    named = [database.get("schema"), database.get("foreign_keys"), frontend.get("navigation")]
    return [path for path in named if isinstance(path, str) and _safe(path)]


def read_wheel(data: bytes, max_expanded: int = MAX_EXPANDED_BYTES) -> WheelContents:
    """Read ``data`` as a plugin's wheel; raise ``WheelRefusedError`` with the reason."""
    with _open(data) as archive:
        names = _check_entries(archive, max_expanded)
        metadata = _top_level(names, ".dist-info/METADATA")
        if not metadata:
            raise WheelRefusedError("not_a_wheel", "no .dist-info/METADATA")
        headers = HeaderParser().parsestr(archive.read(metadata[0]).decode("utf-8", "replace"))
        passports = _top_level(names, "/" + PASSPORT_FILE)
        if len(passports) != 1:
            raise WheelRefusedError("passport", f"{len(passports)} passports in the wheel; one is needed")
        passport = yaml.safe_load(_text(archive, passports[0]))
        if not isinstance(passport, dict):
            raise WheelRefusedError("passport", "the passport is not a mapping")
        files = {path: _text(archive, path) for path in _named_files(passport) if path in names}
        return WheelContents(
            str(headers["Name"] or ""), str(headers["Version"] or ""), passport, files, _actions(names, passports[0])
        )


def _actions(names: set[str], passport_path: str) -> frozenset[str]:
    """The names of ``<package>/actions/<name>_action.py`` and ``<package>/history/<name>_action.py`` in the wheel."""
    package = passport_path.split("/", 1)[0]
    found: set[str] = set()
    for name in names:
        parts = name.split("/")
        if len(parts) == 3 and parts[0] == package and parts[1] in ("actions", "history") and parts[2].endswith("_action.py"):
            found.add(parts[2].removesuffix("_action.py"))
    return frozenset(found)
