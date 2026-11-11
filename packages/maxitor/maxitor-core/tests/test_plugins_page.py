# packages/maxitor/maxitor-core/tests/test_plugins_page.py
"""
The page Settings → Plugins over HTTP: install refused for each reason and asked otherwise; disable refused while an
enabled plugin needs it and enable refused while a needed plugin is disabled; a failed install retried or dropped;
one search over both tabs with their counts; another organization's private plugin nowhere; 404 for anyone but an
active administrator; the organization's tree showing the enabled plugins' sections.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest

from tests.fakes import World

CODE = "severny-veter"
NOTES, TASKS, CALENDAR, SECRET = "run.aoa.maxitor.notes", "run.aoa.maxitor.tasks", "run.aoa.maxitor.calendar", "ru.other.secret"


@pytest.fixture
def world() -> World:
    w = World()
    w.signed(w.sign_up())
    assert w.client.post("/api/v1/organizations", json={"name": "Severny Veter", "code": CODE}).status_code == 200
    w.plugins.offer(NOTES, "notes", "Notes", description="Notes of an organization", sections=(("All notes", "/"), ("Tags", "/tags")))
    w.plugins.offer(TASKS, "tasks", "Tasks", description="Tasks that can carry notes", needs=(NOTES,), sections=(("My tasks", "/"),))
    w.plugins.offer(CALENDAR, "calendar", "Calendar", core_range=">=5.0,<6")
    w.plugins.offer(SECRET, "secret", "Secret", owner=str(uuid.uuid4()))
    return w


def org_id(world: World) -> str:
    return str(next(o["id"] for o in world.storage.tables["organization"] if o["code"] == CODE))


def page(world: World, query: str = "") -> dict[str, Any]:
    answer = world.client.get(f"/api/v1/organizations/{CODE}/plugins", params={"query": query})
    assert answer.status_code == 200, answer.text
    return dict(answer.json())


def act(world: World, passport_id: str, verb: str) -> tuple[int, dict[str, Any]]:
    answer = world.client.post(f"/api/v1/plugins/{verb}", json={"code": CODE, "passport_id": passport_id})
    return answer.status_code, dict(answer.json())


def installed(world: World, passport_id: str) -> None:
    """Install and let the installer finish."""
    assert act(world, passport_id, "install") == (200, {"state": "installing"})
    world.plugins.set_state(org_id(world), passport_id, "enabled")


def test_the_marketplace_offers_what_the_organization_may_install(world: World) -> None:
    listed = page(world)
    assert [c["passport_id"] for c in listed["marketplace"]] == [CALENDAR, NOTES, TASKS]
    calendar, notes, tasks = listed["marketplace"]
    assert not calendar["fits_core"] and notes["fits_core"]
    assert tasks["dependencies"] == [{"passport_id": NOTES, "installed": False}]
    assert listed["installed"] == [] and listed["counts"] == {"installed": 0, "marketplace": 3}


def test_install_is_refused_for_each_reason(world: World) -> None:
    assert act(world, TASKS, "install") == (409, {"error": "missing_dependency", "missing": [NOTES]})
    assert act(world, CALENDAR, "install") == (409, {"error": "core_range", "range": ">=5.0,<6"})
    assert act(world, "io.nowhere", "install")[0] == 404
    assert act(world, SECRET, "install")[0] == 404
    assert act(world, NOTES, "install") == (200, {"state": "installing"})
    assert act(world, NOTES, "install") == (409, {"error": "already_installed", "state": "installing"})
    refused = [var for _m, var in world.logger.lines if type(var).__name__ == "InstallRefusedEvent"]
    assert [e.reason for e in refused] == ["missing_dependency", "core_range", "already_installed"]


def test_an_install_waits_for_the_installer_then_shows_in_the_tree(world: World) -> None:
    assert act(world, NOTES, "install") == (200, {"state": "installing"})
    rows = page(world)["installed"]
    assert [(r["passport_id"], r["state"], r["installed_by"]) for r in rows] == [(NOTES, "installing", "Anna")]
    assert NOTES not in [c["passport_id"] for c in page(world)["marketplace"]]
    def plugin_nodes() -> list[tuple[str, str, str | None]]:
        tree = world.client.get(f"/api/v1/organizations/{CODE}").json()["tree"]
        return [(n["name"], n["title"], n["page"]) for n in tree if n["owner"] != "core"]

    assert plugin_nodes() == []
    world.plugins.set_state(org_id(world), NOTES, "enabled")
    assert plugin_nodes() == [("notes:section-1", "All notes", "/"), ("notes:section-2", "Tags", "/tags")]
    assert world.client.get(f"/api/v1/organizations/{CODE}").json()["owners"] == ["notes"]


def test_disable_and_enable_keep_dependencies_whole(world: World) -> None:
    installed(world, NOTES)
    installed(world, TASKS)
    status, body = act(world, NOTES, "disable")
    assert (status, body) == (409, {"error": "needed_by", "dependents": [{"passport_id": TASKS, "title": "Tasks"}]})
    assert [v.dependents for _m, v in world.logger.lines if type(v).__name__ == "DisableRefusedEvent"] == [[TASKS]]
    assert act(world, TASKS, "disable") == (200, {"state": "disabled"})
    assert act(world, NOTES, "disable") == (200, {"state": "disabled"})
    assert act(world, TASKS, "enable") == (409, {"error": "dependency_disabled", "dependencies": [NOTES]})
    assert act(world, NOTES, "enable") == (200, {"state": "enabled"})
    assert act(world, TASKS, "enable") == (200, {"state": "enabled"})
    assert act(world, TASKS, "enable") == (409, {"error": "not_disabled", "state": "enabled"})


def test_a_disabled_dependency_still_counts_as_installed(world: World) -> None:
    installed(world, NOTES)
    assert act(world, NOTES, "disable") == (200, {"state": "disabled"})
    assert act(world, TASKS, "install") == (200, {"state": "installing"})


def test_a_failed_install_is_retried_or_dropped(world: World) -> None:
    assert act(world, NOTES, "install")[0] == 200
    world.plugins.set_state(org_id(world), NOTES, "failed", "the database refused")
    row = page(world)["installed"][0]
    assert (row["state"], row["reason"]) == ("failed", "the database refused")
    assert act(world, NOTES, "retry") == (200, {"state": "installing"})
    world.plugins.set_state(org_id(world), NOTES, "failed", "again")
    assert act(world, NOTES, "drop") == (200, {"state": "removed"})
    listed = page(world)
    assert listed["installed"] == [] and [r["state"] for r in listed["removed"]] == ["removed"]
    assert NOTES in [c["passport_id"] for c in listed["marketplace"]]
    assert act(world, NOTES, "retry")[0] == 404  # nothing live to retry any more


def test_one_search_over_both_tabs(world: World) -> None:
    installed(world, NOTES)
    found = page(world, "note")
    assert [r["passport_id"] for r in found["installed"]] == [NOTES]
    assert [c["passport_id"] for c in found["marketplace"]] == [TASKS]  # its description says notes
    assert found["counts"] == {"installed": 1, "marketplace": 1}
    assert page(world, "crm")["counts"] == {"installed": 0, "marketplace": 0}
    assert page(world, "%")["counts"] == {"installed": 0, "marketplace": 0}  # a wildcard is a character


def test_details_of_a_plugin(world: World) -> None:
    details = world.client.get(f"/api/v1/organizations/{CODE}/plugins/{TASKS}").json()
    assert details["dependencies"] == [{"passport_id": NOTES, "installed": False}]
    assert (details["schema_name"], details["database_user"], details["deployed"]) == ("tasks_1_0_0", "plg_tasks_1_0_0", False)
    assert details["sections"] == [{"title": "My tasks", "path": "/"}] and details["state"] is None
    assert world.client.get(f"/api/v1/organizations/{CODE}/plugins/{SECRET}").status_code == 404


def test_anyone_but_an_administrator_gets_404(world: World) -> None:
    admin = dict(world.client.cookies.items())
    world.client.cookies.clear()
    world.signed(world.sign_up(email="ilya@example.com", name="Ilya"))
    member = next(a["id"] for a in world.storage.tables["account"] if a["email"] == "ilya@example.com")
    for is_admin in (None, False):
        if is_admin is False:
            world.storage.tables['"user"'].append(
                {"organization_id": org_id(world), "id": str(uuid.uuid4()), "account_id": member, "name": "Ilya",
                 "is_admin": False, "status": "active", "created_at": None, "updated_at": None}
            )
        assert world.client.get(f"/api/v1/organizations/{CODE}/plugins").status_code == 404
        assert world.client.get(f"/api/v1/organizations/{CODE}/plugins/{NOTES}").status_code == 404
        for verb in ("install", "retry", "drop", "disable", "enable"):
            assert act(world, NOTES, verb)[0] == 404, verb
    world.client.cookies.clear()
    for name, value in admin.items():
        world.client.cookies.set(name, value)
    assert page(world)["counts"]["marketplace"] == 3
