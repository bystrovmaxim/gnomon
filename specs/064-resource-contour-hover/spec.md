# Feature Specification: Hovering a resource contour lights up its links to other resources

**Feature Branch**: `feature/issue-55-resource-contour-hover`

**Created**: 2026-11-06

**Status**: Draft

**Input**: Issue #55, "Maxitor ERD: hovering a resource contour lights up its links to other resources". After #52 relations between resources of one data source exist, and their lines cross resource contours (spec 063).

## What this is

With Boundary on, the ERD draws each resource in its own contour. A relation between two resources of one data source is a line that leaves one contour and enters another. On a large diagram these lines are lost among the lines inside each resource. Hovering a resource contour picks them out: the lines that leave this resource, and the tables at both their ends, stay lit; everything else dims.

## Clarifications

### Session 2026-11-06

- Q: What part of a contour takes the hover? → A: Its border line and its name in the header. The empty space inside does not, so a table or a line inside the contour is hovered as before.
- Q: Which contours react? → A: Resource contours only. A data source contour does not: no relation line leaves it.
- Q: A resource with no line to another resource? → A: Its contour takes the hovered look and every table and line dims, so the reader sees at once that it has no link outside.
- Q: Does the contour get a card or a click? → A: No. Its hover label names the resource's full id, as a Resources row does.

## User Scenarios & Testing

### User Story 1 - See what a resource links to (Priority: P1)

A reader looks at the ERD of a service with several resources on one database and wants to know which tables of `OrdersResource` are referenced from other resources, and which tables of other resources it points at.

**Independent Test**: on the AOA demo graph, with Boundary on, hover the border of a resource that shares its data source with another; its cross-resource lines and the tables at their ends are lit, every other table dims.

**Acceptance Scenarios**:

1. **Given** Boundary on and a resource with lines to another resource, **When** the reader hovers its contour's border or name, **Then** each such line takes the hovered look of a line (thicker, darker, end labels shown), the rows of its fields are marked in both tables, the tables at both ends stay bright, the contour's border grows thicker, and every other table and line dims.
2. **Given** the same, **When** the pointer leaves the contour, **Then** the diagram is exactly as drawn before the hover.
3. **Given** a resource with no line to another resource, **When** the reader hovers its contour, **Then** its border grows thicker and every table and line dims.
4. **Given** the pointer on a table or a line inside the contour, **Then** that table or line is hovered as before, not the contour.

### User Story 2 - The same hover in a room (Priority: P2)

A presenter in a room hovers a resource contour; a follower sees the same lines and tables lit.

**Independent Test**: a follower's drawing receives the followed person's contour hover and replays it on the same contour; the room server relays a focus that names a contour.

**Acceptance Scenarios**:

1. **Given** a follower in a room, **When** the followed person hovers a resource contour, **Then** the follower's diagram lights the same lines and tables and shows the same hover label.
2. **Given** Side by side, **When** a contour of one half is hovered, **Then** the contour of the same resource in the other half is lit the same way, when it has one.

### Edge Cases

- In Diff a line painted by its change keeps its colour while lit, as on a line hover today.
- A line whose other end is hidden (its resource switched off, or outside 1-hop) is not drawn and is not lit.
- Boundary off, or a graph with no resources (1.0–1.5): there are no contours; nothing changes.
- A specialization never has a line drawn, so it is never lit.

## Requirements

### Functional Requirements

- **FR-001**: A cross-resource line of resource R is a drawn relation line with one end on a table of R and the other end on a table of another resource.
- **FR-002**: Hovering the border or the header name of a resource contour gives every cross-resource line of that resource the hovered look of a line and marks the rows of its fields in both tables; the tables at both ends stay bright; the contour's border grows thicker; every other table and line dims.
- **FR-003**: A resource with no cross-resource line: hovering its contour thickens its border and dims every table and line.
- **FR-004**: Leaving the contour restores the drawing exactly; a table Diff fades stays faded; a line painted by its change keeps its colour throughout.
- **FR-005**: Only resource contours react; data source contours, the empty space inside a contour, and the invisible spacing round contours do not.
- **FR-006**: The contour's hover label is the resource's full id.
- **FR-007**: The contour hover is shared in a room and passes between the halves of Side by side, by the resource's id, as a table, a row or a line hover is; the room server accepts a contour as a focus element.
- **FR-008**: Boundary off, or a graph with no resource: the ERD behaves as before.
- **FR-009**: Every changed level raises its version; documentation and changelog.

### Key Entities

- **Resource contour**: the rounded frame Boundary draws round the tables of one resource, named by the resource.
- **Cross-resource line**: a relation line between tables of two different resources (FR-001).

## Success Criteria

### Measurable Outcomes

- **SC-001**: On the AOA demo graph a reader finds every link between two resources with one hover, without following any line by eye.
- **SC-002**: The unit tests of the post-pass and of the room focus pass; the drawing check lays out a shop of two data sources through the client's Graphviz build and proves the hover on the SVG it gives; on the AOA demo graph, hovering the dead-letter store's contour in the Messaging ERD lights its one line to the outbox and the two tables at its ends.
- **SC-003**: With Boundary off, every existing ERD browser check passes unchanged.

## Assumptions

- AOA keeps every relation inside one data source (#52), so a cross-resource line never leaves a data source contour; the feature does not rely on it.
- The hovered look of a line and the dimming are the ones the ERD already uses for a line hover (spec 029).
