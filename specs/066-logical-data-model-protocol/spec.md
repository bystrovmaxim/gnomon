# Feature Specification: The logical data model — protocol 1.8

**Feature Branch**: `feature/issue-59-protocol-1-8`

**Created**: 2026-11-06

**Status**: Draft

**Input**: Issue #59, "Logical data model 1/4: protocol 1.8 — a stored entity's resource names a data source, relations know no store".

## What this is

The data model has two axes. The logical one says what things are: domains, entities, relations. The physical one says where they live: a resource and its data source. A relation is a fact of the logical model: it promises no foreign key, no join and no shared transaction, so it may join any two entities. In exchange every stored entity gets a physical place: its resource names a data source, and a domain reaches one data source through one resource.

Version 1.8 of the Open Gnomon Protocol keeps the vocabulary of 1.7 — no new node or edge type — and changes the rules the producer keeps. This is step 1 of 4: the protocol (this spec), then AOA checks the rules (bystrovmaxim/aoa#479), then the demo follows them (bystrovmaxim/aoa#480), then the constitution and Maxitor (#60).

## Clarifications

### Session 2026-11-06

- Q: What does the schema of 1.8 check? → A: Everything a schema can check: the shape of each row on its own, exactly as 1.7. The three new rules each join several rows, so none can be a schema check. `graph/1.8.json` is `graph/1.7.json` with its `$id` and its `schema_version` const changed, and nothing else.
- Q: Who checks the rules a schema cannot? → A: The producer, without exception: AOA checks each one when it builds the model and again when it builds the graph (bystrovmaxim/aoa#479). The README states the division as a rule of the protocol and names each rule's checker in its table. `graph-builder` checks the schema and nothing beyond it.
- Q: Which readers in this repository learn 1.8? → A: `graph-builder` (its copy of the schema and its known versions) and the graph comparison (`graph_compare`, its known versions), as for 1.7, so a graph at 1.8 is checked and compared.
- Q: Which `$id`? → A: `https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/graph/1.8.json`.

## User Scenarios & Testing

### User Story 1 - A producer writes a graph at 1.8 (Priority: P1)

AOA builds a model whose relations cross data sources and whose every storing resource names a data source, and writes its graph at 1.8. The published schema accepts it, so AOA can copy the schema and test its output against it.

**Independent Test**: a 1.8 graph whose relation joins entities of two data sources passes the schema 1.8.

**Acceptance Scenarios**:

1. **Given** a graph at 1.8 with a relation between entities of resources of two data sources, **When** it is checked against `graph/1.8.json`, **Then** it passes.
2. **Given** `graph/1.8.json` and `graph/1.7.json`, **When** they are compared, **Then** they differ only in `$id` and in the `schema_version` const.

### User Story 2 - A reader knows the rules it may rely on (Priority: P1)

A consumer reads the README of the protocol and learns, for 1.8: a resource that stores an entity names exactly one data source; a domain reaches a data source through at most one resource; a relation may join entities of any resources and data sources; a data source is any store. It also learns which rules the schema checks and which the producer keeps.

**Independent Test**: the README names the three rules, the table of rules gives each its checker, and the versions table has 1.8.

### User Story 3 - The tools of this repository read 1.8 (Priority: P2)

`graph-builder check` accepts a graph at 1.8, and every earlier version as before; the comparison of two graphs at 1.8 reports their differences.

**Independent Test**: the fixture `graph-1.8.json` passes `graph-builder`'s schema test; two 1.8 documents differing by one edge compare with that edge reported.

### Edge Cases

- A resource that stores no entity (a gateway) may still have no data source, as in 1.7.
- A data source may serve resources of several domains, one resource per domain.
- A graph at 1.7 or earlier is read exactly as before.

## Requirements

### Functional Requirements

- **FR-001**: `packages/open-gnomon-protocol/graph/1.8.json` exists and equals `graph/1.7.json` except its `$id` and its `schema_version` const.
- **FR-002**: The README of the protocol says that from 1.8 a `Resource` with at least one incoming `entity_resource` edge has exactly one `resource_data_source` edge; that two `Resource` nodes with the same `domain` edge have no `resource_data_source` edges to the same `DataSource`; that relations may join entities of any resources and data sources; and that a data source is any store — a database, an external service, an in-memory store — the physical place of the entities its resources store.
- **FR-003**: The README states the division of checks: the schema checks everything that one row shows on its own; every rule that counts rows, follows an `id` or compares two rows is kept by the producer, and a consumer may rely on it. Its table of rules for 1.8 drops the rule that a relation stays inside one data source and adds the two new rules, each checked by the producer.
- **FR-004**: The README's badge, example and Version row say 1.8; its versions table has a 1.8 row.
- **FR-005**: `graph-builder` holds a byte-for-byte copy of `graph/1.8.json`, knows "1.8", and has a fixture `graph-1.8.json` that its schema test accepts; its refusal of an unknown version lists 1.8.
- **FR-006**: `graph_compare` knows "1.8".
- **FR-007**: Every changed level raises its version; documentation and changelogs.

### Key Entities

- **Rule kept by the producer**: a rule of the protocol a schema cannot check, because it joins several rows; the producer guarantees it and a consumer relies on it.

## Success Criteria

- **SC-001**: The schema-copy tests, `graph-builder`'s tests and the comparison's tests pass with 1.8 added.
- **SC-002**: Every graph that passed 1.7 and every earlier version passes as before.
- **SC-003**: A reader finds every 1.8 rule, and who checks it, in one table of the README.

## Assumptions

- AOA (bystrovmaxim/aoa#479) checks every rule a schema cannot; this repository adds no model check.
- Publishing Maxitor to PyPI and its release tag are outside this work.
