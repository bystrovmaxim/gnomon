# Tasks: The ERD's logical and physical views

One phase = one commit, referencing (#67). After a phase only its own tests run; every new test is broken once on purpose. Nothing is committed, pushed or merged without the maintainer's instruction.

- [x] T001 [US7] Phase 1: `external/aoa` at `3f34c730` with `uv.lock` (a commit of its own, by `./update-aoa.sh`); then Maxitor's code — `DuckDBGraphStorage` with `@entities`, no data source of Maxitor, no `ExternalServiceResource`, every resource and wrapper of `maxitor-web` and `repo-graph-port` named by its kind, `StubParams`/`StubResult`, `get_wrapper_class` a class method, no domain on a resource's `@meta`; every package's tests on the new AOA, the concept model of spec 059 builds on it
- [x] T002 [US3] Phase 2: `list-entities` — `resource_ids` per entity, `resources` of the whole graph with colours, `storage_known`, no data source field; its schema; the client's model and the card (`Domain`, `Resources`, "Not stored"); pytest and Vitest
- [x] T003 [US1] Phase 3: `model=logical|physical` in the address; the capsule switch with its counter; `buildDotSource` for the logical view (a cluster per domain, paint and filter by domain); Vitest; the drawing check `check-erd-logical-view.ts`, a row of the check run
- [x] T004 [US2] Phase 4: the physical view — copies `<entity>␟<resource>`, resource frames (empty ones too) holding domain frames, "Not stored", `×N` and the dashed "same entity" lines with hover, a relation per pair of copies dashed across databases, the Resources filter, the paint by resource, the fold and the contour hover kept; every post-pass, card and focus lookup through `copyEntity`; Vitest; the drawing check `check-erd-physical-view.ts` on the demo's graph shape
- [x] T005 [US4] Phase 5: remove the data source screens — the Boundary switch, the left panel's block (server and client), the filter section, the paint, the contour, the address parameters, the full graph's `DataSource` icon and colour; tests that named them
- [x] T006 [US5, US6] Phase 6: Diff by the set of resources, Side by side by copy; the room's `model` and turned-off resources, the room server's whitelist; graphs before 1.6 without the physical view; Vitest and pytest
- [x] T007 Phase 7: rebuild Maxitor's graph files at 2.0; raise the version of every changed level; `uv.lock`
- [ ] T008 Phase 8: the closing check run, taken to zero, the browser checks included
- [ ] T009 Phase 9: documentation — the ERD's two views, the card, the removed data source screens, Maxitor on the new AOA
- [ ] T010 Phase 10: one changelog article, written last

## Traceability

| Requirement | Tasks |
|---|---|
| FR-001, FR-002 | T003 |
| FR-003–FR-006 | T004 |
| FR-007 | T005 |
| FR-008, FR-009 | T002 |
| FR-010, FR-011, FR-012 | T006 |
| FR-013 | T001 |
| FR-014 | T007, T009, T010 |
| SC-001 | T004 |
| SC-002 | T003 |
| SC-003 | T005 |
| SC-004 | T008 |

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010.
