# packages/maxitor/maxitor-core/maxitor/core/roles.py
"""AccountRole — the role a session token carries: a signed-in account."""

from __future__ import annotations

from aoa.action_machine.auth import ApplicationRole


class AccountRole(ApplicationRole):
    """
    AI-CORE-BEGIN
    ROLE: A person signed in to Maxitor with a valid session.
    CONTRACT: Granted by the claim ``roles: ["account"]`` of the core's session token.
    AI-CORE-END
    """

    name = "account"
    description = "A person signed in to Maxitor with a valid session"


#: The roles the core's tokens may name.
ROLE_REGISTRY = {AccountRole.name: AccountRole}
