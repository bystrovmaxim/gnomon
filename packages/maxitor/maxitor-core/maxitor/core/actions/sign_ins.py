# packages/maxitor/maxitor-core/maxitor/core/actions/sign_ins.py
"""
The ways an account gets in: ListSignInsAction, LinkSignInAction, LinkEmailAction, UnlinkSignInAction.

A signed-in account links only what its region allows; a way in that already signs in another account is refused,
because two accounts are never joined; the last way in is never removed.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from maxitor.core.actions.codes_flow import check_code_limits, code_sent, store_code, take_code
from maxitor.core.actions.common import (
    ALLOWED,
    client_ip,
    country_word,
    mail,
    normal_email,
    now,
    region_of,
    storage,
    tokens,
)
from maxitor.core.actions.provider_sign_in import FinishParams, checked_region, proven_person
from maxitor.core.codes import mask
from maxitor.core.domains import PlatformDomain
from maxitor.core.errors import ConflictError, MailNotSentError, PasswordRuleError, SignInRefusedError
from maxitor.core.events import (
    CodeLimitReachedEvent,
    CodeSentEvent,
    CodeTriesUsedUpEvent,
    LetterNotSentEvent,
    LinkRefusedEvent,
    ProviderAnswerRejectedEvent,
    ProviderRefusedForRegionEvent,
    SignInLinkedEvent,
    SignInUnlinkedEvent,
    WrongCodeEvent,
)
from maxitor.core.gateways.geoip import GEOIP_CONNECTION_KEY, GeoIpGateway
from maxitor.core.gateways.mail import MAIL_CONNECTION_KEY, MailGateway, MailNotDeliveredError
from maxitor.core.gateways.providers import with_providers
from maxitor.core.passwords import broken_rule, hash_password
from maxitor.core.roles import AccountRole
from maxitor.core.storage.core_storage import CORE_CONNECTION_KEY, CoreStorage
from maxitor.core.tokens import TOKENS_CONNECTION_KEY, SessionTokensController
from pydantic import Field, SecretStr

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


async def _link(
    store: CoreStorage,
    operation: str,
    account_id: str,
    way: str,
    subject: str,
    email: str | None,
    ip: str,
    country: str | None,
    password_hash: str | None,
) -> None:
    """Add a way in to ``account_id`` in one change, or refuse one that signs in any account already."""

    async def work() -> None:
        if await store.sign_in_of(way, subject) is not None:
            raise ConflictError("taken")
        changed_at: datetime = await store.account_lock(account_id)
        await store.insert(
            "sign_in",
            {
                "id": str(uuid.uuid4()),
                "account_id": account_id,
                "provider": way,
                "provider_subject": subject,
                "email": email,
                "password_hash": password_hash,
                "password_changed_at": changed_at if password_hash else None,
                "added_country": country,
                "added_ip": ip,
                "added_at": changed_at,
                "last_used_at": None,
            },
            changed_at,
            account_id,
            operation,
        )

    await store.in_transaction(work)


class EmptyParams(BaseParams):
    """Nothing: the account comes from the session."""


class SignInEntryResult(BaseResult):
    """One way in."""

    id: str = Field(description="The sign-in")
    provider: str = Field(description="email, yandex, mailru, google, github or facebook")
    email: str | None = Field(default=None, description="Its email")
    added_at: str = Field(description="When it was added, ISO 8601")
    added_country: str | None = Field(default=None, description="Where it was added from")


class SignInsResult(BaseResult):
    """The account's ways in and what may be added from here."""

    sign_ins: list[SignInEntryResult] = Field(description="The ways in, oldest first")
    offer: list[str] = Field(description="What may be linked from the request's region")


