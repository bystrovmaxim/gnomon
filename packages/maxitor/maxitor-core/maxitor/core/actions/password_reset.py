# packages/maxitor/maxitor-core/maxitor/core/actions/password_reset.py
"""RequestPasswordResetAction and ResetPasswordAction — a forgotten password replaced through a code by email."""

from __future__ import annotations

from maxitor.core.actions.codes_flow import check_code_limits, code_sent, store_code, take_code
from maxitor.core.actions.common import client_ip, country_word, mail, normal_email, now, region_of, storage, tokens
from maxitor.core.actions.email_sign_in import SentResult
from maxitor.core.codes import mask
from maxitor.core.domains import PlatformDomain
from maxitor.core.errors import CodeRefusedError, MailNotSentError, PasswordRuleError
from maxitor.core.events import (
    CodeLimitReachedEvent,
    CodeSentEvent,
    CodeTriesUsedUpEvent,
    LetterNotSentEvent,
    PasswordChangedEvent,
    PasswordResetRequestedEvent,
    WrongCodeEvent,
)
from maxitor.core.gateways.geoip import GEOIP_CONNECTION_KEY, GeoIpGateway
from maxitor.core.gateways.mail import MAIL_CONNECTION_KEY, MailGateway, MailNotDeliveredError
from maxitor.core.passwords import broken_rule, hash_password
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


class ResetRequestParams(BaseParams):
    """The address whose password is forgotten."""

    email: str = Field(min_length=3, max_length=254, description="The email, the login")


@meta(description="Send a code to reset a forgotten password", domain=PlatformDomain)
@check_roles(GuestRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database")
@connection(MailGateway, key=MAIL_CONNECTION_KEY, description="The mail")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The core's code key")
class RequestPasswordResetAction(BaseAction[ResetRequestParams, SentResult]):
    """
    AI-CORE-BEGIN
    ROLE: Start a password reset.
    CONTRACT: A code goes only to an address whose email sign-in has a password; the answer is the same either way.
    AI-CORE-END
    """

    @summary_aspect("Send the reset code when the address has a password")
    @context_requires(Ctx.Request.client_ip)
    @emits(CodeLimitReachedEvent, CodeSentEvent, LetterNotSentEvent, PasswordResetRequestedEvent)
    async def request_summary(
        self, params: ResetRequestParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> SentResult:
        """The limits first, so an unknown address costs the same as a known one."""
        _ = state
        email, store, keys, ip, at = (
            normal_email(params.email),
            storage(connections),
            tokens(connections),
            client_ip(ctx),
            now(),
        )
        _region, country = await region_of(box, connections)

        async def work() -> str | None:
            await check_code_limits(box, store, email, ip, at, country_word(country))
            sign_in = await store.sign_in_of("email", email)
            if sign_in is None or sign_in["password_hash"] is None:
                return None
            return await store_code(keys, store, email=email, purpose="reset_password", ip=ip, country=country, at=at)

        code = await store.in_transaction(work)
        if code is not None:
            try:
                await mail(connections).send_password_reset(email, code, at, country)
            except MailNotDeliveredError as exc:
                await box.critical(
                    Channel.error,
                    "Letter to {%var.email_masked} not sent: {%var.reason}",
                    LetterNotSentEvent(email_masked=mask(email), reason=exc.reason),
                )
                raise MailNotSentError("mail_not_sent") from None
            await box.info(
                Channel.security,
                "Password reset asked for {%var.email_masked}",
                PasswordResetRequestedEvent(email_masked=mask(email), country=country_word(country)),
            )
            await code_sent(box, email, country_word(country))
        return SentResult(sent=True)


class ResetParams(BaseParams):
    """The code from the letter and the new password."""

    email: str = Field(min_length=3, max_length=254, description="The email, the login")
    code: str = Field(min_length=6, max_length=8, description="The six-digit code")
    password: SecretStr = Field(description="The new password; never logged")


class ChangedResult(BaseResult):
    """The password was changed."""

    changed: bool = Field(description="True")


@meta(description="Replace a password through the code sent to its email", domain=PlatformDomain)
@check_roles(GuestRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database")
@connection(MailGateway, key=MAIL_CONNECTION_KEY, description="The mail")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The core's code key")
class ResetPasswordAction(BaseAction[ResetParams, ChangedResult]):
    """
    AI-CORE-BEGIN
    ROLE: Set a new password.
    CONTRACT: The new password keeps the rules; a right code replaces the hash and the time it was set, so sessions
        issued before stop renewing; a letter tells the address.
    AI-CORE-END
    """

    @summary_aspect("Check the code and the password, then replace the hash")
    @emits(CodeTriesUsedUpEvent, LetterNotSentEvent, PasswordChangedEvent, WrongCodeEvent)
    async def reset_summary(
        self, params: ResetParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> ChangedResult:
        """Rules, code, hash, letter."""
        _ = state
        email, password = normal_email(params.email), params.password.get_secret_value()
        rule = broken_rule(email, password)
        if rule is not None:
            raise PasswordRuleError("password_rule", rule=rule)
        store, keys, at = storage(connections), tokens(connections), now()
        _region, country = await region_of(box, connections)
        await take_code(box, keys, store, email, "reset_password", params.code, at)
        sign_in = await store.sign_in_of("email", email)
        if sign_in is None:
            raise CodeRefusedError("expired")
        account_id = str(sign_in["account_id"])
        new_hash = hash_password(password)

        async def work() -> None:
            changed_at = await store.account_lock(account_id)
            await store.update(
                "sign_in",
                {"id": str(sign_in["id"])},
                {"password_hash": new_hash, "password_changed_at": changed_at},
                changed_at,
                account_id,
                type(self).__name__,
            )

        await store.in_transaction(work)
        await box.info(
            Channel.security,
            "Password of {%var.account_id} changed",
            PasswordChangedEvent(account_id=account_id, country=country_word(country)),
        )
        try:
            await mail(connections).send_password_changed(email, at, country)
        except MailNotDeliveredError as exc:
            await box.critical(
                Channel.error,
                "Letter to {%var.email_masked} not sent: {%var.reason}",
                LetterNotSentEvent(email_masked=mask(email), reason=exc.reason),
            )
        return ChangedResult(changed=True)
