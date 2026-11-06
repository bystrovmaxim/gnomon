# Feature Specification: Protocol 2.0 — a resource names its entities, and there is no data source

**Feature Branch**: `feature/issue-66-protocol-2-0`

**Created**: 2026-11-06

**Status**: Draft

**Input**: Issue #66, "Protocol 2.0: a resource names its entities, and there is no data source" (root: bystrovmaxim/aoa#488).

## What this is

A resource is a database: one physical boundary, one connection per call. A resource names the entities it keeps; an entity names only its domain. The store several resources shared — the data source — leaves the model, and with it the protocol; the pool that connects a resource is chosen by the application and is not in the graph.

Version 2.0 of the Open Gnomon Protocol says where data lies by a link from a resource to each entity it keeps. The change is breaking, so it is a new major version. This is step 1 of the root issue; AOA writes 2.0 in bystrovmaxim/aoa#487, and Maxitor's logical and physical views follow in #67.

## Clarifications

### Session 2026-11-06

- Q: What is the schema of 2.0? → A: The schema of 1.8 without the `DataSource` node and the `resource_data_source` edge, with the edge `entity_resource` replaced by `resource_entity` of the same shape: `Aggregation`, `is_dag` `true`, no properties. Nothing else differs but `$id` and the `schema_version` const.
- Q: How does 2.0 say that a `DataSource` has no `application` edge and a resource has no `domain` edge? → A: It has no `DataSource` node, so the first is gone with it. The second is a rule across rows — an edge row does not show its source's type — so the producer keeps it, and the README's table names it.
- Q: How many resources may keep an entity? → A: From 0 to N `resource_entity` edges per entity; a resource that keeps entities has from 1 to N. An entity keeps its `domain` edge.
- Q: Which readers in this repository learn 2.0? → A: `graph-builder` (its copy, its known versions, a fixture), the graph comparison (its known versions) and Maxitor's loader.
- Q: How does Maxitor's store hold where an entity lies? → A: In one table of links from a resource to an entity, `resource_entity_edges`. A 2.0 graph fills it from `resource_entity`; a graph of 1.6–1.8 fills it from `entity_resource`, each edge reversed, so one resource per entity; a graph before 1.6 leaves it empty.
- Q: What does Maxitor's loader do with `DataSource` of 1.7–1.8? → A: It ignores the node, its `application` edge and `resource_data_source`. The store has no data source table at all: the tables `data_source` and `resource_data_source_edges` are removed, and the actions that read them answer that no resource names a data source — the same fields as before, so the client does not change. Maxitor then shows a 1.7–1.8 graph as it shows a 1.6 graph. The data-source fields and views go in #67.
- Q: Which `$id`? → A: `https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/graph/2.0.json`.

## User Scenarios & Testing

### User Story 1 - A producer writes a graph at 2.0 (Priority: P1)

AOA builds a model whose resources name their entities and writes its graph at 2.0. The published schema accepts it, and refuses a `DataSource` node or an `entity_resource` edge.

**Independent Test**: the 2.0 sample passes the schema 2.0; the same sample with a `DataSource` node, or with an `entity_resource` edge, is refused.

**Acceptance Scenarios**:

1. **Given** a graph at 2.0 whose resources reach their entities by `resource_entity`, one entity kept by two resources, **When** it is checked against `graph/2.0.json`, **Then** it passes.
2. **Given** that graph with a `DataSource` node, **When** it is checked, **Then** it is refused at that node.
3. **Given** `graph/2.0.json` and `graph/1.8.json`, **When** they are compared, **Then** they differ only in `$id`, the `schema_version` const, the two removed shapes and the renamed edge.

### User Story 2 - A reader knows what the schema checks and what the producer holds (Priority: P1)

A consumer reads the README of the protocol and learns, for 2.0, what a resource and an entity are, how `resource_entity` looks, and — in one table — which rules the schema checks (the shape of each node and edge) and which the producer holds (everything else).

