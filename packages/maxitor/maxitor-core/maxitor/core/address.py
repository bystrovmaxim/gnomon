# packages/maxitor/maxitor-core/maxitor/core/address.py
"""
The address code of an organization: its segment of every address, ``/w/<code>``.

A code is lower-case ASCII letters, digits and hyphens, 2 to 63 characters, starting and ending with a letter or a
digit, and none of Maxitor's reserved words. A code is suggested from the organization's name.
"""

from __future__ import annotations

import re
import unicodedata

#: Words that are Maxitor's own addresses or may become them.
RESERVED = frozenset(
    {
        "w",
        "api",
        "new",
        "sign-in",
        "sign-up",
        "reset-password",
        "privacy",
        "data-deletion",
        "p",
        "static",
        "_next",
        "admin",
        "maxitor",
        "www",
        "help",
        "docs",
    }
)

SHAPE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$")
ALLOWED_CHARS = frozenset("abcdefghijklmnopqrstuvwxyz0123456789-")

#: Cyrillic letters as the code spells them; any other letter loses its accents.
_CYRILLIC = dict(
    zip(
        "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
        [
            "a",
            "b",
            "v",
            "g",
            "d",
            "e",
            "e",
            "zh",
            "z",
            "i",
            "y",
            "k",
            "l",
            "m",
            "n",
            "o",
            "p",
            "r",
            "s",
            "t",
            "u",
            "f",
            "kh",
            "ts",
            "ch",
            "sh",
            "shch",
            "",
            "y",
            "",
            "e",
            "yu",
            "ya",
        ],
        strict=True,
    )
)


def bad_chars(code: str) -> list[str]:
    """The characters of ``code`` a code may not have, each once, in order."""
    seen: list[str] = []
    for char in code:
        if char not in ALLOWED_CHARS and char not in seen:
            seen.append(char)
    return seen


def allowed(code: str) -> bool:
    """Whether ``code`` has the shape of a code and is not reserved."""
    return bool(SHAPE.match(code)) and code not in RESERVED


def from_name(name: str) -> str:
    """A code made from an organization's name: ``Severny Veter`` gives ``severny-veter``; may be empty."""
    spelled = "".join(_CYRILLIC.get(char, char) for char in name.lower())
    ascii_only = unicodedata.normalize("NFKD", spelled).encode("ascii", "ignore").decode()
    code = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    return code[:63].rstrip("-")


def candidates(name: str, asked: str) -> list[str]:
    """Codes to offer for a name, nearest first, never the code asked for."""
    base = from_name(name) or asked
    base = base if len(base) >= 2 else f"{base}-org".strip("-")
    out = [base, f"{base[:58]}-team", f"{base[:60]}-hq"] + [f"{base[:59]}-{n}" for n in range(2, 40)]
    return [c for c in out if c != asked and allowed(c)]
