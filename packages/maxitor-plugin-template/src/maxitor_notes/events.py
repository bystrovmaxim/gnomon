# packages/maxitor-plugin-template/src/maxitor_notes/events.py
"""The typed events of the domain ``notes``: every line its actions may write."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.model.base_event import BaseEvent


class ItemAddedEvent(BaseEvent):
    """A member added an item."""

    item_id: str = Field(description="The item added")
    title: str = Field(description="Its title")


class ItemRenamedEvent(BaseEvent):
    """A member gave an item a new title."""

    item_id: str = Field(description="The item renamed")
    old_title: str = Field(description="The title it had")
    new_title: str = Field(description="The title it has now")
