# packages/maxitor/maxitor-core/maxitor/core/actions/codes_flow.py
"""
The steps every code takes, whatever it is for: the limits, storing it, sending it, checking it.

Each step writes its events through the calling method's box, which declares them in its ``@emits``.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from maxitor.core.codes import (
    CODE_LIFETIME,
    KEPT_FOR_COUNTING,
    PASSWORD_WINDOW,
    PER_ADDRESS_HOUR,
    PER_ADDRESS_MINUTE,
    PER_IP_HOUR,
    mask,
    new_code,
)
from maxitor.core.errors import CodeRefusedError, LimitReachedError
from maxitor.core.events import CodeLimitReachedEvent, CodeSentEvent, CodeTriesUsedUpEvent, WrongCodeEvent
from maxitor.core.storage.core_storage import CoreStorage
from maxitor.core.tokens import SessionTokensController

from aoa.action_machine.logging import Channel
from aoa.action_machine.runtime.tools_box import ToolsBox

#: The events the steps of this module may write; a method that uses them declares these.
CODE_EVENTS = (CodeLimitReachedEvent, CodeSentEvent, CodeTriesUsedUpEvent, WrongCodeEvent)


async def check_code_limits(box: ToolsBox, store: CoreStorage, email: str, ip: str, at: datetime, country: str) -> None:
    """Refuse a code past the limits: one a minute and ten an hour per address, thirty an hour per IP."""
    await store.prune(at, at - KEPT_FOR_COUNTING, at - PASSWORD_WINDOW)
    minute, hour, per_ip = await store.code_counts(email, ip, at - timedelta(minutes=1), at - KEPT_FOR_COUNTING)
    reached = [
        (count >= most, limit, until)
        for count, most, limit, until in (
            (minute, PER_ADDRESS_MINUTE, "address per minute", at + timedelta(minutes=1)),
            (hour, PER_ADDRESS_HOUR, "address per hour", at + KEPT_FOR_COUNTING),
            (per_ip, PER_IP_HOUR, "IP per hour", at + KEPT_FOR_COUNTING),
        )
    ]
    for over, limit, until in reached:
        if not over:
            continue
        await box.warning(
            Channel.security,
            "Codes limit {%var.limit} for {%var.email_masked}",
            CodeLimitReachedEvent(email_masked=mask(email), country=country, limit=limit),
        )
        raise LimitReachedError("too_many_codes", until=until)


async def store_code(
    tokens: SessionTokensController,
    store: CoreStorage,
    *,
    email: str,
    purpose: str,
    ip: str,
    country: str | None,
    at: datetime,
    password_hash: str | None = None,
) -> str:
    """Make a code, store only its hash (and a sign-up's password hash), and answer the code."""
    code = new_code()
    await store.new_code(
        {
            "id": str(uuid.uuid4()),
            "purpose": purpose,
            "email": email,
            "code_hash": tokens.hash_code(email, purpose, code),
            "password_hash": password_hash,
            "wrong_tries": 0,
            "requested_country": country,
            "requested_ip": ip,
            "created_at": at,
            "expires_at": at + CODE_LIFETIME,
            "used_at": None,
        }
    )
    return code


async def code_sent(box: ToolsBox, email: str, country: str) -> None:
    """Write that a code went to the mail."""
    await box.info(
        Channel.security, "Code sent to {%var.email_masked}", CodeSentEvent(email_masked=mask(email), country=country)
    )


async def take_code(
    box: ToolsBox,
    tokens: SessionTokensController,
    store: CoreStorage,
    email: str,
    purpose: str,
    code: str,
    at: datetime,
) -> dict[str, object]:
    """
    Check ``code`` for ``email`` and ``purpose`` and end it; answer its row.

    Refuses ``expired`` (no working code, or past ten minutes), ``wrong`` with the tries left, or ``used_up`` on the
    fifth wrong try.
    """
    row = await store.working_code(email, purpose)
    if row is None or row["expires_at"] <= at:
        if row is not None:
            await store.end_code(str(row["id"]), at)
        raise CodeRefusedError("expired")
    if not tokens.same_code(email, purpose, code, str(row["code_hash"])):
        left = await store.wrong_code(str(row["id"]), at)
        if left == 0:
            await box.warning(
                Channel.security, "Code of {%var.email_masked} used up", CodeTriesUsedUpEvent(email_masked=mask(email))
            )
            raise CodeRefusedError("used_up")
        await box.warning(
            Channel.security,
            "Wrong code for {%var.email_masked}",
            WrongCodeEvent(email_masked=mask(email), tries_left=left),
        )
        raise CodeRefusedError("wrong", tries_left=left)
    await store.end_code(str(row["id"]), at)
    return row
