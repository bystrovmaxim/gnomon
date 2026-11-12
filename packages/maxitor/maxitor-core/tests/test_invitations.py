# packages/maxitor/maxitor-core/tests/test_invitations.py
"""
Invitations (spec 086, phase 2): sending with the mark, the letter, every refusal, the limits, sending again, what
an account sees by its confirmed emails, accepting, declining, expiry and a removed person invited again.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from maxitor.core.actions import account, invitation_choice, invitations

from tests.fakes import World

CODE = "severny-veter"


class Clock:
    """The time the actions and the storage see; a test moves it forward."""

    def __init__(self, world: World) -> None:
        self.at = datetime.now(UTC)
        self.world = world
        world.storage.clock = self.at

    def now(self) -> datetime:
        return self.at

    def advance(self, delta: timedelta) -> None:
        self.at += delta
        self.world.storage.clock = self.at


@pytest.fixture
def world(monkeypatch: pytest.MonkeyPatch) -> World:
    w = World()
    clock = Clock(w)
    for module in (invitations, invitation_choice, account):
        monkeypatch.setattr(module, "now", clock.now)
    w.clock = clock  # type: ignore[attr-defined]
    w.signed(w.sign_up())
    assert w.client.post("/api/v1/organizations", json={"name": "Severny Veter", "code": CODE}).status_code == 200
    return w


def advance(world: World, delta: timedelta) -> None:
    world.clock.advance(delta)  # type: ignore[attr-defined]


def invite(world: World, email: str, is_admin: bool = False) -> tuple[int, dict[str, Any]]:
    answer = world.client.post("/api/v1/organizations/invitations", json={"code": CODE, "email": email, "is_admin": is_admin})
    return answer.status_code, dict(answer.json())


def as_new_account(world: World, email: str, name: str = "Dmitry") -> None:
    """Sign out and sign up a second account with ``email``."""
    world.client.cookies.clear()
    world.signed(world.sign_up(email=email, name=name))


def test_an_administrator_invites_and_the_letter_holds_no_link(world: World) -> None:
    status, body = invite(world, "Dmitry.Krotov@partner-stroy.ru")
    assert status == 200
    invitation = body["invitation"]
    assert invitation["email"] == "dmitry.krotov@partner-stroy.ru"
    assert invitation["state"] == "sent" and invitation["is_admin"] is False
    assert invitation["invited_by"]["name"] == "Anna" and invitation["decided_at"] is None
    letter = world.mail.letters[-1]
    assert letter.to == "dmitry.krotov@partner-stroy.ru"
    assert letter.subject == "Anna invites you to Severny Veter on Maxitor"
    assert "Severny Veter" in letter.text and "anna@example.com" in letter.text
    assert "http" not in letter.text and "href" not in letter.html
    assert "waits until" in letter.text
    assert len(world.storage.versions["invitation_versions"]) == 1
    assert world.logger.events()[-1] == "InvitationSentEvent"


def test_the_invitation_waits_the_configured_days(world: World) -> None:
    _, body = invite(world, "d@example.com")
    row = world.storage.tables["invitation"][0]
    assert row["expires_at"] - row["sent_at"] == timedelta(days=14)
    assert body["invitation"]["expires_at"].startswith(row["expires_at"].strftime("%Y-%m-%d"))


def test_an_administrator_may_send_the_mark_and_an_ordinary_user_may_not(world: World) -> None:
    assert invite(world, "elena@example.com", is_admin=True)[1]["invitation"]["is_admin"] is True
    _, body = invite(world, "oleg@example.com")
    as_new_account(world, "oleg@example.com", "Oleg")
    assert world.client.post("/api/v1/invitations/accept", json={"invitation_id": body['invitation']['id']}).json() == {"code": CODE}
    status, refused = invite(world, "kirill@example.com", is_admin=True)
    assert (status, refused) == (403, {"error": "administrator_mark"})
    assert "InvitationRefusedEvent" in world.logger.events()
    assert invite(world, "kirill@example.com")[0] == 200
    assert world.client.get(f"/api/v1/organizations/{CODE}").json()["user"] == {"name": "Oleg", "is_admin": False, "may_invite": True}


def test_a_person_already_there_is_refused_blocked_or_active(world: World) -> None:
    status, body = invite(world, "anna@example.com")
    assert (status, body["error"], body["name"], body["state"]) == (409, "already_user", "Anna", "active")
    assert body["user_id"] == world.storage.tables['"user"'][0]["id"]
    assert len(world.storage.tables["invitation"]) == 0


def test_an_invitation_still_sent_is_refused_and_its_letter_may_go_again(world: World) -> None:
    _, first = invite(world, "d@example.com")
    status, body = invite(world, "D@example.com")
    assert (status, body) == (409, {"error": "already_invited", "invitation_id": first["invitation"]["id"]})
    advance(world, timedelta(minutes=2))
    again = world.client.post("/api/v1/organizations/invitations/resend", json={"code": CODE, "invitation_id": first['invitation']['id']})
    assert again.status_code == 200 and again.json()["invitation"]["state"] == "sent"
    assert len(world.mail.letters) == 3  # the sign-up's code, the invitation, the letter again
    assert again.json()["invitation"]["letter_sent_at"] > first["invitation"]["letter_sent_at"]
    assert again.json()["invitation"]["expires_at"] == first["invitation"]["expires_at"]
    assert "InvitationLetterSentAgainEvent" in world.logger.events()


def test_a_second_letter_within_a_minute_is_refused_by_the_address_limit(world: World) -> None:
    _, first = invite(world, "d@example.com")
    again = world.client.post("/api/v1/organizations/invitations/resend", json={"code": CODE, "invitation_id": first['invitation']['id']})
    assert again.status_code == 429
    assert again.json()["error"] == "too_many_invitations" and again.json()["limit"] == "address per minute"
    assert "InvitationLimitReachedEvent" in world.logger.events()


def test_the_inviter_sends_at_most_thirty_an_hour(world: World) -> None:
    for n in range(30):
        assert invite(world, f"p{n}@example.com")[0] == 200
    status, body = invite(world, "p30@example.com")
    assert status == 429 and body["limit"] == "inviter per hour"
    assert len(world.storage.tables["invitation"]) == 30


def test_a_letter_that_does_not_go_leaves_no_invitation(world: World) -> None:
    world.mail.fail = True
    assert invite(world, "d@example.com") == (503, {"error": "mail_not_sent"})
    assert world.storage.tables["invitation"] == [] and world.storage.tables["invitation_letter"] == []
    assert "LetterNotSentEvent" in world.logger.events()


def test_only_an_account_with_the_invited_email_sees_the_invitation(world: World) -> None:
    _, body = invite(world, "Dmitry@example.com")
    as_new_account(world, "nobody@example.com", "Nobody")
    assert world.client.get("/api/v1/invitations").json() == {"invitations": []}
    assert world.client.get("/api/v1/me").json()["invitations_waiting"] == 0
    assert world.client.post("/api/v1/invitations/accept", json={"invitation_id": body['invitation']['id']}).status_code == 404
    as_new_account(world, "dmitry@example.com")
    waiting = world.client.get("/api/v1/invitations").json()["invitations"]
    assert [w["organization"] for w in waiting] == [{"code": CODE, "name": "Severny Veter"}]
    assert waiting[0]["invited_by_name"] == "Anna" and waiting[0]["is_admin"] is False
    assert world.client.get("/api/v1/me").json()["invitations_waiting"] == 1


def test_accepting_makes_an_active_user_named_as_the_account(world: World) -> None:
    _, body = invite(world, "dmitry@example.com", is_admin=True)
    as_new_account(world, "dmitry@example.com")
    assert world.client.post("/api/v1/invitations/accept", json={"invitation_id": body['invitation']['id']}).json() == {"code": CODE}
    me = world.client.get("/api/v1/me").json()
    assert me["organizations"] == [{"code": CODE, "name": "Severny Veter", "is_admin": True}]
    assert me["invitations_waiting"] == 0
    user = next(u for u in world.storage.tables['"user"'] if u["name"] == "Dmitry")
    assert user["status"] == "active" and user["is_admin"] is True
    row = world.storage.tables["invitation"][0]
    assert row["status"] == "accepted" and row["accepted_user_id"] == user["id"] and row["decided_at"] is not None
    assert world.logger.events()[-1] == "InvitationAcceptedEvent"
    opened = world.client.get(f"/api/v1/organizations/{CODE}").json()
    assert opened["user"] == {"name": "Dmitry", "is_admin": True, "may_invite": True}


def test_accepting_twice_or_after_declining_is_refused_alike(world: World) -> None:
    _, body = invite(world, "dmitry@example.com")
    as_new_account(world, "dmitry@example.com")
    chosen = {"invitation_id": body["invitation"]["id"]}
    assert world.client.post("/api/v1/invitations/decline", json=chosen).json() == {"declined": True}
    assert world.storage.tables["invitation"][0]["status"] == "declined"
    assert world.client.post("/api/v1/invitations/accept", json=chosen).status_code == 404
    assert world.client.get("/api/v1/me").json()["organizations"] == []
    assert "InvitationDeclinedEvent" in world.logger.events()


def test_the_policy_is_accepted_before_the_invitation(world: World) -> None:
    _, body = invite(world, "dmitry@example.com")
    as_new_account(world, "dmitry@example.com")
    account = next(a for a in world.storage.tables["account"] if a["email"] == "dmitry@example.com")
    account["policy_version"] = 0
    answer = world.client.post("/api/v1/invitations/accept", json={"invitation_id": body['invitation']['id']})
    assert (answer.status_code, answer.json()) == (403, {"error": "policy"})
    assert world.client.post("/api/v1/session/accept-policy", json={"accepted": True}).status_code == 200
    assert world.client.post("/api/v1/invitations/accept", json={"invitation_id": body['invitation']['id']}).status_code == 200


def test_an_invitation_expires_by_its_time_and_a_new_one_may_be_sent(world: World) -> None:
    _, body = invite(world, "dmitry@example.com")
    as_new_account(world, "dmitry@example.com")
    advance(world, timedelta(days=15))
    assert world.client.get("/api/v1/invitations").json() == {"invitations": []}
    assert world.client.post("/api/v1/invitations/accept", json={"invitation_id": body['invitation']['id']}).status_code == 404
    world.client.cookies.clear()
    world.signed(world.client.post("/api/v1/sign-in/password", json={"email": "anna@example.com", "password": "CorrectHorse!42"}).json()["session_token"])
    mine = world.client.get(f"/api/v1/organizations/{CODE}/invitations/mine").json()["invitations"]
    assert mine[0]["state"] == "expired"
    assert invite(world, "dmitry@example.com")[0] == 200
    assert [i["status"] for i in world.storage.tables["invitation"]] == ["expired", "sent"]
    assert "InvitationExpiredEvent" in world.logger.events()


def test_a_removed_person_is_invited_again_as_a_new_user(world: World) -> None:
    _, body = invite(world, "dmitry@example.com")
    as_new_account(world, "dmitry@example.com")
    world.client.post("/api/v1/invitations/accept", json={"invitation_id": body['invitation']['id']})
    user = next(u for u in world.storage.tables['"user"'] if u["name"] == "Dmitry")
    user["status"] = "removed"
    advance(world, timedelta(minutes=2))
    world.client.cookies.clear()
    world.signed(world.client.post("/api/v1/sign-in/password", json={"email": "anna@example.com", "password": "CorrectHorse!42"}).json()["session_token"])
    _, second = invite(world, "dmitry@example.com")
    world.client.cookies.clear()
    world.signed(world.client.post("/api/v1/sign-in/password", json={"email": "dmitry@example.com", "password": "CorrectHorse!42"}).json()["session_token"])
    assert world.client.post("/api/v1/invitations/accept", json={"invitation_id": second['invitation']['id']}).json() == {"code": CODE}
    users = [u for u in world.storage.tables['"user"'] if u["name"] == "Dmitry"]
    assert [u["status"] for u in users] == ["removed", "active"] and users[0]["id"] != users[1]["id"]


def test_the_mine_list_and_a_stranger_answer_alike_for_a_made_up_organization(world: World) -> None:
    assert world.client.get("/api/v1/organizations/orbita/invitations/mine").status_code == 404
    assert world.client.post("/api/v1/organizations/invitations", json={"code": "orbita", "email": "d@example.com"}).status_code == 404
    world.client.cookies.clear()
    assert world.client.get("/api/v1/invitations").status_code == 401
