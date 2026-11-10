# packages/maxitor-plugin-template/src/maxitor_notes/notes_refusal_error.py
"""
NotesRefusalError — a refusal the plugin's page shows, with the HTTP answer it becomes.

The same shape as the core's refusals: a reason a page can tell apart, the details it shows, and a status. A
moment not come yet, a note changed or deleted since the person saw it, nothing to publish.
"""

from __future__ import annotations


class NotesRefusalError(Exception):
    """
    AI-CORE-BEGIN
    ROLE: A refusal of an action of the plugin, as an answer.
    CONTRACT: ``reason`` is a short code; ``status`` the HTTP status; ``body`` the JSON a page reads.
    INVARIANTS: Nothing was written when it is raised.
    AI-CORE-END
    """

    def __init__(self, reason: str, status: int, **details: object) -> None:
        super().__init__(reason)
        self.reason = reason
        self.status = status
        self.details = details

    @property
    def body(self) -> dict[str, object]:
        """The answer's JSON: the reason and its details."""
        return {"error": self.reason, **self.details}
