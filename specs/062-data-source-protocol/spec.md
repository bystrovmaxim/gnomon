# Feature Specification: A resource may work through a data source — protocol 1.7

**Feature Branch**: `feature/issue-51-data-source-protocol`

**Created**: 2026-11-06

**Status**: Draft

**Input**: Issue #51, "Data source 1/4: protocol 1.7 adds the DataSource node and the resource_data_source edge".

## What this is

A graph says which resource stores each entity (`entity_resource`, 1.6) and which domain each resource belongs to. It does not say which resources work with the same database. Several resources often share one database, and joins between their tables are ordinary, but no reader of the graph can see that.

Version 1.7 of the Open Gnomon Protocol adds one node type, `DataSource` — one database or other store that several resources may share — and one edge type, `resource_data_source`, from a `Resource` to its `DataSource`. A data source belongs to no domain; like a domain and a role, it belongs to the application through the `application` edge that 1.0 already has. A data source is optional: a resource may have none. Everything 1.6 allows and requires stays as it is.

This is step 1 of 4 of one change: the protocol (this spec), then AOA writes the node and the edge and checks every rule (bystrovmaxim/aoa#475), then the demo gets three databases (bystrovmaxim/aoa#476), then Maxitor shows them (#52).

## Clarifications

### Session 2026-11-06

- Q: Is a data source required on every resource? → A: No. A resource of any kind (a storage, a gateway, a controller) has at most one; a resource without one works on its own, as in 1.6.
- Q: Where does a `DataSource` node hang in the graph? → A: On the `Application` node, by the `application` edge, as a `Domain` and a `Role` do. It has no `domain` edge.
- Q: What does a `DataSource` node carry? → A: Its `description`, as a `Resource` does; nothing else.
- Q: Which rules does the schema check? → A: Only what a schema can: the shape of the node and of the edge, each row on its own. Every rule that counts rows, follows an `id` or compares two rows is AOA's, checked without exception (bystrovmaxim/aoa#475); the README names each one as a rule the producer keeps. `graph-builder` checks the schema and nothing beyond it.
- Q: Which `$id`? → A: `https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/graph/1.7.json`, the address the file is served at.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A graph says which resources share a store (Priority: P1)

A framework that exports graphs (AOA first) declares a data source on the resources that share a store and writes it into the graph: a `DataSource` node with its `application` edge, and a `resource_data_source` edge from each of those resources. The published schema 1.7 accepts such a graph, so the framework can copy the schema and test its output against it.

**Why this priority**: Without the published schema nothing downstream can start: AOA's test compares its copy of the schema with the published version.

**Independent Test**: Validate a 1.7 graph with one data source, two resources pointing at it and one resource without one: it passes. Change the data source's properties or the edge's shape: it fails.

**Acceptance Scenarios**:

1. **Given** a graph with `"schema_version": "1.7"`, a `DataSource` node `shop.ShopDataSource` with a description, its `application` edge, and `resource_data_source` edges from `shop.OrdersResource` and `shop.SupportResource` with empty properties, **When** it is validated against `graph/1.7.json`, **Then** it passes.
2. **Given** the same graph with a `DataSource` node without a description, or with a property other than `description`, **When** it is validated, **Then** it fails, naming the node.
3. **Given** the same graph with a property on a `resource_data_source` edge, a `relationship` other than `Aggregation`, or `is_dag` `false`, **When** it is validated, **Then** it fails, naming the edge.
4. **Given** a graph of version 1.6 that passed before, **When** it is validated against `graph/1.6.json`, **Then** it still passes, and a `DataSource` node or a `resource_data_source` edge in a graph declaring 1.6 is refused.
5. **Given** a graph of version 1.7 that carries every node and edge kind 1.6 allows and no data source at all, **When** it is validated against 1.7, **Then** it passes: no rule of 1.6 is lost, and a data source is optional.

---

### User Story 2 - `graph-builder` and the comparison read graphs of version 1.7 (Priority: P1)

A developer runs `graph-builder` (`write`, `check` or `validate`) on a graph of version 1.7. It checks the graph against schema 1.7, as it checks every earlier version against its own schema: whatever schema 1.7 refuses, `graph-builder` refuses, and nothing more. Maxitor's comparison reads 1.7 documents as it reads 1.0–1.6.

**Why this priority**: A graph of version 1.7 is otherwise refused as an unknown version, so no exporter can write one.

**Independent Test**: Run `graph-builder validate` on the 1.7 fixture: it reports `ok 1.7`. Put a property on its `resource_data_source` edge: it is refused, naming the edge.

**Acceptance Scenarios**:

1. **Given** the test fixture `graph-1.7.json`, **When** `graph-builder validate` runs on it, **Then** it reports `ok 1.7` with the counts of nodes and edges.
2. **Given** the fixture with a property on a `resource_data_source` edge, **When** `graph-builder validate` runs, **Then** it is refused with the JSON path of the edge.
3. **Given** the fixtures of 1.0–1.6, **When** `graph-builder validate` runs on each, **Then** each passes as before.
4. **Given** two 1.7 documents that differ by one `resource_data_source` edge, **When** they are compared, **Then** the edge is reported added.

---

### User Story 3 - A reader that knows only 1.6 still reads everything it knew (Priority: P2)

A tool written for 1.6 reads the 1.6 part of a 1.7 graph: every entity keeps its `domain` and `entity_resource` edges, every resource its `domain` edge.

**Why this priority**: The data source adds to the model; it takes nothing away from what a 1.6 reader finds.

**Independent Test**: Remove the `DataSource` nodes and the edges that touch them from the 1.7 fixture: what is left is the 1.6 fixture.

**Acceptance Scenarios**:

1. **Given** the 1.7 fixture, **When** its `DataSource` nodes, their `application` edges and the `resource_data_source` edges are removed, **Then** the nodes and edges left are those of the 1.6 fixture.

### Edge Cases

- A resource with two `resource_data_source` edges, an edge whose ends are not a `Resource` and a `DataSource`, a `DataSource` with no `application` edge or with two, a `DataSource` no resource points at: a JSON Schema checks each row on its own and cannot count rows or follow an `id`, so schema 1.7 passes such a graph. Each of these is a rule of the protocol written in its README; the producer keeps it, and AOA checks every one of them (bystrovmaxim/aoa#475).
- Relations between entities whose resources have different data sources, or whose resources have none and differ: a rule of the model, not of the shape; AOA refuses them, the schema cannot see them.
- A graph of version 1.7 has no data source at all: it passes.
- Maxitor's web part loads only the node and edge types it knows and refuses others; it learns `DataSource` and `resource_data_source` in #52. Until then a 1.7 graph that has a data source does not open in the web part, while `graph-builder` and the comparison read it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The protocol MUST publish version 1.7 as a new file `graph/1.7.json` whose `$id` is `https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/graph/1.7.json`; files of earlier versions MUST NOT change.
- **FR-002**: Version 1.7 MUST add the node type `DataSource`, whose `properties` hold exactly a required string `description`.
- **FR-003**: Version 1.7 MUST add the edge type `resource_data_source` with empty properties, `relationship` `Aggregation` and `is_dag` `true`.
- **FR-004**: Version 1.7 MUST keep every node kind, edge kind and rule of 1.6. The `application` edge needs no new definition: its shape does not depend on its source.
- **FR-005**: The protocol's README MUST state each rule of 1.7 that a schema cannot check — a resource has at most one `resource_data_source` edge, from a `Resource` to a `DataSource`; a `DataSource` has exactly one `application` edge, to the `Application` node, and at least one resource — as the producer's duty, and MUST say that the schema checks each row on its own and the producer (AOA) checks every rule.
- **FR-006**: `graph-builder` MUST check graphs of version 1.7 against schema 1.7, as it checks each earlier version against its own schema, and keep accepting every earlier version. It gains no rule of its own.
- **FR-007**: The graph comparison Maxitor's map and comparison use MUST read graphs of version 1.7, as it reads 1.0–1.6.
- **FR-008**: `graph-builder`'s tests MUST include a fixture `graph-1.7.json` with a data source, its `application` edge, two resources pointing at it and one resource without one, and the fixture MUST pass; each shape rule of FR-002 and FR-003 MUST have a test with a row the schema refuses.
- **FR-009**: The protocol's README MUST describe version 1.7, the node and the edge, with an example of the rows.
- **FR-010**: Every level this change touches MUST raise its version, and each level's changelog MUST get one article about the work.

### Key Entities

- **DataSource**: one database or other store that several resources may share; carries its description; belongs to the application, to no domain.
- **Resource**: from 1.7 it may point at one data source by a `resource_data_source` edge.
- **`resource_data_source` edge**: Resource → DataSource, no properties; says which store the resource shares.

## Checks

- After each phase only that phase's tests run: the schema's tests after the schema, `graph-builder`'s and the comparison's tests after the readers.
- The closing check run runs in CI on the pull request and is taken to zero.
- **The browser check of the three engines is emulated, not run**, as in spec 060: this change does not touch the web part of Maxitor or anything it serves. The required status `Local check run` is set on each pushed commit by hand, with a description naming the emulation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `graph/1.7.json` is on `main` at its public address, and AOA's issue can copy it byte for byte.
- **SC-002**: The 1.7 fixture passes `graph-builder validate`; each refused shape of FR-008 is refused, naming its row.
- **SC-003**: All 7 earlier fixtures (1.0–1.6) still pass `graph-builder validate` unchanged.
- **SC-004**: The 1.7 fixture without its data source rows is the 1.6 fixture.

## Assumptions

- `graph-builder` keeps its own copy of each schema version beside the protocol's; the 1.7 copy equals the protocol's file.
- Every model rule — at most one data source per resource, the ends of the edge, the `application` edge of a data source, the boundary of relations — is AOA's (bystrovmaxim/aoa#475).
- Maxitor's web part reading the node and the edge is out of scope (#52).
