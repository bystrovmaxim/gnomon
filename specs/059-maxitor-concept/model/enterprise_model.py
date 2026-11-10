# specs/059-maxitor-concept/model/boundary_model.py
"""
The data model of the Maxitor concept, written as AOA entities.

Every approved dictionary term that names a thing Maxitor stores becomes an entity
here. A term that is a rule (for example, the boundary's edge) becomes a
constraint next to the entities it concerns. The model grows one term at a time, and
the code around it is built later. ``data-model.md`` next to the ``model`` folder
explains the model in words and draws it.

All entities live in one module because ``Inverse`` names the partner class: if the
classes were split across modules, they would import each other in a circle.

Every domain is a plugin, and the plugins depend on each other in one direction only::

    organization            the core; depends on nothing
        ▲
    backbone                business areas and stages; depends on organization
        ▲
    landscape               the C4 landscape; depends on organization and backbone
        ▲
    story_map               the map and its stories; depends on all three

A dependent plugin knows its masters, and a master knows nothing about those that depend
on it. In the model this is a rule about links: a link from a dependent entity to a
master entity is one-way — ``AssociationOne[...]`` with ``NoInverse()`` — and the
master has no field pointing back. Inside one plugin links are two-way as usual. So the
boundary does not list its business areas, containers or map; the user does not list
what they own outside the core; a stage does not list its stories; a container does
not list the steps done in it. What a master "has" in a dependent plugin is read from
the dependent side.

::

    OrganizationDomain — the core: who works
        OrganizationCoreEntity                     the Maxitor account
            ├── users: UserCoreEntity *               users (composition)
            └── boundaries: BoundaryCoreEntity *   boundaries (composition)
        UserCoreEntity * ── granted_boundaries ── * BoundaryCoreEntity   explicit access to a closed boundary
        UserCoreEntity 0..1 ── owner ── * BoundaryCoreEntity              the owner manages access
        Access: an open boundary (is_open) — every user of the organization; a closed one — granted_users

    BackboneDomain — the backbone of the map; depends on organization
        BusinessAreaCoreEntity * ──► 1 BoundaryCoreEntity   the upper level of the backbone, in order; owner 0..1
            └── stages: StageCoreEntity *                      the lower level of the backbone, in order; owner 0..1
        BusinessAreaCoreEntity * ──► 0..1 UserCoreEntity       owner
        StageCoreEntity * ──► 0..1 UserCoreEntity              owner

    LandscapeDomain — the C4 landscape; depends on organization and backbone
        SoftwareSystemCoreEntity * ──► 1 BoundaryCoreEntity   the top C4 level
            └── kind: Specialization by SoftwareSystemKindEnumEntity
                    ├── DigitalProductSpecEntity       gives value, gathers our containers; owner 0..1
                    └── ExternalSystemSpecEntity       beyond the boundary, exactly one container — its entry point
        ContainerCoreEntity * ──► 1 BoundaryCoreEntity        everything that runs; owner 0..1 on ours
        ContainerCoreEntity * ──► 1 BusinessAreaCoreEntity      the business area that pays for the container
            └── published_interfaces: InterfaceCoreEntity *    what the container publishes (composition)
        DigitalProductSpecEntity * ── containers ── * ContainerCoreEntity      a product gathers containers rather than containing them
        ExternalSystemSpecEntity 1 ── container ── 0..1 ContainerCoreEntity  the external system's entry point
        ContainerCoreEntity * ── used_interfaces ── * InterfaceCoreEntity     whose interfaces the container uses

    StoryMapDomain — the map and its stories; depends on organization, backbone and landscape
        StoryMapCoreEntity 1 ──► 1 BoundaryCoreEntity   exactly one map per boundary
            └── release_slices: ReleaseSliceCoreEntity *   horizontal slices from top to bottom; owner 0..1
        UserStoryCoreEntity * ──► 1 StageCoreEntity        the stage the story lies under; it can move under another
            └── plan_steps: PlanStepCoreEntity *             plan steps in order (composition)
        UserStoryCoreEntity * ──► 0..1 SoftwareSystemCoreEntity   where the requirement arises
        UserStoryCoreEntity * ── release_slice ── 0..1 ReleaseSliceCoreEntity       which slice it is planned for
        InitiativeCoreEntity * ──► 1 BoundaryCoreEntity   why the stories are done; kind — PR/FAQ; exactly one author
        UserStoryCoreEntity * ── initiative ── 0..1 InitiativeCoreEntity             which initiative it serves
        PlanStepCoreEntity * ──► 1 ContainerCoreEntity      where the step's work happens

    ──► is a one-way link to a master plugin; ── is a two-way link inside one plugin.

The AOA domains here are parts of Maxitor itself, not business areas on a boundary's
map. The boundary lives in OrganizationDomain: it is the frame every other plugin hangs
its data on, and users' access is set on it. The backbone — business areas and stages —
belongs to the boundary directly: it is what defines the boundary's edge, and
the map in StoryMapDomain shows the backbone of its boundary rather than owning it.

Every entity names its domain, and each plugin's storage names the entities it keeps
(``@entities(...)``); a storage has no domain and there is no data source. The four storages
are one PostgreSQL database for every plugin, a schema per plugin inside it. The model is a
design, so each storage is a stub without methods; they appear when it is known what to fetch.

The boundary's edge is not an entity. Digital products and our containers lie inside
the boundary's edge; external systems and their containers stand on it. A container
is external if it is an external system's entry point; otherwise it is ours. Every
container and every Software System belongs to exactly one boundary, so the boundary is
always unambiguous.

A Software System is a generalization: what is shared (name, description, boundary)
lives in the ``SoftwareSystemCoreEntity`` head, and what sets a kind apart lives in the
``DigitalProductSpecEntity`` and ``ExternalSystemSpecEntity`` specializations. Every
Software System has exactly one kind; the ``SoftwareSystemKindEnumEntity`` dictionary
sets it.

Links are built at the container level, through interfaces. A container publishes many
interfaces and uses those of others (many to many): container A is linked to container B
if A uses an interface that B publishes. A Software System is a logical label with no
code of its own, so it has no fields linking it to another Software System. A link from
a product to a product or to an external system is derived from the links of their
containers: only what runs can call anything, and so a link has one source of truth.

C4 levels: the model stores C1 (Software Systems) and C2 (containers and interfaces). C3
and code are not stored in the model: Maxitor reads them from the container's graph
through live_graph_url and graph_history_url, because below the container only its code
knows the truth.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated

from pydantic import Field

from aoa.action_machine.domain import (
    AssociationMany,
    AssociationOne,
    BaseCoreEntity,
    BaseDomain,
    BaseEnumEntity,
    BaseSpecEntity,
    BaseStateEntity,
    Classifier,
    CompositeMany,
    Generalization,
    Inverse,
    Lifecycle,
    NoInverse,
    Specialization,
    value,
)
from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.entity import entity
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseStorage


class OrganizationDomain(BaseDomain):
    """The core: the organization, its users, its boundaries and access to them. Depends on nothing."""

    name = "organization"
    description = "The core: the organization, its users and boundaries, and which users work with which boundaries"


class BackboneDomain(BaseDomain):
    """The backbone of the boundary's map: business areas and their stages. Depends on organization."""

    name = "backbone"
    description = "The backbone of the boundary: business areas and their stages, which define the boundary's edge"


