# packages/maxitor/maxitor-core/tests/test_plugins_tokens.py
"""
Plugin tokens: signed with the core's Ed25519 key for one plugin and 60 seconds, checked by a plugin through the
core's JWKS with AOA's own coordinator; refused for another plugin, another key or once expired; a plugin calls a
direct dependency by exchanging its token and is refused for anything else; a version's service key gives the plugin
a token for itself and nothing else does; the core refuses to start without its key.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from maxitor.core.plugins.plugin_tokens import PluginTokensController
from maxitor.core.server import create_app
from maxitor.core.settings import CoreSettings

from aoa.action_machine.auth.jwt_auth.jwt_auth_coordinator import JwtAuthCoordinator
from tests.fakes import World

NOW = datetime.now(UTC)
CODE = "severny-veter"


def tokens() -> PluginTokensController:
    return PluginTokensController(Ed25519PrivateKey.generate())


# ── the controller ────────────────────────────────────────────────────────────


def test_a_token_names_its_plugin_person_organization_and_roles_for_a_minute() -> None:
    signer = tokens()
    claims = signer.read(signer.issue("io.x.notes", "a1", "s1", "acme", ["member"], NOW))
    assert claims is not None
    assert {k: claims[k] for k in ("iss", "aud", "sub", "sid", "org", "roles")} == {
        "iss": "maxitor", "aud": "io.x.notes", "sub": "a1", "sid": "s1", "org": "acme", "roles": ["member"]
    }
    assert claims["exp"] - claims["iat"] == 60


def test_a_token_of_another_key_or_expired_is_not_read() -> None:
    assert tokens().read(tokens().issue("io.x.notes", "a1", "s1", "acme", ["member"], NOW)) is None
    signer = tokens()
    assert signer.read(signer.issue("io.x.notes", "a1", "s1", "acme", ["member"], NOW - timedelta(minutes=2))) is None
    assert signer.read("not a token") is None


def test_the_key_never_shows() -> None:
    signer = tokens()
    assert "PRIVATE" not in repr(signer) and signer.kid in repr(signer)


class Request:
    """What AOA's coordinator reads of an HTTP request."""

    def __init__(self, token: str) -> None:
        self.headers = {"authorization": f"Bearer {token}"}
        self.url = type("U", (), {"path": "/p/notes/api/acme/notes"})()
        self.method = "GET"
        self.client = None
        self.path_params: dict[str, Any] = {}
        self.query_params: dict[str, Any] = {}


async def test_a_plugin_checks_its_token_by_the_jwks_and_refuses_another_plugins(monkeypatch: pytest.MonkeyPatch) -> None:
    signer = tokens()
    # The plugin fetches the JWKS from the core over HTTP; here the answer is the controller's own.
    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", lambda _client: signer.jwks())
    coordinator = JwtAuthCoordinator(
        jwks_url="http://127.0.0.1:8020/api/v1/jwks", algorithm="EdDSA", audience="io.x.notes", issuer="maxitor",
        role_registry={}, session_id_claim="sid",
    )
    mine = await coordinator.process(Request(signer.issue("io.x.notes", "a1", "s1", "acme", ["member"], NOW)))
    assert mine is not None and mine.user.user_id == "a1"
    theirs = await coordinator.process(Request(signer.issue("io.x.tasks", "a1", "s1", "acme", ["member"], NOW)))
    assert theirs is None


def test_the_jwks_is_published_over_http() -> None:
    world = World()
    answer = world.client.get("/api/v1/jwks")
    assert answer.status_code == 200
    [key] = answer.json()["keys"]
    assert key["kty"] == "OKP" and key["crv"] == "Ed25519" and key["alg"] == "EdDSA" and set(key) == {"kty", "crv", "x", "kid", "use", "alg"}


def test_the_core_does_not_start_without_its_key() -> None:
    with pytest.raises(ValueError, match="MAXITOR_GATEWAY_KEY_FILE"):
        create_app(CoreSettings(session_secret="s"), resources={"core": object(), "plugins": object()})


