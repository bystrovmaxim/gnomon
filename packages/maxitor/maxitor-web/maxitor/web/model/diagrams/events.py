# packages/maxitor/maxitor-web/maxitor/web/model/diagrams/events.py
"""The typed events of the domain ``diagrams``: every line its actions may write."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.model.base_event import BaseEvent


class ComparisonComputedEvent(BaseEvent):
    """A comparison of two graph versions was computed."""

    ms: float = Field(description="The line's ms")
    nodes: str = Field(description="The line's nodes")
    edges: str = Field(description="The line's edges")
