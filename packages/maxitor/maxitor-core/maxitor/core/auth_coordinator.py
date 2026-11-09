# packages/maxitor/maxitor-core/maxitor/core/auth_coordinator.py
"""
CoreAuthCoordinator — every request's context: its address always, the signed-in account when the session cookie
holds a valid token.

The token is AOA's JWT, read from the cookie ``__Host-maxitor_session`` (constitution 1.6.0, rule 55) with the
standard authenticator: signature, ``exp``, ``sid`` and the ``account`` role, without the database. A request with
no valid token is a guest: open actions answer it, actions of ``AccountRole`` refuse it.
"""

from __future__ import annotations

from typing import Any

from maxitor.core.roles import ROLE_REGISTRY
from maxitor.core.tokens import SESSION_COOKIE

from aoa.action_machine.auth.auth_coordinator import AuthCoordinator
from aoa.action_machine.auth.jwt_auth import CookieCredentialExtractor, HttpContextAssembler, JwtAuthenticator
from aoa.action_machine.context.context import Context
from aoa.action_machine.context.request_info import RequestInfo
from aoa.action_machine.context.user_info import UserInfo


class CoreAuthCoordinator(AuthCoordinator):
    """
    AI-CORE-BEGIN
    ROLE: Give every request its context.
    CONTRACT: ``process`` never answers ``None``: a valid session gives the account and the role ``account``,
        anything else a guest; the request's address is always there.
    INVARIANTS: Never logs or keeps a token.
    AI-CORE-END
    """

    def __init__(self, secret: str) -> None:
        super().__init__(
            CookieCredentialExtractor(SESSION_COOKIE),
            JwtAuthenticator(secret_key=secret, algorithm="HS256", role_registry=ROLE_REGISTRY, session_id_claim="sid"),
            HttpContextAssembler(),
        )

    def __repr__(self) -> str:
        return "CoreAuthCoordinator(cookie=__Host-maxitor_session)"

    async def process(self, request_data: Any) -> Context:
        """The request's context: the account of a valid session, or a guest."""
        request = RequestInfo(**await self.assembler.assemble(request_data))
        credentials = await self.extractor.extract(request_data)
        user = await self.authenticator.authenticate(credentials) if credentials else None
        return Context(user=user or UserInfo(), request=request)
