# packages/maxitor/maxitor-core/tests/test_organizations.py
"""
Registering an organization and opening it: the address code's rules, the limit, the race and the alike 404.
"""

from __future__ import annotations

import uuid

import pytest
from maxitor.core import address

from tests.fakes import World


@pytest.fixture
def world() -> World:
    w = World()
    w.signed(w.sign_up())
    return w


def check(world: World, code: str, name: str = "") -> dict[str, object]:
    return dict(world.client.get("/api/v1/organizations/code-check", params={"code": code, "name": name}).json())


def register(world: World, name: str, code: str) -> tuple[int, dict[str, object]]:
    answer = world.client.post("/api/v1/organizations", json={"name": name, "code": code})
    return answer.status_code, dict(answer.json())


def test_code_from_name() -> None:
    assert address.from_name("Severny Veter") == "severny-veter"
    assert address.from_name("Северный ветер") == "severnyy-veter"
    assert address.from_name("  Café & Co.  ") == "cafe-co"
    assert len(address.from_name("x" * 100)) == 63


@pytest.mark.parametrize("code", ["a", "-ab", "ab-", "AB", "a_b", "api", "sign-in", "w", "x" * 64])
def test_codes_not_allowed(code: str) -> None:
    assert not address.allowed(code)


def test_check_says_free_taken_or_not_allowed(world: World) -> None:
    assert check(world, "severny-veter") == {"state": "free", "bad_chars": [], "suggestions": []}
    assert check(world, "Severny Veter!") == {
        "state": "not_allowed",
        "bad_chars": ["S", " ", "V", "!"],
        "suggestions": [],
    }
    assert check(world, "admin")["state"] == "not_allowed"
    assert register(world, "Severny Veter", "severny-veter") == (200, {"code": "severny-veter"})
    taken = check(world, "severny-veter", "Severny Veter")
    assert taken["state"] == "taken" and taken["suggestions"] == ["severny-veter-team", "severny-veter-hq"]


def test_register_creates_the_organization_and_its_administrator(world: World) -> None:
    assert register(world, "Severny Veter", "severny-veter")[0] == 200
    me = world.client.get("/api/v1/me").json()
    assert me["organizations"] == [{"code": "severny-veter", "name": "Severny Veter", "is_admin": True}]
    opened = world.client.get("/api/v1/organizations/severny-veter").json()
    assert {k: v for k, v in opened.items() if k != "tree"} == {
        "code": "severny-veter", "name": "Severny Veter", "user": {"name": "Anna", "is_admin": True}, "owners": [], "dependencies": {}, "histories": {}
    }
    assert [node["name"] for node in opened["tree"]] == ["core:settings", "core:settings.plugins"]
    assert len(world.storage.versions["organization_versions"]) == len(world.storage.versions["user_versions"]) == 1
    assert world.logger.events().count("OrganizationRegisteredEvent") == 1


def test_taken_code_is_refused_with_suggestions(world: World) -> None:
    register(world, "Severny Veter", "severny-veter")
    status, body = register(world, "Severny Veter", "severny-veter")
    assert status == 409 and body["error"] == "taken" and len(body["suggestions"]) == 2  # type: ignore[arg-type]
    assert len(world.storage.tables["organization"]) == 1


def test_the_loser_of_a_race_is_told_and_nothing_of_theirs_is_created(world: World) -> None:
    register(world, "Severny Veter", "severny-veter")
    world.storage.uncommitted_codes.add("severny-veter")
    status, body = register(world, "Severny Veter", "severny-veter")
    assert status == 409 and body["error"] == "taken" and body["moment"] is True
    assert len(world.storage.tables["organization"]) == 1 and len(world.storage.tables['"user"']) == 1
    assert "AddressCodeLostRaceEvent" in world.logger.events()


def test_code_not_allowed_is_refused(world: World) -> None:
    assert register(world, "X", "Bad Code") == (422, {"error": "not_allowed", "bad_chars": ["B", " ", "C"]})


def test_the_eleventh_organization_is_refused(world: World) -> None:
    for n in range(10):
        assert register(world, f"Org {n}", f"org-{n}")[0] == 200
    assert register(world, "Org 10", "org-10") == (409, {"error": "limit", "limit": 10})
    assert len(world.storage.tables["organization"]) == 10


def test_a_foreign_organization_and_a_made_up_code_answer_alike(world: World) -> None:
    register(world, "Severny Veter", "severny-veter")
    world.client.cookies.clear()
    world.signed(world.sign_up(email="bob@example.com", name="Bob"))
    foreign = world.client.get("/api/v1/organizations/severny-veter")
    made_up = world.client.get(f"/api/v1/organizations/x-{uuid.uuid4().hex[:8]}")
    assert foreign.status_code == made_up.status_code == 404
    assert foreign.json() == made_up.json() == {"error": "not_found"}
    assert world.logger.events().count("ForeignOrganizationRefusedEvent") == 2


def test_organizations_need_a_session(world: World) -> None:
    world.client.cookies.clear()
    assert world.client.get("/api/v1/organizations/severny-veter").status_code == 401
    assert world.client.post("/api/v1/organizations", json={"name": "A", "code": "aa"}).status_code == 401
