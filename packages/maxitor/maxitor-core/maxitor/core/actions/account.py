# packages/maxitor/maxitor-core/maxitor/core/actions/account.py
"""
The account and its session: CreateAccountAction, AcceptPolicyAction, RenewSessionAction, SignOutAction,
CurrentUserAction.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from maxitor.core.actions.common import client_ip, country_word, now, region_of, storage, tokens
from maxitor.core.domains import PlatformDomain
from maxitor.core.errors import ConflictError, CoreRefusalError, SignInRefusedError
from maxitor.core.events import AccountCreatedEvent, PolicyAcceptedAgainEvent, SignedOutEvent
from maxitor.core.gateways.geoip import GEOIP_CONNECTION_KEY, GeoIpGateway
from maxitor.core.roles import AccountRole
from maxitor.core.storage.core_storage import CORE_CONNECTION_KEY, CoreStorage
from maxitor.core.tokens import TOKENS_CONNECTION_KEY, SessionTokensController
from pydantic import Field

from aoa.action_machine.auth import GuestRole
from aoa.action_machine.context.context_view import ContextView
from aoa.action_machine.context.ctx_constants import Ctx
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.context_requires import context_requires
from aoa.action_machine.intents.emits import emits
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging import Channel
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class ConsentRequiredError(CoreRefusalError):
    """The consent box was not ticked."""

    status = 422


class CreateAccountParams(BaseParams):
    """The consent step's answer."""

    consent_token: str = Field(min_length=1, description="The token ConfirmEmailAction or FinishSignInAction answered")
    name: str = Field(min_length=1, max_length=200, description="The person's name, editable on the consent step")
    accepted: bool = Field(description="The consent box: true only when ticked")


class SessionOnlyResult(BaseResult):
    """A new session."""

    session_token: str = Field(description="The session token the frontend's server puts into the cookie")


