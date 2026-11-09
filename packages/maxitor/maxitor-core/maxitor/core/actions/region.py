# packages/maxitor/maxitor-core/maxitor/core/actions/region.py
"""
DetectRegionAction — the one place that decides whether a request comes from Russia.
SignInOptionsAction — what the sign-in page may offer to this request.
"""

from __future__ import annotations

from typing import cast

from maxitor.core.actions.common import ALLOWED, region_of
from maxitor.core.domains import PlatformDomain
from maxitor.core.gateways.geoip import GEOIP_CONNECTION_KEY, GeoIpGateway
from pydantic import Field

from aoa.action_machine.auth import GuestRole
from aoa.action_machine.context.context_view import ContextView
from aoa.action_machine.context.ctx_constants import Ctx
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.context_requires import context_requires
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class DetectRegionParams(BaseParams):
    """Nothing: the address comes from the request."""


class DetectRegionResult(BaseResult):
    """The region of the request."""

    region: str = Field(description="russia or abroad")
    country: str | None = Field(default=None, description="The country of the request's IP; empty if unknown")


@meta(description="Decide whether a request comes from Russia, by the country of its IP", domain=PlatformDomain)
@check_roles(GuestRole)
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database kept on the server")
class DetectRegionAction(BaseAction[DetectRegionParams, DetectRegionResult]):
    """
    AI-CORE-BEGIN
    ROLE: The one place that decides the region; every other action runs it.
    CONTRACT: ``abroad`` only when the country is known and is not RU; an unknown address counts as Russia.
    AI-CORE-END
    """

    @summary_aspect("Read the country of the request's IP")
    @context_requires(Ctx.Request.client_ip)
    async def region_summary(
        self, params: DetectRegionParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> DetectRegionResult:
        """Russia unless the country is known and not Russia."""
        _ = (params, state, box)
        country = await cast(GeoIpGateway, connections[GEOIP_CONNECTION_KEY]).country_of(ctx.get(Ctx.Request.client_ip))
        return DetectRegionResult(region="abroad" if country and country != "RU" else "russia", country=country)


class SignInOptionsParams(BaseParams):
    """Nothing: the region comes from the request."""


class SignInOptionsResult(BaseResult):
    """What the sign-in page offers."""

    region: str = Field(description="russia or abroad")
    email: bool = Field(description="Email and password: offered everywhere")
    providers: list[str] = Field(description="The providers the region allows, in the page's order")


@meta(description="Answer the sign-in page the ways in the request's region allows", domain=PlatformDomain)
@check_roles(GuestRole)
@connection(GeoIpGateway, key=GEOIP_CONNECTION_KEY, description="The country database kept on the server")
class SignInOptionsAction(BaseAction[SignInOptionsParams, SignInOptionsResult]):
    """
    AI-CORE-BEGIN
    ROLE: Tell the page what to draw.
    CONTRACT: From Russia: email, Yandex ID, Mail.ru ID. Abroad: email and all five providers.
    AI-CORE-END
    """

    @summary_aspect("Answer the ways in of the region")
    async def options_summary(
        self, params: SignInOptionsParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> SignInOptionsResult:
        """The region by DetectRegionAction, then its ways in."""
        _ = (params, state)
        region, _country = await region_of(box, connections)
        return SignInOptionsResult(region=region, email=True, providers=list(ALLOWED[region]))