# ── exchange and service tokens over HTTP ─────────────────────────────────────


@pytest.fixture
def world() -> World:
    w = World()
    w.signed(w.sign_up())
    assert w.client.post("/api/v1/organizations", json={"name": "Severny Veter", "code": CODE}).status_code == 200
    organization = next(o["id"] for o in w.storage.tables["organization"] if o["code"] == CODE)
    notes = w.plugins.offer("io.x.notes", "notes", "Notes", deployed=True)
    tasks = w.plugins.offer("io.x.tasks", "tasks", "Tasks", deployed=True, needs=("io.x.notes",))
    calendar = w.plugins.offer("io.x.calendar", "calendar", "Calendar", deployed=True)
    for version_id in (notes, tasks, calendar):
        plugin_id = next(v["plugin_id"] for v in w.plugins.tables["plugin_version"] if v["id"] == version_id)
        w.plugins.tables["organization_plugin"].append(
            {"organization_id": organization, "plugin_id": plugin_id, "plugin_version_id": version_id, "state": "enabled"}
        )
        w.plugins.tables["plugin_process"].append({"version_id": version_id, "kind": "backend", "address": "http://127.0.0.1:4100"})
    w.plugins.tables["plugin_version"][1]["service_key_hash"] = hashlib.sha256(b"the tasks key").hexdigest()
    return w


def signer_of(world: World) -> PluginTokensController:
    return PluginTokensController(world.gateway_key)


def exchange(world: World, token: str, plugin: str, organization: str = CODE) -> Any:
    world.client.cookies.clear()
    return world.client.post(
        "/api/v1/gateway/exchange", json={"token": token, "plugin": plugin, "organization": organization, "kind": "backend"}
    )


def test_a_plugin_calls_its_dependency_as_the_same_person(world: World) -> None:
    caller = signer_of(world).issue("io.x.tasks", "a1", "s1", CODE, ["member"], NOW)
    answer = exchange(world, caller, "notes")
    assert answer.status_code == 200, answer.text
    claims = signer_of(world).read(answer.json()["token"])
    assert claims is not None and claims["aud"] == "io.x.notes"
    assert (claims["sub"], claims["sid"], claims["org"], claims["roles"]) == ("a1", "s1", CODE, ["member"])
    assert answer.json()["address"] == "http://127.0.0.1:4100"


def test_a_plugin_that_is_not_a_dependency_is_out_of_reach(world: World) -> None:
    caller = signer_of(world).issue("io.x.tasks", "a1", "s1", CODE, ["member"], NOW)
    assert exchange(world, caller, "calendar").status_code == 404
    notes = signer_of(world).issue("io.x.notes", "a1", "s1", CODE, ["member"], NOW)
    assert exchange(world, notes, "tasks").status_code == 404


def test_a_foreign_or_mismatched_token_is_unauthorized(world: World) -> None:
    assert exchange(world, tokens().issue("io.x.tasks", "a1", "s1", CODE, ["member"], NOW), "notes").status_code == 401
    other = signer_of(world).issue("io.x.tasks", "a1", "s1", "beta", ["member"], NOW)
    assert exchange(world, other, "notes").status_code == 401


def service(world: World, key: str, organization: str = CODE) -> Any:
    return world.client.post("/api/v1/gateway/service-token", json={"service_key": key, "organization": organization})


def test_a_service_key_gives_the_plugin_a_token_for_itself(world: World) -> None:
    answer = service(world, "the tasks key")
    assert answer.status_code == 200, answer.text
    claims = signer_of(world).read(answer.json()["token"])
    assert claims is not None
    assert (claims["aud"], claims["sub"], claims["roles"], claims["org"]) == ("io.x.tasks", "plugin:io.x.tasks", ["service"], CODE)


def test_another_key_or_organization_gives_nothing(world: World) -> None:
    assert service(world, "a made-up key").status_code == 401
    assert service(world, "the tasks key", "beta").status_code == 401
