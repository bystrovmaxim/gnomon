# packages/maxitor-plugin-template/src/maxitor_notes/organization_auth_coordinator.py
"""
OrganizationAuthCoordinator — the context of a request to the plugin: the core's token and the address's organization.

::

    request ──► JwtAuthCoordinator: the core's token (EdDSA, aud = the plugin's id, exp) ──► user, roles, session
            └─► the path parameter {organization} ──► OrganizationMember.organization

The token is checked by AOA's standard coordinator against the core's public key. The organization comes
from the address the gateway has already checked membership in, never from a body, so a write is bound to
the same organization as a read.
"""

from __future__ import annotations

import re
from typing import Any

from aoa.action_machine.auth.jwt_auth.jwt_auth_coordinator import JwtAuthCoordinator
from aoa.action_machine.context import Context
from aoa.action_machine.runtime.base_coordinator import BaseCoordinator
from maxitor_notes.organization_member import ORGANIZATION_CODE_PATTERN, OrganizationMember


class OrganizationAuthCoordinator(BaseCoordinator):
    """
    AI-CORE-BEGIN
    ROLE: Build the context of a request to the plugin.
    CONTRACT: ``None`` — the request is not authenticated — when the token fails AOA's check or the address has no
    well-formed organization; otherwise the token's person and roles with the address's organization.
    INVARIANTS: Reads the organization only from the path; logs nothing.
    AI-CORE-END
    """

    def __init__(self, tokens: JwtAuthCoordinator) -> None:
        self._tokens = tokens

    def __repr__(self) -> str:
        """Name the coordinator only."""
        return "OrganizationAuthCoordinator()"

    async def process(self, request_data: Any) -> Context | None:
        """The token's person in the organization of the address, or ``None``."""
        organization = getattr(request_data, "path_params", {}).get("organization")
        if not isinstance(organization, str) or re.fullmatch(ORGANIZATION_CODE_PATTERN, organization) is None:
            return None
        context = await self._tokens.process(request_data)
        if context is None:
            return None
        user = context.user
        member = OrganizationMember(user_id=user.user_id, session_id=user.session_id, roles=user.roles, organization=organization)
        return Context(user=member, request=context.request, runtime=context.runtime)