@meta(description="Create the account once the person accepted the privacy policy", domain=PlatformDomain)
@check_roles(GuestRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The core's tokens and policy version")
class CreateAccountAction(BaseAction[CreateAccountParams, SessionOnlyResult]):
    """
    AI-CORE-BEGIN
    ROLE: The only way an account comes to exist.
    CONTRACT: Refuses without the tick (422) and with an expired token (401); a sign-in taken meanwhile is a
        conflict (409); otherwise the account and its first sign-in are created in one change with the policy's
        version, time and IP, and a session is signed.
    AI-CORE-END
    """

    @summary_aspect("Check the consent and the token, then create the account and its first sign-in")
    @context_requires(Ctx.Request.client_ip)
    @emits(AccountCreatedEvent)
    async def create_summary(
        self, params: CreateAccountParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> SessionOnlyResult:
        """One change: the account, its sign-in, both versions."""
        _ = state
        if not params.accepted:
            raise ConsentRequiredError("consent_required")
        store, keys, ip, at = storage(connections), tokens(connections), client_ip(ctx), now()
        references = keys.read_consent(params.consent_token)
        if references is None:
            raise SignInRefusedError("expired")
        _region, country = await region_of(box, connections)
        if references.get("kind") == "email":
            code = await store.code_by_id(str(references["code_id"]))
            if code is None or code["purpose"] != "confirm_email" or code["password_hash"] is None:
                raise SignInRefusedError("expired")
            way, subject, email, password_hash = (
                "email",
                str(code["email"]),
                str(code["email"]),
                str(code["password_hash"]),
            )
        else:
            way, subject, email, password_hash = (
                str(references["provider"]),
                str(references["subject"]),
                str(references["email"]),
                None,
            )
        account_id, sign_in_id = str(uuid.uuid4()), str(uuid.uuid4())

        async def work() -> None:
            if await store.sign_in_of(way, subject) is not None:
                raise ConflictError("taken")
            changed_at = await store.account_lock(account_id)
            await store.insert(
                "account",
                {
                    "id": account_id,
                    "name": params.name.strip(),
                    "email": email.lower(),
                    "policy_version": keys.policy_version,
                    "policy_accepted_at": changed_at,
                    "policy_accepted_ip": ip,
                    "created_at": changed_at,
                    "updated_at": None,
                },
                changed_at,
                account_id,
                type(self).__name__,
            )
            await store.insert(
                "sign_in",
                {
                    "id": sign_in_id,
                    "account_id": account_id,
                    "provider": way,
                    "provider_subject": subject.lower() if way == "email" else subject,
                    "email": email.lower(),
                    "password_hash": password_hash,
                    "password_changed_at": changed_at if password_hash else None,
                    "added_country": country,
                    "added_ip": ip,
                    "added_at": changed_at,
                    "last_used_at": changed_at,
                },
                changed_at,
                account_id,
                type(self).__name__,
            )

        await store.in_transaction(work)
        await box.info(
            Channel.security,
            "Account {%var.account_id} created by {%var.provider}",
            AccountCreatedEvent(
                account_id=account_id, provider=way, country=country_word(country), policy_version=keys.policy_version
            ),
        )
        return SessionOnlyResult(session_token=keys.session(account_id, at))


class AcceptPolicyParams(BaseParams):
    """The consent step's answer for an existing account."""

    accepted: bool = Field(description="The consent box: true only when ticked")


class AcceptedResult(BaseResult):
    """The policy now accepted."""

    policy_version: int = Field(description="The version the account accepted")


@meta(description="Accept the current privacy policy for a signed-in account", domain=PlatformDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The current policy version")
class AcceptPolicyAction(BaseAction[AcceptPolicyParams, AcceptedResult]):
    """
    AI-CORE-BEGIN
    ROLE: Record that an existing account accepted a new policy version.
    CONTRACT: Refuses without the tick; records the version, time and IP in one change.
    AI-CORE-END
    """

    @summary_aspect("Record the acceptance")
    @context_requires(Ctx.User.user_id, Ctx.Request.client_ip)
    @emits(PolicyAcceptedAgainEvent)
    async def accept_summary(
        self, params: AcceptPolicyParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> AcceptedResult:
        """One change of the account."""
        _ = state
        if not params.accepted:
            raise ConsentRequiredError("consent_required")
        store, keys, account_id, ip = (
            storage(connections),
            tokens(connections),
            str(ctx.get(Ctx.User.user_id)),
            client_ip(ctx),
        )

        async def work() -> None:
            changed_at = await store.account_lock(account_id)
            await store.update(
                "account",
                {"id": account_id},
                {
                    "policy_version": keys.policy_version,
                    "policy_accepted_at": changed_at,
                    "policy_accepted_ip": ip,
                    "updated_at": changed_at,
                },
                changed_at,
                account_id,
                type(self).__name__,
            )

        await store.in_transaction(work)
        await box.info(
            Channel.security,
            "Account {%var.account_id} accepted policy {%var.policy_version}",
            PolicyAcceptedAgainEvent(account_id=account_id, policy_version=keys.policy_version),
        )
        return AcceptedResult(policy_version=keys.policy_version)


class RenewParams(BaseParams):
    """The session token the frontend's server holds."""

    session_token: str = Field(min_length=1, description="The current session token")


@meta(
    description="Renew a session token while the person is active, up to 30 days from signing in", domain=PlatformDomain
)
@check_roles(GuestRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The core's tokens")
class RenewSessionAction(BaseAction[RenewParams, SessionOnlyResult]):
    """
    AI-CORE-BEGIN
    ROLE: Keep an active session alive.
    CONTRACT: Refuses (401) a token that is invalid, older than 30 days from signing in, or issued before the
        account's password changed; otherwise signs a new token with the same session id.
    AI-CORE-END
    """

    @summary_aspect("Check the token and the password's change, then renew")
    async def renew_summary(
        self, params: RenewParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> SessionOnlyResult:
        """A renewal is an action: it may read the account, which the token check never does."""
        _ = (state, box)
        store, keys, at = storage(connections), tokens(connections), now()
        claims = keys.read_session(params.session_token)
        if claims is None:
            raise SignInRefusedError("expired")
        changed = await store.password_changed_at(str(claims["sub"]))
        if changed is not None and changed > datetime.fromtimestamp(int(claims["iat"]), UTC):
            raise SignInRefusedError("password_changed")
        token = keys.renewed(claims, at)
        if token is None:
            raise SignInRefusedError("expired")
        return SessionOnlyResult(session_token=token)


class EmptyParams(BaseParams):
    """Nothing: the account comes from the session."""


class EmptyResult(BaseResult):
    """Nothing to answer."""


@meta(description="Sign the account out", domain=PlatformDomain)
@check_roles(AccountRole)
class SignOutAction(BaseAction[EmptyParams, EmptyResult]):
    """
    AI-CORE-BEGIN
    ROLE: Record that the person signed out; the frontend's server clears the cookie.
    AI-CORE-END
    """

    @summary_aspect("Record the sign-out")
    @context_requires(Ctx.User.user_id)
    @emits(SignedOutEvent)
    async def sign_out_summary(
        self, params: EmptyParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> EmptyResult:
        """The session ends at the cookie; the event says when."""
        _ = (params, state, connections)
        await box.info(
            Channel.security,
            "Account {%var.account_id} signed out",
            SignedOutEvent(account_id=str(ctx.get(Ctx.User.user_id))),
        )
        return EmptyResult()


class OrganizationEntryResult(BaseResult):
    """One organization the account works in."""

    code: str = Field(description="The address code")
    name: str = Field(description="The organization's name")
    is_admin: bool = Field(description="Whether the account administers it")


class MeResult(BaseResult):
    """The signed-in account and its organizations."""

    account_id: str = Field(description="The account")
    name: str = Field(description="The person's name")
    email: str = Field(description="The account's email")
    policy_current: bool = Field(description="False when the current privacy policy is not yet accepted")
    organizations: list[OrganizationEntryResult] = Field(
        description="The organizations the account has an active user in"
    )


@meta(description="Answer the signed-in account and its organizations", domain=PlatformDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The current policy version")
class CurrentUserAction(BaseAction[EmptyParams, MeResult]):
    """
    AI-CORE-BEGIN
    ROLE: Tell the frontend who is signed in.
    AI-CORE-END
    """

    @summary_aspect("Read the account and its organizations")
    @context_requires(Ctx.User.user_id)
    async def me_summary(
        self, params: EmptyParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> MeResult:
        """The account, its organizations by name."""
        _ = (params, state, box)
        store, keys, account_id = storage(connections), tokens(connections), str(ctx.get(Ctx.User.user_id))
        account = await store.account(account_id)
        if account is None:
            raise SignInRefusedError("expired")
        organizations = [
            OrganizationEntryResult(code=o["code"], name=o["name"], is_admin=o["is_admin"])
            for o in await store.organizations_of(account_id)
        ]
        return MeResult(
            account_id=account_id,
            name=account["name"],
            email=account["email"],
            policy_current=account["policy_version"] >= keys.policy_version,
            organizations=organizations,
        )
