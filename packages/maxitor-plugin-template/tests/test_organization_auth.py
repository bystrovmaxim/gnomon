# packages/maxitor-plugin-template/tests/test_organization_auth.py
"""The plugin accepts only the core's EdDSA token for its own id, and takes the organization from the address only."""

import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from maxitor_notes.organization_auth_coordinator import OrganizationAuthCoordinator
from maxitor_notes.organization_member import OrganizationMember
from maxitor_plugin_sdk.roles import CORE_ROLES, MemberRole
from starlette.requests import Request

from aoa.action_machine.auth.jwt_auth.jwt_auth_coordinator import JwtAuthCoordinator

PLUGIN_ID = "io.github.bystrovmaxim.notes"
CORE_KEY = Ed25519PrivateKey.generate()
CORE_PUBLIC_PEM = CORE_KEY.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()


def _token(key=CORE_KEY, algorithm="EdDSA", **claims) -> str:
    now = int(time.time())
    body = {"iss": "maxitor", "aud": PLUGIN_ID, "sub": "33333333-3333-3333-3333-333333333333", "sid": "s1", "org": "acme", "roles": ["member"], "iat": now, "exp": now + 60}
    body.update(claims)
    return jwt.encode(body, key, algorithm=algorithm)


def _request(path_params: dict, token: str | None) -> Request:
    headers = [] if token is None else [(b"authorization", f"Bearer {token}".encode())]
    scope = {"type": "http", "method": "GET", "path": "/p/notes/api/acme/items/1/notes", "headers": headers, "query_string": b"", "path_params": path_params, "client": ("127.0.0.1", 1), "server": ("test", 80), "scheme": "http"}
    return Request(scope)


def _coordinator() -> OrganizationAuthCoordinator:
    tokens = JwtAuthCoordinator(
        secret_key=CORE_PUBLIC_PEM, algorithm="EdDSA", audience=PLUGIN_ID, issuer="maxitor",
        role_registry=CORE_ROLES, session_id_claim="sid",
    )
    return OrganizationAuthCoordinator(tokens)


async def test_the_cores_token_gives_the_person_in_the_organization_of_the_address() -> None:
    context = await _coordinator().process(_request({"organization": "acme"}, _token()))
    assert isinstance(context.user, OrganizationMember)
    assert context.user.organization == "acme"
    assert context.user.user_id == "33333333-3333-3333-3333-333333333333"
    assert context.user.roles == (MemberRole,)


async def test_the_organization_comes_from_the_address_not_from_the_token() -> None:
    context = await _coordinator().process(_request({"organization": "globex"}, _token(org="acme")))
    assert context.user.organization == "globex"


@pytest.mark.parametrize("path_params", [{}, {"organization": ""}, {"organization": "Acme"}, {"organization": "acme;drop"}, {"organization": "../core"}])
async def test_an_address_without_a_well_formed_organization_is_not_authenticated(path_params) -> None:
    assert await _coordinator().process(_request(path_params, _token())) is None


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(lambda: _token(aud="io.github.acme.tags"), id="another-plugins-token"),
        pytest.param(lambda: _token(exp=int(time.time()) - 1), id="expired"),
        pytest.param(lambda: _token(key=Ed25519PrivateKey.generate()), id="not-signed-by-the-core"),
        pytest.param(lambda: _token(key="a shared secret of thirty-two bytes!", algorithm="HS256"), id="hs256"),
        pytest.param(lambda: None, id="no-token"),
    ],
)
async def test_a_token_the_core_did_not_issue_for_this_plugin_is_refused(token) -> None:
    assert await _coordinator().process(_request({"organization": "acme"}, token())) is None
