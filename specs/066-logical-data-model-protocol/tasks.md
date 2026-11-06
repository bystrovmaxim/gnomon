# Tasks: The logical data model — protocol 1.8

One phase = one commit, referencing (#59). After a phase only its own tests run; every new test is broken once on purpose.

- [x] T001 Phase 1: `packages/open-gnomon-protocol/graph/1.8.json` (1.7 with `$id` and `schema_version` 1.8); `tests/scripts/test_schema_copies.py` — the folder holds it, its hash, the equality with 1.7 but for `$id` and version; the README — the 1.8 rules, the division of checks, the rules table, badge, example, Version row, versions table
- [x] T002 Phase 2: `graph-builder` — the copy `schemas/1.8.json`, `SCHEMA_VERSIONS`, the fixture `graph-1.8.json`, `test_schemas_1_8.py`, the refusal text in `test_cli.py`; `graph_compare` — `KNOWN_VERSIONS` and a test comparing two 1.8 documents
- [x] T003 Phase 3: versions — protocol 1.8.0, `graph-builder` 1.6.0, `maxitor` 3.22.0 and `uv.lock`
- [ ] T004 Phase 4: the closing check run on the pull request, taken to zero
- [x] T005 Phase 5: documentation — the known versions in the `graph_compare` README and the `graph-builder` pages that list them
- [ ] T006 Phase 6: changelogs — protocol `## 1.8`, Maxitor under Unreleased