class LandscapeDomain(BaseDomain):
    """The boundary's C4 landscape: Software Systems, containers and interfaces. Depends on organization and backbone."""

    name = "landscape"
    description = "Levels C1 and C2: the boundary's Software Systems, their containers and interfaces; C3 is in the container's graph"


class StoryMapDomain(BaseDomain):
    """The boundary's story map: user stories under the backbone, their plans and initiatives. Depends on all other plugins."""

    name = "story_map"
    description = "The boundary's user story map: release slices, initiatives, user stories and their plan steps"


@entity(
    description="A Maxitor account: one or more boundaries and the users who work with them",
    domain=OrganizationDomain,
)
class OrganizationCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: A Maxitor account; a studio with three clients has one organization and three boundaries.
    CONTRACT: Its boundaries and its users belong to it (composition).
    INVARIANTS: Not a legal entity and not a boundary; organizations are isolated from each other.
    AI-CORE-END
    """

    id: str = Field(description="Organization id")
    name: str = Field(description="Organization name, for example the studio's name")

    users: Annotated[
        CompositeMany[UserCoreEntity],
        Inverse(UserCoreEntity, "organization"),
    ] = Field(description="The organization's users")

    boundaries: Annotated[
        CompositeMany[BoundaryCoreEntity],
        Inverse(BoundaryCoreEntity, "organization"),
    ] = Field(description="The boundaries the organization runs")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


class UserStateEntity(BaseStateEntity):
    """A user's state in the organization: invited, active, blocked or removed."""

    sort_order: int = Field(default=0, description="Display order of the states")

    INVITED = value(code="invited", display_name="Invitation sent", sort_order=1)
    ACTIVE = value(code="active", display_name="Active", sort_order=2)
    BLOCKED = value(code="blocked", display_name="Blocked", sort_order=3)
    REMOVED = value(code="removed", display_name="Removed", sort_order=4)


class UserLifecycle(Lifecycle[UserStateEntity]):
    """
    The user lifecycle. A user appears either with an invitation sent or already active.
    An accepted invitation makes the user active, that is, a real user. An active or
    invited user can be blocked, and a blocked one can be unblocked back to active. A user
    can be removed from the organization from any state, and removal is final.
    """

    _template = (
        Lifecycle()
        .state(UserStateEntity.INVITED)
        .to(UserStateEntity.ACTIVE, UserStateEntity.BLOCKED, UserStateEntity.REMOVED)
        .initial()
        .state(UserStateEntity.ACTIVE)
        .to(UserStateEntity.BLOCKED, UserStateEntity.REMOVED)
        .initial()
        .state(UserStateEntity.BLOCKED)
        .to(UserStateEntity.ACTIVE, UserStateEntity.REMOVED)
        .intermediate()
        .state(UserStateEntity.REMOVED)
        .final()
    )


