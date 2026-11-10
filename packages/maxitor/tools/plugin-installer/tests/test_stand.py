# packages/maxitor/tools/plugin-installer/tests/test_stand.py
"""
On the local stand (scripts/core-stand.sh) with a version deployed: its user reaches nothing but its own schema and
the core's three functions, and the core's everyday role can create neither a schema nor a role (FR-023, FR-024).

Marked ``stand``: it needs MAXITOR_STAND_DSN (the core's DSN) and MAXITOR_STAND_PLUGIN_ENV (a deployed version's
plugin.env), and CI never runs it.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

pytestmark = [
    pytest.mark.stand,
    pytest.mark.skipif(
        not (os.environ.get("MAXITOR_STAND_DSN") and os.environ.get("MAXITOR_STAND_PLUGIN_ENV")),
        reason="needs the local stand: MAXITOR_STAND_DSN and MAXITOR_STAND_PLUGIN_ENV",
    ),
]


def _plugin_env() -> dict[str, str]:
    lines = Path(os.environ["MAXITOR_STAND_PLUGIN_ENV"]).read_text(encoding="utf-8").splitlines()
    return dict(line.split("=", 1) for line in lines if "=" in line)


async def _refused(dsn: str, statement: str) -> bool:
    import asyncpg

    connection = await asyncpg.connect(dsn)
    try:
        await connection.execute(statement)
    except asyncpg.PostgresError:
        return True
    finally:
        await connection.close()
    return False


async def test_the_core_role_creates_no_schema_and_no_role() -> None:
    dsn = os.environ["MAXITOR_STAND_DSN"]
    assert await _refused(dsn, "CREATE SCHEMA stand_probe")
    assert await _refused(dsn, "CREATE ROLE stand_probe")


async def test_a_versions_user_sees_only_its_own_schema() -> None:
    import asyncpg

    env = _plugin_env()
    dsn, schema = env["MAXITOR_PLUGIN_DSN"], env["MAXITOR_PLUGIN_SCHEMA"]
    for statement in (
        "SELECT 1 FROM organization.organization",
        'SELECT 1 FROM organization."user"',
        "SELECT 1 FROM platform.account",
        "SELECT 1 FROM plugins.plugin",
        "CREATE TABLE probe (a int)",
        f"CREATE TABLE {schema}.probe (a int)",
        f"ALTER TABLE {schema}.note ADD COLUMN probe int",
        "CREATE SCHEMA probe",
    ):
        assert await _refused(dsn, statement), statement
    connection = await asyncpg.connect(dsn)
    try:
        organization = await connection.fetchval("SELECT organization_id FROM note_versions LIMIT 1")
        if organization is not None:
            assert await connection.fetchval("SELECT watermark($1)", organization) is not None
        assert await connection.fetchval("SELECT is_member(gen_random_uuid(), gen_random_uuid())") is False
    finally:
        await connection.close()
