# Feature Specification: An entity belongs to a resource — Maxitor shows the model of a resource

**Feature Branch**: `feature/issue-46-resource-model`

**Created**: 2026-11-06

**Status**: Draft

**Input**: Issue #46, "An entity belongs to a resource 2/2: Maxitor shows the model of a resource".

## What this is

Maxitor places an entity by its `domain` edge only. The entity ERD of a domain draws every entity of that domain, but nothing on it says which store keeps which entity. A reader cannot pick out the data model of one database: the entities it stores and the relations between them.

Protocol 1.6 (#45) adds the `entity_resource` edge, Entity → Resource, and AOA (bystrovmaxim/aoa#474) writes it for every entity and refuses any relation between entities of different resources. This change makes Maxitor read that edge and show it on the ERD it already has:

- the ERD's filter panel gains a **Resources** section, one row per resource on the diagram;
- the ERD gains a **Boundary** switch, as the use-case diagram has: on, the entities of each resource are drawn inside one rounded contour, and the contour's header carries the resource's name;
- the element card of an entity names its resource.

Because AOA refuses relations across resources, a resource's boundary holds a closed model: no relation line crosses its contour. A resource belongs to one domain and gives its entities that domain, so every relation of a graph from AOA — dictionaries and specializations included — stays inside one domain and one resource, and 1-hop only brings back tables of the same resource.

This is step 3 of 4 of one change: the protocol (#45), AOA (bystrovmaxim/aoa#469), Maxitor (this spec), then the game offers move to one resource per database (bystrovmaxim/gameoffer#146).

## Clarifications

### Session 2026-11-06

- Q: Where does the reader open the model of one resource — a new row in the left sidebar, or the ERD that exists? → A: The ERD that exists ("Entity domain view" and "ERD all domains"). The left sidebar gains nothing. The ERD's filter panel gains a Resources section, and the ERD gains a Boundary mode, as the use-case diagram has, drawing the border of each resource with its name in the header.
- Q: Are the Resources section and the Boundary switch shown when the diagram has one resource? → A: Yes, both are shown even for one resource.
- Q: Is the new state shared in a room? → A: Yes, all of it: the Resources rows switched off, Boundary, and painting by resource are page settings, broadcast to every member of the room as the domain and kind filters are.
- Q: Must a resource have the same colour for everyone on the diagram? → A: Yes. A resource's colour depends only on the graph: the server gives it from the palette by the resource's place among all resources of the graph, as it gives domain colours, so filters, 1-hop, the domain opened, the browser and the order of joining a room never change it.
- Q: Does the Resources section paint? → A: Yes. It takes its own point on the gear shift at the foot of the filter panel; on that point every table and contour is painted in its resource's colour.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The border of each store on the ERD (Priority: P1)

A reader opens the entity ERD of a domain and turns Boundary on. The entities of each resource are drawn inside one rounded contour; the contour's header names the resource. The reader sees at once which tables live in which database, and that the relations of a database stay inside its contour.

**Why this priority**: It is the reason for the whole chain: the data model of one store, seen as one picture.

**Independent Test**: Load a 1.6 graph with one domain whose entities belong to two resources. Open the domain's ERD with Boundary on: two contours, each headed by its resource's name, each holding exactly the entities of that resource. Turn Boundary off: the same tables and lines, no contours.

**Acceptance Scenarios**:

1. **Given** a domain whose entities `Order` and `OrderLine` belong to `StorefrontDatabase` and `Invoice` to `BillingDatabase`, **When** the reader opens the domain's ERD with Boundary on, **Then** `Order` and `OrderLine` sit in a contour headed `StorefrontDatabase`, `Invoice` in a contour headed `BillingDatabase`, and every relation line runs inside one contour.
2. **Given** the same diagram, **When** the reader turns Boundary off, **Then** the contours disappear and the tables and relations are those drawn before this change.
3. **Given** a domain whose entities all belong to one resource, **When** Boundary is on, **Then** one contour headed by that resource holds them all.
4. **Given** Boundary is on and a filter hides `OrderLine`, **When** 1-hop brings it back as `Order`'s neighbour, **Then** it sits in the `StorefrontDatabase` contour with `Order`.
5. **Given** the reader turned Boundary on, **When** the reader shares the page or opens it again, **Then** Boundary is still on: it is a page setting, kept in the address as the use-case diagram's is.

---

### User Story 2 - Show only some stores (Priority: P1)

A reader opens the filter panel of the ERD and finds a **Resources** section with one row per resource on the diagram. Switching a resource off hides its tables, as switching off a domain or a kind does.

**Why this priority**: A domain with several stores is read one store at a time; together with Boundary it gives the model of one database alone.

**Independent Test**: On the two-resource diagram, switch `BillingDatabase` off: `Invoice` and its contour disappear, `Order` and `OrderLine` stay. Switch it on again: the diagram is as before.

**Acceptance Scenarios**:

1. **Given** the domain ERD of User Story 1, **When** the reader opens the filter panel, **Then** a section **Resources** lists `BillingDatabase` and `StorefrontDatabase`, both on.
2. **Given** that section, **When** the reader switches `BillingDatabase` off, **Then** `Invoice` is hidden, and with Boundary on its contour is gone too.
3. **Given** a diagram whose entities all belong to one resource, **When** the reader opens the filter panel, **Then** the Resources section is there with that one row.
4. **Given** a resource switched off, **When** 1-hop is on, **Then** 1-hop brings its tables back only as it brings back tables hidden by any other filter (spec 038): filters and 1-hop keep their present rules.
5. **Given** the filter panel, **When** the reader moves the gear shift to the Resources point, **Then** the Resources section opens, the others fold, and every table (and, with Boundary on, every contour) takes its resource's colour; the section's rows show that colour.

---

### User Story 3 - A room sees the same resources (Priority: P1)

Two readers are in one room on the same ERD. One switches a resource off, turns Boundary on, or moves the gear shift to Resources. The other sees the same change at once, as with the domain and kind filters today.

**Why this priority**: Rooms are how the model is read together; a setting that stays on one screen splits the room.

**Independent Test**: Open the ERD in two browsers joined to one room. In the first, switch `BillingDatabase` off, turn Boundary off, paint by Resources: the second shows each change. Reload the second: it joins with the room's state.

**Acceptance Scenarios**:

1. **Given** two members of one room on a domain's ERD, **When** one switches a Resources row off, **Then** the other's diagram hides the same tables.
2. **Given** the same room, **When** one turns Boundary on or off, **Then** the other's diagram draws or drops the contours.
3. **Given** the same room, **When** one moves the gear shift to Resources, **Then** the other's diagram is painted by resource.
4. **Given** a member who joins the room later, **When** the page opens, **Then** it shows the room's Resources rows, Boundary and paint.
5. **Given** a room painted by Resources, **When** each member looks at `BillingDatabase`, **Then** it has the same colour on every screen, whatever each member has scrolled to or which browser they use.

---

### User Story 4 - An entity names its resource (Priority: P2)

A reader opens the element card of a table. Under its name it reads the entity's resource.

**Why this priority**: Useful on its own, and the check a reader makes when a table sits in an unexpected contour.

**Independent Test**: Open the card of `Invoice`: it shows resource `BillingDatabase`.

**Acceptance Scenarios**:

1. **Given** a 1.6 graph, **When** the reader opens the card of an entity, **Then** the line under its name reads `Resource: <name>`.
2. **Given** a graph of version 1.5 or older, **When** the reader opens the card of an entity, **Then** the card has no resource line and shows everything it showed before.

---

### User Story 5 - Maxitor's own model has its store (Priority: P3)

Maxitor's own entity, `NodeCoreEntity` in `DiagramsDomain`, declares its resource, `DuckDBGraphResource`, which builds its rows. Maxitor's own graph is therefore a valid 1.6 graph, and its ERD shows that entity inside the contour of `DuckDBGraphResource`.

**Why this priority**: Required by AOA once it moves to the release of aoa#469; Maxitor's graph is the first real data the feature is checked on.

**Independent Test**: Rebuild Maxitor's graph: it is version 1.6 and has the edge `NodeCoreEntity` → `DuckDBGraphResource`. Open Diagrams' ERD with Boundary on: `NodeCoreEntity` sits in a contour headed `DuckDBGraphResource`.

**Acceptance Scenarios**:

1. **Given** AOA at the commit of aoa#474, **When** Maxitor's graph is rebuilt, **Then** it validates as 1.6 and `NodeCoreEntity` has one `entity_resource` edge to `DuckDBGraphResource`.

### Edge Cases

- **A graph of version 1.5 or older**: it loads as before. It has no resources, so the ERD has no Resources section, no Boundary switch and no Resources point on the gear shift, and every diagram looks as it did.
- **An entity without an `entity_resource` edge in a 1.6 graph** (the protocol forbids it, but a hand-written graph may have it): the entity is drawn outside every contour, is not hidden by any Resources row, and its card has no resource line. Nothing fails.
- **A resource with no entities** (a service, a socket channel): it has no row in the Resources section and no contour; only resources that store an entity on the diagram appear.
- **"ERD all domains"**: the same section and switch, over every resource of the graph.
- **Diff and Side by side**: each side draws its own resources; a table takes the newer side's resource, or the older side's when it is gone from the newer. A table is marked changed by its resource only when both versions give it a resource and the two differ; its card then reads `Resource: <old> → <new>`. A resource that appears where the older version had none (every 1.5 → 1.6 comparison) marks nothing, so moving to protocol 1.6 does not paint every table as changed.
- **A resource name repeated in two domains**: rows and contours are keyed by the resource's id; the label is its name, and the full id is shown on hover.
- **A relation between two resources in a hand-written graph** (AOA refuses it, so it cannot come from AOA): the line is drawn across the two contours as it is; Maxitor adds no check.
- **Every resource switched off**: the diagram is empty, as when every domain is switched off.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Maxitor MUST load the `entity_resource` edges of a 1.6 graph and keep them beside the entity's `domain` edges, without changing how `domain` edges are read.
- **FR-002**: The entity listing behind the ERD MUST return, for each entity, its resource (id and name), or none when the entity has no `entity_resource` edge.
- **FR-003**: The ERD's filter panel MUST have a section **Resources** with one row per resource that stores at least one entity of the diagram's base, shown even when there is one such resource, and absent when there is none.
- **FR-004**: Switching a Resources row off MUST hide the tables of that resource, under the same rules as the other filter sections (spec 038): rows come from the diagram's base, a filter never adds or removes another section's rows, and 1-hop applies over the filters.
- **FR-005**: The ERD MUST have a **Boundary** switch, shown whenever the diagram has at least one resource. On, the tables of each resource are drawn inside one rounded contour whose header carries the resource's name; off, no contour is drawn.
- **FR-006**: Boundary MUST be a page setting like the use-case diagram's: kept in the page address and shared inside a room. It starts on, as the use-case diagram's does.
- **FR-007**: The Resources rows switched off and the gear shift's point MUST be page settings too, kept in the page address and broadcast inside a room like the domain and kind filters; a member who joins later gets the room's state.
- **FR-008**: The Resources section MUST take its own point on the gear shift. On it every table, and with Boundary on every contour, is painted in its resource's colour, and the section's rows show those colours; the domain and change points paint as today.
- **FR-009**: A resource's colour MUST depend on the graph alone: the server assigns it from the domain palette by the resource's place in the sorted list of all resources of the graph that store an entity, as it assigns domain colours. Every member of a room, every browser, every domain's ERD and "ERD all domains" MUST show one resource in one colour, whatever is filtered or on screen.
- **FR-010**: The Resources section and the Boundary switch MUST work the same way on a domain's ERD and on "ERD all domains".
- **FR-011**: The element card of a table MUST show `Resource: <name>` under its name when the entity has a resource, and no resource line when it has none.
- **FR-012**: The domain's own view MUST not change: the entities of a domain are listed through its `domain` edges exactly as before, and with Boundary off and every resource on, a 1.6 graph draws the same diagram as before this change.
- **FR-013**: Graphs of protocol 1.0–1.5 MUST load and draw as before.
- **FR-014**: In Diff, a table MUST be marked changed by its resource only when both versions give it a resource and the two differ; a resource present only in the newer version MUST NOT mark it.
- **FR-015**: `NodeCoreEntity` MUST declare `DuckDBGraphResource` as its resource, and `external/aoa` MUST move to the commit of aoa#474 (`537c61d4`) together with `uv.lock`, in a commit of its own.
- **FR-016**: Every new or changed endpoint MUST be an AOA action; no hand-written route.
- **FR-017**: Maxitor's graph files MUST be rebuilt, and every level this change touches MUST raise its version.
- **FR-018**: The Maxitor pages on the ERD MUST describe the Resources section, the Boundary switch and the resource on the card, and Maxitor's changelog MUST get one article about the work.

### Key Entities

- **Entity**: a stored record type; drawn as a table on the ERD; has one domain and, from 1.6, one resource.
- **Resource**: a store or service of the model; on the ERD only the resources that store an entity appear, as a filter row and as a contour.
- **Resource boundary**: the rounded contour around the tables of one resource, headed by its name; drawn while Boundary is on.

## Checks

- After each phase only that phase's tests run.
- The closing check run runs in CI on the pull request and is taken to zero.
- The browser checks (three engines) run locally on a pushed commit: the ERD changes what it draws, and the room check covers the three new settings.
- Verification is adversarial: break the code the way a new test must catch, confirm that test fails and no other test of the phase does, restore.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 1.6 graph with one domain and two resources, Boundary on draws exactly two contours, each headed by its resource and holding exactly that resource's tables; no relation line crosses a contour.
- **SC-002**: Switching off one Resources row hides exactly the tables of that resource and nothing else.
- **SC-003**: On Maxitor's own graph, Diagrams' ERD with Boundary on shows `NodeCoreEntity` in a contour headed `DuckDBGraphResource`, and its card names that resource.
- **SC-004**: In a room of two browsers, a Resources row switched off, Boundary switched, and the paint moved to Resources each reach the other browser; a third browser joining later opens with the same state.
- **SC-005**: Two browsers in one room, one on a domain's ERD and the other on "ERD all domains", paint each resource in the same colour; so does a browser that opens the page later.
- **SC-006**: A 1.5 graph draws every ERD exactly as before: no Resources section, no Boundary switch, no resource line on a card.
- **SC-007**: With Boundary off and every resource on, a 1.6 graph draws the same ERD as the same graph without its `entity_resource` edges.

## Assumptions

- The left sidebar does not change: the model of a resource is reached through the ERD that exists.
- `external/aoa` moves to `537c61d4`, the merge commit of aoa#474; no tagged AOA release contains it yet, and the submodule is fixed to a commit either way.
- A graph that breaks the one-resource rule cannot come from AOA, which refuses it before a graph exists; Maxitor adds no check of its own.

## Out of scope

- The protocol (#45).
- Any check of the one-resource rule.
- A resource row in the left sidebar, or a diagram of its own for one resource.
- Moving the game offers to one resource per database (bystrovmaxim/gameoffer#146).
