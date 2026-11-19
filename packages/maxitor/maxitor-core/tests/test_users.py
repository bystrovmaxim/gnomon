# packages/maxitor/maxitor-core/tests/test_users.py
"""
Managing users (spec 086, phase 4): the list with its fields, each move of the lifecycle with who and when, the mark
only while active, the last active administrator kept — also when two step down at once —, a blocked user refused
on the next request, no way to remove a user, and withdrawing an invitation.
"""

from __future__ import annotations

from typing import Any

import pytest
from maxitor.core.entities import UserLifecycle

from tests.fakes import World

CODE = "severny-veter"
PASSWORD = "CorrectHorse!42"


@pytest.fixture
def world() -> World:
    w = World()
    w.signed(w.sign_up())
    assert w.client.post("/api/v1/organizations", json={"name": "Severny Veter", "code": CODE}).status_code == 200
    return w


def invite(world: World, email: str, is_admin: bool = False) -> dict[str, Any]:
    answer = world.client.post("/api/v1/organizations/invitations", json={"code": CODE, "email": email, "is_admin": is_admin})
    assert answer.status_code == 200, answer.text
    return dict(answer.json()["invitation"])


def sign_in_as(world: World, email: str) -> None:
    world.client.cookies.clear()
    token = world.client.post("/api/v1/sign-in/password", json={"email": email, "password": PASSWORD}).json()["session_token"]
    world.signed(token)


def join(world: World, email: str, name: str, is_admin: bool = False) -> str:
    """The signed-in administrator invites ``email``; a new account accepts; the session is the inviter's again. Answers the user id."""
    inviter = world.client.get("/api/v1/me").json()["email"]
    invitation = invite(world, email, is_admin)
    world.client.cookies.clear()
    world.signed(world.sign_up(email=email, name=name))
    assert world.client.post("/api/v1/invitations/accept", json={"invitation_id": invitation["id"]}).status_code == 200
    sign_in_as(world, inviter)
    return str(next(u for u in world.storage.tables['"user"'] if u["name"] == name)["id"])


def users(world: World) -> dict[str, dict[str, Any]]:
    answer = world.client.get(f"/api/v1/organizations/{CODE}/users")
    assert answer.status_code == 200, answer.text
    return {u["name"]: u for u in answer.json()["users"]}


def act(world: World, verb: str, user_id: str, **more: Any) -> tuple[int, dict[str, Any]]:
    answer = world.client.post(f"/api/v1/organizations/users/{verb}", json={"code": CODE, "user_id": user_id, **more})
    return answer.status_code, dict(answer.json())


def test_the_list_names_every_user_and_how_they_appeared(world: World) -> None:
    oleg = join(world, "oleg@example.com", "Oleg")
    listed = users(world)
    assert listed["Anna"]["appeared"] == "registered" and listed["Anna"]["invited_by"] is None
    assert listed["Anna"]["is_admin"] is True and listed["Anna"]["state"] == "active"
    assert listed["Oleg"]["id"] == oleg and listed["Oleg"]["appeared"] == "invited"
    assert listed["Oleg"]["invited_by"]["name"] == "Anna" and listed["Oleg"]["email"] == "oleg@example.com"
    assert listed["Oleg"]["last_sign_in_at"] is not None
    answer = world.client.get(f"/api/v1/organizations/{CODE}/users").json()
    assert [i["state"] for i in answer["invitations"]] == ["accepted"]
    assert answer["invitations"][0]["accepted_user"]["name"] == "Oleg"


def test_only_an_administrator_sees_the_page(world: World) -> None:
    join(world, "oleg@example.com", "Oleg")
    sign_in_as(world, "oleg@example.com")
    assert world.client.get(f"/api/v1/organizations/{CODE}/users").status_code == 404
    assert act(world, "block", "whoever")[0] == 404


