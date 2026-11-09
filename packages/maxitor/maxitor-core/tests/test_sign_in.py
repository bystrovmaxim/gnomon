# packages/maxitor/maxitor-core/tests/test_sign_in.py
"""
Signing in, through the core's addresses: by email and password, with a provider, the session and the ways in.
"""

from __future__ import annotations

import json
from datetime import timedelta

import pytest
from maxitor.core.gateways.providers import ProviderPerson

from tests.fakes import World

PASSWORD = "CorrectHorse!42"


@pytest.fixture
def world() -> World:
    return World()


def test_options_follow_the_region(world: World) -> None:
    world.geo.country = None
    assert world.client.get("/api/v1/sign-in/options").json() == {
        "region": "russia",
        "email": True,
        "providers": ["yandex", "mailru"],
    }
    world.geo.country = "RU"
    assert world.client.get("/api/v1/sign-in/options").json()["providers"] == ["yandex", "mailru"]
    world.geo.country = "DE"
    assert world.client.get("/api/v1/sign-in/options").json() == {
        "region": "abroad",
        "email": True,
        "providers": ["google", "github", "facebook", "yandex", "mailru"],
    }


def test_sign_up_confirm_and_create(world: World) -> None:
    token = world.sign_up()
    world.signed(token)
    me = world.client.get("/api/v1/me").json()
    assert me["email"] == "anna@example.com" and me["policy_current"] is True and me["organizations"] == []
    assert world.logger.events() == ["CodeSentEvent", "AccountCreatedEvent"]


def test_an_address_that_is_not_an_ip_is_kept_as_unknown(world: World) -> None:
    world.sign_up()
    assert world.storage.tables["sign_in_code"][0]["requested_ip"] == "0.0.0.0"
    assert world.storage.tables["account"][0]["policy_accepted_ip"] == "0.0.0.0"


def test_account_needs_the_tick(world: World) -> None:
    world.client.post("/api/v1/sign-up", json={"email": "a@example.com", "password": PASSWORD})
    consent = world.client.post(
        "/api/v1/sign-up/confirm", json={"email": "a@example.com", "code": world.mail.last_code()}
    ).json()["consent_token"]
    answer = world.client.post("/api/v1/account", json={"consent_token": consent, "name": "A", "accepted": False})
    assert answer.status_code == 422 and answer.json() == {"error": "consent_required"}
    assert world.storage.tables["account"] == []


def test_weak_password_is_refused_before_a_letter(world: World) -> None:
    answer = world.client.post("/api/v1/sign-up", json={"email": "a@example.com", "password": "password1"})
    assert answer.status_code == 422 and answer.json()["error"] == "password_rule"
    assert world.mail.letters == []


def test_second_code_within_a_minute_is_refused(world: World) -> None:
    assert (
        world.client.post("/api/v1/sign-up", json={"email": "a@example.com", "password": PASSWORD}).status_code == 200
    )
    answer = world.client.post("/api/v1/sign-up", json={"email": "a@example.com", "password": PASSWORD})
    assert answer.status_code == 429 and answer.json()["error"] == "too_many_codes"
    assert "CodeLimitReachedEvent" in world.logger.events()


def test_wrong_code_counts_down_and_used_up(world: World) -> None:
    world.client.post("/api/v1/sign-up", json={"email": "a@example.com", "password": PASSWORD})
    right = world.mail.last_code()
    wrong = "000000" if right != "000000" else "111111"
    answers = [
        world.client.post("/api/v1/sign-up/confirm", json={"email": "a@example.com", "code": wrong}).json()
        for _ in range(5)
    ]
    assert [a.get("tries_left") for a in answers[:4]] == [4, 3, 2, 1]
    assert answers[4] == {"error": "used_up"}
    late = world.client.post("/api/v1/sign-up/confirm", json={"email": "a@example.com", "code": right})
    assert late.status_code == 400 and late.json() == {"error": "expired"}


def test_mail_failure_is_a_503_and_a_critical_event(world: World) -> None:
    world.mail.fail = True
    answer = world.client.post("/api/v1/sign-up", json={"email": "a@example.com", "password": PASSWORD})
    assert answer.status_code == 503 and answer.json() == {"error": "mail_not_sent"}
    assert "LetterNotSentEvent" in world.logger.events()


