# packages/maxitor/maxitor-core/tests/test_migration.py
"""The core's migrations keep the constitution's rules, and the migrator runs them in order under their schemas."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest
from maxitor.core.migrate import MIGRATIONS, MigrationChangedError, apply_migrations
from maxitor.core.schemas import CoreSchemas, identifier
from maxitor.core.storage.migrations_storage import MigrationsStorage

from aoa.action_machine.resources.postgres import PostgresStorage
from tests.recording_database import recording_pool

FILES = sorted(MIGRATIONS.glob("*/*.sql"))
BOOTSTRAP = Path(MIGRATIONS).parent / "bootstrap.sql"


def _tables(sql: str) -> dict[str, list[str]]:
    """Each CREATE TABLE of ``sql`` with its column names."""
    tables: dict[str, list[str]] = {}
    for match in re.finditer(r'CREATE TABLE ("?\w+"?) \((.*?)\n\);', sql, re.S):
        columns = []
        for line in match.group(2).splitlines():
            word = line.strip().split(" ")[0]
            if word and word.upper() not in {"PRIMARY", "CONSTRAINT", "FOREIGN", "EXCLUDE", "UNIQUE", "CHECK"}:
                columns.append(word)
        tables[match.group(1)] = columns
    return tables


def test_there_are_migrations_for_every_schema() -> None:
    assert {path.parent.name for path in FILES} == {"platform", "organization", "plugins"}


@pytest.mark.parametrize("path", FILES, ids=lambda p: f"{p.parent.name}/{p.name}")
def test_every_table_and_column_is_described(path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    for table, columns in _tables(sql).items():
        assert f"COMMENT ON TABLE {table} IS" in sql, table
        for column in columns:
            assert f"COMMENT ON COLUMN {table}.{column} IS" in sql, f"{table}.{column}"


@pytest.mark.parametrize("path", FILES, ids=lambda p: f"{p.parent.name}/{p.name}")
def test_no_default_no_cascade_no_schema(path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    code = "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--"))
    assert " DEFAULT " not in code.upper()
    assert "CASCADE" not in code.upper()
    # A COMMENT names table.column, and the table organization shares its name with its schema: skip comments.
    statements = "\n".join(line for line in code.splitlines() if not line.lstrip().startswith("COMMENT ON"))
    assert not re.search(r"\b(platform|organization|plugins|extensions|public)\.\w", statements), "a name says its schema"


@pytest.mark.parametrize("path", FILES, ids=lambda p: f"{p.parent.name}/{p.name}")
def test_every_column_states_its_nullability(path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    for match in re.finditer(r"CREATE TABLE \"?\w+\"? \((.*?)\n\);", sql, re.S):
        for line in match.group(1).splitlines():
            word = line.strip().split(" ")[0]
            if (
                not word
                or word.upper() in {"PRIMARY", "CONSTRAINT", "FOREIGN", "EXCLUDE", "UNIQUE", "CHECK"}
                or line.strip().startswith(("EXCLUDE", "id WITH"))
            ):
                continue
            if "GENERATED ALWAYS" in line:
                continue
            assert "NOT NULL" in line or " NULL" in line, line


def test_the_password_hash_is_never_versioned() -> None:
    sql = (MIGRATIONS / "platform" / "0001_platform.sql").read_text(encoding="utf-8")
    assert "password_hash" not in _tables(sql)["sign_in_versions"]
    assert "password_hash" in _tables(sql)["sign_in"]


def test_bootstrap_closes_public_and_makes_the_role() -> None:
    sql = BOOTSTRAP.read_text(encoding="utf-8")
    assert "REVOKE ALL ON SCHEMA public FROM PUBLIC" in sql
    assert "NOSUPERUSER NOCREATEDB NOCREATEROLE" in sql
    assert "CREATE SCHEMA platform AUTHORIZATION maxitor_core" in sql
    assert "CREATE SCHEMA organization AUTHORIZATION maxitor_core" in sql
    assert "btree_gist SCHEMA extensions" in sql
    assert "PASSWORD :'core_password'" in sql


def test_bootstrap_makes_the_installer_and_the_plugins_group() -> None:
    sql = BOOTSTRAP.read_text(encoding="utf-8")
    assert "CREATE ROLE maxitor_installer LOGIN NOSUPERUSER NOCREATEDB CREATEROLE PASSWORD :'installer_password'" in sql
    assert "GRANT CREATE ON DATABASE %I TO maxitor_installer" in sql
    assert "CREATE ROLE maxitor_plugin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE" in sql
    assert "GRANT maxitor_plugin TO maxitor_installer WITH ADMIN OPTION" in sql
    assert "CREATE SCHEMA plugins AUTHORIZATION maxitor_core" in sql
    # The core's everyday role never gets to create a role or a schema in the database.
    assert "CREATE ROLE maxitor_core LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE" in sql
    assert "TO maxitor_core;" not in sql.split("GRANT CREATE ON DATABASE")[1].split("\n")[0]


def test_the_installer_may_write_only_the_schema_plugins() -> None:
    sql = (MIGRATIONS / "plugins" / "0001_plugins.sql").read_text(encoding="utf-8")
    grants = [line for line in sql.splitlines() if line.startswith("GRANT")]
    assert "GRANT USAGE ON SCHEMA plugins TO maxitor_installer;" in grants
    assert "GRANT SELECT ON organization_versions, user_versions, boundary_versions, boundary_user_versions TO maxitor_installer;" in grants
    assert not any("DELETE" in line for line in grants)


def test_one_live_row_per_organization_and_plugin() -> None:
    sql = (MIGRATIONS / "plugins" / "0001_plugins.sql").read_text(encoding="utf-8")
    assert "CREATE UNIQUE INDEX organization_plugin_one_live ON organization_plugin (organization_id, plugin_id) WHERE state <> 'removed';" in sql


def test_identifier_quotes() -> None:
    assert identifier("organization") == '"organization"'
    assert identifier('we"ird') == '"we""ird"'
    with pytest.raises(ValueError):
        identifier("")


async def test_the_migrator_runs_platform_then_organization_under_their_schemas() -> None:
    def answer(query: str, params: tuple[Any, ...]) -> Any:
        return []

    pool, connection = recording_pool(answer)
    storage = MigrationsStorage(pool=pool)
    ran = await apply_migrations(storage, CoreSchemas())
    assert ran == [
        "platform/0001_platform.sql",
        "organization/0001_organization.sql",
        "organization/0002_plugin_functions.sql",
        "plugins/0001_plugins.sql",
        "plugins/0002_plugin_processes.sql",
    ]
    paths = [q for q in connection.queries() if q.startswith("SET LOCAL search_path")]
    assert paths[0] == 'SET LOCAL search_path TO "platform", "extensions"'
    assert paths[1] == 'SET LOCAL search_path TO "platform", "extensions"'
    assert paths[2] == 'SET LOCAL search_path TO "organization", "platform", "extensions"'
    assert paths[3] == 'SET LOCAL search_path TO "organization", "platform", "extensions"'
    assert paths[4] == paths[5] == 'SET LOCAL search_path TO "plugins", "organization", "platform", "extensions"'
    recorded = [params for query, params in connection.statements if query.startswith("INSERT INTO migration")]
    assert [name for name, _digest in recorded] == ran


async def test_an_edited_migration_stops_the_run() -> None:
    def answer(query: str, params: tuple[Any, ...]) -> Any:
        if query.startswith("SELECT name, sha256 FROM migration"):
            return [{"name": "platform/0001_platform.sql", "sha256": "an older digest"}]
        return []

    pool, _connection = recording_pool(answer)
    with pytest.raises(MigrationChangedError):
        await apply_migrations(MigrationsStorage(pool=pool), CoreSchemas())


def test_storage_is_a_postgres_storage() -> None:
    assert issubclass(MigrationsStorage, PostgresStorage)


def test_the_plugins_functions_run_as_their_owner_for_the_plugins_group_only() -> None:
    sql = (MIGRATIONS / "organization" / "0002_plugin_functions.sql").read_text(encoding="utf-8")
    created = re.findall(r"CREATE FUNCTION (\w+)\(", sql)
    assert created == ["change_time", "watermark", "is_member", "member_organization", "member_name"]
    for header in re.findall(r"CREATE FUNCTION .*?AS \$\$", sql, re.S):
        assert "SECURITY DEFINER SET search_path = " in header, header
    statements = " ".join(sql.split())
    assert "REVOKE ALL ON FUNCTION change_time(uuid), watermark(uuid), is_member(uuid, uuid), member_organization(text, uuid), member_name(uuid, uuid, timestamptz) FROM PUBLIC;" in statements
    assert "GRANT EXECUTE ON FUNCTION change_time(uuid), watermark(uuid), is_member(uuid, uuid), member_organization(text, uuid), member_name(uuid, uuid, timestamptz) TO maxitor_plugin;" in statements
    grants = [line for line in sql.splitlines() if line.startswith("GRANT")]
    assert not any("SELECT" in line or "INSERT" in line for line in grants)
    assert "status = 'active'" in sql
