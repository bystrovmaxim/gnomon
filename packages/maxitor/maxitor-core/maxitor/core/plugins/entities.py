# packages/maxitor/maxitor-core/maxitor/core/plugins/entities.py
"""
The entities of the domain plugins, one table each in the schema plugins (specs/073-plugin-marketplace/data-model.md).

All entities live in one module because ``Inverse`` names the partner class. A link into the domain organization —
an organization, a user — is kept as the other domain's id, so this domain depends on the core's tables only by key.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from maxitor.core.plugins.plugins_domain import PluginsDomain
from pydantic import Field

from aoa.action_machine.domain import (
    AssociationOne,
    BaseCoreEntity,
    BaseStateEntity,
    CompositeMany,
    Inverse,
    Lifecycle,
    NoInverse,
    value,
)
from aoa.action_machine.intents.entity import entity

# ════════════════════════════════════════════════════════════════════════════
# States and lifecycles
# ════════════════════════════════════════════════════════════════════════════


class PluginStateEntity(BaseStateEntity):
    """A plugin of the marketplace: listed or withdrawn."""

    sort_order: int = Field(default=0, description="Display order of the states")

    LISTED = value(code="listed", display_name="Listed", sort_order=1)
    WITHDRAWN = value(code="withdrawn", display_name="Withdrawn", sort_order=2)


class PluginLifecycle(Lifecycle[PluginStateEntity]):
    """A listed plugin can be installed anew; a withdrawn one keeps working where it is installed."""

    _template = (
        Lifecycle()
        .state(PluginStateEntity.LISTED)
        .to(PluginStateEntity.WITHDRAWN)
        .initial()
        .state(PluginStateEntity.WITHDRAWN)
        .to(PluginStateEntity.LISTED)
        .intermediate()
    )


class PluginVersionStateEntity(BaseStateEntity):
    """A version of a plugin: draft, active, rejected or withdrawn."""

    sort_order: int = Field(default=0, description="Display order of the states")

    DRAFT = value(code="draft", display_name="Draft", sort_order=1)
    ACTIVE = value(code="active", display_name="Active", sort_order=2)
    REJECTED = value(code="rejected", display_name="Rejected", sort_order=3)
    WITHDRAWN = value(code="withdrawn", display_name="Withdrawn", sort_order=4)


class PluginVersionLifecycle(Lifecycle[PluginVersionStateEntity]):
    """A version is checked once: active or rejected; an active one can be withdrawn and brought back."""

    _template = (
        Lifecycle()
        .state(PluginVersionStateEntity.DRAFT)
        .to(PluginVersionStateEntity.ACTIVE, PluginVersionStateEntity.REJECTED)
        .initial()
        .state(PluginVersionStateEntity.ACTIVE)
        .to(PluginVersionStateEntity.WITHDRAWN)
        .intermediate()
        .state(PluginVersionStateEntity.WITHDRAWN)
        .to(PluginVersionStateEntity.ACTIVE)
        .intermediate()
        .state(PluginVersionStateEntity.REJECTED)
        .final()
    )


class OrganizationPluginStateEntity(BaseStateEntity):
    """A plugin in one organization: installing, enabled, disabled, failed, removing or removed."""

    sort_order: int = Field(default=0, description="Display order of the states")

    INSTALLING = value(code="installing", display_name="Installing", sort_order=1)
    ENABLED = value(code="enabled", display_name="Enabled", sort_order=2)
    DISABLED = value(code="disabled", display_name="Disabled", sort_order=3)
    FAILED = value(code="failed", display_name="Failed", sort_order=4)
    REMOVING = value(code="removing", display_name="Removing", sort_order=5)
    REMOVED = value(code="removed", display_name="Removed", sort_order=6)


class OrganizationPluginLifecycle(Lifecycle[OrganizationPluginStateEntity]):
    """
    Installing ends enabled or failed; a failed install is retried or dropped; enabled and disabled go to each other;
    removing (bystrovmaxim/gnomon#94) takes enabled or disabled to removed, which is final.
    """

    _template = (
        Lifecycle()
        .state(OrganizationPluginStateEntity.INSTALLING)
        .to(OrganizationPluginStateEntity.ENABLED, OrganizationPluginStateEntity.FAILED)
        .initial()
        .state(OrganizationPluginStateEntity.ENABLED)
        .to(OrganizationPluginStateEntity.DISABLED, OrganizationPluginStateEntity.REMOVING)
        .intermediate()
        .state(OrganizationPluginStateEntity.DISABLED)
        .to(OrganizationPluginStateEntity.ENABLED, OrganizationPluginStateEntity.REMOVING)
        .intermediate()
        .state(OrganizationPluginStateEntity.FAILED)
        .to(OrganizationPluginStateEntity.INSTALLING, OrganizationPluginStateEntity.REMOVED)
        .intermediate()
        .state(OrganizationPluginStateEntity.REMOVING)
        .to(OrganizationPluginStateEntity.REMOVED)
        .intermediate()
        .state(OrganizationPluginStateEntity.REMOVED)
        .final()
    )


# ════════════════════════════════════════════════════════════════════════════
# Entities
# ════════════════════════════════════════════════════════════════════════════


@entity(description="A plugin of the marketplace, public or private to one organization", domain=PluginsDomain)
class PluginCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: What an organization installs, known by its passport's id.
    CONTRACT: Public when it has no owner; private to one organization otherwise, and then no other organization
        sees it. Changes under the plugin's lock.
    INVARIANTS: Its passport id and its name are unique across the marketplace, private plugins included; the
        schema of each version is named after its name.
    AI-CORE-END
    """

    id: str = Field(description="Plugin id")
    passport_id: str = Field(description="The plugin's id from its passport, in reverse domain notation")
    name: str = Field(description="The plugin's name: ^[a-z][a-z0-9_]{0,31}$, the start of its schemas' names")
    title: str = Field(description="The plugin's title for people")
    description: str = Field(description="What the plugin does, for the marketplace's card")
    owner_organization_id: str | None = Field(
        default=None, description="The organization a private plugin belongs to; empty for a public plugin"
    )
    state: PluginLifecycle = Field(description="listed or withdrawn")

    versions: Annotated[
        CompositeMany[PluginVersionCoreEntity],
        Inverse(PluginVersionCoreEntity, "plugin"),
    ] = Field(description="The plugin's versions")

    created_at: datetime = Field(description="When the plugin entered the marketplace")
    updated_at: datetime | None = Field(default=None, description="When it last changed; empty if never")


@entity(description="One release x.y.z of a plugin: its wheel, its passport and its schema", domain=PluginsDomain)
class PluginVersionCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: What is checked, deployed and installed.
    CONTRACT: Starts as draft; the installer's check makes it active or rejected with the reason. Deployed once for
        all of Maxitor: its schema and database user are named when it is.
    INVARIANTS: Its wheel is named by its sha256 and never changes; only an active version of a listed plugin is
        installed.
    AI-CORE-END
    """

    id: str = Field(description="Version id")
    version: str = Field(description="The version, ^[0-9]+\\.[0-9]+\\.[0-9]+$")
    purl: str = Field(description="The wheel's source as a Package URL")
    sha256: str = Field(description="The wheel's SHA-256, 64 lower-case hexadecimal characters")
    core_range: str | None = Field(default=None, description="The core range of its passport; empty until checked")
    state: PluginVersionLifecycle = Field(description="draft, active, rejected or withdrawn")
    reason: str | None = Field(
        default=None, description="Why it was rejected or why its check waits; empty when there is nothing to say"
    )
    schema_name: str | None = Field(default=None, description="Its schema once deployed; empty before")
    database_user: str | None = Field(default=None, description="Its database user once deployed; empty before")
    deployed_at: datetime | None = Field(default=None, description="When it was deployed; empty before")
    checked_at: datetime | None = Field(default=None, description="When its check ended; empty while draft")
    service_key_hash: str | None = Field(
        default=None, description="The SHA-256 of its service key, 64 lower-case hexadecimal characters; empty until deployed"
    )

    plugin: Annotated[
        AssociationOne[PluginCoreEntity],
        Inverse(PluginCoreEntity, "versions"),
    ] = Field(description="The plugin it is a version of")

    dependencies: Annotated[
        CompositeMany[PluginDependencyCoreEntity],
        Inverse(PluginDependencyCoreEntity, "plugin_version"),
    ] = Field(description="The plugins it needs, from its passport")

    nodes: Annotated[
        CompositeMany[PluginNodeCoreEntity],
        Inverse(PluginNodeCoreEntity, "plugin_version"),
    ] = Field(description="Every node of its navigation, joined into an organization's tree while it is enabled")

    created_at: datetime = Field(description="When the version was added")
    updated_at: datetime | None = Field(default=None, description="When it last changed; empty if never")


@entity(description="A plugin a version needs, named by passport id and version range", domain=PluginsDomain)
class PluginDependencyCoreEntity(BaseCoreEntity):
    """A dependency from a version's passport; it names a plugin that may not be in the marketplace yet."""

    id: str = Field(description="Dependency id")
    passport_id: str = Field(description="The needed plugin's passport id")
    version_range: str = Field(description="The versions of it the passport accepts")

    plugin_version: Annotated[
        AssociationOne[PluginVersionCoreEntity],
        Inverse(PluginVersionCoreEntity, "dependencies"),
    ] = Field(description="The version that needs it")

    created_at: datetime = Field(description="When it was read from the passport")
    updated_at: datetime | None = Field(default=None, description="When it last changed; empty if never")


@entity(description="One node of a version's navigation, with its full name and the node it stands under", domain=PluginsDomain)
class PluginNodeCoreEntity(BaseCoreEntity):
    """A node a plugin adds to the organization's tree while it is enabled (specs/077-core-frame/data-model.md)."""

    id: str = Field(description="Node row id")
    full_name: str = Field(description="Its full name, <plugin name>:<node id>, unique within the version")
    parent: str = Field(description="root, a node of the core, of a dependency or of its own plugin")
    position: int = Field(description="Its place in the file, from 1: the order among equal order values")
    node_order: int = Field(description="Its order among the children of its parent; 0 when the file names none")
    title: str | None = Field(default=None, description="An ordinary node's title; empty for a list node")
    icon: str | None = Field(default=None, description="A name of the core's icon set; empty for none")
    page: str | None = Field(default=None, description="The page's path template inside the plugin; empty for a group")
    each_source: str | None = Field(default=None, description="A list node's reading action; empty for an ordinary node")
    each_key: str | None = Field(default=None, description="The parameter a list node's instance adds; empty otherwise")
    roles: list[str] = Field(description="The core's roles needed to see it; empty for every member")
    room: str | None = Field(default=None, description="The page's behaviour with other people as the file writes it, as JSON")

    plugin_version: Annotated[
        AssociationOne[PluginVersionCoreEntity],
        Inverse(PluginVersionCoreEntity, "nodes"),
    ] = Field(description="The version whose navigation it comes from")

    created_at: datetime = Field(description="When it was read from the navigation")
    updated_at: datetime | None = Field(default=None, description="When it last changed; empty if never")


@entity(description="A plugin in one organization: which version, its state, who installed it", domain=PluginsDomain)
class OrganizationPluginCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: What an organization runs.
    CONTRACT: Written under the organization's lock. Installing goes through installing to enabled or failed;
        disabling keeps the data.
    INVARIANTS: At most one row not removed per organization and plugin; a removed row stays in the history.
    AI-CORE-END
    """

    id: str = Field(description="Row id")
    organization_id: str = Field(description="The organization, from the domain organization")
    plugin_id: str = Field(description="The plugin installed")
    plugin_version_id: str = Field(description="The version the organization runs")
    state: OrganizationPluginLifecycle = Field(
        description="installing, enabled, disabled, failed, removing or removed"
    )
    reason: str | None = Field(default=None, description="Why the install failed; empty otherwise")
    installed_by: str = Field(description="The administrator's user in the organization who installed it")

    created_at: datetime = Field(description="When the install was asked for")
    updated_at: datetime | None = Field(default=None, description="When it last changed; empty if never")


@entity(description="A running backend or frontend of a deployed version, kept by the runner", domain=PluginsDomain)
class PluginProcessCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: Where a version's process listens, for the gateway, and how its starts went, for the runner.
    CONTRACT: Written only by the runner; one row per version and kind; its address is empty until the process accepts.
    INVARIANTS: Mechanics of work: kept without versions; the address is always on 127.0.0.1.
    AI-CORE-END
    """

    id: str = Field(description="Process row id")
    kind: str = Field(description="backend or frontend")
    address: str | None = Field(
        default=None, description="The inner address http://127.0.0.1:<port> once it accepts; empty while it starts or waits"
    )
    container: str | None = Field(default=None, description="The Docker container that runs it; empty while it waits")
    started_at: datetime | None = Field(default=None, description="When the running process started; empty while it waits")
    failures: int = Field(description="Starts that failed or exits in a row since the last good start")
    next_start_at: datetime | None = Field(
        default=None, description="The earliest next start after a failure; empty when it may start at once"
    )

    plugin_version: Annotated[
        AssociationOne[PluginVersionCoreEntity],
        NoInverse(),
    ] = Field(description="The deployed version the process runs")

    updated_at: datetime = Field(description="When the row last changed")


@entity(description="One build of a plugin version's frontend for one core version, kept by the installer", domain=PluginsDomain)
class PluginBuildCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: Which image runs a version's frontend under a core version, or why there is none.
    CONTRACT: Written only by the installer; one row per version and core version; a built row names its image, a
        failed one its error.
    INVARIANTS: Mechanics of work: kept without versions; a retry moves a failed row back to building.
    AI-CORE-END
    """

    id: str = Field(description="Build id")
    core_version: str = Field(description="The core version whose builder image and @maxitor packages made it")
    state: str = Field(description="building, built or failed")
    image: str | None = Field(default=None, description="The frontend's image once built; empty otherwise")
    error: str | None = Field(default=None, description="The first error of the step that failed; empty unless failed")
    started_at: datetime = Field(description="When the build started")
    finished_at: datetime | None = Field(default=None, description="When the build ended; empty while it runs")

    plugin_version: Annotated[
        AssociationOne[PluginVersionCoreEntity],
        NoInverse(),
    ] = Field(description="The plugin version whose frontend was built")


# Relations name classes declared later in the module; resolve them now.
PluginCoreEntity.model_rebuild()
PluginVersionCoreEntity.model_rebuild()
PluginDependencyCoreEntity.model_rebuild()
PluginNodeCoreEntity.model_rebuild()
