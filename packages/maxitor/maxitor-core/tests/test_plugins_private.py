# packages/maxitor/maxitor-core/tests/test_plugins_private.py
"""
A private plugin: each refusal of the dialog; a release's address adds a draft version owned by the organization; an
uploaded wheel is kept once under the hash Maxitor computes and named pkg:generic; another organization sees none of it.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from typing import Any

import pytest

from tests.fakes import World
from tests.plugin_wheels import wheel

CODE = "severny-veter"
SHA = "9d1f02c7e4b8a6013f5c2d9e8b7a6f4c3d2e1b0a9f8e7d6c5b4a3f2e1d0ca8e5"
RELEASE = "pkg:github/severny-veter/maxitor-reports@v0.3.0?file=sv_reports-0.3.0-py3-none-any.whl"


def _world(**kwargs: Any) -> World:
    w = World(**kwargs)
    w.signed(w.sign_up())
    assert w.client.post("/api/v1/organizations", json={"name": "Severny Veter", "code": CODE}).status_code == 200
    return w


@pytest.fixture
def world() -> World:
    return _world()


def add(world: World, purl: str, sha256: str = SHA) -> tuple[int, dict[str, Any]]:
    answer = world.client.post("/api/v1/plugins/private", json={"code": CODE, "purl": purl, "sha256": sha256})
    return answer.status_code, dict(answer.json())


def upload(world: World, data: bytes, name: str = "sv_reports-0.3.0-py3-none-any.whl") -> tuple[int, dict[str, Any]]:
    body = {"code": CODE, "file_name": name, "content_base64": base64.b64encode(data).decode()}
    answer = world.client.post("/api/v1/plugins/private/upload", json=body)
    return answer.status_code, dict(answer.json())


@pytest.mark.parametrize(
    ("purl", "sha256", "reason"),
    [
        ("pkg:pypi/sv-reports@0.3.0", SHA, "pypi_is_public"),
        ("https://github.com/severny-veter/maxitor-reports", SHA, "not_a_purl"),
        ("pkg:npm/sv-reports@0.3.0", SHA, "not_a_purl"),
        ("pkg:github/severny-veter/maxitor-reports@v0.3.0", SHA, "no_file"),
        ("pkg:github/severny-veter/maxitor-reports@v0.3.0?file=notes.tar.gz", SHA, "no_file"),
        (RELEASE, "9d1f02c7e4b8", "sha256_form"),
        (RELEASE, "Z" * 64, "sha256_form"),
    ],
)
def test_the_dialog_refuses_each_fault(world: World, purl: str, sha256: str, reason: str) -> None:
    status, body = add(world, purl, sha256)
    assert (status, body["error"]) == (422, reason)
    assert [v.reason for _m, v in world.logger.lines if type(v).__name__ == "PrivatePluginRefusedEvent"] == [reason]
    assert world.plugins.tables["plugin_version"] == []


def test_a_release_adds_a_draft_version_owned_by_the_organization(world: World) -> None:
    status, body = add(world, RELEASE, SHA.upper())
    assert status == 200 and body["state"] == "draft" and body["sha256"] == SHA
    version = world.plugins.tables["plugin_version"][0]
    plugin = world.plugins.tables["plugin"][0]
    assert (version["version"], version["state"], version["purl"]) == ("0.3.0", "draft", RELEASE)
    assert plugin["owner_organization_id"] is not None and plugin["passport_id"] == f"pending.{version['id']}"
    cards = world.client.get(f"/api/v1/organizations/{CODE}/plugins").json()["private"]
    assert [(c["title"], c["state"], c["private"]) for c in cards] == [("maxitor-reports", "draft", True)]
    added = [v for _m, v in world.logger.lines if type(v).__name__ == "PrivatePluginAddedEvent"]
    assert [(e.uploaded, e.sha256) for e in added] == [(False, SHA)]


def test_an_uploaded_wheel_is_kept_once_under_its_computed_hash(world: World) -> None:
    data = wheel()
    sha = hashlib.sha256(data).hexdigest()
    status, body = upload(world, data)
    assert status == 200 and body["sha256"] == sha
    assert body["purl"] == f"pkg:generic/maxitor-notes@0.4.0?checksum=sha256:{sha}"
    assert (world.wheels / f"{sha}.whl").read_bytes() == data
    assert upload(world, data)[0] == 200
    assert len(list(world.wheels.glob("*.whl"))) == 1


def test_a_file_that_is_not_a_wheel_or_too_large_is_refused() -> None:
    world = _world(wheel_max_bytes=2000)
    assert upload(world, b"not a zip at all") == (422, {"error": "not_a_wheel"})
    assert upload(world, wheel({"maxitor_notes/blob.txt": secrets.token_hex(3000)}))[1] == {"error": "too_large", "limit": 2000}
    assert world.plugins.tables["plugin_version"] == [] and not list(world.wheels.glob("*.whl"))


def test_another_organization_sees_nothing_of_it(world: World) -> None:
    assert add(world, RELEASE)[0] == 200
    world.client.cookies.clear()
    world.signed(world.sign_up(email="daniel@example.com", name="Daniel"))
    assert world.client.post("/api/v1/organizations", json={"name": "Lumen", "code": "lumen-labs"}).status_code == 200
    listed = world.client.get("/api/v1/organizations/lumen-labs/plugins").json()
    assert listed["private"] == [] and listed["marketplace"] == []
    pending = world.plugins.tables["plugin"][0]["passport_id"]
    assert world.client.get(f"/api/v1/organizations/lumen-labs/plugins/{pending}").status_code == 404
    assert world.client.post("/api/v1/plugins/private", json={"code": CODE, "purl": RELEASE, "sha256": SHA}).status_code == 404
