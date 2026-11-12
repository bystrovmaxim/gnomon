# packages/maxitor-plugin-template/tests/test_app.py
"""The backend's routes: every one lies under /p/notes/api/{organization} and is an action; a token is checked by the core's JWKS."""

import json
import re
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from jwt.algorithms import OKPAlgorithm
from maxitor_notes.app import create_app

DSN = "postgresql://plg_notes@db.invalid/maxitor"
JWKS_URL = "http://127.0.0.1:3000/api/v1/jwks"
CORE = Ed25519PrivateKey.generate()


@pytest.fixture(autouse=True)
def core_jwks(monkeypatch: pytest.MonkeyPatch) -> None:
    """The core's JWKS, as the plugin fetches it through the gateway."""
    key = json.loads(OKPAlgorithm.to_jwk(CORE.public_key()))
    key.update(kid="core", use="sig", alg="EdDSA")
    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", lambda _client: {"keys": [key]})


def test_every_route_lies_under_the_plugins_path_and_the_organization() -> None:
    app = create_app(dsn=DSN, jwks_url=JWKS_URL)
    routes = {(next(iter(route.methods)), route.path) for route in app.routes if getattr(route, "methods", None) and route.path.startswith("/p/")}
    assert routes == {
        ("POST", "/p/notes/api/{organization}/items"),
        ("PATCH", "/p/notes/api/{organization}/items"),
        ("GET", "/p/notes/api/{organization}/lists/list_items"),
        ("POST", "/p/notes/api/{organization}/notes"),
        ("PATCH", "/p/notes/api/{organization}/notes"),
        ("DELETE", "/p/notes/api/{organization}/notes/{note_id}"),
        ("DELETE", "/p/notes/api/{organization}/draft/{note_id}"),
        ("GET", "/p/notes/api/{organization}/items/{item_id}/notes"),
        ("GET", "/p/notes/api/{organization}/lists/list_note_authors"),
        ("POST", "/p/notes/api/{organization}/revisions/rollback"),
        ("GET", "/p/notes/api/{organization}/history/list_published_notes"),
        ("GET", "/p/notes/api/{organization}/history/list_note_draft"),
        ("POST", "/p/notes/api/{organization}/revisions"),
        ("GET", "/p/notes/api/{organization}/items/{item_id}/published"),
        ("GET", "/p/notes/api/{organization}/items/{item_id}/draft"),
        ("GET", "/p/notes/api/{organization}/history/list_note_history"),
        ("GET", "/p/notes/api/{organization}/history/note_milestone_card"),
    }


def test_a_route_with_a_body_takes_no_id_from_its_path() -> None:
    """AOA's adapter builds a POST or PATCH action's params from the body alone: an id in such a path never reaches the action."""
    for route in create_app(dsn=DSN, jwks_url=JWKS_URL).routes:
        methods = getattr(route, "methods", None) or set()
        if route.path.startswith("/p/") and methods & {"POST", "PATCH", "PUT"}:
            assert set(re.findall(r"\{(\w+)\}", route.path)) == {"organization"}, route.path


def test_an_organization_in_a_request_body_is_refused_not_used() -> None:
    client = TestClient(create_app(dsn=DSN, jwks_url=JWKS_URL))
    response = client.post("/p/notes/api/acme/notes", json={"item_id": "i", "body": "b", "organization": "globex"})
    assert response.status_code == 422


class Connection:
    """A database connection that answers every read with nothing."""

    async def execute(self, *_args: object) -> str:
        return "OK"

    async def fetch(self, *_args: object) -> list[object]:
        return []

    async def fetchrow(self, *_args: object) -> None:
        return None

    async def fetchval(self, *_args: object) -> None:
        return None


class Pool:
    """Stands for the plugin's pool in the lifespan, so a request goes as far as its action."""

    def __init__(self, *_args: object, **_kwargs: object) -> None:
        self.connection = Connection()

    async def __aenter__(self) -> "Pool":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def acquire(self, *, timeout: float | None = None) -> Connection:
        return self.connection

    async def release(self, _connection: Connection) -> None:
        return None


def test_the_app_accepts_only_a_token_the_core_issued_for_this_plugin_with_member(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("maxitor_notes.app.PostgresPool", Pool)
    with TestClient(create_app(dsn=DSN, jwks_url=JWKS_URL), raise_server_exceptions=False) as client:

        def call(audience: str, roles: list[str], key: Ed25519PrivateKey = CORE) -> int:
            now = int(time.time())
            claims = {"iss": "maxitor", "aud": audience, "sub": "u1", "sid": "s1", "org": "acme", "roles": roles, "iat": now, "exp": now + 60}
            token = jwt.encode(claims, key, algorithm="EdDSA", headers={"kid": "core"})
            return client.get("/p/notes/api/acme/items/i/notes", headers={"authorization": f"Bearer {token}"}).status_code

        assert call("io.github.acme.tags", ["member"]) == 403
        assert call("io.github.bystrovmaxim.notes", ["member"], Ed25519PrivateKey.generate()) == 403
        # The plugin itself, with no person, is not a member: its role does not open a person's page.
        assert call("io.github.bystrovmaxim.notes", ["service"]) == 403
        # A member passes the role; the organization's decision reads the core's tables, empty here: not found.
        assert call("io.github.bystrovmaxim.notes", ["member"]) == 404


def test_a_moment_not_written_as_one_is_refused_by_name_not_a_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("maxitor_notes.app.PostgresPool", Pool)
    with TestClient(create_app(dsn=DSN, jwks_url=JWKS_URL), raise_server_exceptions=False) as client:
        now = int(time.time())
        claims = {"iss": "maxitor", "aud": "io.github.bystrovmaxim.notes", "sub": "u1", "sid": "s1", "org": "acme", "roles": ["member"], "iat": now, "exp": now + 60}
        token = jwt.encode(claims, CORE, algorithm="EdDSA", headers={"kid": "core"})
        for moment in ("2099-01-01T00:00:00Z", "garbage"):
            response = client.get(f"/p/notes/api/acme/items/i/published?at={moment}", headers={"authorization": f"Bearer {token}"})
            assert response.status_code == 422, moment
            assert response.json() == {"error": "invalid", "fields": ["at"]}