@meta(description="List the account's ways in and what may be added from the request's region", domain=PlatformDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database")
class ListSignInsAction(BaseAction[EmptyParams, SignInsResult]):
    """
    AI-CORE-BEGIN
    ROLE: Show "Sign-in methods".
    CONTRACT: Never a password hash; ``offer`` lists email and the providers the region allows that the account has not.
    AI-CORE-END
    """

    @summary_aspect("Read the ways in and the region's offer")
    @context_requires(Ctx.User.user_id)
    async def list_summary(
        self, params: EmptyParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> SignInsResult:
        """The rows and the offer."""
        _ = (params, state)
        rows = await storage(connections).sign_ins(str(ctx.get(Ctx.User.user_id)))
        region, _country = await region_of(box, connections)
        have = {row["provider"] for row in rows}
        offer = [way for way in ("email", *ALLOWED[region]) if way not in have]
        items = [
            SignInEntryResult(
                id=r["id"],
                provider=r["provider"],
                email=r["email"],
                added_at=r["added_at"].isoformat(),
                added_country=r["added_country"],
            )
            for r in rows
        ]
        return SignInsResult(sign_ins=items, offer=offer)


class LinkedResult(BaseResult):
    """A way in was added."""

    linked: bool = Field(description="True")


@meta(description="Link a provider to the signed-in account", domain=PlatformDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database")
@with_providers
class LinkSignInAction(BaseAction[FinishParams, LinkedResult]):
    """
    AI-CORE-BEGIN
    ROLE: Finish linking a provider the region allows.
    CONTRACT: The same checks as signing in; a provider account that signs in another account is refused (409).
    AI-CORE-END
    """

    @summary_aspect("Check the region and the answer, then link")
    @context_requires(Ctx.User.user_id, Ctx.Request.client_ip)
    @emits(LinkRefusedEvent, ProviderAnswerRejectedEvent, ProviderRefusedForRegionEvent, SignInLinkedEvent)
    async def link_summary(
        self, params: FinishParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> LinkedResult:
        """Region, answer, one change."""
        _ = state
        account_id, ip = str(ctx.get(Ctx.User.user_id)), client_ip(ctx)
        country = await checked_region(box, connections, params.provider, account_id)
        person = await proven_person(box, connections, params, country)
        try:
            await _link(
                storage(connections),
                type(self).__name__,
                account_id,
                params.provider,
                person.subject,
                person.email,
                ip,
                country,
                None,
            )
        except ConflictError:
            await box.warning(
                Channel.security,
                "Link of {%var.provider} refused for {%var.account_id}",
                LinkRefusedEvent(account_id=account_id, provider=params.provider),
            )
            raise
        await box.info(
            Channel.security,
            "{%var.provider} linked to {%var.account_id}",
            SignInLinkedEvent(account_id=account_id, provider=params.provider, country=country_word(country)),
        )
        return LinkedResult(linked=True)


class LinkEmailParams(BaseParams):
    """An email and password to link; without the code, the code is sent."""

    email: str = Field(min_length=3, max_length=254, description="The email, a new login")
    password: SecretStr = Field(description="The password for it; never logged")
    code: str | None = Field(default=None, description="The code sent to the email; empty to send it")


class LinkEmailResult(BaseResult):
    """Sent, or linked."""

    sent: bool = Field(default=False, description="The code was sent")
    linked: bool = Field(default=False, description="The email was linked")


@meta(
    description="Link an email and password to the signed-in account, the email confirmed by a code",
    domain=PlatformDomain,
)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database")
@connection(MailGateway, key=MAIL_CONNECTION_KEY, description="The mail")
@connection(SessionTokensController, key=TOKENS_CONNECTION_KEY, description="The core's code key")
class LinkEmailAction(BaseAction[LinkEmailParams, LinkEmailResult]):
    """
    AI-CORE-BEGIN
    ROLE: Add an email login that works in every country.
    CONTRACT: Without a code: check the password's rules and send a code. With it: check the code and link; an
        address that signs in another account is refused (409).
    AI-CORE-END
    """

    @summary_aspect("Send the code, or check it and link")
    @context_requires(Ctx.User.user_id, Ctx.Request.client_ip)
    @emits(
        CodeLimitReachedEvent,
        CodeSentEvent,
        CodeTriesUsedUpEvent,
        LetterNotSentEvent,
        LinkRefusedEvent,
        SignInLinkedEvent,
        WrongCodeEvent,
    )
    async def link_email_summary(
        self, params: LinkEmailParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> LinkEmailResult:
        """Two steps under one action."""
        _ = state
        email, password = normal_email(params.email), params.password.get_secret_value()
        rule = broken_rule(email, password)
        if rule is not None:
            raise PasswordRuleError("password_rule", rule=rule)
        store, keys, account_id, ip, at = (
            storage(connections),
            tokens(connections),
            str(ctx.get(Ctx.User.user_id)),
            client_ip(ctx),
            now(),
        )
        _region, country = await region_of(box, connections)
        if params.code is None:

            async def work() -> str:
                await check_code_limits(box, store, email, ip, at, country_word(country))
                return await store_code(
                    keys,
                    store,
                    email=email,
                    purpose="confirm_email",
                    ip=ip,
                    country=country,
                    at=at,
                    password_hash=hash_password(password),
                )

            code = await store.in_transaction(work)
            try:
                await mail(connections).send_email_confirmation(email, code, at, country, has_account=False)
            except MailNotDeliveredError as exc:
                await box.critical(
                    Channel.error,
                    "Letter to {%var.email_masked} not sent: {%var.reason}",
                    LetterNotSentEvent(email_masked=mask(email), reason=exc.reason),
                )
                raise MailNotSentError("mail_not_sent") from None
            await code_sent(box, email, country_word(country))
            return LinkEmailResult(sent=True)
        row = await take_code(box, keys, store, email, "confirm_email", params.code, at)
        try:
            await _link(
                store,
                type(self).__name__,
                account_id,
                "email",
                email,
                email,
                ip,
                country,
                str(row["password_hash"] or hash_password(password)),
            )
        except ConflictError:
            await box.warning(
                Channel.security,
                "Link of {%var.provider} refused for {%var.account_id}",
                LinkRefusedEvent(account_id=account_id, provider="email"),
            )
            raise
        await box.info(
            Channel.security,
            "{%var.provider} linked to {%var.account_id}",
            SignInLinkedEvent(account_id=account_id, provider="email", country=country_word(country)),
        )
        return LinkEmailResult(linked=True)


class UnlinkParams(BaseParams):
    """The way in to remove."""

    sign_in_id: str = Field(min_length=1, description="The sign-in")


@meta(description="Remove a way in of the signed-in account, never the last", domain=PlatformDomain)
@check_roles(AccountRole)
@connection(CoreStorage, key=CORE_CONNECTION_KEY, description="The core's database")
class UnlinkSignInAction(BaseAction[UnlinkParams, LinkedResult]):
    """
    AI-CORE-BEGIN
    ROLE: Remove a way in.
    CONTRACT: Refuses the last one (409) and one of another account (404 as not found).
    AI-CORE-END
    """

    @summary_aspect("Remove the way in under the account's lock")
    @context_requires(Ctx.User.user_id)
    @emits(SignInUnlinkedEvent)
    async def unlink_summary(
        self, params: UnlinkParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> LinkedResult:
        """Count under the lock, so two removals cannot leave none."""
        _ = state
        store, account_id = storage(connections), str(ctx.get(Ctx.User.user_id))

        async def work() -> str:
            changed_at = await store.account_lock(account_id)
            rows = await store.sign_ins(account_id)
            target = next((r for r in rows if r["id"] == params.sign_in_id), None)
            if target is None:
                raise SignInRefusedError("not_found")
            if len(rows) <= 1:
                raise ConflictError("last")
            await store.delete("sign_in", {"id": params.sign_in_id}, changed_at, account_id, type(self).__name__)
            return str(target["provider"])

        way = await store.in_transaction(work)
        await box.info(
            Channel.security,
            "{%var.provider} unlinked from {%var.account_id}",
            SignInUnlinkedEvent(account_id=account_id, provider=way),
        )
        return LinkedResult(linked=False)
