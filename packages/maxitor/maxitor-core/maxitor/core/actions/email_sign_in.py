# packages/maxitor/maxitor-core/maxitor/core/actions/email_sign_in.py
"""
Email and password: creating an account (StartSignUpAction, ConfirmEmailAction) and signing in
(SignInWithPasswordAction).

The email is the login. A new account's email is confirmed by a code before the consent step; the password's hash
waits in the code's row until consent. A wrong address and a wrong password get one answer.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from maxitor.core.actions.codes_flow import check_code_limits, code_sent, store_code, take_code
from maxitor.core.actions.common import client_ip, country_word, mail, normal_email, now, region_of, storage, tokens
from maxitor.core.codes import PASSWORD_WINDOW, PASSWORDS_PER_ADDRESS, PASSWORDS_PER_IP, mask
from maxitor.core.domains import PlatformDomain
from maxitor.core.errors import LimitReachedError, MailNotSentError, PasswordRuleError, SignInRefusedError
from maxitor.core.events import (
    CodeLimitReachedEvent,
    CodeSentEvent,
    CodeTriesUsedUpEvent,
    LetterNotSentEvent,
    PasswordLimitReachedEvent,
    SignedInEvent,
    WrongCodeEvent,
    WrongPasswordEvent,
)
from maxitor.core.gateways.geoip import GEOIP_CONNECTION_KEY, GeoIpGateway
from maxitor.core.gateways.mail import MAIL_CONNECTION_KEY, MailGateway, MailNotDeliveredError
from maxitor.core.passwords import broken_rule, hash_password, verify_password
from maxitor.core.storage.core_storage import CORE_CONNECTION_KEY, CoreStorage
from maxitor.core.tokens import TOKENS_CONNECTION_KEY, SessionTokensController
from pydantic import Field, SecretStr

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


class StartSignUpParams(BaseParams):
    """A new account's email and password."""

    email: str = Field(min_length=3, max_length=254, description="The email, the account's login")
    password: SecretStr = Field(description="The password chosen; never logged")


class SentResult(BaseResult):
    """The same answer whether the address has an account or not."""

    sent: bool = Field(description="Always true: the page says where the code went")


