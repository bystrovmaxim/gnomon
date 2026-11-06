# Tasks: A resource may work through a data source — protocol 1.7

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/data-source.md](contracts/data-source.md)

Each phase is one commit, the phases of issue #51. After a phase only its own tests run. Every new test is broken once on purpose: it fails, no other test of the phase does, the break is restored.

## Phase 1: The protocol file 1.7 and its README (US1)

- [x] T001 [US1] Create `packages/open-gnomon-protocol/graph/1.7.json` from `graph/1.6.json`: `$id` `https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/graph/1.7.json`; `schema_version` const `"1.7"`; `$defs.data_source` — `allOf` of `row` and `type` const `DataSource`, `properties` an object with `additionalProperties: false`, `required: ["description"]`, `description` a string — with a branch at the end of `$defs.vertex.oneOf`; `$defs.resource_data_source` — `allOf` of `link_row` and `type` const `resource_data_source`, `relationship` const `Aggregation`, `is_dag` const `true`, `properties` empty — with a branch at the end of `$defs.link.oneOf`; nothing else differs from 1.6
- [x] T002 [US1] In `tests/scripts/test_schema_copies.py`: the protocol folder holds `graph/1.7.json`; `PUBLISHED["1.7"]` is its hash; the gnomon `$id` from 1.6 on covers 1.7; a test that `graph/1.7.json` equals `graph/1.6.json` except its `$id`, its `schema_version` const, the two new definitions and the last branch of `vertex.oneOf` and `link.oneOf` (FR-004). Break: one character of the 1.7 `$id` → only the `$id` test fails; an extra edge type in 1.7's `empty_properties` → only the equality test fails; restore
- [x] T003 [US1] `packages/open-gnomon-protocol/README.md`: badge, example and Version row `1.7`; "Vocabulary of version 1.7": node types 26 with `DataSource` under Structure, edge types 42 with `resource_data_source` under Data; a paragraph — a data source is one store several resources may share, it belongs to the application by its `application` edge and to no domain, a resource has at most one and may have none; the example rows; a table of what the schema checks and what the producer keeps (FR-005); a row `1.7` in the versions table

## Phase 2: The readers of this repository know 1.7 (US2, US3)

- [x] T004 [US2] Copy `graph/1.7.json` byte for byte to `packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.7.json`; add it to `COPIES` in `tests/scripts/test_schema_copies.py`
- [x] T005 [US2] `SCHEMA_VERSIONS` gets `"1.7"` in `packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/__init__.py`; the refusal text of the unknown version lists 1.7 in `packages/maxitor/tools/graph-builder/tests/test_cli.py`
- [x] T006 [US2] [US3] Fixture `packages/maxitor/tools/graph-builder/tests/fixtures/graph-1.7.json`: `graph-1.6.json` with `schema_version` `1.7`, one `DataSource` node with its `application` edge, and a `resource_data_source` edge from one of its two `Resource` nodes; the other keeps no data source, so the fixture without its data source rows is the 1.6 fixture
- [x] T007 [US2] [US3] Tests in `packages/maxitor/tools/graph-builder/tests/test_schemas.py`: without its data source rows the 1.7 fixture is the 1.6 fixture (SC-004); the node and the edge pass 1.7 and are refused by 1.6; refused by 1.7: a `DataSource` without `description`, with another property, with a non-string `description`; an edge with a property, with `relationship` `Composition`, with `is_dag` `false`. Each check looks only at the errors of the row under test. Break: `description` optional in the protocol file → only the missing-description test fails; `relationship` const `Composition` → only the tests of that value fail; restore
- [x] T008 [US2] `KNOWN_VERSIONS` gets `"1.7"` in `packages/maxitor/core/graph_compare/maxitor/graph_compare/compare.py`; a test in `packages/maxitor/core/graph_compare/tests/test_graph_compare.py` compares two 1.7 documents that differ by one `resource_data_source` edge and reports it added. Break: drop `"1.7"` → only the new test fails; restore

## Phase 3: Versions

- [x] T009 `packages/open-gnomon-protocol/version.toml` 1.7.0; `packages/maxitor/tools/graph-builder/version.toml` 1.5.0; `packages/maxitor/pyproject.toml` 3.18.0 (and `uv.lock` if it records it)

## Phase 4: The closing check run

- [ ] T010 Push; CI's closing check run on the pull request taken to zero; the status `Local check run` set by hand on each pushed commit, describing the emulated browser check

## Phase 5: Documentation

- [ ] T011 `packages/maxitor/core/graph_compare/README.md`: the known versions `1.0` to `1.7`

## Phase 6: Changelog

- [ ] T012 `packages/open-gnomon-protocol/CHANGELOG.md` `## 1.7 — <YYYY-MM-DD HH:MM>`: one article; `packages/maxitor/CHANGELOG.md` under Unreleased / Added: one line — the graph builder and the comparison read protocol 1.7

## Dependencies

Phase 1 → Phase 2 (copies the file) → Phase 3 → Phase 4 → Phase 5 → Phase 6.