**Independent Test**: the README's vocabulary is that of 2.0, its versions table has a 2.0 row, and its table of checks names each rule's checker.

### User Story 3 - The tools of this repository read 2.0 and every earlier version (Priority: P1)

`graph-builder check` accepts a graph at 2.0, and every earlier version as before; the comparison of two 2.0 graphs reports their differences.

**Independent Test**: the fixture `graph-2.0.json` passes; every earlier fixture still passes; two 2.0 documents differing by one `resource_entity` edge compare with that edge reported.

### User Story 4 - Maxitor opens a 2.0 graph and keeps opening older ones (Priority: P1)

Maxitor loads a 2.0 graph and knows which resources keep each entity; it loads a 1.8 graph and knows the same from `entity_resource`, and does not show its data sources.

**Independent Test**: a 2.0 graph and a 1.8 graph of the same model fill the same links from resource to entity; a 1.8 graph with data sources loads with none.

### Edge Cases

- An entity kept by no resource: it has no `resource_entity` edge and is drawn as an entity of no resource, as before 1.6.
- An entity kept by two resources: Maxitor's screens still show one resource per entity — the first by id — until #67.
- A resource that keeps no entity: no `resource_entity` edge; it is reached through the actions that use it.
- A graph at 1.7 or 1.8 with data sources: read without them.
- A graph before 1.6: no resource of an entity, as before.

## Requirements

### Functional Requirements

- **FR-001**: `packages/open-gnomon-protocol/graph/2.0.json` exists and equals `graph/1.8.json` without the `data_source` node shape and the `resource_data_source` edge shape, with `entity_resource` replaced by `resource_entity` of the same shape, and with its own `$id` and `schema_version` const.
- **FR-002**: The README of the protocol describes 2.0: badge, example, Version row and vocabulary say 2.0; `resource_entity` is described, with an example row; the versions table has a 2.0 row; a table states what the schema checks — the shape of each node and edge — and what the producer holds: that an edge joins existing nodes of the right types, that every entity has one `domain` edge, that a resource has no `domain` edge, that the `is_dag` edges form no cycle.
- **FR-003**: `graph-builder` holds a byte-for-byte copy of `graph/2.0.json`, knows "2.0" after every earlier version, and has a fixture `graph-2.0.json` that its schema test accepts; its refusal of an unknown version lists 2.0.
- **FR-004**: `graph_compare` knows "2.0".
- **FR-005**: Maxitor's store holds `resource_entity_edges` (resource → entity) in place of `entity_resource_edges`, filled from `resource_entity` of 2.0 and from `entity_resource` of 1.6–1.8 reversed; it holds no `data_source` and no `resource_data_source_edges`, ignores `DataSource` nodes and their edges, and its actions answer with no data source.
- **FR-006**: The constitution's data-model rules say: a resource is a database and names its entities; an entity names its domain; a relation may join entities of any resources; there is no data source and no rule of one resource per domain and data source.
- **FR-007**: Every changed level raises its version; graph files are rebuilt; documentation and changelogs.

### Key Entities

- **Resource**: a database — one physical boundary, one connection per call; it names the entities it keeps and has no domain.
- **`resource_entity`**: the edge from a resource to an entity it keeps.

## Success Criteria

- **SC-001**: The schema-copy tests, `graph-builder`'s tests, the comparison's tests and Maxitor's tests pass with 2.0 added.
- **SC-002**: Every graph that passed 1.0–1.8 passes as before, and Maxitor opens it.
- **SC-003**: A reader finds every rule of 2.0, and who checks it, in one table of the README.

## Assumptions

- AOA (bystrovmaxim/aoa#487) writes 2.0 and keeps every rule the schema cannot check; this repository adds no model check.
- AOA in `external/aoa` still writes 1.8, so the graph files of this repository stay at 1.8 here.
- Publishing Maxitor to PyPI and its release tag are outside this work; AOA may take `graph-builder` from the merge commit.
