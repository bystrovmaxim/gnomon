# Feature Specification: The ERD's logical and physical views

**Feature Branch**: `feature/issue-67-logical-physical-views`

**Created**: 2026-11-08

**Status**: Draft

**Input**: Issue #67, "Maxitor: the ERD's logical and physical views" (root: bystrovmaxim/aoa#488, step 5).

## What this is

After bystrovmaxim/aoa#487 a resource is a database: it lists the entities that lie in it, and an entity names only its domain. One entity may lie in several databases, and two domains may share one. The model has two sides, and Maxitor's ERD shows each as a view of its own:

- the **logical view** — what the business is made of: domains, their entities, the relations between them;
- the **physical view** — where the data lies: each database, the domains whose entities it keeps, and those entities.

The data source, which the model no longer has, leaves Maxitor's screens with it. Maxitor's own code, built on AOA, follows AOA to the same model.

## Clarifications

### Session 2026-11-08

- Q: Which view opens first? → A: The logical one. An address without `model` opens it; a shared address keeps the view it was copied in.
- Q: Which address parameter names the view? → A: `model=logical|physical`. The address already uses `view` for the page (`view=domain-erd`), so the ERD's view cannot take that name.
- Q: What does the domain filter do in the physical view? → A: The same as in the logical one: an entity of a turned-off domain is not drawn, in any database. The Resources filter turns whole database frames off and exists only in the physical view.
- Q: How is a table painted in each view? → A: By its domain in the logical view, by its resource in the physical one; the copies of one entity in two databases carry their database's colour.
- Q: Which AOA does Maxitor follow? → A: AOA's main at the merge of bystrovmaxim/aoa#492 (`3f34c730`), which carries #485, #486, #487 and #492.

## User Scenarios & Testing

### User Story 1 - Read the business model without storage (Priority: P1)

An analyst opens a service's ERD and sees its domains, their entities and the relations between them, with nothing about databases.

**Why this priority**: The logical model is what most readers come for, and it must not be cluttered by where data lies.

**Independent Test**: On the AOA demo's graph, the ERD opens in the logical view; every entity sits in its domain's frame, every relation is drawn once, and no resource frame, resource colour or resource filter is shown.

**Acceptance Scenarios**:

1. **Given** an address without `view`, **When** the ERD opens, **Then** it shows the logical view and the switch reads `Logical` selected.
2. **Given** the logical view, **When** the reader turns a domain off in the filter, **Then** its entities and their relations leave the drawing.
3. **Given** the logical view, **Then** tables are painted by domain, and the switch's counter shows the number of domains drawn.

---

### User Story 2 - See where the data lies (Priority: P1)

An architect switches the ERD to the physical view and sees each database as a frame, the domains whose entities it keeps nested inside it, and those entities in them; an entity kept in two databases appears in both.

**Why this priority**: This is the view the model change exists for: one database shared by domains, one entity kept in several databases.

**Independent Test**: On the AOA demo's graph, the physical view draws one frame per resource of the model — `ShopDatabaseStorage` holding the Store, Support and Inventory domains, and every resource that lists no entity as an empty frame with its name.

**Acceptance Scenarios**:

1. **Given** the physical view, **Then** each resource of the model has a frame named by it, empty when it lists no entity, and inside it a frame for each domain of its entities, holding those entities.
2. **Given** an entity listed by N resources, **Then** it is drawn once in each, marked `×N`, and its copies are joined by a dashed "same entity" line; hovering one copy highlights all of them.
3. **Given** a relation between two entities, **Then** a line is drawn between every pair of their copies; a line whose ends lie in two different databases is dashed, because no join is possible there and an action glues the data.
4. **Given** entities that no resource lists, **Then** they are gathered in a "Not stored" zone.
5. **Given** the physical view, **Then** tables are painted by resource, the Resources filter turns database frames off, a resource frame collapses into a box with `×N` lines, and hovering a frame highlights its links to other frames.
6. **Given** the switch, **When** the reader changes the view, **Then** the address carries `model=logical` or `model=physical`, and the counter shows domains or resources drawn.

---

### User Story 3 - A table's card says where it lies (Priority: P2)

A reader hovers or selects a table and its card says its domain and every resource that keeps it.

**Independent Test**: The card of an entity kept by two resources reads `Domain: …` and `Resources: A, B`; the card of an entity kept by none reads "Not stored".

**Acceptance Scenarios**:

1. **Given** an entity listed by `ShopDatabaseStorage` only, **Then** its card reads `Resources: ShopDatabaseStorage`.
2. **Given** an entity no resource lists, **Then** its card reads "Not stored".
3. **Given** any card, **Then** no line names a data source.

---

### User Story 4 - The data source is gone from every screen (Priority: P2)

A reader of a graph at any version sees no data source anywhere in Maxitor.

**Independent Test**: Neither the left panel, the ERD's filter and paint, the table cards, the address nor the full graph's legend names a data source; the Boundary switch is gone.

**Acceptance Scenarios**:

1. **Given** the left panel, **Then** it has no Data sources block and no "No data source" row.
2. **Given** an old address with `boundary`, `off_data_sources` or `data_source=`, **When** it is opened, **Then** these parameters are ignored and the page opens as if they were absent.
3. **Given** the full graph of a 1.7 or 1.8 graph, **Then** no `DataSource` node is drawn and its icon and colour are not offered.

---

### User Story 5 - Comparing versions and rooms understand the new storage (Priority: P2)

A reviewer compares two versions of a graph; a presenter shows the ERD in a room.

**Independent Test**: Two versions where an entity moved from one resource to another, or gained a second one, report that entity as changed in storage; a follower in a room sees the presenter's view and turned-off resources.

**Acceptance Scenarios**:

