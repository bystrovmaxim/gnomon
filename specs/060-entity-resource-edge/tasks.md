# Tasks: An entity belongs to a resource — protocol 1.6

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/entity-resource-edge.md](contracts/entity-resource-edge.md)

Each phase is one commit, the phases of issue #45. After a phase only its own tests run. Every new test is broken once on purpose: it fails, no other test of the phase does, the break is restored.

## Phase 1: The protocol file 1.6 (US1)

- [x] T001 [US1] Create `packages/open-gnomon-protocol/graph/1.6.json` from `graph/1.5.json`: `$id` `https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/graph/1.6.json`; `schema_version` const `"1.6"`; a new definition `$defs.entity_resource` — `allOf` of `link_row` and `type` const `entity_resource`, `relationship` const `Aggregation`, `is_dag` const `true`, `properties` an object with `additionalProperties: false`, `maxProperties: 0` — and a `{"$ref": "#/$defs/entity_resource"}` branch at the end of `$defs.link.oneOf`; nothing else differs from 1.5
- [x] T002 [US1] In `tests/scripts/test_schema_copies.py`: the protocol folder holds `graph/1.6.json`; `PUBLISHED["1.6"]` is its hash; the `$id` check expects the aoa address for 1.0–1.5 and the gnomon address from 1.6 on. a test that `graph/1.6.json` equals `graph/1.5.json` except its `$id`, its `schema_version` const, `$defs.entity_resource` and the last branch of `$defs.link.oneOf` (FR-003). Break: one character of the 1.6 `$id` → only the `$id` test fails; one extra edge type in 1.6's `empty_properties` → only the equality test fails; restore

## Phase 2: The readers of this repository know 1.6 (US2, US3)

- [x] T003 [US2] Copy `graph/1.6.json` byte for byte to `packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/1.6.json`; add it to `COPIES` in `tests/scripts/test_schema_copies.py`
- [x] T004 [US2] `SCHEMA_VERSIONS` gets `"1.6"` in `packages/maxitor/tools/graph-builder/maxitor/graph_builder/schemas/__init__.py`; the refusal text of the unknown version lists 1.6 in `packages/maxitor/tools/graph-builder/tests/test_cli.py`
- [x] T005 [US2] [US3] Fixture `packages/maxitor/tools/graph-builder/tests/fixtures/graph-1.6.json`: `graph-1.5.json` with `schema_version` `1.6` and, for each `Entity` node, one `entity_resource` edge to a `Resource` node of the fixture (`relationship` `Aggregation`, `is_dag` `true`, `properties` `{}`); every other node and edge stays as in 1.5
- [x] T006 [US2] [US3] Tests in `packages/maxitor/tools/graph-builder/tests/test_schemas.py`: the 1.6 fixture holds one `entity_resource` edge from each entity to a resource, and without those edges it is the 1.5 fixture (SC-004); the edge passes 1.6 and is refused by 1.5; with a property, with `relationship` `Composition`, with `is_dag` `false` it is refused by 1.6. each check looks only at the errors of the edge under test. Break: `relationship` const `Composition` in the protocol file → the two tests of that value fail, no other; `is_dag` and `properties` left open → the two tests of those fail, no other; restore
- [x] T007 [US2] `KNOWN_VERSIONS` gets `"1.6"` in `packages/maxitor/core/graph_compare/maxitor/graph_compare/compare.py`; a test in `packages/maxitor/core/graph_compare/tests/test_graph_compare.py` compares two 1.6 documents that differ by one `entity_resource` edge and reports it added; `packages/maxitor/core/graph_compare/README.md` names the refused versions as those outside `KNOWN_VERSIONS`. Break: drop `"1.6"` → only the new test fails; restore

## Phase 3: Versions

- [x] T008 `packages/open-gnomon-protocol/version.toml` 1.6.0; `packages/maxitor/tools/graph-builder/version.toml` 1.4.0; `packages/maxitor/pyproject.toml` 3.16.0 (and `uv.lock` if it records it)

## Phase 4: The closing check run

- [ ] T009 Push; CI's closing check run on the pull request taken to zero; the status `Local check run` set by hand on each pushed commit, describing the emulated browser check (plan, Complexity Tracking)

## Phase 5: Documentation

- [x] T010 `packages/open-gnomon-protocol/README.md`: badge and example `1.6`; the Version row links `graph/1.6.json`; "Vocabulary of version 1.6": edge types 41, `entity_resource` under Data; a paragraph — the edge goes from an entity to the resource that stores it, `Aggregation`, `is_dag` `true`, no properties; every `Entity` has exactly one, which a schema cannot check, so the exporter keeps it; the entity keeps its `domain` edge; the before-and-after example of the entity's edges; a row `1.6` in the versions table

## Phase 6: Changelog

- [x] T011 `packages/open-gnomon-protocol/CHANGELOG.md` `## 1.6 — <YYYY-MM-DD HH:MM>` (the constitution's heading; earlier entries stay as they are): one article in the form of 1.5's; `packages/maxitor/CHANGELOG.md` under Unreleased / Added: "The graph builder and the comparison read protocol 1.6 — the edge `entity_resource` from an entity to its resource"

## Dependencies

Phase 1 → Phase 2 (copies the file) → Phase 3 → Phase 4 → Phase 5 → Phase 6. Inside Phase 2, T003–T006 (graph-builder) and T007 (graph_compare) touch different files.

## Implementation strategy

US1 alone (Phase 1) already publishes what aoa#469 copies; Phase 2 makes this repository read it. The pull request opens whole after Phase 6.