@meta(
    description="Start an account by email and password: check the password, send a code to confirm the email",
    domain=PlatformDomain,
)
@check_roles(GuestRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database")
@connection(MailGateway, key=MAIL_CONNECTION_KEY, description="The mail")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The core's tokens and code key")
class StartSignUpAction(BaseAction[StartSignUpParams, SentResult]):
    """
    AI-CORE-BEGIN
    ROLE: The first step of an account by email.
    CONTRACT: A password that breaks a rule is refused (422) and nothing is sent; past a limit, 429; otherwise a
        code goes to the address — or, when it already has an account, a letter offering to sign in — and the answer
        is the same either way.
    INVARIANTS: The password exists only as its hash in the code's row; no account is created here.
    AI-CORE-END
    """

    @summary_aspect("Check the password, then send the code")
    @context_requires(Ctx.Request.client_ip)
    @emits(CodeLimitReachedEvent, CodeSentEvent, LetterNotSentEvent)
    async def sign_up_summary(
        self, params: StartSignUpParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> SentResult:
        """The rules, the limits, the code, the letter."""
        _ = state
        email, password = normal_email(params.email), params.password.get_secret_value()
        rule = broken_rule(email, password)
        if rule is not None:
            raise PasswordRuleError("password_rule", rule=rule)
        store, keys, ip, at = storage(connections), tokens(connections), client_ip(ctx), now()
        _region, country = await region_of(box, connections)

        async def work() -> tuple[str, bool]:
            await check_code_limits(box, store, email, ip, at, country_word(country))
            has_account = await store.sign_in_of("email", email) is not None
            code = await store_code(
                keys,
                store,
                email=email,
                purpose="confirm_email",
                ip=ip,
                country=country,
                at=at,
                password_hash=None if has_account else hash_password(password),
            )
            return code, has_account

        code, has_account = await store.in_transaction(work)
        try:
            await mail(connections).send_email_confirmation(email, code, at, country, has_account)
        except MailNotDeliveredError as exc:
            await box.critical(
                Channel.error,
                "Letter to {%var.email_masked} not sent: {%var.reason}",
                LetterNotSentEvent(email_masked=mask(email), reason=exc.reason),
            )
            raise MailNotSentError("mail_not_sent") from None
        await code_sent(box, email, country_word(country))
        return SentResult(sent=True)


class ConfirmEmailParams(BaseParams):
    """The address and the code from its letter."""

    email: str = Field(min_length=3, max_length=254, description="The email being confirmed")
    code: str = Field(min_length=6, max_length=8, description="The six-digit code")


class ConsentResult(BaseResult):
    """A proven sign-in waiting for the person's consent."""

    consent_token: str = Field(description="Signed, fifteen minutes; names only references")
    name: str = Field(default="", description="The name to show on the consent step")


@meta(description="Confirm an email by its code and lead to the consent step", domain=PlatformDomain)
@check_roles(GuestRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The core's tokens and code key")
class ConfirmEmailAction(BaseAction[ConfirmEmailParams, ConsentResult]):
    """
    AI-CORE-BEGIN
    ROLE: Prove the person reads the address.
    CONTRACT: A right code answers a consent token naming the code's row; a wrong, used up or expired code is
        refused with its reason and the tries left.
    AI-CORE-END
    """

    @summary_aspect("Check the code and answer the consent token")
    @emits(CodeTriesUsedUpEvent, WrongCodeEvent)
    async def confirm_summary(
        self, params: ConfirmEmailParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> ConsentResult:
        """The code ends on use; the token names its row."""
        _ = state
        email, store, keys, at = normal_email(params.email), storage(connections), tokens(connections), now()
        # Each statement commits on its own: a wrong try must stay counted when the code is refused.
        row = await take_code(box, keys, store, email, "confirm_email", params.code, at)
        if row.get("password_hash") is None:
            # The address already had an account: its letter carried no code that could get here.
            raise SignInRefusedError("wrong")
        return ConsentResult(
            consent_token=keys.consent({"kind": "email", "code_id": str(row["id"]), "email": email}, at), name=""
        )


class PasswordSignInParams(BaseParams):
    """An email and a password."""

    email: str = Field(min_length=3, max_length=254, description="The email, the login")
    password: SecretStr = Field(description="The password; never logged")


class SessionResult(BaseResult):
    """A signed-in session."""

    session_token: str = Field(description="The session token the frontend's server puts into the cookie")
    policy_current: bool = Field(description="False when the account has not accepted the current privacy policy")


@meta(description="Sign in with an email and password", domain=PlatformDomain)
@check_roles(GuestRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The core's tokens")
class SignInWithPasswordAction(BaseAction[PasswordSignInParams, SessionResult]):
    """
    AI-CORE-BEGIN
    ROLE: Sign an account in by its email and password.
    CONTRACT: A wrong address and a wrong password are one refusal (401); ten wrong passwords for an address in
        fifteen minutes, or thirty from an IP, refuse with the time of the next try (429).
    INVARIANTS: A wrong address costs the same work as a wrong password; the password reaches no log.
    AI-CORE-END
    """

    @summary_aspect("Check the password and sign the session")
    @context_requires(Ctx.Request.client_ip)
    @emits(PasswordLimitReachedEvent, SignedInEvent, WrongPasswordEvent)
    async def sign_in_summary(
        self, params: PasswordSignInParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> SessionResult:
        """The limits, the hash, the session."""
        _ = state
        email, store, keys, ip, at = (
            normal_email(params.email),
            storage(connections),
            tokens(connections),
            client_ip(ctx),
            now(),
        )
        _region, country = await region_of(box, connections)
        address, per_ip, oldest = await store.attempt_counts(email, ip, at - PASSWORD_WINDOW)
        if address >= PASSWORDS_PER_ADDRESS or per_ip >= PASSWORDS_PER_IP:
            limit = "address per fifteen minutes" if address >= PASSWORDS_PER_ADDRESS else "IP per fifteen minutes"
            await box.warning(
                Channel.security,
                "Passwords limit {%var.limit} for {%var.email_masked}",
                PasswordLimitReachedEvent(email_masked=mask(email), country=country_word(country), limit=limit),
            )
            raise LimitReachedError(
                "too_many_passwords",
                until=(oldest or at) + PASSWORD_WINDOW
                if address >= PASSWORDS_PER_ADDRESS
                else at + timedelta(minutes=15),
            )
        sign_in = await store.sign_in_of("email", email)
        if not verify_password(
            None if sign_in is None else sign_in["password_hash"], params.password.get_secret_value()
        ):
            await store.wrong_password(str(uuid.uuid4()), email, ip, at)
            await box.warning(
                Channel.security,
                "Wrong password for {%var.email_masked}",
                WrongPasswordEvent(email_masked=mask(email), country=country_word(country)),
            )
            raise SignInRefusedError("wrong")
        assert sign_in is not None
        account_id = str(sign_in["account_id"])
        await store.touch_sign_in(str(sign_in["id"]), at)
        account = await store.account(account_id)
        await box.info(
            Channel.security,
            "Account {%var.account_id} signed in by {%var.provider}",
            SignedInEvent(account_id=account_id, provider="email", country=country_word(country)),
        )
        return SessionResult(
            session_token=keys.session(account_id, at),
            policy_current=bool(account and account["policy_version"] >= keys.policy_version),
        )
