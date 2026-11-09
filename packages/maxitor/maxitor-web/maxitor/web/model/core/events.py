# packages/maxitor/maxitor-web/maxitor/web/model/core/events.py
"""The typed events of the domain ``core``: every line its actions may write."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.model.base_event import BaseEvent


class HistoryUnreadableEvent(BaseEvent):
    """A history's port could not be read now."""

    history: str = Field(description="The line's history")
    port: str = Field(description="The line's port")
    reason: str = Field(description="The line's reason")


class HistoryPortBlockedMaxitorEvent(BaseEvent):
    """A history's port blocked Maxitor for too many wrong keys."""

    history: str = Field(description="The line's history")
    port: str = Field(description="The line's port")
    client: str = Field(description="The line's client")


class HistoryKeyRefusedEvent(BaseEvent):
    """A history's port refused the key a client gave."""

    history: str = Field(description="The line's history")
    port: str = Field(description="The line's port")
    client: str = Field(description="The line's client")


class HeldKeyRevokedEvent(BaseEvent):
    """A port no longer accepts a key Maxitor held."""

    history: str = Field(description="The line's history")
    port: str = Field(description="The line's port")


class HistoryNotCheckedEvent(BaseEvent):
    """A history was not checked because its port cannot be read now."""

    history: str = Field(description="The line's history")
    port: str = Field(description="The line's port")


class HistoryUnchangedEvent(BaseEvent):
    """A checked history had not changed."""

    history: str = Field(description="The line's history")


class HistoryChangedEvent(BaseEvent):
    """A checked history had changed."""

    history: str = Field(description="The line's history")
    count: int = Field(description="The line's count")
    live: str = Field(description="The line's live")


class SourceUnreachableEvent(BaseEvent):
    """A graph source could not be reached."""

    source: str = Field(description="The line's source")
    reason: str = Field(description="The line's reason")


class SourceUnchangedEvent(BaseEvent):
    """A graph source had not changed."""

    source: str = Field(description="The line's source")


class SourceNotRebuiltEvent(BaseEvent):
    """A changed graph source could not be rebuilt."""

    source: str = Field(description="The line's source")
    reason: str = Field(description="The line's reason")


class SourceRebuiltEvent(BaseEvent):
    """A graph source was rebuilt."""

    source: str = Field(description="The line's source")


class HistoryOpenedEvent(BaseEvent):
    """A history was opened."""

    history: str = Field(description="The line's history")
    count: str = Field(description="The line's count")
    live: str = Field(description="The line's live")
