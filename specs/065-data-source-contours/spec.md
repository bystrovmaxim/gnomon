# Feature Specification: Data source contours — one name, copying names, folding, and a Data sources node

**Feature Branch**: `feature/issue-56-data-source-contours`

**Created**: 2026-11-06

**Status**: Draft

**Input**: Issue #56, "Maxitor: a data source's name once, copying contour names, folding contours, and a Data sources node in the navigation panel". Builds on spec 063 (data source contours) and spec 064 (hovering a resource contour).

## What this is

With Boundary on, the ERD draws a data source as an outer contour around its resources. This work makes that contour read well (its name once), lets the reader copy the names in it, folds a contour into one box that keeps its links, and gives data sources their own place in the navigation panel, with an ERD of each data source and of each resource.

## Clarifications

### Session 2026-11-06

- Q: Why does a data source's name repeat? → A: Each resource contour sits in an invisible spacing frame inside the data source's contour; Graphviz passes a frame's label down to the frames inside it, so the spacing frame draws the data source's name again. Every spacing frame gets an empty label.
- Q: What does a click on a contour's name copy? → A: The name as shown, like a table's name: `MessagingDataSource`, `OutboxPrimaryDatabase`.
- Q: What does the Data sources node hold? → A: One node per data source, sorted by name, then **No data source**. A data source node holds the ERD of the whole data source, then one ERD per resource of it; **No data source** holds one ERD per resource that names none. The node stands only when the graph has a data source.
- Q: What does an ERD of a data source or of a resource show? → A: The tables of every domain stored in that data source or that resource, Boundary drawn as on a domain's ERD; 1-hop adds the tables one line away, wherever they are stored.
- Q: How does a folded contour look and link? → A: One rounded box in the contour's style and colour, its name in the header, under it `12 tables · 9 relations inside` (a resource) or `3 resources · 20 tables` (a data source), and a plus in its corner. Every relation with an end inside it is drawn to the box. All relations between the same two ends become one line, wider with its count relative to the widest such line of the diagram, with a `×N` plate when N > 1 and no cardinality at its ends.
- Q: Hovering and clicking a bundled line? → A: Hovering lights it and its two ends, dims the rest, and opens a card listing its relations, one per row. A click unfolds the folded contours at its ends.
- Q: Folding a data source when some of its resources are folded? → A: The data source folds whole; each resource keeps its own state, so unfolding the data source shows them as they were.
- Q: Where does the fold state live? → A: A page setting, `folded_contours`, carried by the address as `folded` and shared by a room, as the tables switched off are. The room server accepts the ERD's resource settings — `disabled_resources`, `disabled_data_sources`, `boundary`, `folded_contours` and the paints `resources` and `data_sources` — on every ERD page.

## User Scenarios & Testing

### User Story 1 - Read a data source contour (Priority: P1)

A reader opens the Messaging ERD of the AOA demo. `MessagingDataSource` is written once, in the header of its contour.

**Independent Test**: lay out a data source of two resources; its name appears once in the drawing.

**Acceptance Scenarios**:

1. **Given** Boundary on and a data source of two resources, **Then** the data source's name appears exactly once, in its contour's header.
2. **Given** a resource with no data source, **Then** it is drawn as before.

### User Story 2 - Copy a contour's name (Priority: P2)

A reader clicks `OutboxPrimaryDatabase` in a contour's header and pastes it into a search.

**Acceptance Scenarios**:

1. **Given** a resource contour, **When** the reader clicks its name, **Then** the name is copied and the message says so.
2. **Given** a data source contour, **When** the reader clicks its name, **Then** its name is copied.
3. **Given** a drag that starts on a name, **Then** the diagram pans and nothing is copied.

### User Story 3 - Open the ERD of a data source or of a resource (Priority: P1)

A reader wants the whole data model of one database, whatever domains its tables belong to.

**Independent Test**: on the AOA demo graph, open Data sources → MessagingDataSource → its ERD; only the tables stored in its resources are drawn.

**Acceptance Scenarios**:

1. **Given** a graph with data sources, **Then** the navigation panel has a first-level node **Data sources** after Domains; a graph without one has no such node.
2. **When** the reader opens it, **Then** it lists each data source by name and then **No data source** when some resource names none.
3. **When** the reader opens a data source, **Then** it lists the ERD of the data source and one ERD per resource of it; under **No data source**, one ERD per resource that names none.
4. **When** the reader picks one, **Then** the ERD shows exactly the tables stored there, with Boundary, filters, painting, hover, Diff and rooms as on any ERD, and the address names it, so a link opens the same diagram.

