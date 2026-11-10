# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/plugin_details_action.py
"""
PluginDetailsAction — the details panel: what a version's passport and schema.yaml say, its wheel, its schema.

::

    GET /api/v1/organizations/{code}/plugins/{passport_id}   {..., tables, schema_name, deployed} | 404

The tables are read from the wheel the store keeps — read, never run. "Deployed" says whether installing builds the
schema or only adds the plugin; it names no other organization. A private plugin of another organization answers 404,
the same as one that does not exist.
"""

from __future__ import annotations

from typing import cast

from maxitor.core.errors import OrganizationNotFoundError
from maxitor.core.plugins.actions.administrator import administered, administrator_verdict, fits_core, plugins
from maxitor.core.plugins.actions.deploy_and_install_action import schema_name_of
from maxitor.core.plugins.actions.list_plugins_action import DependencySchema
from maxitor.core.plugins.actions.request_install_action import PluginParams
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from maxitor.core.plugins.storage.wheel_storage import WHEELS_CONNECTION_KEY, WheelStorage
from maxitor.core.plugins.wheel import WheelRefusedError, read_wheel
from maxitor.core.roles import AccountRole
from maxitor_plugin_sdk.plugin_schema import PluginSchemaError, parse_plugin_schema
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
from aoa.action_machine.model import BaseAction, BaseResult, BaseState
from aoa.action_machine.model.base_schema import BaseSchema
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox


class SectionSchema(BaseSchema):
    """A section the plugin adds to the organization's tree."""

    title: str = Field(description="The section's title")
    path: str = Field(description="Its path inside the plugin's pages")


class DetailsResult(BaseResult):
    """The details panel."""

    passport_id: str = Field(description="The plugin's id from its passport")
    name: str = Field(description="The plugin's name")
    title: str = Field(description="The plugin's title")
    description: str = Field(description="The plugin's description")
    private: bool = Field(description="Whether it is the organization's private plugin")
    withdrawn: bool = Field(description="Whether the marketplace withdrew it")
    version: str = Field(description="The version offered or installed")
    purl: str = Field(description="The version's source")
    sha256: str = Field(description="The wheel's SHA-256")
    core_range: str | None = Field(description="The core range of its passport")
    fits_core: bool = Field(description="Whether it fits this core")
    dependencies: list[DependencySchema] = Field(description="The plugins it needs")
    sections: list[SectionSchema] = Field(description="The sections it adds to the tree")
    tables: list[str] = Field(description="The tables of its schema.yaml; empty when its wheel is not at hand")
    schema_name: str = Field(description="Its schema, built or to be built")
    database_user: str = Field(description="Its database user, built or to be built")
    deployed: bool = Field(description="Whether its schema exists already, so installing builds nothing")
    state: str | None = Field(description="Its state in the organization; empty when it is not installed")


@meta(description="The details of a plugin the organization can see: passport, wheel, tables, schema", domain=PluginsDomain)
@check_roles(AccountRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="The schema plugins")
@connection(WheelStorage, key=WHEELS_CONNECTION_KEY, description="The wheels Maxitor keeps, by SHA-256")
class PluginDetailsAction(BaseAction[PluginParams, DetailsResult]):
    """
    AI-CORE-BEGIN
    ROLE: Give the details panel its plugin.
    CONTRACT: Only an active administrator; 404 for a plugin the organization cannot see.
    AI-CORE-END
    """

    @access_decide("Let through only an active administrator of the organization")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(
        self, params: PluginParams, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> Verdict:
        """The same refusal as for a made-up address."""
        _ = box
        return await administrator_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Read the plugin, its version's dependencies and sections, and the tables of its wheel")
    @context_requires(Ctx.User.user_id)
    async def details_summary(
        self, params: PluginParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView
    ) -> DetailsResult:
        """The tables are read from the wheel only; a wheel not at hand shows none."""
        _ = (state, box)
        organization = await administered(connections, params.code, str(ctx.get(Ctx.User.user_id)))
        store = plugins(connections)
        found = await store.plugin_for(organization["id"], params.passport_id)
        if found is None:
            raise OrganizationNotFoundError("not_found")
        states = await store.live_states(organization["id"])
        needed = await store.dependencies([found["version_id"]])
        sections = await store.sections([found["version_id"]])
        schema_name = found["schema_name"] or schema_name_of(found["name"], found["version"])
        return DetailsResult(
            passport_id=found["passport_id"],
            name=found["name"],
            title=found["title"],
            description=found["description"],
            private=found["owner_organization_id"] is not None,
            withdrawn=found["plugin_state"] == "withdrawn",
            version=found["version"],
            purl=found["purl"],
            sha256=found["sha256"],
            core_range=found["core_range"],
            fits_core=fits_core(found["core_range"]),
            dependencies=[
                DependencySchema(passport_id=d["passport_id"], installed=states.get(d["passport_id"]) in ("enabled", "disabled"))
                for d in needed
            ],
            sections=[SectionSchema(title=s["title"], path=s["path"]) for s in sections],
            tables=_tables(cast(WheelStorage, connections[WHEELS_CONNECTION_KEY]), found["sha256"]),
            schema_name=schema_name,
            database_user=found["database_user"] or f"plg_{schema_name}",
            deployed=found["schema_name"] is not None,
            state=found["row_state"],
        )


def _tables(store: WheelStorage, sha256: str) -> list[str]:
    """The tables of the wheel's schema.yaml, or none when the wheel is not at hand or does not read."""
    data = store.read(sha256)
    if data is None:
        return []
    try:
        contents = read_wheel(data)
        schema = parse_plugin_schema(contents.file((contents.passport.get("database") or {}).get("schema")) or "")
    except (WheelRefusedError, PluginSchemaError):
        return []
    return [table.name for table in schema.tables]
