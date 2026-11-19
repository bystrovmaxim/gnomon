"""Administration history stays read-only and uses current access, with half-open snapshots."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from maxitor.core.plugins.storage.plugins_storage import PluginsStorage

from tests.fakes import World
from tests.recording_database import recording_pool


@pytest.mark.parametrize("section", ["organization", "users", "invitations", "plugins"])
async def test_snapshot_is_scoped_and_half_open_without_writes(section: str) -> None:
    pool, connection = recording_pool(lambda query, params: [])
    store = PluginsStorage(pool=pool)
    await store.open()
    instant = datetime(2026, 11, 17, tzinfo=UTC)
    assert await store.administration_snapshot("org", section, instant) == []
    query, params = connection.statements[-1]
    assert params == ("org", instant)
    assert "v.organization_id = $1::text::uuid" in query
    assert "v.valid_from_at <= $2" in query
    assert "$2 < v.valid_to_at" in query
    assert all(sql.startswith("SELECT") for sql, _ in connection.statements)
    assert "FROM account a" not in query
    assert "JOIN plugin p" not in query
    if section == "invitations":
        for alias in ("ib", "db", "au"):
            assert f"LEFT JOIN user_versions {alias}" in query
            assert f"{alias}.valid_from_at <= $2" in query
            assert f"$2 < {alias}.valid_to_at" in query
        assert "au.name AS accepted_user_id_name" in query


def test_historical_read_requires_current_administrator_and_does_not_expire_invitations() -> None:
    world = World()
    world.signed(world.sign_up())
    code = "history-admin"
    assert world.client.post("/api/v1/organizations", json={"name": "History", "code": code}).status_code == 200
    snapshot = AsyncMock(return_value=[])
    world.plugins.administration_snapshot = snapshot
    url = f"/api/v1/organizations/{code}/administration?section=users&at=2026-11-01T00:00:00Z"
    assert world.client.get(url).json() == {"rows": []}
    assert snapshot.await_count == 1
    user = world.storage.tables['"user"'][0]
    user["is_admin"] = False
    assert world.client.get(url).status_code in (403, 404)
    assert snapshot.await_count == 1
    user["is_admin"] = True
    user["status"] = "blocked"
    assert world.client.get(url).status_code in (403, 404)
    assert snapshot.await_count == 1


def test_history_rejects_invalid_section_and_unbounded_bucket_count() -> None:
    world = World()
    world.signed(world.sign_up())
    assert (
        world.client.post("/api/v1/organizations", json={"name": "History", "code": "history-admin"}).status_code == 200
    )
    base = "/api/v1/organizations/history-admin/administration"
    assert world.client.get(base + "?section=account").status_code == 422
    assert (
        world.client.get(
            base + "/history?section=users&from_at=2026-01-01T00:00:00Z&to_at=2026-11-01T00:00:00Z&width=1"
        ).status_code
        == 400
    )