@entity(
    description="A person who works in Maxitor; not the C4 Person who uses the digital products",
    domain=OrganizationDomain,
)
class UserCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: A person who works in Maxitor: sees boundaries and is accountable for parts of their map and landscape.
    CONTRACT: Belongs to exactly one organization. Has access to every open boundary of the
        organization and to the closed ones where they are listed explicitly. May own a boundary,
        a release slice, a business area, a stage, a user story, a digital product and our container.
        The state follows UserLifecycle: invitation sent, active, blocked, removed. An organization
        administrator invites, blocks and removes users, creates boundaries and appoints the owner of
        a boundary that has no active owner.
    INVARIANTS: Owns only what lies in a boundary they have access to. An organization always has
        at least one active administrator.
        A blocked or removed user does not work in Maxitor; what they owned stays theirs until the
        owner is changed, and it is visible that the owner is blocked or removed.
        The core knows nothing of the other plugins: what a user owns there — business areas, stages,
        stories, products, containers, slices — and the initiatives they authored are read from those
        plugins' entities, which point at the user one way.
    AI-CORE-END
    """

    id: str = Field(description="User id")
    name: str = Field(description="User name")
    email: str = Field(description="The email the invitation was sent to and the user signs in with")
    status: UserLifecycle = Field(description="The user's state: invitation sent, active, blocked or removed")
    is_admin: bool = Field(
        default=False,
        description="Organization administrator: invites, blocks and removes users, creates boundaries",
    )

    organization: Annotated[
        AssociationOne[OrganizationCoreEntity],
        Inverse(OrganizationCoreEntity, "users"),
    ] = Field(description="The organization the user belongs to")

    granted_boundaries: Annotated[
        AssociationMany[BoundaryCoreEntity],
        Inverse(BoundaryCoreEntity, "granted_users"),
    ] = Field(description="Closed boundaries the user is listed in explicitly; open ones are accessible anyway")

    owned_boundaries: Annotated[
        AssociationMany[BoundaryCoreEntity],
        Inverse(BoundaryCoreEntity, "owner"),
    ] = Field(description="Boundaries the user owns and manages access to")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


@entity(
    description="All of ours that serves one end-to-end business process; the frame of the map and the landscape",
    domain=OrganizationDomain,
)
class BoundaryCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: The frame of the story map and of the C4 landscape; everything in them belongs to exactly one boundary.
    CONTRACT: Defined by its end-to-end business process, not by a legal entity and not by infrastructure.
        Belongs to exactly one organization.
    INVARIANTS: A studio that works for three clients runs three boundaries in one organization;
        a holding with unrelated businesses runs one per business. There is exactly one map. Every
        Software System and every container is recorded in exactly one boundary. Only users of the
        boundary's organization have access to it: to an open one — all of them, to a closed one —
        those listed explicitly. The owner opens it, closes it and grants access; without an active
        owner the administrator does. The administrator changes the owner, and only when there is no
        active owner.
        The boundary is the core's frame and knows nothing of what hangs on it: its backbone, map,
        Software Systems, containers and initiatives live in the other plugins and point at the
        boundary one way.
    AI-CORE-END
    """

    id: str = Field(description="Boundary id")
    name: str = Field(description="Boundary name; it also names the end-to-end process, for example development")
    description: str = Field(description="What the process is and why it is set up and improved")
    is_open: bool = Field(
        description="Whether the boundary is open: an open one is available to every user of the organization, a closed one only to those listed",
    )

    organization: Annotated[
        AssociationOne[OrganizationCoreEntity],
        Inverse(OrganizationCoreEntity, "boundaries"),
    ] = Field(description="The organization that runs the boundary")

    granted_users: Annotated[
        AssociationMany[UserCoreEntity],
        Inverse(UserCoreEntity, "granted_boundaries"),
    ] = Field(
        description="Users of the organization granted access explicitly; it applies while the boundary is closed",
    )

    owner: Annotated[
        AssociationOne[UserCoreEntity] | None,
        Inverse(UserCoreEntity, "owned_boundaries"),
    ] = Field(
        default=None,
        description="The boundary's owner: opens, closes and grants access; replaced only when not active",
    )

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


