# packages/maxitor/maxitor-web/maxitor/web/model/core/core_domain.py
"""
CoreDomain — bounded-context marker for Maxitor core surface.

═══════════════════════════════════════════════════════════════════════════════
PURPOSE
═══════════════════════════════════════════════════════════════════════════════

Declares a :class:`~aoa.action_machine.domain.base_domain.BaseDomain` subclass for
user management, authentication, authorization, and related core actions and entities
in the Maxitor model layer.
"""

from __future__ import annotations

from maxitor.web.model.core.events import (
    HeldKeyRevokedEvent,
    HistoryChangedEvent,
    HistoryKeyRefusedEvent,
    HistoryNotCheckedEvent,
    HistoryOpenedEvent,
    HistoryPortBlockedMaxitorEvent,
    HistoryUnchangedEvent,
    HistoryUnreadableEvent,
    SourceNotRebuiltEvent,
    SourceRebuiltEvent,
    SourceUnchangedEvent,
    SourceUnreachableEvent,
)

from aoa.action_machine.domain import BaseDomain


class CoreDomain(BaseDomain):
    """
    AI-CORE-BEGIN
    ROLE: Marker domain for core platform capabilities in Maxitor (identity, authz).
    CONTRACT: ``name`` is ``core``; use with ``@meta(domain=CoreDomain)``; an entity takes it from its resource.
    INVARIANTS: Marker only — no I/O on the class.
    AI-CORE-END
    """

    name = "core"
    events = (
        HistoryUnreadableEvent,
        HistoryPortBlockedMaxitorEvent,
        HistoryKeyRefusedEvent,
        HeldKeyRevokedEvent,
        HistoryNotCheckedEvent,
        HistoryUnchangedEvent,
        HistoryChangedEvent,
        SourceUnreachableEvent,
        SourceUnchangedEvent,
        SourceNotRebuiltEvent,
        SourceRebuiltEvent,
        HistoryOpenedEvent,
    )
    description = "Core domain: user management, authentication, authorization, " "and other core functionalities"
