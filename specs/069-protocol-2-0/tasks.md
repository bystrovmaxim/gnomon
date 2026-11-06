# Tasks: Protocol 2.0 — a resource names its entities, and there is no data source

One phase = one commit, referencing (#66). After a phase only its own tests run; every new test is broken once on purpose.

- [ ] T001 Phase 1: `packages/open-gnomon-protocol/graph/2.0.json`; `tests/scripts/test_schema_copies.py` — the folder holds it, its hash, 2.0 equals 1.8 but for the removed and renamed shapes; the README — 2.0, `resource_entity`, the table of what the schema checks and what the producer holds
- [ ] T002 Phase 2: `graph-builder` — the copy `schemas/2.0.json`, `SCHEMA_VERSIONS`, the fixture `graph-2.0.json`, `test_schemas_2_0.py`, the refusal text in `test_cli.py`
- [ ] T003 Phase 3: `graph_compare` — `KNOWN_VERSIONS` and a test comparing two 2.0 documents
- [ ] T004 Phase 4: Maxitor's store — `resource_entity_edges` from `resource_entity` and reversed `entity_resource`; no data source tables; the actions' SQL; tests on a 1.8 and a 2.0 graph
- [ ] T005 Phase 5: the constitution — rules 13, 15, 24, 25, 26, 53, version 1.5.0
- [ ] T006 Phase 6: graph files rebuilt; versions — protocol 2.0.0, `graph-builder` 1.7.0, `maxitor-web` 1.17.0, `maxitor` 3.25.0, `uv.lock`
- [ ] T007 Phase 7: the closing check run, taken to zero
- [ ] T008 Phase 8: documentation — the protocol pages, the known versions of `graph-builder` and `graph_compare`, Maxitor's pages on the store and on old versions
- [ ] T009 Phase 9: changelogs — protocol `## 2.0`, Maxitor under Unreleased