@entity(
    description="The upper level of the backbone: a large part of the boundary's end-to-end process",
    domain=BackboneDomain,
)
class BusinessAreaCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: A large part of the end-to-end process, for example the land bank, design or finance.
    CONTRACT: Belongs to exactly one boundary and has its place in order from left to right. The
        boundary does not know its business areas: the backbone plugin depends on the core, not
        the other way round.
    INVARIANTS: Not an AOA domain. A domain is an area inside the code of one application, while a
        business area is a part of the business on the boundary's map; they may overlap, but
        neither follows from the other. The backbone defines the boundary's edge: nothing
        that is not on it gets developed.
    AI-CORE-END
    """

    id: str = Field(description="Business area id")
    name: str = Field(description="Area name, for example the land bank or construction")
    position: int = Field(description="Place on the backbone, counting from the left", ge=0)

    boundary: Annotated[
        AssociationOne[BoundaryCoreEntity],
        NoInverse(),
    ] = Field(description="The boundary whose backbone this area is part of; the core does not list its areas")

    stages: Annotated[
        CompositeMany[StageCoreEntity],
        Inverse(StageCoreEntity, "business_area"),
    ] = Field(description="The lower level of the backbone inside this area, from left to right")

    owner: Annotated[
        AssociationOne[UserCoreEntity] | None,
        NoInverse(),
    ] = Field(default=None, description="The user who owns the area; empty until an owner is appointed")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


@entity(
    description="The lower level of the backbone: a step inside a business area",
    domain=BackboneDomain,
)
class StageCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: A step inside one business area; user stories lie under it.
    CONTRACT: Belongs to exactly one business area and has its place in order from left to right.
        The stage does not know its stories: they live in the story map plugin, which depends on
        the backbone, and point at the stage one way.
    AI-CORE-END
    """

    id: str = Field(description="Stage id")
    name: str = Field(description="Stage name")
    position: int = Field(description="Place inside the business area, counting from the left", ge=0)

    business_area: Annotated[
        AssociationOne[BusinessAreaCoreEntity],
        Inverse(BusinessAreaCoreEntity, "stages"),
    ] = Field(description="The business area this stage is a step of")

    owner: Annotated[
        AssociationOne[UserCoreEntity] | None,
        NoInverse(),
    ] = Field(default=None, description="The user who owns the stage; empty until an owner is appointed")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


# The container is declared before the Software System classes on purpose. Declared after the
# specializations that refer to it, model_rebuild recurses forever (an AOA bug,
# bystrovmaxim/aoa#415).
@entity(
    description="The C4 level below a Software System: what actually runs — a service, a database, an app, a queue",
    domain=LandscapeDomain,
)
class ContainerCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: What actually runs; most often a service, so people call containers services.
    CONTRACT: Belongs to exactly one boundary and is paid for by exactly one business area of its
        backbone. Either ours — working for zero or more digital products — or external — the entry
        point of exactly one external system, belonging to no product. Publishes its interfaces (many)
        and uses those of others (many to many). Created by hand together with a link: ours to the
        graph history on GitHub and, if the service runs, to the live graph; an external one to the
        service's web address. The interfaces and links of our container are derived from its code;
        for an external one they are entered by hand: there is no source code.
    INVARIANTS: Our container without a single product is a signal that it serves no value. A container
        is the highest level with real links; links between Software Systems are derived from container
        links. The history link holds no access keys: only a public link to the graph file. Graph links
        exist only on our container, the service's web address only on an external one. An external
        container has a business area too: the one that answers for the integration with that partner.
        The container does not know the plan steps done in it: they live in the story map plugin and
        point at the container one way.
    AI-CORE-END
    """

    id: str = Field(description="Container id")
    name: str = Field(description="Container name, for example the residents' mobile app or a bank's API")
    description: str = Field(description="What the container does")
    kind: str = Field(description="Container kind: service, database, mobile app, web app, queue")
    live_graph_url: str | None = Field(
        default=None,
        description="Address of the running container's live graph: the service or its graph-json; empty if there is none",
    )
    graph_history_url: str | None = Field(
        default=None,
        description="Link to the container's graph file on GitHub, through which Maxitor opens its version history; no keys",
    )
    service_url: str | None = Field(
        default=None,
        description="Web address of an external service, for example its website or API documentation; only on an external container",
    )

    boundary: Annotated[
        AssociationOne[BoundaryCoreEntity],
        NoInverse(),
    ] = Field(description="The boundary the container is recorded in; the core does not list its containers")

    business_area: Annotated[
        AssociationOne[BusinessAreaCoreEntity],
        NoInverse(),
    ] = Field(description="The business area that pays for the container; for an external one — the area that answers for the integration")

    digital_products: Annotated[
        AssociationMany[DigitalProductSpecEntity],
        Inverse(DigitalProductSpecEntity, "containers"),
    ] = Field(description="The digital products our container works for; an external container has none")

    external_system: Annotated[
        AssociationOne[ExternalSystemSpecEntity] | None,
        Inverse(ExternalSystemSpecEntity, "container"),
    ] = Field(
        default=None,
        description="The external system this container is the entry point of; our container has none",
    )

    published_interfaces: Annotated[
        CompositeMany[InterfaceCoreEntity],
        Inverse(InterfaceCoreEntity, "publisher"),
    ] = Field(description="The interfaces the container publishes for others; there may be many")

    used_interfaces: Annotated[
        AssociationMany[InterfaceCoreEntity],
        Inverse(InterfaceCoreEntity, "consumers"),
    ] = Field(description="Other containers' interfaces this container uses; this is how a container link arises")

    owner: Annotated[
        AssociationOne[UserCoreEntity] | None,
        NoInverse(),
    ] = Field(default=None, description="The user who owns our container; an external container has no owner")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


@entity(
    description="A set of related endpoints of a container on one protocol, for example a mobile API over HTTP",
    domain=LandscapeDomain,
)
class InterfaceCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: What links one container to another: a set of related endpoints on one protocol.
    CONTRACT: Published by exactly one container and used by zero or more containers. The same set
        of endpoints on another protocol (HTTP and MCP) is another interface.
    INVARIANTS: In an AOA service one interface is one adapter. The interfaces of our container are
        derived from its code; those of an external one are entered by hand.
    AI-CORE-END
    """

    id: str = Field(description="Interface id")
    name: str = Field(description="Interface name, for example admin, mobile or payment")
    description: str = Field(description="Who the interface is for and what is done through it")
    protocol: str = Field(description="The interface's protocol, for example http, mcp, grpc, sftp")

    publisher: Annotated[
        AssociationOne[ContainerCoreEntity],
        Inverse(ContainerCoreEntity, "published_interfaces"),
    ] = Field(description="The container that publishes the interface; there is exactly one")

    consumers: Annotated[
        AssociationMany[ContainerCoreEntity],
        Inverse(ContainerCoreEntity, "used_interfaces"),
    ] = Field(description="The containers that use the interface")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