def test_wrong_password_and_unknown_email_answer_alike(world: World) -> None:
    world.sign_up()
    wrong = world.client.post(
        "/api/v1/sign-in/password", json={"email": "anna@example.com", "password": "Wrong-Password-1"}
    )
    unknown = world.client.post(
        "/api/v1/sign-in/password", json={"email": "nobody@example.com", "password": "Wrong-Password-1"}
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"error": "wrong"}


def test_right_password_signs_in(world: World) -> None:
    world.sign_up()
    answer = world.client.post("/api/v1/sign-in/password", json={"email": "Anna@Example.com", "password": PASSWORD})
    assert answer.status_code == 200 and answer.json()["session_token"]
    assert world.logger.events()[-1] == "SignedInEvent"


def test_ten_wrong_passwords_lock_the_address(world: World) -> None:
    world.sign_up()
    for _ in range(10):
        assert (
            world.client.post(
                "/api/v1/sign-in/password", json={"email": "anna@example.com", "password": "Wrong-Password-1"}
            ).status_code
            == 401
        )
    locked = world.client.post("/api/v1/sign-in/password", json={"email": "anna@example.com", "password": PASSWORD})
    assert locked.status_code == 429 and locked.json()["error"] == "too_many_passwords" and locked.json()["until"]


def test_reset_changes_the_password_and_ends_renewal(world: World) -> None:
    old_session = world.sign_up()
    for row in world.storage.tables["sign_in_code"]:
        row["created_at"] -= timedelta(minutes=2)
    assert world.client.post("/api/v1/password-reset", json={"email": "anna@example.com"}).json() == {"sent": True}
    code = world.mail.last_code()
    for row in world.storage.tables["sign_in"]:
        row["password_changed_at"] -= timedelta(seconds=5)
    changed = world.client.post(
        "/api/v1/password-reset/confirm",
        json={"email": "anna@example.com", "code": code, "password": "Another-Horse-77"},
    )
    assert changed.status_code == 200 and changed.json() == {"changed": True}
    assert "changed" in world.mail.letters[-1].subject.lower()
    assert (
        world.client.post(
            "/api/v1/sign-in/password", json={"email": "anna@example.com", "password": PASSWORD}
        ).status_code
        == 401
    )
    assert (
        world.client.post(
            "/api/v1/sign-in/password", json={"email": "anna@example.com", "password": "Another-Horse-77"}
        ).status_code
        == 200
    )
    renewal = world.client.post("/api/v1/session/renew", json={"session_token": old_session})
    assert renewal.status_code == 401 and renewal.json() == {"error": "password_changed"}


def test_reset_for_an_unknown_email_answers_alike_and_sends_nothing(world: World) -> None:
    answer = world.client.post("/api/v1/password-reset", json={"email": "nobody@example.com"})
    assert answer.status_code == 200 and answer.json() == {"sent": True}
    assert world.mail.letters == []


@pytest.mark.parametrize("provider", ["google", "github", "facebook"])
@pytest.mark.parametrize("country", ["RU", None])
def test_foreign_providers_are_refused_in_russia_at_start(world: World, provider: str, country: str | None) -> None:
    world.geo.country = country
    answer = world.client.post("/api/v1/sign-in/start", json={"provider": provider})
    assert answer.status_code == 403 and answer.json() == {"error": "region", "provider": provider}
    assert world.logger.events() == ["ProviderRefusedForRegionEvent"]


def test_region_is_checked_again_at_finish(world: World) -> None:
    world.geo.country = "DE"
    start = world.client.post("/api/v1/sign-in/start", json={"provider": "google"}).json()
    assert start["authorize_url"].startswith("https://accounts.google.com/")
    world.geo.country = "RU"
    finish = world.client.post(
        "/api/v1/sign-in/finish",
        json={
            "provider": "google",
            "code": "c",
            "state": start["state"],
            "expected_state": start["state"],
            "verifier": start["verifier"],
        },
    )
    assert finish.status_code == 403