### User Story 4 - Fold a contour (Priority: P1)

A reader folds the large `OutboxPrimaryDatabase` to see how the rest links to it.

**Independent Test**: fold one resource of a data source with lines to another; the folded box is drawn with one bundled line to each end it links to, the plate saying how many relations it stands for.

**Acceptance Scenarios**:

1. **Given** Boundary on, **Then** every resource contour and every data source contour shows a small minus in its top right corner, low in contrast until the pointer is on the contour.
2. **When** the reader clicks it, **Then** the contour is drawn as one box with its name, its counts and a plus; its tables and the lines between them are not drawn.
3. **Given** relations from tables inside the folded contour to tables outside, **Then** each is drawn to the box, and the relations between the same two ends are one line, its width grown with their number, a `×N` plate when N > 1.
4. **When** the reader hovers that line, **Then** it and its ends are lit, the rest dims, and a card lists its relations.
5. **When** the reader clicks that line, **Then** the folded contours at its ends unfold.
6. **When** the reader hovers the folded box, **Then** its lines and the tables or boxes at their other ends are lit, the rest dims.
7. **When** the reader clicks the plus, **Then** the contour unfolds; a folded data source keeps its resources' own fold states.
8. **Given** a room, **Then** folding is shared; **given** the address, a reload keeps it.
9. **Given** Diff, **Then** a folded box with changed tables inside shows an amber mark with their number.

### Edge Cases

- A relation with both ends inside one folded contour is not drawn; it is counted on the box.
- A table with no resource is never inside a contour and never folded.
- Boundary off: no contour, no control, nothing folded; the fold state is kept for when Boundary comes back.
- A folded resource inside a folded data source: the data source's box stands for both.
- A fold id that names no contour of the diagram is ignored.

## Requirements

### Functional Requirements

- **FR-001**: A data source's name is drawn exactly once, in its contour's header.
- **FR-002**: A click on a resource's or a data source's name in a contour's header copies the name, with the rules of a table's name (a drag pans, a refused clipboard selects the text).
- **FR-003**: The sidebar listing has a first-level node `data_sources_root` "Data sources" after Domains when the graph has a data source; under it one node per data source and `no_data_source` "No data source" when some resource names none; under each, the ERD rows described in User Story 3.
- **FR-004**: An ERD may be scoped to a data source or to a resource (`data_source=` / `resource=` in the address); it draws the tables stored there, as an ERD of all domains narrowed to them; a room names it as a page of its own.
- **FR-005**: Every resource contour and data source contour has a fold control in its top right corner; a folded contour is one box with its name, its counts and an unfold control.
- **FR-006**: Relations with an end inside a folded contour are drawn to its box; relations between the same two ends are one line whose width grows with their count relative to the diagram's widest bundle, with a `×N` plate when N > 1 and no cardinality ends.
- **FR-007**: Hovering a bundled line lights it and its ends and shows a card listing its relations; clicking it unfolds the folded contours at its ends; hovering a folded box lights its lines and their other ends.
- **FR-008**: The folded contours are the page setting `folded_contours` (address `folded`), shared by a room; the room server accepts the ERD's resource settings on ERD pages.
- **FR-009**: In Diff a folded box with changed tables shows an amber mark with their number.
- **FR-010**: A graph with no data source has no Data sources node; Boundary off draws no contour and no control.
- **FR-011**: Every changed level raises its version; documentation and changelog.

### Key Entities

- **Folded contour**: a resource or data source drawn as one box, named by its id.
- **Bundled line**: one line standing for every relation between the same two drawn ends, at least one of them a folded box.
- **Scoped ERD**: an ERD narrowed to the tables of one data source or one resource.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On the Messaging ERD of the AOA demo, `MessagingDataSource` appears once.
- **SC-002**: Folding `OutboxPrimaryDatabase` on the Messaging ERD leaves one box and one bundled line to the dead-letter store, its card listing the relation between them.
- **SC-003**: Data sources → MessagingDataSource → its ERD opens with only the tables stored in that data source.
- **SC-004**: The unit tests, the drawing checks of the fold and of the single name, and the browser checks pass.

## Assumptions

- A data source contour and a resource contour are drawn only with Boundary on (spec 061, 063).
- The scoped ERD needs no new server read: it narrows the listing of all domains on the client, as the filters do.
