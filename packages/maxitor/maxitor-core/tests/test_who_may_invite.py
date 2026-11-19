# packages/maxitor/maxitor-core/tests/test_who_may_invite.py
"""
Who may invite (spec 086, phase 3): any user at registration, changed only by an administrator, checked on every
invitation, and a switch to administrators withdrawing what ordinary users sent.
"""

from __future__ import annotations

from typing import Any

import pytest

from tests.fakes import World

CODE = "severny-veter"
PASSWORD = "CorrectHorse!42"


@pytest.fixture
def world() -> World:
    w = World()
    w.signed(w.sign_up())
    assert w.client.post("/api/v1/organizations", json={"name": "Severny Veter", "code": CODE}).status_code == 200
    return w


def invite(world: World, email: str, is_admin: bool = False) -> tuple[int, dict[str, Any]]:
    answer = world.client.post("/api/v1/organizations/invitations", json={"code": CODE, "email": email, "is_admin": is_admin})
    return answer.status_code, dict(answer.json())


def switch(world: World, value: str) -> tuple[int, dict[str, Any]]:
    answer = world.client.post("/api/v1/organizations/settings/who-may-invite", json={"code": CODE, "who_may_invite": value})
    return answer.status_code, dict(answer.json())


def sign_in_as(world: World, email: str) -> None:
    world.client.cookies.clear()
    token = world.client.post("/api/v1/sign-in/password", json={"email": email, "password": PASSWORD}).json()["session_token"]
    world.signed(token)


def join(world: World, email: str, name: str, is_admin: bool = False) -> None:
    """Anna invites ``email``; a new account with it accepts; the session is the new user's."""
    _, body = invite(world, email, is_admin)
    world.client.cookies.clear()
    world.signed(world.sign_up(email=email, name=name))
    assert world.client.post("/api/v1/invitations/accept", json={"invitation_id": body["invitation"]["id"]}).status_code == 200


def test_a_new_organization_lets_any_user_invite(world: World) -> None:
    settings = world.client.get(f"/api/v1/organizations/{CODE}/settings").json()
    assert settings["who_may_invite"] == "any_user" and settings["invitation_days"] == 14
    assert settings["pending_by_users"] == [] and settings["name"] == "Severny Veter"


def test_only_an_administrator_reads_or_changes_the_setting(world: World) -> None:
    join(world, "oleg@example.com", "Oleg")
    assert world.client.get(f"/api/v1/organizations/{CODE}/settings").status_code == 404
    assert switch(world, "administrators")[0] == 404
    assert world.storage.tables["organization"][0]["who_may_invite"] == "any_user"


def test_the_setting_is_checked_on_every_invitation(world: World) -> None:
    join(world, "oleg@example.com", "Oleg")
    assert invite(world, "maria@example.com")[0] == 200
    assert world.client.get(f"/api/v1/organizations/{CODE}").json()["user"]["may_invite"] is True
    sign_in_as(world, "anna@example.com")
    assert switch(world, "administrators")[0] == 200
    sign_in_as(world, "oleg@example.com")
    assert invite(world, "kirill@example.com") == (403, {"error": "administrators_only"})
    opened = world.client.get(f"/api/v1/organizations/{CODE}").json()
    assert opened["who_may_invite"] == "administrators" and opened["user"]["may_invite"] is False
    assert "InvitationRefusedEvent" in world.logger.events()


def test_switching_to_administrators_withdraws_what_ordinary_users_sent(world: World) -> None:
    _, by_anna = invite(world, "dmitry@example.com")
    join(world, "oleg@example.com", "Oleg")
    _, by_oleg = invite(world, "kirill@example.com")
    sign_in_as(world, "anna@example.com")
    settings = world.client.get(f"/api/v1/organizations/{CODE}/settings").json()
    assert [i["email"] for i in settings["pending_by_users"]] == ["kirill@example.com"]
    status, body = switch(world, "administrators")
    assert status == 200 and body["who_may_invite"] == "administrators"
    assert [i["id"] for i in body["withdrawn"]] == [by_oleg["invitation"]["id"]]
    withdrawn = body["withdrawn"][0]
    assert withdrawn["state"] == "withdrawn" and withdrawn["by_setting"] is True
    assert withdrawn["decided_by"]["name"] == "Anna" and withdrawn["decided_at"] is not None
    rows = {r["id"]: r for r in world.storage.tables["invitation"]}
    assert rows[by_anna["invitation"]["id"]]["status"] == "sent"
    assert rows[by_oleg["invitation"]["id"]]["status"] == "withdrawn"
    assert next(u for u in world.storage.tables['"user"'] if u["name"] == "Oleg")["status"] == "active"
    assert world.logger.events().count("InvitationWithdrawnEvent") == 1
    assert world.logger.events()[-1] == "WhoMayInviteChangedEvent"
    assert len([v for v in world.storage.versions["organization_versions"]]) == 2
    # Back to any user: nothing is restored.
    assert switch(world, "any_user") == (200, {"who_may_invite": "any_user", "withdrawn": []})
    assert rows[by_oleg["invitation"]["id"]]["status"] == "withdrawn"


def test_an_administrators_invitation_survives_the_switch_and_a_withdrawn_one_cannot_be_accepted(world: World) -> None:
    join(world, "oleg@example.com", "Oleg")
    _, by_oleg = invite(world, "kirill@example.com")
    sign_in_as(world, "anna@example.com")
    _, by_anna = invite(world, "elena@example.com", is_admin=True)
    switch(world, "administrators")
    world.client.cookies.clear()
    world.signed(world.sign_up(email="kirill@example.com", name="Kirill"))
    assert world.client.get("/api/v1/invitations").json() == {"invitations": []}
    assert world.client.post("/api/v1/invitations/accept", json={"invitation_id": by_oleg["invitation"]["id"]}).status_code == 404
    world.client.cookies.clear()
    world.signed(world.sign_up(email="elena@example.com", name="Elena"))
    assert world.client.post("/api/v1/invitations/accept", json={"invitation_id": by_anna["invitation"]["id"]}).json() == {"code": CODE}


def test_an_administrator_sees_the_organization_node(world: World) -> None:
    tree = [node["name"] for node in world.client.get(f"/api/v1/organizations/{CODE}").json()["tree"]]
    assert "core:settings.organization" in tree
    join(world, "oleg@example.com", "Oleg")
    tree = [node["name"] for node in world.client.get(f"/api/v1/organizations/{CODE}").json()["tree"]]
    assert "core:settings" not in tree and "core:settings.organization" not in tree
