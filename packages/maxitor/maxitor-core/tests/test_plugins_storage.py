# packages/maxitor/maxitor-core/tests/test_plugins_storage.py
"""
PluginsStorage writes a row with its version under the right lock, names no schema, reads an organization's plugins
only by its organization, and shows a private plugin only to its owner; the lifecycles allow only their transitions.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

import pytest
from maxitor.core.plugins.entities import OrganizationPluginLifecycle, PluginLifecycle, PluginVersionLifecycle
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.plugins_storage import PluginsStorage, like_pattern

from tests.recording_database import RecordingConnection, recording_pool

MOMENT = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)
ORG = "0b9c2c8e-9a43-4d0e-8f3f-5d0f1b8b6a11"


def _storage() -> tuple[PluginsStorage, RecordingConnection]:
    def answer(query: str, params: tuple[Any, ...]) -> Any:
        if query.startswith("SELECT greatest"):
            return MOMENT
        if query.startswith("SELECT * FROM organization_plugin"):
            return {"organization_id": ORG, "id": "r1", "state": "enabled", "updated_at": MOMENT}
        return None

    pool, connection = recording_pool(answer)
    return PluginsStorage(pool=pool), connection


async def test_a_plugin_and_its_versions_change_under_the_plugins_lock() -> None:
    storage, connection = _storage()
    await storage.open()
    assert await storage.plugin_lock("p1") == MOMENT
    queries = connection.queries()
    assert connection.statements[0] == ("SELECT pg_advisory_xact_lock(hashtext($1))", ("plugin:p1",))
    assert "plugin_versions WHERE id = $1" in queries[1] and "plugin_version_versions WHERE plugin_id = $2" in queries[1]


async def test_the_organizations_lock_follows_its_plugins_too() -> None:
    storage, connection = _storage()
    await storage.open()
    await storage.organization_lock(ORG)
    assert connection.statements[0][1] == (f"organization:{ORG}",)
    assert "organization_plugin_versions" in connection.queries()[1]
    assert "user_versions" in connection.queries()[1]


async def test_insert_and_update_write_the_version_table() -> None:
    storage, connection = _storage()
    await storage.open()
    row = {
        "organization_id": ORG,
        "id": "r1",
        "plugin_id": "p1",
        "plugin_version_id": "v1",
        "state": "installing",
        "reason": None,
        "installed_by": "u1",
        "created_at": MOMENT,
        "updated_at": None,
    }
    await storage.insert("organization_plugin", row, MOMENT, "a1", "RequestInstallAction")
    await storage.update(
        "organization_plugin", {"organization_id": ORG, "id": "r1"}, {"state": "enabled"}, MOMENT, None, "Deploy"
    )
    q = connection.queries()
    assert q[0].startswith("INSERT INTO organization_plugin (organization_id, id, plugin_id")
    assert q[1].startswith("INSERT INTO organization_plugin_versions (organization_id, id, valid_from_at")
    assert q[2].startswith("UPDATE organization_plugin_versions SET valid_to_at")
    assert q[3] == "UPDATE organization_plugin SET state = $1 WHERE organization_id = $2 AND id = $3"


async def test_no_sql_names_a_schema_and_an_organizations_rows_name_it() -> None:
    storage, connection = _storage()
    await storage.open()
    await storage.installed(ORG, "")
    await storage.offered(ORG, "notes")
    await storage.private_pending(ORG, "")
    await storage.plugin_for(ORG, "run.aoa.maxitor.notes")
    await storage.live_states(ORG)
    await storage.enabled_dependents(ORG, "run.aoa.maxitor.notes")
    await storage.enabled_plugins(ORG)
    for query in connection.queries():
        assert not re.search(r"\b(platform|organization|plugins|extensions|public)\.\w", query), query
        assert "SELECT *" not in query and "o.*" not in query, query
        if "FROM organization_plugin op" in query or "JOIN organization_plugin op" in query:
            assert "op.organization_id = $1::text::uuid" in query, query
    # Every reading of the marketplace shows a private plugin only to its owner.
    offered = connection.queries()[1]
    assert "p.owner_organization_id IS NULL OR p.owner_organization_id = $1::text::uuid" in offered


def test_a_search_takes_its_wildcards_literally() -> None:
    assert like_pattern("") == ""
    assert like_pattern("  notes ") == "%notes%"
    assert like_pattern("50%_off\\") == "%50\\%\\_off\\\\%"


@pytest.mark.parametrize(
    ("lifecycle", "state", "targets"),
    [
        (PluginLifecycle, "listed", {"withdrawn"}),
        (PluginLifecycle, "withdrawn", {"listed"}),
        (PluginVersionLifecycle, "draft", {"active", "rejected"}),
        (PluginVersionLifecycle, "active", {"withdrawn"}),
        (PluginVersionLifecycle, "rejected", set()),
        (OrganizationPluginLifecycle, "installing", {"enabled", "failed"}),
        (OrganizationPluginLifecycle, "enabled", {"disabled", "removing"}),
        (OrganizationPluginLifecycle, "disabled", {"enabled", "removing"}),
        (OrganizationPluginLifecycle, "failed", {"installing", "removed"}),
        (OrganizationPluginLifecycle, "removing", {"removed"}),
        (OrganizationPluginLifecycle, "removed", set()),
    ],
)
def test_the_lifecycles_allow_only_their_transitions(lifecycle: Any, state: str, targets: set[str]) -> None:
    assert set(lifecycle(state).available_transitions) == targets


def test_the_domain_lists_its_twenty_three_events() -> None:
    assert len(PluginsDomain.events) == 23
    assert len(set(PluginsDomain.events)) == 23
