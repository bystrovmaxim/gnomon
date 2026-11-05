# Feature Specification: An entity belongs to a resource — protocol 1.6

**Feature Branch**: `feature/issue-45-entity-resource-edge`

**Created**: 2026-11-05

**Status**: Draft

**Input**: Issue #45, "An entity belongs to a resource 1/2: protocol 1.6 adds the entity_resource edge".

## What this is

A graph links an entity to the rest of the model by one edge, `domain` (Entity → Domain). Nothing in the graph says where the entity is stored. Entities of one domain may live in different stores, and a reader cannot pick out the entities of one database to show its data model.

Version 1.6 of the Open Gnomon Protocol adds one edge type, `entity_resource`, from an `Entity` to the `Resource` that stores it. Every entity has exactly one. Everything 1.5 allows and requires stays as it is.

This is step 1 of 4 of one change: the protocol (this spec), then AOA writes the edge (bystrovmaxim/aoa#469), then Maxitor shows it (#46), then the game offers move to one resource per database.

## Clarifications

### Session 2026-11-05

- Q: Which address goes into the `$id` of `graph/1.6.json`? → A: The gnomon address, `https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/graph/1.6.json`; the `$id` of 1.0–1.5 stays as published.
- Q: Does `graph-builder` gain a check of its own for "exactly one `entity_resource` edge per entity"? → A: No. `graph-builder` checks the schema and nothing beyond it; whatever schema 1.6 refuses, it refuses. "Exactly one, from an Entity to a Resource" compares rows, which a schema cannot do, so it is a protocol rule in the README that the exporter keeps (AOA checks it in bystrovmaxim/aoa#469).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A graph says where each entity is stored (Priority: P1)

A framework that exports graphs (AOA first) declares the resource of every entity and writes it into the graph as an `entity_resource` edge. The published schema 1.6 accepts such a graph, so the framework can copy the schema and test its output against it.

**Why this priority**: Without the published schema nothing downstream can start: AOA's test compares its copy of the schema with the published version.

**Independent Test**: Validate a graph of version 1.6 whose every entity has one `entity_resource` edge against the published schema: it passes. Validate the same graph with the edge's properties not empty: it fails.

**Acceptance Scenarios**:

1. **Given** a graph with `"schema_version": "1.6"` whose entity `shop.SalesOrderCoreEntity` has the edge `entity_resource` to the resource `shop.StorefrontDatabase` with empty properties, **When** it is validated against `graph/1.6.json`, **Then** it passes.
2. **Given** the same graph with a property on the `entity_resource` edge, **When** it is validated, **Then** it fails, naming the edge.
3. **Given** a graph of version 1.5 that passed before, **When** it is validated against `graph/1.5.json`, **Then** it still passes: 1.5 does not change.
4. **Given** a graph of version 1.6 that carries every node and edge kind 1.5 allows, plus the new edge, **When** it is validated against 1.6, **Then** it passes: no rule of 1.5 is lost.

---

### User Story 2 - `graph-builder` checks graphs of version 1.6 against the new schema (Priority: P1)

A developer runs `graph-builder` (`write`, `check` or `validate`) on a graph of version 1.6. It checks the graph against schema 1.6, as it checks every earlier version against its own schema: whatever schema 1.6 refuses, `graph-builder` refuses. `graph-builder` checks the schema and nothing beyond it; its rules do not grow.

**Why this priority**: A graph of version 1.6 is otherwise refused as an unknown version, so no exporter can write one.

**Independent Test**: Run `graph-builder validate` on the 1.6 fixture: it reports `ok 1.6`. Put a property on its `entity_resource` edge: it is refused, naming the edge.

**Acceptance Scenarios**:

1. **Given** the test fixture `graph-1.6.json`, **When** `graph-builder validate` runs on it, **Then** it reports `ok 1.6` with the counts of nodes and edges.
2. **Given** the fixture with a property on its `entity_resource` edge, **When** `graph-builder validate` runs, **Then** it is refused with the JSON path of the edge.
3. **Given** the fixtures of 1.0–1.5, **When** `graph-builder validate` runs on each, **Then** each passes as before.

---

### User Story 3 - A reader that knows only 1.5 still finds every entity in its domain (Priority: P2)

A tool written for 1.5 reads a 1.6 graph. It ignores the new edge and still finds each entity through its `domain` edge, which 1.6 keeps.

**Why this priority**: Existing readers (Maxitor before #46) keep working while the rest of the chain moves.

**Independent Test**: In the 1.6 fixture, every entity still has its `domain` edge, and removing the `entity_resource` edges leaves a graph whose entities and domains are those of 1.5.

**Acceptance Scenarios**:

1. **Given** the 1.6 fixture, **When** its entity's edges are listed, **Then** they include both `domain` and `entity_resource`.

### Edge Cases

- An entity with no `entity_resource` edge, an entity with two, or an `entity_resource` edge whose ends are not an `Entity` and a `Resource`: a JSON Schema checks each row on its own and cannot compare rows, so schema 1.6 passes such a graph. "Exactly one, from an Entity to a Resource" is a rule of the protocol written in its README; the exporter keeps it, and AOA checks it in its own tests (bystrovmaxim/aoa#469).
- A graph of version 1.6 has no entities at all: it passes.
- An entity's resource belongs to a different domain than the entity's `domain` edge: the protocol does not check this; AOA writes the `domain` edge from the resource's domain, so it does not arise from AOA.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The protocol MUST publish version 1.6 as a new file `graph/1.6.json` whose `$id` is `https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/graph/1.6.json`, the address the file is served at; files of earlier versions MUST NOT change, their `$id` included.
- **FR-002**: Version 1.6 MUST add the edge type `entity_resource` with empty properties, `relationship` `Aggregation` and `is_dag` `true` — the values every `domain` edge carries in the graphs AOA writes today.
- **FR-003**: Version 1.6 MUST keep every node kind, edge kind and rule of 1.5, the entity's `domain` edge included.
- **FR-004**: The protocol's README MUST state the rule of 1.6 that a schema cannot check: every `Entity` node has exactly one `entity_resource` edge, and that edge runs from the `Entity` to a `Resource`; keeping it is the exporter's duty.
- **FR-005**: `graph-builder` MUST check graphs of version 1.6 against schema 1.6, as it checks each earlier version against its own schema, and keep accepting every earlier version. It checks the schema only and gains no rule of its own.
- **FR-006**: The graph comparison Maxitor's map and comparison use MUST read graphs of version 1.6, as it reads 1.0–1.5, so a 1.6 graph opens in Maxitor as its 1.5 part did before #46 draws the edge.
- **FR-007**: `graph-builder`'s tests MUST include a fixture `graph-1.6.json` with an entity, its resource and the `entity_resource` edge between them, and the fixture MUST pass.
- **FR-008**: The protocol's README MUST describe version 1.6 and the new edge, with the before-and-after example of the entity's edges.
- **FR-009**: Every level this change touches MUST raise its version, and each level's changelog MUST get one article about the work.

### Key Entities

- **Entity**: a stored record type of the model; from 1.6 it has exactly one `entity_resource` edge and keeps its `domain` edge.
- **Resource**: a store or service the model uses (a database, for one); from 1.6 it is the target of the `entity_resource` edges of the entities it stores.
- **`entity_resource` edge**: Entity → Resource, no properties; says where the entity is stored.

## Checks

- After each phase only that phase's tests run: the schema's tests after the schema, `graph-builder`'s tests after `graph-builder`.
- The closing check run runs in CI on the pull request and is taken to zero.
- **The browser check of the three engines is emulated, not run.** This change does not touch the web part of Maxitor or anything it serves; the browsers have nothing new to draw. The required status `Local check run` is set on the pushed commit by hand, with a description that says the browser check is emulated because the web part did not change, as the demo versions of spec 054 did.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `graph/1.6.json` is on `main` at its public address, and AOA's issue can copy it byte for byte.
- **SC-002**: The 1.6 fixture passes `graph-builder validate`; the same fixture with a property on its `entity_resource` edge is refused.
- **SC-003**: All 6 earlier fixtures (1.0–1.5) still pass `graph-builder validate` unchanged.
- **SC-004**: A 1.6 graph and the same graph without its `entity_resource` edges contain the same entities and the same entity–domain pairs.

## Assumptions

- `graph-builder` keeps its own copy of each schema version beside the protocol's, as it does for 1.0–1.5; the 1.6 copy equals the protocol's file.
- The domain consistency between an entity and its resource is AOA's rule (bystrovmaxim/aoa#469), not the protocol's.
- References from an entity of one resource to an entity of another are out of scope: AOA refuses them, and a separate field kind may come later.
- Maxitor reading the edge is out of scope (#46).