def test_block_and_unblock_follow_the_lifecycle_with_who_and_when(world: World) -> None:
    oleg = join(world, "oleg@example.com", "Oleg")
    status, body = act(world, "block", oleg)
    assert status == 200 and body["user"]["state"] == "blocked" and body["user"]["changed_by"]["name"] == "Anna"
    assert act(world, "block", oleg) == (409, {"error": "not_active", "state": "blocked"})
    assert act(world, "administrator", oleg, is_admin=True) == (409, {"error": "not_active", "state": "blocked"})
    assert act(world, "unblock", oleg)[1]["user"]["state"] == "active"
    assert act(world, "unblock", oleg) == (409, {"error": "not_blocked", "state": "active"})
    states = [v["status"] for v in world.storage.versions["user_versions"] if v["name"] == "Oleg"]
    assert states == ["active", "blocked", "active"]
    assert world.logger.events().count("UserStateChangedEvent") == 2
    assert users(world)["Oleg"]["state"] == "active"


def test_removed_is_terminal_in_the_declared_lifecycle_only() -> None:
    active = UserLifecycle("active")
    assert active.get_initial_keys() == {"active"}
    assert active.get_final_keys() == {"removed"}
    blocked = active.transition("blocked")
    assert blocked.transition("active").current_state == "active"
    # AOA requires a path to a final state in the graph; application actions never take this edge.
    removed = blocked.transition("removed")
    assert removed.is_final and removed.available_transitions == set()


@pytest.mark.parametrize("blocked", [False, True], ids=["active", "blocked"])
def test_a_user_cannot_be_removed(world: World, blocked: bool) -> None:
    oleg = join(world, "oleg@example.com", "Oleg")
    if blocked:
        assert act(world, "block", oleg)[0] == 200
    before = users(world)["Oleg"]
    version_count = len(world.storage.versions["user_versions"])
    response = world.client.post("/api/v1/organizations/users/remove", json={"code": CODE, "user_id": oleg})
    assert response.status_code in (404, 405)
    assert users(world)["Oleg"] == before
    assert len(world.storage.versions["user_versions"]) == version_count


@pytest.mark.parametrize("verb", ["block", "unblock"])
def test_a_client_cannot_choose_the_terminal_state(world: World, verb: str) -> None:
    oleg = join(world, "oleg@example.com", "Oleg")
    if verb == "unblock":
        assert act(world, "block", oleg)[0] == 200
    before = users(world)["Oleg"]
    version_count = len(world.storage.versions["user_versions"])
    status, _ = act(world, verb, oleg, status="removed", state="removed")
    assert status == 422
    assert users(world)["Oleg"] == before
    assert len(world.storage.versions["user_versions"]) == version_count


def test_a_blocked_user_is_a_stranger_from_the_next_request(world: World) -> None:
    oleg = join(world, "oleg@example.com", "Oleg")
    act(world, "block", oleg)
    sign_in_as(world, "oleg@example.com")
    assert world.client.get(f"/api/v1/organizations/{CODE}").status_code == 404
    assert world.client.get("/api/v1/me").json()["organizations"] == []
    sign_in_as(world, "anna@example.com")
    act(world, "unblock", oleg)
    sign_in_as(world, "oleg@example.com")
    assert world.client.get(f"/api/v1/organizations/{CODE}").status_code == 200


def test_the_mark_is_appointed_and_dismissed_and_the_last_administrator_kept(world: World) -> None:
    oleg = join(world, "oleg@example.com", "Oleg")
    anna = users(world)["Anna"]["id"]
    assert act(world, "administrator", anna, is_admin=False) == (409, {"error": "last_administrator"})
    assert act(world, "block", anna) == (409, {"error": "last_administrator"})
    assert world.logger.events().count("LastAdministratorKeptEvent") == 2
    assert act(world, "administrator", oleg, is_admin=True)[1]["user"]["is_admin"] is True
    assert "AdministratorChangedEvent" in world.logger.events()
    assert act(world, "administrator", anna, is_admin=False)[1]["user"]["is_admin"] is False
    # Anna is an ordinary user now: Settings is not hers.
    assert world.client.get(f"/api/v1/organizations/{CODE}/users").status_code == 404
    sign_in_as(world, "oleg@example.com")
    assert act(world, "administrator", oleg, is_admin=False) == (409, {"error": "last_administrator"})


