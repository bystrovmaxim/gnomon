# packages/maxitor/maxitor-web/maxitor/web/model/rooms/events.py
"""The typed events of the domain ``rooms``: every line its actions may write."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.model.base_event import BaseEvent


class RoomVersionRefusedEvent(BaseEvent):
    """A room refused a version change."""

    room: str = Field(description="The line's room")


class RoomVersionMovedEvent(BaseEvent):
    """A room moved to another version."""

    room: str = Field(description="The line's room")
    version: str = Field(description="The line's version")


class FollowRefusedEvent(BaseEvent):
    """A participant was refused following another."""

    room: str = Field(description="The line's room")
    participant: str = Field(description="The line's participant")
    target: str = Field(description="The line's target")


class FollowStartedEvent(BaseEvent):
    """A participant started following another."""

    participant: str = Field(description="The line's participant")
    target: str = Field(description="The line's target")
    room: str = Field(description="The line's room")


class RoomSourceReloadedEvent(BaseEvent):
    """A participant reloaded a room's source."""

    participant: str = Field(description="The line's participant")
    source: str = Field(description="The line's source")
    room: str = Field(description="The line's room")


class RoomEndedEvent(BaseEvent):
    """A room ended."""

    room: str = Field(description="The line's room")


class ParticipantLeftEvent(BaseEvent):
    """A participant left a room."""

    participant: str = Field(description="The line's participant")
    room: str = Field(description="The line's room")


class ParticipantExpiredEvent(BaseEvent):
    """A participant left a room after losing the connection."""

    participant: str = Field(description="The line's participant")
    room: str = Field(description="The line's room")


class JoinRefusedForeignOriginEvent(BaseEvent):
    """A room join came from a foreign origin."""

    origin: str = Field(description="The line's origin")


class JoinRefusedInvalidNameEvent(BaseEvent):
    """A room join gave an invalid name."""

    room: str = Field(description="The line's room")


class JoinRefusedFullEvent(BaseEvent):
    """A room join was refused because the room is full."""

    room: str = Field(description="The line's room")


class ParticipantJoinedEvent(BaseEvent):
    """A participant joined a room."""

    participant: str = Field(description="The line's participant")
    room: str = Field(description="The line's room")


class ParticipantReturnedEvent(BaseEvent):
    """A participant returned to a room."""

    participant: str = Field(description="The line's participant")
    room: str = Field(description="The line's room")


class JoinRefusedEndedEvent(BaseEvent):
    """A room join was refused because the room has ended."""

    room: str = Field(description="The line's room")


class RoomCreationRefusedEvent(BaseEvent):
    """A room was not created because the limit of open rooms is reached."""

    limit: int = Field(description="The line's limit")


class RoomCreatedForSourceEvent(BaseEvent):
    """A room was created for a graph source."""

    room: str = Field(description="The line's room")
    source: str = Field(description="The line's source")


class RoomCreatedOnHistoryEvent(BaseEvent):
    """A room was created on a graph history."""

    room: str = Field(description="The line's room")
    history: str = Field(description="The line's history")


class JoinRefusedNoTicketEvent(BaseEvent):
    """A room join on a private history came with no valid ticket."""


class SeedRefusedEvent(BaseEvent):
    """A participant who did not open a room tried to seed it."""

    room: str = Field(description="The line's room")
    participant: str = Field(description="The line's participant")


class RoomSeededEvent(BaseEvent):
    """A room was seeded with a page's settings."""

    room: str = Field(description="The line's room")
    count: int = Field(description="The line's count")


class PageSettingChangedEvent(BaseEvent):
    """A page setting changed in a room."""

    setting: str = Field(description="The line's setting")
    room: str = Field(description="The line's room")


class ParticipantDisconnectedEvent(BaseEvent):
    """A participant lost the connection to a room."""

    participant: str = Field(description="The line's participant")
    room: str = Field(description="The line's room")


class ParticipantRenamedEvent(BaseEvent):
    """A participant was renamed in a room."""

    participant: str = Field(description="The line's participant")
    room: str = Field(description="The line's room")