@entity(description="Software System kinds: a digital product or an external system", domain=LandscapeDomain)
class SoftwareSystemKindEnumEntity(BaseEnumEntity):
    """The dictionary of kinds the Software System specialization axis takes its codes from."""

    DIGITAL_PRODUCT = value(code="digital_product", display_name="Digital product")
    EXTERNAL_SYSTEM = value(code="external_system", display_name="External system")


@entity(
    description="The top C4 level inside a boundary: something that makes sense on its own, without looking inside",
    domain=LandscapeDomain,
)
class SoftwareSystemCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: The head of the Software System generalization: what a digital product and an external system share.
    CONTRACT: Belongs to exactly one boundary and has exactly one kind — one of the specializations.
    INVARIANTS: The word itself is vague, so a Software System is spoken of only through its kind.
        There are no fields linking one Software System to another: such links are derived from the
        links of its containers. The list of Software Systems and their containers are entered by hand:
        they are not in the code. The Software System does not know the stories whose requirements
        arise in it: they live in the story map plugin and point at it one way.
    AI-CORE-END
    """

    id: str = Field(description="Software System id")
    name: str = Field(description="Name, for example FSM, billing, the state housing system or a bank")
    description: str = Field(description="What it is: what value it gives or why we integrate with it")

    boundary: Annotated[
        AssociationOne[BoundaryCoreEntity],
        NoInverse(),
    ] = Field(description="The boundary inside whose boundary, or on whose boundary, it stands; the core does not list its systems")

    kind: Annotated[
        Specialization[DigitalProductSpecEntity | ExternalSystemSpecEntity, SoftwareSystemKindEnumEntity],
        Inverse(field_name="software_system"),
    ] = Field(description="The Software System's kind: a digital product or an external system")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


@entity(
    description="A kind of Software System: something that gives people value by improving the boundary's business process",
    domain=LandscapeDomain,
)
class DigitalProductSpecEntity(BaseSpecEntity):
    """
    AI-CORE-BEGIN
    ROLE: The carrier of value for the people who use it; not a service but a set of containers that give value together.
    CONTRACT: Gathers one or more containers but does not contain them: one container may work for
        several products, and the containers belong to the boundary.
    INVARIANTS: All of a product's containers belong to the same boundary as the product.
    AI-CORE-END
    """

    id: str = Field(description="Digital product id; the same as its Software System's")

    software_system: Annotated[
        Generalization[SoftwareSystemCoreEntity],
        Classifier(variant=SoftwareSystemKindEnumEntity.DIGITAL_PRODUCT),
        Inverse(SoftwareSystemCoreEntity, "kind"),
    ] = Field(description="The Software System this product is a kind of")

    containers: Annotated[
        AssociationMany[ContainerCoreEntity],
        Inverse(ContainerCoreEntity, "digital_products"),
    ] = Field(description="The containers that together give the product's value, including supporting ones")

    owner: Annotated[
        AssociationOne[UserCoreEntity] | None,
        NoInverse(),
    ] = Field(default=None, description="The user who owns the product; empty until an owner is appointed")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


@entity(
    description="A kind of Software System: anything we integrate with that lies beyond the boundary's edge",
    domain=LandscapeDomain,
)
class ExternalSystemSpecEntity(BaseSpecEntity):
    """
    AI-CORE-BEGIN
    ROLE: A system on the boundary's edge: the systems of partners, banks, the state. Needed at C1.
    CONTRACT: Has exactly one container — its entry point. At C2 and below that container takes part
        instead of the system: our containers use its interfaces.
    INVARIANTS: The same external system on the boundary of two boundaries is recorded in each
        separately, because boundaries are isolated from each other.
    AI-CORE-END
    """

    id: str = Field(description="External system id; the same as its Software System's")

    software_system: Annotated[
        Generalization[SoftwareSystemCoreEntity],
        Classifier(variant=SoftwareSystemKindEnumEntity.EXTERNAL_SYSTEM),
        Inverse(SoftwareSystemCoreEntity, "kind"),
    ] = Field(description="The Software System this external system is a kind of")

    container: Annotated[
        AssociationOne[ContainerCoreEntity],
        Inverse(ContainerCoreEntity, "external_system"),
    ] = Field(description="The external system's only container — its entry point")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


@entity(
    description="The development map of the whole boundary: user stories under the boundary's backbone",
    domain=StoryMapDomain,
)
class StoryMapCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: The only user story map of one boundary.
    CONTRACT: Belongs to exactly one boundary; a boundary has exactly one map. The boundary does
        not know its map: the story map plugin depends on the core, not the other way round.
    INVARIANTS: The map shows the backbone of its boundary — business areas and their stages from
        the backbone plugin — but does not own it: the backbone belongs to the boundary. What the map
        owns is its release slices.
    AI-CORE-END
    """

    id: str = Field(description="Map id")

    boundary: Annotated[
        AssociationOne[BoundaryCoreEntity],
        NoInverse(),
    ] = Field(description="The boundary the map belongs to; the core does not list its map")

    release_slices: Annotated[
        CompositeMany[ReleaseSliceCoreEntity],
        Inverse(ReleaseSliceCoreEntity, "story_map"),
    ] = Field(description="Horizontal slices below the backbone, from top to bottom: what goes into which portion of value")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