def test_state_mismatch_is_refused(world: World) -> None:
    world.geo.country = "RU"
    world.providers["yandex"].person_answer = ProviderPerson(subject="y-1", email="anna@yandex.ru", name="Anna")
    answer = world.client.post(
        "/api/v1/sign-in/finish",
        json={"provider": "yandex", "code": "c", "state": "one", "expected_state": "two", "verifier": "v"},
    )
    assert answer.status_code == 401 and answer.json() == {"error": "state"}
    assert world.logger.events() == ["ProviderAnswerRejectedEvent"]


def test_provider_new_person_then_known_person(world: World) -> None:
    world.geo.country = "RU"
    world.providers["yandex"].person_answer = ProviderPerson(subject="y-1", email="Anna@Yandex.ru", name="Anna Y")
    body = {"provider": "yandex", "code": "c", "state": "s", "expected_state": "s", "verifier": "v"}
    first = world.client.post("/api/v1/sign-in/finish", json=body).json()
    assert first["session_token"] is None and first["name"] == "Anna Y" and first["consent_token"]
    created = world.client.post(
        "/api/v1/account", json={"consent_token": first["consent_token"], "name": "Anna Y", "accepted": True}
    )
    assert created.status_code == 200
    again = world.client.post("/api/v1/sign-in/finish", json=body).json()
    assert again["session_token"] and again["consent_token"] is None


def test_provider_without_email_for_a_new_person(world: World) -> None:
    world.geo.country = "DE"
    world.providers["github"].person_answer = ProviderPerson(subject="g-1", email=None, name="Anna")
    answer = world.client.post(
        "/api/v1/sign-in/finish",
        json={"provider": "github", "code": "c", "state": "s", "expected_state": "s", "verifier": "v"},
    )
    assert answer.status_code == 401 and answer.json() == {"error": "no_email"}


def test_me_without_a_session_is_401(world: World) -> None:
    assert world.client.get("/api/v1/me").status_code == 401
    world.signed("not-a-token")
    assert world.client.get("/api/v1/me").status_code == 401


def test_sign_ins_link_taken_and_unlink_last(world: World) -> None:
    world.signed(world.sign_up())
    world.geo.country = "RU"
    listed = world.client.get("/api/v1/sign-ins").json()
    assert [s["provider"] for s in listed["sign_ins"]] == ["email"] and listed["offer"] == ["yandex", "mailru"]
    last = world.client.post("/api/v1/sign-ins/unlink", json={"sign_in_id": listed["sign_ins"][0]["id"]})
    assert last.status_code == 409 and last.json() == {"error": "last"}
    world.providers["yandex"].person_answer = ProviderPerson(subject="y-1", email="anna@yandex.ru", name="Anna")
    body = {"provider": "yandex", "code": "c", "state": "s", "expected_state": "s", "verifier": "v"}
    assert world.client.post("/api/v1/sign-ins/link", json=body).json() == {"linked": True}
    assert world.client.post("/api/v1/sign-ins/unlink", json={"sign_in_id": listed["sign_ins"][0]["id"]}).json() == {
        "linked": False
    }
    assert [s["provider"] for s in world.client.get("/api/v1/sign-ins").json()["sign_ins"]] == ["yandex"]

    world.client.cookies.clear()
    world.signed(world.sign_up(email="bob@example.com", name="Bob"))
    taken = world.client.post("/api/v1/sign-ins/link", json=body)
    assert taken.status_code == 409 and taken.json() == {"error": "taken"}
    assert world.logger.events()[-1] == "LinkRefusedEvent"


def test_no_password_or_hash_leaves_the_core(world: World) -> None:
    world.signed(world.sign_up())
    world.client.post("/api/v1/sign-in/password", json={"email": "anna@example.com", "password": "Wrong-Password-1"})
    seen = json.dumps([world.client.get("/api/v1/sign-ins").json(), world.client.get("/api/v1/me").json()], default=str)
    seen += json.dumps(world.logger.lines, default=repr) + json.dumps(world.storage.versions, default=str)
    stored_hash = world.storage.tables["sign_in"][0]["password_hash"]
    assert PASSWORD not in seen and "Wrong-Password-1" not in seen and stored_hash not in seen
    assert all("password_hash" not in v for v in world.storage.versions["sign_in_versions"])
