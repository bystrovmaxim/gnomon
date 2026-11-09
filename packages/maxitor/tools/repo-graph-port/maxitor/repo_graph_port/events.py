# packages/maxitor/tools/repo-graph-port/maxitor/repo_graph_port/events.py
"""The typed events of the domain ``repo_graph``: every line its actions may write."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.model.base_event import BaseEvent


class HistoryListedEvent(BaseEvent):
    """A history's versions were listed for a reader."""

    history: str = Field(description="The line's history")
    reader: str = Field(description="The line's reader")


class HistoryVersionReadEvent(BaseEvent):
    """One version of a history was read for a reader."""

    history: str = Field(description="The line's history")
    reader: str = Field(description="The line's reader")


class HostEventReceivedEvent(BaseEvent):
    """A host's webhook event arrived and changed the histories named."""

    kind: str = Field(description="The line's kind")
    repository: str = Field(description="The line's repository")
    changed: str = Field(description="The line's changed")


class HistoryDescribedEvent(BaseEvent):
    """A history was described for a reader."""

    history: str = Field(description="The line's history")
    reader: str = Field(description="The line's reader")


class WrongHistoryKeyEvent(BaseEvent):
    """A request named a history with a wrong key."""

    history: str = Field(description="The line's history")
    client: str = Field(description="The line's client")


class BadWebhookSignatureEvent(BaseEvent):
    """A webhook arrived with a wrong signature."""

    client: str = Field(description="The line's client")


class ClientBlockedEvent(BaseEvent):
    """A client was blocked for a minute after too many wrong keys."""

    client: str = Field(description="The line's client")
    count: int = Field(description="The line's count")
