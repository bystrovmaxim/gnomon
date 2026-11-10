# packages/maxitor-plugin-template/tests/test_app.py
"""The backend's routes: every one lies under /p/notes/api/{organization} and is an action."""

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from maxitor_notes.app import create_app


def test_every_route_lies_under_the_plugins_path_and_the_organization() -> None:
    key = Ed25519PrivateKey.generate().public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    app = create_app(dsn="postgresql://plg_notes@db.invalid/maxitor", core_public_key=key)
    routes = {(next(iter(route.methods)), route.path) for route in app.routes if getattr(route, "methods", None) and route.path.startswith("/p/")}
    assert routes == {
        ("POST", "/p/notes/api/{organization}/notes"),
        ("PATCH", "/p/notes/api/{organization}/notes/{note_id}"),
        ("DELETE", "/p/notes/api/{organization}/notes/{note_id}"),
        ("GET", "/p/notes/api/{organization}/items/{item_id}/notes"),
        ("GET", "/p/notes/api/{organization}/lists/list_note_authors"),
        ("POST", "/p/notes/api/{organization}/items/{item_id}/revisions"),
        ("GET", "/p/notes/api/{organization}/items/{item_id}/published"),
        ("GET", "/p/notes/api/{organization}/items/{item_id}/draft"),
    }


def test_an_organization_in_a_request_body_is_refused_not_used() -> None:
    from fastapi.testclient import TestClient

    key = Ed25519PrivateKey.generate().public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    client = TestClient(create_app(dsn="postgresql://plg_notes@db.invalid/maxitor", core_public_key=key))
    response = client.post("/p/notes/api/acme/notes", json={"item_id": "i", "body": "b", "organization": "globex"})
    assert response.status_code == 422


def test_the_app_accepts_only_a_token_issued_for_this_plugin() -> None:
    import time

    import jwt
    from fastapi.testclient import TestClient

    core = Ed25519PrivateKey.generate()
    key = core.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    client = TestClient(create_app(dsn="postgresql://plg_notes@db.invalid/maxitor", core_public_key=key), raise_server_exceptions=False)

    def call(audience: str) -> int:
        now = int(time.time())
        claims = {"iss": "maxitor", "aud": audience, "sub": "u1", "sid": "s1", "org": "acme", "roles": ["reader"], "iat": now, "exp": now + 60}
        token = jwt.encode(claims, core, algorithm="EdDSA")
        return client.get("/p/notes/api/acme/items/i/notes", headers={"authorization": f"Bearer {token}"}).status_code

    assert call("io.github.acme.tags") == 403
    # Past authentication the action needs the database, which this test does not start.
    assert call("io.github.bystrovmaxim.notes") != 403