@entity(
    description="A horizontal slice of the user story map: a portion of value, for example an MVP or Release 2",
    domain=StoryMapDomain,
)
class ReleaseSliceCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: A horizontal slice of the map below the backbone: which stories under all the stages make up one portion of value.
    CONTRACT: Belongs to exactly one map and has its place from top to bottom. It holds zero or more
        stories, and every story lies in at most one slice.
    INVARIANTS: It is not a code version. A container's version (version.toml, a GitHub Release) is
        another idea: one slice holds work in many containers with their own versions.
    AI-CORE-END
    """

    id: str = Field(description="Release slice id")
    name: str = Field(description="Slice name, for example MVP or Release 2")
    goal: str = Field(description="The slice's goal: what people will get when its stories are done")
    position: int = Field(description="The slice's place on the map, counting from the top", ge=0)
    target_date: date | None = Field(default=None, description="The slice's target date; empty if none is set")

    story_map: Annotated[
        AssociationOne[StoryMapCoreEntity],
        Inverse(StoryMapCoreEntity, "release_slices"),
    ] = Field(description="The map the slice lies on")

    user_stories: Annotated[
        AssociationMany[UserStoryCoreEntity],
        Inverse(UserStoryCoreEntity, "release_slice"),
    ] = Field(description="The stories planned for this slice")

    owner: Annotated[
        AssociationOne[UserCoreEntity] | None,
        NoInverse(),
    ] = Field(default=None, description="The user who owns the slice; empty until an owner is appointed")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


@entity(description="Initiative kinds; for now there is one — PR/FAQ", domain=StoryMapDomain)
class InitiativeKindEnumEntity(BaseEnumEntity):
    """The dictionary of initiative kinds: the format in which an initiative explains why its stories are done."""

    PR_FAQ = value(code="pr_faq", display_name="PR/FAQ")


class InitiativeStateEntity(BaseStateEntity):
    """An initiative's state: draft, approved, done or rejected."""

    sort_order: int = Field(default=0, description="Display order of the states")

    DRAFT = value(code="draft", display_name="Draft", sort_order=1)
    APPROVED = value(code="approved", display_name="Approved", sort_order=2)
    DONE = value(code="done", display_name="Done", sort_order=3)
    REJECTED = value(code="rejected", display_name="Rejected", sort_order=4)


class InitiativeLifecycle(Lifecycle[InitiativeStateEntity]):
    """
    The simplified initiative lifecycle. A draft is discussed and either approved or rejected.
    An approved initiative is carried out through its stories and finished, and it can still be
    dropped after approval.
    """

    _template = (
        Lifecycle()
        .state(InitiativeStateEntity.DRAFT)
        .to(InitiativeStateEntity.APPROVED, InitiativeStateEntity.REJECTED)
        .initial()
        .state(InitiativeStateEntity.APPROVED)
        .to(InitiativeStateEntity.DONE, InitiativeStateEntity.REJECTED)
        .intermediate()
        .state(InitiativeStateEntity.DONE)
        .final()
        .state(InitiativeStateEntity.REJECTED)
        .final()
    )


