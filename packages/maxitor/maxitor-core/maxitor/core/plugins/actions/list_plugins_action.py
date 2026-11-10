# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/list_plugins_action.py
"""
ListPluginsAction — the page Settings → Plugins: both tabs and their counts, for one search.

::

    GET /api/v1/organizations/{code}/plugins?query=   {installed, removed, marketplace, private, counts}

The search looks through the title, the name, the passport's id and the description, case aside, on both tabs at
once, so each tab's count says how many match there (FR-030). It runs in the database, not in the browser. A private
plugin of another organization is never read (FR-013).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from maxitor.core.plugins.actions.administrator import administered, administrator_verdict, fits_core, plugins
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from maxitor.core.roles import AccountRole
from pydantic import Field

from aoa.action_machine.context.context_view import ContextView
from aoa.action_machine.context.ctx_constants import Ctx
from aoa.action_machine.intents.access_control import Verdict
from aoa.action_machine.intents.access_decide import access_decide
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.context_requires import context_requires
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.model.base_schema import BaseSchema
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class ListParams(BaseParams):
    """The organization and the search."""

    code: str = Field(min_length=1, max_length=200, description="The organization's address code")
    query: str = Field(default="", max_length=200, description="The search; empty shows everything")


class DependencySchema(BaseSchema):
    """A plugin a version needs, and whether the organization has it."""

    passport_id: str = Field(description="The needed plugin's passport id")
    installed: bool = Field(description="Whether it is installed in the organization, enabled or disabled")


class InstalledSchema(BaseSchema):
    """A row of the Installed tab."""

    passport_id: str = Field(description="The plugin's passport id")
    name: str = Field(description="The plugin's name")
    title: str = Field(description="The plugin's title")
    description: str = Field(description="The plugin's description")
    version: str = Field(description="The version the organization runs")
    state: str = Field(description="installing, enabled, disabled, failed, removing or removed")
    reason: str | None = Field(description="Why the install failed; empty otherwise")
    purl: str = Field(description="The version's source")
    installed_by: str = Field(description="The name of the administrator who installed it")
    installed_at: datetime = Field(description="When the install was asked for")
    depends_on: list[str] = Field(description="The passport ids of the plugins it needs")
    withdrawn: bool = Field(description="Whether the marketplace withdrew the plugin; it keeps working here")
    private: bool = Field(description="Whether it is the organization's private plugin")


class CardSchema(BaseSchema):
    """A card of the Marketplace tab."""

    passport_id: str = Field(description="The plugin's passport id; pending.<id> while a private version waits")
    name: str = Field(description="The plugin's name")
    title: str = Field(description="The plugin's title")
    description: str = Field(description="The plugin's description")
    version: str = Field(description="The version offered")
    purl: str = Field(description="The version's source")
    private: bool = Field(description="Whether it is the organization's private plugin")
    state: str = Field(description="active; or draft and rejected for a private version still waiting or refused")
    reason: str | None = Field(description="Why a private version waits or was refused")
    fits_core: bool = Field(description="Whether the version fits this core")
    dependencies: list[DependencySchema] = Field(description="The plugins it needs")


class CountsSchema(BaseSchema):
    """How many match on each tab."""

    installed: int = Field(description="Plugins of the organization not removed")
    marketplace: int = Field(description="Cards of the marketplace, private ones included")


class ListResult(BaseResult):
    """Both tabs."""

    installed: list[InstalledSchema] = Field(description="The organization's plugins not removed")
    removed: list[InstalledSchema] = Field(description="The removed ones, kept in the history")
    marketplace: list[CardSchema] = Field(description="Public versions the organization may install")
    private: list[CardSchema] = Field(description="The organization's own plugins, ready, waiting or refused")
    counts: CountsSchema = Field(description="How many match on each tab")


def _row(row: dict[str, Any], needs: dict[str, list[str]]) -> InstalledSchema:
    return InstalledSchema(
        passport_id=row["passport_id"],
        name=row["name"],
        title=row["title"],
        description=row["description"],
        version=row["version"],
        state=row["state"],
        reason=row["reason"],
        purl=row["purl"],
        installed_by=row["installed_by_name"],
        installed_at=row["installed_at"],
        depends_on=needs.get(row["version_id"], []),
        withdrawn=row["plugin_state"] == "withdrawn",
        private=bool(row["private"]),
    )


def _card(card: dict[str, Any], needs: dict[str, list[str]], states: dict[str, str], *, private: bool) -> CardSchema:
    return CardSchema(
        passport_id=card["passport_id"],
        name=card["name"],
        title=card["title"],
        description=card["description"],
        version=card["version"],
        purl=card["purl"],
        private=private,
        state=card.get("state", "active"),
        reason=card.get("reason"),
        fits_core=fits_core(card.get("core_range")),
        dependencies=[
            DependencySchema(passport_id=d, installed=states.get(d) in ("enabled", "disabled"))
            for d in needs.get(card["version_id"], [])
        ],
    )


@meta(description="The page Settings → Plugins: installed plugins and the marketplace, for one search", domain=PluginsDomain)
@check_roles(AccountRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
class ListPluginsAction(BaseAction[ListParams, ListResult]):
    """
    AI-CORE-BEGIN
    ROLE: Give the page both tabs.
    CONTRACT: Only an active administrator; everything matches the search on both tabs; counts per tab.
    INVARIANTS: Never reads another organization's private plugin.
    AI-CORE-END
    """

    @access_decide("Let through only an active administrator of the organization")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(
        self, params: ListParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """The same refusal as for a made-up address."""
        _ = box
        return await administrator_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Read the organization's plugins, the offered versions and the private ones, for the search")
    @context_requires(Ctx.User.user_id)
    async def list_summary(
        self, params: ListParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> ListResult:
        """Four readings and one of the dependencies of every version shown."""
        _ = (state, box)
        organization = await administered(connections, params.code, str(ctx.get(Ctx.User.user_id)))
        store = plugins(connections)
        rows = await store.installed(organization["id"], params.query)
        offered = await store.offered(organization["id"], params.query)
        waiting = await store.private_pending(organization["id"], params.query)
        states = await store.live_states(organization["id"])
        needs: dict[str, list[str]] = {}
        version_ids = [r["version_id"] for r in rows] + [c["version_id"] for c in offered]
        for dependency in await store.dependencies(version_ids):
            needs.setdefault(dependency["version_id"], []).append(dependency["passport_id"])
        live = [_row(r, needs) for r in rows if r["state"] != "removed"]
        public = [_card(c, needs, states, private=False) for c in offered if c["owner_organization_id"] is None]
        own = [_card(c, needs, states, private=True) for c in offered if c["owner_organization_id"] is not None]
        own += [_card(c, needs, states, private=True) for c in waiting]
        return ListResult(
            installed=live,
            removed=[_row(r, needs) for r in rows if r["state"] == "removed"],
            marketplace=public,
            private=own,
            counts=CountsSchema(installed=len(live), marketplace=len(public) + len(own)),
        )