1. **Given** two versions in which an entity's set of resources differs, **When** they are compared, **Then** the entity is reported as changed in storage.
2. **Given** a room, **When** the presenter switches the view or turns a resource off, **Then** each follower's ERD follows; the room server relays these fields and drops `boundary`.

---

### User Story 6 - Old graphs keep opening (Priority: P3)

A reader opens a graph written at 1.0–1.8.

**Acceptance Scenarios**:

1. **Given** a graph at 1.6–1.8, **Then** the physical view shows one resource per entity, read as bystrovmaxim/gnomon#66 reads it, and no data source.
2. **Given** a graph before 1.6, **Then** the switch's Physical half is disabled, saying the graph names no resources, and the logical view is shown.

---

### User Story 7 - Maxitor's own code follows AOA (Priority: P1)

Maxitor is built on AOA, taken as the submodule `external/aoa`. Its own model must be valid under the AOA it is built with.

**Independent Test**: With `external/aoa` at `3f34c730`, every package of this repository passes its tests, Maxitor's own graph files are written at protocol 2.0, and `graph-builder check` is green.

**Acceptance Scenarios**:

1. **Given** Maxitor's graph store, **Then** it is a storage that lists the entities it answers with, and no data source of Maxitor remains.
2. **Given** Maxitor's resources, **Then** each ends with its kind, and no `ExternalServiceResource`, `ParamsStub` or `ResultStub` is used.
3. **Given** the concept model of spec 059, **Then** it builds on the new AOA: its entities already name their domains, and it has no store to list them.

### Edge Cases

- A resource that lists no entity: an empty frame with its name in the physical view; nothing in the logical one.
- An entity whose domain is turned off: drawn in no database frame.
- A relation whose one end is filtered out: not drawn, in either view.
- A resource turned off whose entity is also kept by a resource turned on: the copy in the turned-on frame stays, its `×N` still counts every resource that keeps it.
- Collapsing a resource frame: its copies fold into the box; lines to copies elsewhere become `×N` lines.
- Side by side and Diff: both halves show the same view; an entity is matched across halves by its id, a copy by its resource and its id.
- A graph before 1.6 opened with `model=physical`: opens in the logical view, the Physical half disabled.

## Requirements

### Functional Requirements

- **FR-001**: The ERD has a capsule switch `Logical · Physical`, styled like the events page's switch; its counter shows the domains drawn in the logical view and the resources drawn in the physical one; the address carries `model=logical|physical`, logical when absent.
- **FR-002**: The logical view draws a frame per domain holding its entities, and the relations between entities; no resource appears; filter and paint are by domain.
- **FR-003**: The physical view draws a frame per resource of the model, an empty one too, holding a frame per domain of its entities, holding those entities; entities that no resource lists are gathered in a "Not stored" zone.
- **FR-004**: An entity listed by N resources is drawn once in each, marked `×N`; its copies are joined by a dashed "same entity" line; hovering one copy highlights every copy.
- **FR-005**: A relation is drawn between every pair of copies of its two ends; a line between copies in two different resources is dashed.
- **FR-006**: The physical view keeps the Resources filter, the paint by resource, the collapse of a resource frame into a box with `×N` lines, and the highlight on hovering a frame.
- **FR-007**: The Boundary switch, the left panel's Data sources block and its "No data source" row, the filter's Data sources section, the paint by data source, the data source contour, the card's data source line, the address parameters `boundary`, `off_data_sources` and `data_source=`, and the `DataSource` node's icon and colour in the full graph are removed; old addresses carrying them still open.
- **FR-008**: A table's card reads `Domain: …` and `Resources: A, B`, or "Not stored".
- **FR-009**: `list-entities` answers every resource that keeps an entity, as a list, and the graph's resources with their colours; it answers no data source field.
- **FR-010**: Comparing two versions reports an entity as changed in storage when its set of resources differs.
- **FR-011**: A room shares the view and the turned-off resources; the room server accepts these fields and no longer relays `boundary`.
- **FR-012**: Graphs at 1.6–1.8 are shown through the reading of #66 — one resource per entity, no data source; before 1.6 the physical view is unavailable and the switch says why.
- **FR-013**: `external/aoa` is at AOA's `3f34c730`; Maxitor's graph store lists its entities, its data sources and every use of `ExternalServiceResource` are removed, its resources and wrappers are named by their kind, `StubParams` and `StubResult` replace the old stubs, and the concept model of spec 059 builds on the new AOA.
- **FR-014**: Maxitor's own graph files are rebuilt at protocol 2.0; every changed level raises its version; documentation and changelog.

### Key Entities

- **View**: logical or physical; part of the ERD's address and of a room's shared state.
- **Copy of an entity**: the drawing of one entity inside one resource's frame; an entity has as many copies as resources that list it, and one in "Not stored" when none does.
- **Resource frame**: the frame of one database in the physical view, empty or holding domain frames.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On the AOA demo's graph the physical view shows all 28 resources of the model, `ShopDatabaseStorage` holding three domain frames, and the 9 resources that list no entity — eight gateways and the billing read replica — as empty frames.
- **SC-002**: A reader switches between the views with one click, and the address restores the chosen view on reload and in a shared link.
- **SC-003**: No screen of Maxitor names a data source, for a graph of any version.
- **SC-004**: Every package's tests, the ERD's drawing checks of both views and the browser checks pass; `graph-builder check` is green on Maxitor's own graph files at 2.0.

## Assumptions

- AOA's graph at 2.0 and the reading of #66 are the only sources of where an entity lies; Maxitor computes nothing about storage of its own.
- The ERD's existing drawing machinery — frames, collapse, hover highlight, Diff, Side by side, rooms — is reused; only what each view puts in it differs.
- The stand is deployed after this issue, on the maintainer's word; publishing Maxitor is outside this work.
