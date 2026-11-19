# packages/maxitor/maxitor-core/tests/test_last_place.py
"""The user's last place (spec 086, phase 5): kept with the account without the time scale's names, answered by me."""

from __future__ import annotations

import pytest

from tests.fakes import World

CODE = "severny-veter"


@pytest.fixture
def world() -> World:
    w = World()
    w.signed(w.sign_up())
    assert w.client.post("/api/v1/organizations", json={"name": "Severny Veter", "code": CODE}).status_code == 200
    return w


def keep(world: World, address: str) -> tuple[int, dict[str, object]]:
    answer = world.client.post("/api/v1/me/place", json={"address": address})
    return answer.status_code, dict(answer.json())


def test_the_place_is_kept_without_the_moment_and_the_comparison(world: World) -> None:
    assert world.client.get("/api/v1/me").json()["last_place"] is None
    status, body = keep(world, f"/w/{CODE}/notes/items/4f1c?view=table&at=2026-11-10T12:00:00Z&mode=diff&from=2026-11-09T12:00:00Z")
    assert (status, body) == (200, {"address": f"/w/{CODE}/notes/items/4f1c?view=table"})
    assert world.client.get("/api/v1/me").json()["last_place"] == f"/w/{CODE}/notes/items/4f1c?view=table"
    assert keep(world, f"/w/{CODE}/core/settings/users") == (200, {"address": f"/w/{CODE}/core/settings/users"})
    assert world.client.get("/api/v1/me").json()["last_place"] == f"/w/{CODE}/core/settings/users"
    assert len(world.storage.tables["account_place"]) == 1


@pytest.mark.parametrize("address", ["/new", "https://evil.example/w/x", "/w", "w/severny-veter", ""])
def test_anything_not_a_place_under_w_is_refused(world: World, address: str) -> None:
    status, body = keep(world, address)
    assert (status, body["error"]) == (422, "not_a_place")
    assert world.client.get("/api/v1/me").json()["last_place"] is None


def test_the_place_needs_a_session(world: World) -> None:
    world.client.cookies.clear()
    assert world.client.post("/api/v1/me/place", json={"address": f"/w/{CODE}"}).status_code == 401