@entity(
    description="A boundary's initiative: why the stories under it are done",
    domain=StoryMapDomain,
)
class InitiativeCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: The answer to "why" for a group of user stories; for now the only kind is PR/FAQ.
    CONTRACT: Belongs to exactly one boundary. It has zero or more stories, and every story lies
        under at most one initiative. It has exactly one author — the user who created it. The state
        follows InitiativeLifecycle: draft, approved, done or rejected.
    INVARIANTS: The initiative's content is not modelled yet: it will be a set of nodes, not a
        document, and will be designed separately. The author never changes and stays the author
        even if blocked or removed.
    AI-CORE-END
    """

    id: str = Field(description="Initiative id")
    name: str = Field(description="Initiative name")
    kind: Annotated[AssociationOne[InitiativeKindEnumEntity], NoInverse()] = Field(
        description="The initiative's kind; only PR/FAQ for now",
    )
    status: InitiativeLifecycle = Field(description="The initiative's state: draft, approved, done or rejected")

    boundary: Annotated[
        AssociationOne[BoundaryCoreEntity],
        NoInverse(),
    ] = Field(description="The boundary the initiative belongs to; the core does not list its initiatives")

    user_stories: Annotated[
        AssociationMany[UserStoryCoreEntity],
        Inverse(UserStoryCoreEntity, "initiative"),
    ] = Field(description="The stories done for this initiative")

    author: Annotated[
        AssociationOne[UserCoreEntity],
        NoInverse(),
    ] = Field(description="The user who created the initiative")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


class UserStoryStateEntity(BaseStateEntity):
    """A user story's state: from an idea on the map to a done or rejected story."""

    sort_order: int = Field(default=0, description="Display order of the states")

    BACKLOG = value(code="backlog", display_name="Idea", sort_order=1)
    ELABORATION = value(code="elaboration", display_name="In elaboration", sort_order=2)
    READY = value(code="ready", display_name="Ready", sort_order=3)
    IN_PROGRESS = value(code="in_progress", display_name="In progress", sort_order=4)
    DONE = value(code="done", display_name="Done", sort_order=5)
    REJECTED = value(code="rejected", display_name="Rejected", sort_order=6)


class UserStoryLifecycle(Lifecycle[UserStoryStateEntity]):
    """
    The user story lifecycle: which states exist and which moves between them are allowed.

    An idea is written on the map, gets a Software System and a plan on mob elaboration,
    becomes ready, is done and becomes done. A story can be rejected at any step before the
    end. From elaboration it can go back to the ideas, and from ready and from in progress back
    to elaboration if the plan had to be revised.
    """

    _template = (
        Lifecycle()
        .state(UserStoryStateEntity.BACKLOG)
        .to(UserStoryStateEntity.ELABORATION, UserStoryStateEntity.REJECTED)
        .initial()
        .state(UserStoryStateEntity.ELABORATION)
        .to(UserStoryStateEntity.READY, UserStoryStateEntity.BACKLOG, UserStoryStateEntity.REJECTED)
        .intermediate()
        .state(UserStoryStateEntity.READY)
        .to(UserStoryStateEntity.IN_PROGRESS, UserStoryStateEntity.ELABORATION, UserStoryStateEntity.REJECTED)
        .intermediate()
        .state(UserStoryStateEntity.IN_PROGRESS)
        .to(UserStoryStateEntity.DONE, UserStoryStateEntity.ELABORATION, UserStoryStateEntity.REJECTED)
        .intermediate()
        .state(UserStoryStateEntity.DONE)
        .final()
        .state(UserStoryStateEntity.REJECTED)
        .final()
    )


@entity(
    description="One user story on the map: who wants to do what and why",
    domain=StoryMapDomain,
)
class UserStoryCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One user story under a stage on the map.
    CONTRACT: At any moment lies under exactly one stage. Moved under another stage, it stays the
        same story: the link to the stage is a one-way association from the story, and the stage,
        which lives in the backbone plugin, does not know its stories. Points to zero or one Software
        System — the digital product or external system where the requirement arises. On mob
        elaboration it is split into plan steps, and each step points to its container. The state
        follows UserStoryLifecycle.
    INVARIANTS: The steps' containers do not have to belong to the story's Software System: a story of
        one product may need work in a container of another, and this makes cross-product impact
        visible. "Ready" — only with a Software System and at least one step; "done" — only when all
        steps are done.
    AI-CORE-END
    """

    id: str = Field(description="User story id")
    title: str = Field(description="Short title of the story")
    text: str = Field(description="The story itself: who wants to do what and why")
    position: int = Field(
        description="Place in the stage × release slice cell, counting from the top, by priority", ge=0
    )
    status: UserStoryLifecycle = Field(description="The story's state: from an idea to done or rejected")

    stage: Annotated[
        AssociationOne[StageCoreEntity],
        NoInverse(),
    ] = Field(description="The stage the story lies under; the backbone does not list the stories of a stage")

    owner: Annotated[
        AssociationOne[UserCoreEntity] | None,
        NoInverse(),
    ] = Field(default=None, description="The user who owns the story; empty until an owner is appointed")

    software_system: Annotated[
        AssociationOne[SoftwareSystemCoreEntity] | None,
        NoInverse(),
    ] = Field(
        default=None,
        description="The Software System where the story's requirement arises; empty until mob elaboration",
    )

    plan_steps: Annotated[
        CompositeMany[PlanStepCoreEntity],
        Inverse(PlanStepCoreEntity, "user_story"),
    ] = Field(description="The story's plan steps in order; they appear on mob elaboration")

    release_slice: Annotated[
        AssociationOne[ReleaseSliceCoreEntity] | None,
        Inverse(ReleaseSliceCoreEntity, "user_stories"),
    ] = Field(default=None, description="The release slice the story is planned for; empty until it is planned")

    initiative: Annotated[
        AssociationOne[InitiativeCoreEntity] | None,
        Inverse(InitiativeCoreEntity, "user_stories"),
    ] = Field(default=None, description="The initiative the story is done for; empty if there is none")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


class PlanStepStateEntity(BaseStateEntity):
    """A plan step's readiness; for now there are two states: a step is either done or not."""

    sort_order: int = Field(default=0, description="Display order of the states")

    TODO = value(code="todo", display_name="Not done", sort_order=1)
    DONE = value(code="done", display_name="Done", sort_order=2)