def test_two_administrators_stepping_down_at_once_leave_exactly_one(world: World) -> None:
    oleg = join(world, "oleg@example.com", "Oleg", is_admin=True)
    anna = users(world)["Anna"]["id"]
    # Both requests reach the organization's lock at the same moment; the lock orders them: the first goes through.
    sign_in_as(world, "oleg@example.com")
    assert act(world, "administrator", oleg, is_admin=False)[0] == 200
    sign_in_as(world, "anna@example.com")
    assert act(world, "administrator", anna, is_admin=False) == (409, {"error": "last_administrator"})
    assert sum(1 for u in world.storage.tables['"user"'] if u["is_admin"] and u["status"] == "active") == 1


def test_an_administrator_withdraws_an_invitation(world: World) -> None:
    invitation = invite(world, "dmitry@example.com")
    answer = world.client.post("/api/v1/organizations/invitations/withdraw", json={"code": CODE, "invitation_id": invitation["id"]})
    assert answer.status_code == 200
    withdrawn = answer.json()["invitation"]
    assert withdrawn["state"] == "withdrawn" and withdrawn["decided_by"]["name"] == "Anna" and withdrawn["by_setting"] is False
    again = world.client.post("/api/v1/organizations/invitations/withdraw", json={"code": CODE, "invitation_id": invitation["id"]})
    assert again.status_code == 409 and again.json()["error"] == "not_sent"
    join(world, "oleg@example.com", "Oleg")
    sign_in_as(world, "oleg@example.com")
    mine = invite(world, "kirill@example.com")
    answer = world.client.post("/api/v1/organizations/invitations/withdraw", json={"code": CODE, "invitation_id": mine["id"]})
    assert answer.status_code == 404
    assert "InvitationWithdrawnEvent" in world.logger.events()


def test_job_title_is_copied_on_acceptance_versioned_and_independent_of_permissions(world: World) -> None:
    inviter = world.client.get('/api/v1/me').json()['email']
    answer = world.client.post('/api/v1/organizations/invitations', json={
        'code': CODE, 'email': 'title@example.com', 'job_title': 'Project manager',
    })
    assert answer.status_code == 200, answer.text
    invitation = answer.json()['invitation']
    assert invitation['job_title'] == 'Project manager'
    world.client.cookies.clear()
    world.signed(world.sign_up(email='title@example.com', name='Title Person'))
    assert world.client.post('/api/v1/invitations/accept', json={'invitation_id': invitation['id']}).status_code == 200
    user_id = next(u['id'] for u in world.storage.tables['"user"'] if u['name'] == 'Title Person')
    assert act(world, 'job-title', user_id, job_title='Director')[0] == 404
    sign_in_as(world, inviter)
    assert users(world)['Title Person']['job_title'] == 'Project manager'
    status, result = act(world, 'job-title', user_id, job_title='  Director  ')
    assert status == 200, result
    assert result['user']['job_title'] == 'Director'
    assert result['user']['is_admin'] is False
    versions = [v for v in world.storage.versions['user_versions'] if v['id'] == user_id]
    assert [v.get('job_title') for v in versions] == ['Project manager', 'Director']
    assert world.storage.tables['invitation'][0]['job_title'] == 'Project manager'
    assert act(world, 'job-title', user_id, job_title='x' * 161)[0] == 422
    assert act(world, 'job-title', user_id, job_title='')[1]['user']['job_title'] is None
    assert act(world, 'job-title', 'another-organization-user', job_title='Director')[0] == 404


def test_invitation_title_length_is_validated_before_sending(world: World) -> None:
    answer = world.client.post('/api/v1/organizations/invitations', json={
        'code': CODE, 'email': 'title@example.com', 'job_title': 'x' * 161,
    })
    assert answer.status_code == 422
    assert world.storage.tables['invitation'] == []
