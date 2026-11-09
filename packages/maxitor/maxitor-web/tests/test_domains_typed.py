# packages/maxitor/maxitor-web/tests/test_domains_typed.py
"""
Every domain of Maxitor lists its events: its actions write only typed events.

A domain with ``events`` is a typed zone of AOA: a line with no event, or with an event the
method does not declare in ``@emits``, is refused when it is written. This test walks every
domain the repository's Maxitor code declares and fails on one without ``events``.
"""

from __future__ import annotations

import importlib

import pytest

from aoa.action_machine.domain import BaseDomain

#: The modules that declare Maxitor's domains, and the domain each declares.
DOMAINS = [
    ("maxitor.web.model.core.core_domain", "CoreDomain"),
    ("maxitor.web.model.diagrams.diagrams_domain", "DiagramsDomain"),
    ("maxitor.web.model.rooms.rooms_domain", "RoomsDomain"),
    ("maxitor.repo_graph_port.repo_graph_domain", "RepoGraphDomain"),
]


@pytest.mark.parametrize(("module", "name"), DOMAINS)
def test_every_domain_lists_its_events(module: str, name: str) -> None:
    domain = getattr(importlib.import_module(module), name)
    assert issubclass(domain, BaseDomain)
    assert "events" in domain.__dict__, f"{name} declares no events: its actions could write untyped lines"
    assert isinstance(domain.events, tuple)


def test_a_line_outside_the_method_declaration_is_refused() -> None:
    """A room action that writes an event its method does not declare fails when it writes."""
    from maxitor.web.model.rooms.actions.end_room_action import EndRoomAction
    from maxitor.web.model.rooms.events import ParticipantJoinedEvent, RoomEndedEvent

    from aoa.action_machine.exceptions.event_contract_error import EventContractError
    from aoa.action_machine.runtime.emission_rules import emission_rules_for

    method = next(n for n, v in vars(EndRoomAction).items() if callable(v) and n.endswith("summary"))
    rules = emission_rules_for(EndRoomAction, method)
    assert rules is not None
    rules.check(RoomEndedEvent(room="r1"))
    with pytest.raises(EventContractError):
        rules.check(ParticipantJoinedEvent(participant="p1", room="r1"))
    with pytest.raises(EventContractError):
        rules.check(None)
