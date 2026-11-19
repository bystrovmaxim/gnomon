"""Read-only administration snapshots and scale bars through the normal current-access pipeline."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from maxitor.core.actions.common import now
from maxitor.core.domains import OrganizationDomain
from maxitor.core.errors import CoreRefusalError
from maxitor.core.plugins.actions.administrator import administered, administrator_verdict, plugins
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from maxitor.core.roles import AccountRole
from pydantic import AwareDatetime, Field

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

Section = Literal["organization", "users", "invitations", "plugins"]


class SnapshotParams(BaseParams):
    """One administration section at one instant; absent at means the current clock."""

    code: str = Field(min_length=1, max_length=200, description="Organization address")
    section: Section = Field(description="Administration section")
    at: AwareDatetime | None = Field(default=None, description="UTC instant; absent means now")


class HistoryParams(BaseParams):
    """A half-open stretch of version openings, in epoch-aligned buckets."""

    code: str = Field(min_length=1, max_length=200, description="Organization address")
    section: Section = Field(description="Administration section")
    from_at: AwareDatetime = Field(description="Inclusive beginning")
    to_at: AwareDatetime = Field(description="Exclusive end")
    width: int = Field(ge=1, le=315360000, description="Seconds per bar")


class AdministrationField(BaseSchema):
    """A persisted field, labelled by its stable name."""

    name: str = Field(description="Stable field name")
    value: str = Field(description="Plain-text value")


class AdministrationRow(BaseSchema):
    """A semantic object on the canvas."""

    id: str = Field(description="Stable object identifier")
    title: str = Field(description="Object title at the selected time")
    fields: list[AdministrationField] = Field(description="Persisted values at that time")
    changed_at: datetime = Field(description="Opening of this version")
    author: str | None = Field(description="Author's name when this version opened; absent for system changes")


class SnapshotResult(BaseResult):
    """Only the requested organization's objects, under current authorization."""

    rows: list[AdministrationRow] = Field(description="Objects at the requested time")


class AdministrationBar(BaseSchema):
    """Counts at a UTC bucket boundary."""

    start: str = Field(description="UTC instant with six fractional digits")
    added: int = Field(description="First versions")
    changed: int = Field(description="Later versions")
    removed: int = Field(description="Deleted objects")


class HistoryResult(BaseResult):
    """Bars consumed by the common time scale."""

    bars: list[AdministrationBar] = Field(description="Non-empty buckets")


def field_text(value: object) -> str:
    """Stable text for persisted values; never serialize arbitrary objects."""
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


@meta(description="Read administration objects at a moment without side effects", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="Versioned administration data")
class ReadAdministrationAction(BaseAction[SnapshotParams, SnapshotResult]):
    @access_decide("Require an active administrator now, including for historical reads")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(self, params: SnapshotParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        return await administrator_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Read the versions valid at the selected moment")
    @context_requires(Ctx.User.user_id)
    async def read_summary(self, params: SnapshotParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> SnapshotResult:
        found = await administered(connections, params.code, str(ctx.get(Ctx.User.user_id)))
        if params.at is not None and params.at > now():
            raise CoreRefusalError("future_moment")
        rows = await plugins(connections).administration_snapshot(found["id"], params.section, params.at or now())
        return SnapshotResult(
            rows=[
                AdministrationRow(
                    id=row["id"],
                    title=row["title"],
                    changed_at=row["changed_at"],
                    author=row["author"],
                    fields=[
                        AdministrationField(name=key, value=field_text(value))
                        for key, value in row.items()
                        if key not in {"id", "title", "changed_at", "author"}
                    ],
                )
                for row in rows
            ]
        )


@meta(description="Read administration version counts for the common scale", domain=OrganizationDomain)
@check_roles(AccountRole)
@connection(PluginsStorage, key=PLUGINS_CONNECTION_KEY, description="Versioned administration data")
class ReadAdministrationHistoryAction(BaseAction[HistoryParams, HistoryResult]):
    @access_decide("Require an active administrator now, including for historical reads")
    @context_requires(Ctx.User.user_id)
    async def administrator_access_decide(self, params: HistoryParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        return await administrator_verdict(connections, params.code, str(ctx.get(Ctx.User.user_id)))

    @summary_aspect("Aggregate version openings in the requested interval")
    @context_requires(Ctx.User.user_id)
    async def history_summary(self, params: HistoryParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> HistoryResult:
        found = await administered(connections, params.code, str(ctx.get(Ctx.User.user_id)))
        if params.to_at <= params.from_at or (params.to_at - params.from_at).total_seconds() / params.width > 5000:
            raise CoreRefusalError("invalid_history_range")
        rows = await plugins(connections).administration_bars(
            found["id"], params.section, params.from_at, params.to_at, params.width
        )
        return HistoryResult(
            bars=[
                AdministrationBar(
                    start=row["start"].strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    added=row["added"],
                    changed=row["changed"],
                    removed=row["removed"],
                )
                for row in rows
            ]
        )
