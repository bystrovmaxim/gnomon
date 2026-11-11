# packages/maxitor-plugin-sdk/tests/test_roles.py
"""A plugin works with the core's roles as they are: it declares none, and a node asks only for member or administrator."""

from __future__ import annotations

from maxitor_plugin_sdk.checks import navigation_problems, node_role_problems, passport_role_problems
from maxitor_plugin_sdk.roles import CORE_ROLES, NODE_ROLES


def test_the_core_roles_are_member_administrator_and_service() -> None:
    assert set(CORE_ROLES) == {"member", "administrator", "service"}
    assert NODE_ROLES == {"member", "administrator"}


def test_a_passport_with_roles_is_refused() -> None:
    assert passport_role_problems({"id": "io.x.notes"}) == []
    [problem] = passport_role_problems({"roles": [{"name": "reader", "description": "Reads."}]})
    assert "declares no roles" in problem


def test_a_node_asks_only_for_the_cores_roles() -> None:
    navigation = {"navigation": 1, "nodes": [
        {"id": "notes", "attach": "root", "title": "Notes", "page": "/", "roles": ["member"],
         "children": [{"id": "admin", "title": "Admin", "page": "/admin", "roles": ["administrator", "reader"]}]},
    ]}
    assert node_role_problems(navigation) == [
        "navigation: 'admin' asks for the role 'reader'; a node asks for member or administrator"
    ]
    assert node_role_problems(navigation)[0] in navigation_problems(navigation)
