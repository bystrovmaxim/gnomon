# packages/maxitor/maxitor-core/tests/test_frame_tree.py
"""
The frame's tree and "now" over HTTP (spec 077, FR-007 – FR-013, FR-020): an organization's tree holds the core's
Settings for its administrator and the enabled plugins' nodes with their scope; installing or enabling a plugin
whose nodes would not hold is refused with the reason navigation; the watermark answers a member only.
"""

from __future__ import annotations

from typing import Any

import pytest

from tests.fakes import World

CODE = "severny-veter"
NOTES, REVIEWS = "run.aoa.maxitor.notes", "run.aoa.maxitor.reviews"

ITEM = {
    "full_name": "notes:item",
    "parent": "notes:notes",
    "node_order": 0,
    "title": None,
    "icon": None,
    "page": None,
    "each_source": "list_items",
    "each_key": "item_id",
    "roles": ["member"],
}
ITEM_NOTES = {
    "full_name": "notes:item-notes",
    "parent": "notes:item",
    "node_order": 100,
    "title": "Notes",
    "icon": "note",
    "page": "/items/{item_id}",
    "each_source": None,
    "each_key": None,
    "roles": ["member"],
}
ROOT = {
    "full_name": "notes:notes",
    "parent": "root",
    "node_order": 500,
    "title": "Notes",
    "icon": "note",
    "page": "/",
    "each_source": None,
    "each_key": None,
    "roles": ["member"],
}


def _reviews(parent: str) -> dict[str, Any]:
    return {
        "full_name": "reviews:reviews",
        "parent": parent,
        "node_order": 0,
        "title": "Reviews",
        "icon": None,
        "page": "/items/{item_id}/reviews",
        "each_source": None,
        "each_key": None,
        "roles": [],
    }


@pytest.fixture
def world() -> World:
    w = World()
    w.signed(w.sign_up())
    assert w.client.post("/api/v1/organizations", json={"name": "Severny Veter", "code": CODE}).status_code == 200
    w.plugins.offer(NOTES, "notes", "Notes", nodes=(ROOT, ITEM, ITEM_NOTES))
    return w


def _org_id(world: World) -> str:
    return str(next(o["id"] for o in world.storage.tables["organization"] if o["code"] == CODE))


def _act(world: World, passport_id: str, verb: str) -> tuple[int, dict[str, Any]]:
    answer = world.client.post(f"/api/v1/plugins/{verb}", json={"code": CODE, "passport_id": passport_id})
    return answer.status_code, dict(answer.json())


def _tree(world: World) -> dict[str, dict[str, Any]]:
    return {node["name"]: node for node in world.client.get(f"/api/v1/organizations/{CODE}").json()["tree"]}


def test_an_administrator_sees_settings_and_the_enabled_plugins_nodes_with_their_scope(world: World) -> None:
    assert set(_tree(world)) == {"core:settings", "core:settings.plugins"}
    assert _act(world, NOTES, "install") == (200, {"state": "installing"})
    world.plugins.set_state(_org_id(world), NOTES, "enabled")
    tree = _tree(world)
    assert tree["core:settings.plugins"]["page"] == "/settings/plugins"
    assert tree["notes:item"]["each"] == {"source": "list_items", "key": "item_id"}
    assert tree["notes:item-notes"]["scope"] == ["item_id"]
    assert "controls" not in tree["notes:item-notes"]


def test_a_plugin_attached_to_a_plugin_it_does_not_depend_on_is_refused(world: World) -> None:
    world.plugins.offer(REVIEWS, "reviews", "Reviews", nodes=(_reviews("notes:item"),))
    assert _act(world, NOTES, "install") == (200, {"state": "installing"})
    world.plugins.set_state(_org_id(world), NOTES, "enabled")
    status, body = _act(world, REVIEWS, "install")
    assert status == 409 and body["error"] == "navigation" and "direct dependency" in body["detail"]
    refused = [var for _m, var in world.logger.lines if type(var).__name__ == "InstallRefusedEvent"]
    assert [e.reason for e in refused] == ["navigation"]


def test_a_dependency_gives_its_node_and_its_scope(world: World) -> None:
    world.plugins.offer(REVIEWS, "reviews", "Reviews", needs=(NOTES,), nodes=(_reviews("notes:item"),))
    for passport_id in (NOTES, REVIEWS):
        assert _act(world, passport_id, "install") == (200, {"state": "installing"})
        world.plugins.set_state(_org_id(world), passport_id, "enabled")
    tree = _tree(world)
    assert tree["reviews:reviews"]["parent"] == "notes:item" and tree["reviews:reviews"]["scope"] == ["item_id"]
    opened = world.client.get(f"/api/v1/organizations/{CODE}").json()
    assert opened["owners"] == ["notes", "reviews"]
    assert opened["dependencies"] == {"notes": [], "reviews": ["notes"]}


def test_enabling_a_plugin_whose_nodes_would_not_hold_is_refused(world: World) -> None:
    world.plugins.offer(REVIEWS, "reviews", "Reviews", needs=(NOTES,), nodes=(_reviews("notes:folder"),))
    assert _act(world, NOTES, "install") == (200, {"state": "installing"})
    world.plugins.set_state(_org_id(world), NOTES, "enabled")
    status, body = _act(world, REVIEWS, "install")
    assert status == 409 and body["error"] == "navigation" and "does not exist" in body["detail"]


def test_the_watermark_answers_a_member_and_no_one_else(world: World) -> None:
    answer = world.client.get(f"/api/v1/organizations/{CODE}/watermark")
    assert answer.status_code == 200
    at = answer.json()["at"]
    assert at is not None and at.endswith("Z") and len(at.split(".")[1]) == 7
    assert world.client.get("/api/v1/organizations/made-up/watermark").status_code == 404