class PlanStepLifecycle(Lifecycle[PlanStepStateEntity]):
    """
    The plan step lifecycle: a new step is not done, and a finished one becomes done.

    A new state is added as one line in PlanStepStateEntity and its moves here; the step's
    field stays the same.
    """

    _template = (
        Lifecycle()
        .state(PlanStepStateEntity.TODO)
        .to(PlanStepStateEntity.DONE)
        .initial()
        .state(PlanStepStateEntity.DONE)
        .final()
    )


@entity(
    description="A plan step of a user story: one piece of work in one container",
    domain=StoryMapDomain,
)
class PlanStepCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One piece of work from a story's plan, done in one container.
    CONTRACT: Belongs to exactly one user story and has its place in its plan in order. Points to
        exactly one container; the container, which lives in the landscape plugin, does not know
        its steps. Readiness follows PlanStepLifecycle: for now there are two states, "not done"
        (initial) and "done" (final).
    INVARIANTS: A step on an external container is not our work but a request to the other side.
    AI-CORE-END
    """

    id: str = Field(description="Step id")
    title: str = Field(description="Short title of the step")
    text: str = Field(description="What needs to be done in the container")
    position: int = Field(description="The step's place in the story's plan, counting from the first", ge=0)
    status: PlanStepLifecycle = Field(description="The step's readiness: not done or done")

    user_story: Annotated[
        AssociationOne[UserStoryCoreEntity],
        Inverse(UserStoryCoreEntity, "plan_steps"),
    ] = Field(description="The user story whose plan holds the step")

    container: Annotated[
        AssociationOne[ContainerCoreEntity],
        NoInverse(),
    ] = Field(description="The container where the step's work happens; the landscape does not list the steps of a container")

    created_at: datetime = Field(description="When the record was created")
    updated_at: datetime | None = Field(
        default=None, description="When the record last changed; empty if it has not changed yet"
    )


OrganizationCoreEntity.model_rebuild()
UserCoreEntity.model_rebuild()
BoundaryCoreEntity.model_rebuild()
BusinessAreaCoreEntity.model_rebuild()
StageCoreEntity.model_rebuild()
ContainerCoreEntity.model_rebuild()
InterfaceCoreEntity.model_rebuild()
SoftwareSystemCoreEntity.model_rebuild()
DigitalProductSpecEntity.model_rebuild()
ExternalSystemSpecEntity.model_rebuild()
StoryMapCoreEntity.model_rebuild()
ReleaseSliceCoreEntity.model_rebuild()
InitiativeCoreEntity.model_rebuild()
UserStoryCoreEntity.model_rebuild()
PlanStepCoreEntity.model_rebuild()


# Each plugin's storage names the entities it keeps (a storage has no domain and no data source).


@meta(description="Stores the core: organizations, users and boundaries")
@entities(OrganizationCoreEntity, UserCoreEntity, BoundaryCoreEntity)
class OrganizationStorage(BaseStorage):
    """Stores the core: organizations, users and boundaries; the design never opens it."""


@meta(description="Stores the backbone: business areas and stages")
@entities(BusinessAreaCoreEntity, StageCoreEntity)
class BackboneStorage(BaseStorage):
    """Stores the backbone: business areas and stages; the design never opens it."""


@meta(description="Stores the landscape: Software Systems, containers and interfaces")
@entities(ContainerCoreEntity, InterfaceCoreEntity, SoftwareSystemKindEnumEntity, SoftwareSystemCoreEntity, DigitalProductSpecEntity, ExternalSystemSpecEntity)
class LandscapeStorage(BaseStorage):
    """Stores the landscape: Software Systems, containers and interfaces; the design never opens it."""


@meta(description="Stores the story map: slices, initiatives, stories and steps")
@entities(StoryMapCoreEntity, ReleaseSliceCoreEntity, InitiativeKindEnumEntity, InitiativeCoreEntity, UserStoryCoreEntity, PlanStepCoreEntity)
class StoryMapStorage(BaseStorage):
    """Stores the story map: slices, initiatives, stories and steps; the design never opens it."""
