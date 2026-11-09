# packages/maxitor/maxitor-core/maxitor/core/actions/common.py
"""What the core's actions share: the region rule, the clock, the request's address, email normalisation."""

from __future__ import annotations

import ipaddress
from datetime import UTC, datetime
from typing import Any, cast

from maxitor.core.gateways.geoip import GEOIP_CONNECTION_KEY
from maxitor.core.gateways.mail import MAIL_CONNECTION_KEY, MailGateway
from maxitor.core.gateways.providers import ProviderSignInGateway
from maxitor.core.settings import PROVIDERS, RUSSIAN_WAYS
from maxitor.core.storage.core_storage import CORE_CONNECTION_KEY, CoreStorage
from maxitor.core.tokens import TOKENS_CONNECTION_KEY, SessionTokensController

from aoa.action_machine.context.context_view import ContextView
from aoa.action_machine.context.ctx_constants import Ctx
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox

#: Every way in a region allows, in the order the page shows them.
ALLOWED = {
    "russia": ("yandex", "mailru"),
    "abroad": ("google", "github", "facebook", "yandex", "mailru"),
}


def now() -> datetime:
    """The clock."""
    return datetime.now(UTC)


def normal_email(email: str) -> str:
    """An address as the core keeps it: trimmed and in lower case."""
    return email.strip().lower()


def client_ip(ctx: ContextView) -> str:
    """The request's address, as the adapter took it from the proxy; ``0.0.0.0`` when it is unknown or not an address."""
    try:
        return str(ipaddress.ip_address(str(ctx.get(Ctx.Request.client_ip) or "")))
    except ValueError:
        return "0.0.0.0"


def allowed(region: str, way: str) -> bool:
    """Whether ``way`` may be used in ``region``: Russian ways everywhere, foreign ones only outside Russia."""
    return way in RUSSIAN_WAYS or (region == "abroad" and way in PROVIDERS)


async def region_of(box: ToolsBox, connections: Connections) -> tuple[str, str | None]:
    """The region and country of the request, decided by ``DetectRegionAction``."""
    from maxitor.core.actions.region import DetectRegionAction, DetectRegionParams  # pylint: disable=import-outside-toplevel

    result = await box.run(
        DetectRegionAction, DetectRegionParams(), connections={GEOIP_CONNECTION_KEY: connections[GEOIP_CONNECTION_KEY]}
    )
    return result.region, result.country


def storage(connections: Connections) -> CoreStorage:
    return cast(CoreStorage, connections[CORE_CONNECTION_KEY])


def tokens(connections: Connections) -> SessionTokensController:
    return cast(SessionTokensController, connections[TOKENS_CONNECTION_KEY])


def mail(connections: Connections) -> MailGateway:
    return cast(MailGateway, connections[MAIL_CONNECTION_KEY])


def provider(connections: Connections, name: str) -> ProviderSignInGateway | None:
    value: Any = connections.get(name)
    return cast(ProviderSignInGateway, value) if value is not None else None


def country_word(country: str | None) -> str:
    """A country as an event carries it."""
    return country or "unknown"
