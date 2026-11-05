# Tasks: An entity belongs to a resource — Maxitor shows the model of a resource

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/list-entities-resources.md](contracts/list-entities-resources.md), [contracts/erd-page-settings.md](contracts/erd-page-settings.md), [quickstart.md](quickstart.md)

Each phase is one commit, the phases of issue #46. Phase 1 is the one exception: it is two commits, and both go in one push. After a phase only its own tests run. Every new test is broken once on purpose: it fails, no other test of the phase does, the break is restored.

Paths below are relative to `packages/maxitor/maxitor-web/` unless they start at the repository root (`external/`, `packages/`, `specs/`).

## Phase 1: AOA at `537c61d4`, Maxitor's own entity has its store, DuckDB opens a 1.6 graph (US5)

**Goal**: Maxitor runs on the AOA that writes `entity_resource`; its graph is a valid 1.6 graph, and DuckDB opens it. Maxitor's own graph is 1.6 from the second commit on, and every test that loads it into DuckDB fails on an unknown edge type until DuckDB knows `entity_resource`, so the edge table belongs here, not in Phase 2.

**Independent test**: the phase's test set (T007).

- [ ] T001 [US5] Move `external/aoa` to `537c61d4` with `./update-aoa.sh 537c61d4`; the commit holds `external/aoa` and `uv.lock` only (`AGENTS.md`)
- [ ] T002 [US5] In `maxitor/web/model/core/entities/node_entity.py`: `@entity(description=..., resource=DuckDBGraphResource)` in place of `domain=DiagramsDomain`; import `DuckDBGraphResource` from `maxitor.web.model.diagrams.resources.duckdb_graph_resource`; drop the `DiagramsDomain` import if nothing else uses it. The entity's domain stays `DiagramsDomain`, which AOA reads from the resource's `@meta` (research R1)
- [ ] T003 [US5] Fixture `tests/fixtures/resource_model.py`: a 1.6 graph builder.
  - Domain `shop.ShopDomain`.
  - Resources `shop.StorefrontDatabase` with entities `shop.Order` and `shop.OrderLine` (a relation between them) and `shop.BillingDatabase` with entity `shop.Invoice`.
  - Resource `shop.SocketChannel` with no entity.
  - Each entity has one `entity_resource` edge `<entity>|entity_resource|<resource>`, `Aggregation`, `is_dag` true, `properties` `{}`, and keeps its `domain` edge.
  - A second function returns the same graph as 1.5: no `entity_resource` edges, `schema_version` `"1.5"`.
- [ ] T004 [US5] In `maxitor/web/model/diagrams/resources/duckdb_graph_resource.py`:
  - `CREATE TABLE entity_resource_edges` with the four base columns of `domain_edges`;
  - `"entity_resource": "entity_resource_edges"` in `_fill_simple_edge_tables`;
  - the name in `_EDGE_TABLE_NAMES` and in `_graph_union_view_ddls`;
  - `"entity_resource"` in `known_edges` of `_assert_no_unknown_graph_types`;
  - the module docstring names the table.
- [ ] T005 [US5] Test `tests/test_duckdb_entity_resource_edges.py`:
  - the 1.6 fixture loads, and `entity_resource_edges` holds 3 rows `(entity, resource)`;
  - the 1.5 fixture loads with the table empty;
  - the edge appears in the union view with type `entity_resource_edges`.

  Break: drop the map entry → the 1.6 load test fails with `KeyError`, no other test does; restore.
- [ ] T006 [US5] In `tests/test_own_graph_json.py`: the graph built from the loaded code has `schema_version` `"1.6"`, and `NodeCoreEntity` has exactly one `entity_resource` edge, whose target is `DuckDBGraphResource`. Break: point the edge test at `DiagramsDomain` → only this test fails; restore
- [ ] T007 [US5] The phase's test set, and nothing beyond it: `uv run pytest packages/maxitor/maxitor-web/tests/test_own_graph_json.py packages/maxitor/maxitor-web/tests/test_duckdb_entity_resource_edges.py packages/maxitor/maxitor-web/tests/test_left_sidebar_action.py packages/maxitor/maxitor-web/tests/test_list_entities_specialization_contract.py packages/maxitor/maxitor-web/tests/test_list_entities_generalization_relations.py packages/maxitor/maxitor-web/tests/test_duckdb_specialization_type_registration.py packages/maxitor/maxitor-web/tests/test_domain_use_case_diagram_action.py packages/maxitor/maxitor-web/tests/test_api_diagram_routes.py` — the tests that build Maxitor's model or load it into DuckDB. What AOA at `537c61d4` refuses there is fixed in this phase. The move also brings bystrovmaxim/aoa#466, #468, #471 and #473 and `aoa-action-machine` 1.1.0b1 (research R1); the closing check run of Phase 6 covers the rest. The commits: T001 alone; T002–T007 as the second; both in one push.

## Phase 2: The listing names resources and their colours (Foundational for US1–US4)

**Goal**: every entity row carries its resource, and the listing carries the graph's resources with their colours.

**Independent test**: `uv run pytest packages/maxitor/maxitor-web/tests -k "list_entities"`.

- [ ] T008 In `maxitor/web/model/diagrams/actions/list_domains_action.py`: give the palette a public name used by both actions (`DOMAIN_PALETTE`, the tuple now `_LIST_DOMAINS_DISTINCT_COLORS`), without changing its values or the domain colours.
- [ ] T009 In `maxitor/web/model/diagrams/actions/list_entities_action.py`:
  - every entity row of `_slice_payload` gains `resource_id` and `resource_label` (from `entity_resource_edges` joined to the resource node; `null` "without one", data-model.md);
  - a new `@regular_aspect` (`build_resources_aspect`) reads the resources into `state["resources"]` and the summary aspect puts them in the Result (constitution, rule 43): the Result gains `resources`: "every resource of the graph that stores at least one entity, sorted by `id`", each `{id, label, color}`, with `color = DOMAIN_PALETTE[i % len(DOMAIN_PALETTE)]` by the row's place in that list. Not restricted to the domains asked for (research R4).
- [ ] T010 In `maxitor/web/model/diagrams/actions/list_entities_action_schema.py`:
  - the entity row gains `resource_id` and `resource_label`, each `{"type": ["string", "null"]}`;
  - the result gains `resources`, an array of objects with required `id`, `label`, `color` (strings, `minLength` 1) and `additionalProperties: False` (contracts/list-entities-resources.md).
- [ ] T011 Test `tests/test_list_entities_resources.py`:
  - on the 1.6 fixture, `Invoice` → `shop.BillingDatabase` / `BillingDatabase`;
  - `resources` is `[BillingDatabase, StorefrontDatabase]` in that order, and `SocketChannel` is not in it;
  - the colours are `DOMAIN_PALETTE[0]` and `[1]`;
  - asking for the domain alone and for all domains gives the same `resources` with the same colours;
  - the 1.5 fixture gives `null` fields and `[]`;
  - the answer passes the schema.

  Break: sort by label → the order test fails; build the list from the asked domains only → the "same colours" test fails; restore.
- [ ] T012 In `client/src/api/erd.ts`, types: the entity row gains `resource_id?: string | null` and `resource_label?: string | null`; the listing gains `resources: { id: string; label: string; color: string }[]`. In `client/src/lib/buildDotSource.ts`: `ErdEntity` gains `resource_id?`, `resource_label?` and `previous_resource_id?: string | null`.
- [ ] T013 In `client/src/lib/loadErdDomainsBundle.ts`: `ErdDomainsBundle` gains `resource_colors: Record<string, string>` and `resource_labels: Record<string, string>`.
  - One: from the listing's `resources`.
  - Diff (`readErdDiffBundle`): the newer listing's rows, then the older's rows the newer lacks, as `domain_qualifier_colors` does.

  Tests in a new `client/src/lib/loadErdDomainsBundle.test.ts`. Break: older colours first → the Diff colour test fails; restore.

## Phase 3: The card names the resource (US4)

**Goal**: a table's card reads `Resource: <name>`, and in Diff `Resource: <old> → <new>`.

**Independent test**: `cd packages/maxitor/maxitor-web/client && npx vitest run src/lib/erdCard`.

- [ ] T014 [US4] In `client/src/lib/erdCard.ts` `erdSubject`, a table's `detail`:
  - `Resource: <resource_label>` when `resource_id` is set;
  - `Resource: <previous label> → <resource_label>` when `previous_resource_id` is also set;
  - `""` without a resource.

  The previous label comes from the bundle's `resource_labels`, passed in by the canvas.
- [ ] T015 [US4] Tests in `client/src/lib/erdCard.test.ts`:
  - `Invoice` reads `Resource: BillingDatabase`;
  - a table without a resource has an empty detail;
  - a moved table reads both names.

  Break: always print the line → the "no resource" test fails; restore.

## Phase 4: Resources on the ERD — filter, paint, Boundary, Diff, rooms (US1, US2, US3)

**Goal**: the Resources section, painting by resource, the Boundary contours, the Diff rule, all as page settings shared in a room.

**Independent test**: `cd packages/maxitor/maxitor-web/client && npx vitest run src/lib src/components/ui/ErdFilterPanel src/components/diagrams/ErdViewer`.

### Diff (US1, US2)

- [ ] T016 [US1] In `client/src/lib/erdDiff.ts`:
  - `mergeErdSlices` gives a merged table the newer side's `resource_id`/`resource_label`, else the older side's;
  - it sets `previous_resource_id` only when both sides have a resource and they differ;
  - `markErd` marks such a table `"changed"` (like `movedTables`). A table whose older side has no resource is not marked by it (FR-014).
- [ ] T017 [US1] Tests in `client/src/lib/erdDiff.test.ts`:
  - 1.5 → 1.6 (`entity_resource` edges only added): no table changed;
  - `Invoice` moved from `BillingDatabase` to `StorefrontDatabase`: changed, with `previous_resource_id`;
  - a table only in the older side keeps its older resource.

  Break: mark on any `|entity_resource|` id in `compared.edges` → the 1.5 → 1.6 test fails alone; restore.

### Filter (US2)

- [ ] T018 [US2] New `client/src/lib/erdResourceFilter.ts`:
  - `resourcesOnDiagram(entities)`: the distinct `resource_id`s of the base, sorted by id;
  - `filterGraphByResources(data, off)`: prunes through `pruneGraphToEntities`; a table without `resource_id` is always kept.

  Tests in `client/src/lib/erdResourceFilter.test.ts`. Break: drop the "no resource is kept" guard → only its test fails; restore.
- [ ] T019 [US2] In `client/src/lib/viewUrl.ts`: `disabled_resources: { param: "off_resources", kind: "list" }`. Test in `client/src/lib/viewUrl.test.ts`: the setting round-trips through the address, and an address without it reads as every resource on.
- [ ] T020 [US2] In `client/src/components/ui/ErdFilterPanel/ErdFilterPanel.tsx`: the panel takes a `resources` section through its `sections` prop: id `resources`, title `Resources`, rows with each resource's colour disk, the full id as the row's title, `paints: true`. Tests in `ErdFilterPanel.test.tsx`:
  - the section shows with one row;
  - it is absent with none;
  - the gear shift gains its point.

### Paint (US2)

- [ ] T021 [US2] In `client/src/lib/erdPaint.ts`: `PaintSection` gains `"resources"`. In `client/src/lib/buildDotSource.ts`: `ErdPaintSource` gains `"resource"`, and a card's band takes `resource_colors[resource_id]`, grey without one. `defaultPaint` does not change. Tests in `erdPaint.test.ts` and a new `client/src/lib/buildDotSource.test.ts`.

### Boundary (US1)

- [ ] T022 [US1] In `client/src/lib/buildDotSource.ts`:
  - `ErdGraphPayload` gains `boundary?: boolean` and `resource_labels`;
  - with `boundary` on, the tables of each resource go inside `subgraph "cluster_resource_<n>"` (n by the sorted resource id), `style="rounded"`, `label` the resource's label, and the specialization clusters of those tables nest inside;
  - a table is declared in its innermost cluster only (the rule at `buildDotSource.ts:450`);
  - tables without a resource stay outside every cluster;
  - painted by `resources`, a cluster's outline and header take `resource_colors[resource_id]`; painted otherwise, they stay neutral grey;
  - with `boundary` off, the output is byte for byte what it is today.
- [ ] T023 [US1] Tests in `client/src/lib/buildDotSource.test.ts` (new in T021):
  - the shop fixture with Boundary on: two resource clusters labelled `BillingDatabase` and `StorefrontDatabase` holding exactly their tables;
  - a specialization group nested in its resource's cluster, each member declared once;
  - Boundary off equals the output without resources.

  Break: declare a member in both clusters → the nesting test fails alone; restore.

### The canvas and rooms (US1, US2, US3)

- [ ] T024 [US3] In `client/src/components/diagrams/ErdViewer/parts/ErdGraphvizCanvas/ErdGraphvizCanvas.tsx`:
  - `usePageSetting<string[]>("disabled_resources", [])` and `usePageSetting("boundary", true)` (never `useState`, so a room shares them, research R8);
  - the Resources rows come from `baseGraph`;
  - the filter applies with the other sections before 1-hop;
  - `paintSections` gains `"resources"` while the base has a resource;
  - the Boundary switch (`OneHopToggle` with label `Boundary`, as `UseCaseDiagramViewer.tsx:534`) is shown while the base has a resource;
  - `boundary` and the colours go into `buildDotSource` and into `paintKey`, so two tabs painting differently never share a Graphviz input.
- [ ] T025 [US3] Room test, new `client/src/lib/erdResourceSettings.test.tsx`, on the room harness of `client/src/lib/pageSettings.test.tsx` (a `PageSettingsProvider` with a fake `RoomSettings`):
  - a Resources row switched off, Boundary switched off and the paint moved to Resources each send a "set to" value to the room;
  - a page opened with the room's values shows them;
  - the same resource gets the same colour from the bundle of a domain's ERD and of "ERD all domains".

  The canvas reads these three settings only through the hook this test covers.

  Break: keep `disabled_resources` in `useState` → only the room test fails; restore.
- [ ] T026 [US1] [US2] Tests in `client/src/lib/buildDotSource.test.ts` and `ErdFilterPanel.test.tsx`:
  - a 1.5 graph: no Resources section, no Boundary switch, no Resources point, and the DOT equals today's;
  - "ERD all domains" (two domains, three resources): the section lists all three and Boundary draws three clusters, as on one domain's ERD.

- [ ] T027 [US1] [US2] [US3] Browser check, new `client/scripts/check-erd-resources.ts` on the shop graph (`tests/fixtures/resource_model.py` served as a local `graph-json`), with a `_client(..., browser=True)` row in `STEPS` of `scripts/check_run.py`, in Chromium, Firefox and WebKit:
  - Boundary on: two contours headed `BillingDatabase` and `StorefrontDatabase`, each holding exactly its tables, no line crossing a contour (SC-001);
  - Maxitor's own graph: Diagrams' ERD shows `NodeCoreEntity` in a contour headed `DuckDBGraphResource`, and its card reads `Resource: DuckDBGraphResource` (SC-003);
  - two tabs in one room: `BillingDatabase` switched off, Boundary off and the paint moved to Resources reach the other tab; a third tab joining later opens with the same state (SC-004);
  - one resource has one band colour in both tabs, one on a domain's ERD and one on "ERD all domains" (SC-005);
  - a 1.5 graph: no Resources section, no Boundary switch; Diff of its 1.5 and 1.6 forms marks no table changed (SC-006, FR-014).

  Break: build `resources` from the asked domains only → the colour step fails; restore.

## Phase 5: Graph files and versions

- [ ] T028 Rebuild with `graph-builder write`, as `README.md` §"Its own graph" says:
  - `graph.json`: 1.6, with the `NodeCoreEntity` → `DuckDBGraphResource` edge;
  - `packages/maxitor/tools/repo-graph-port/graph.json`: 1.6, no entities.

  `specs/059-maxitor-concept/model/graph.json` stays as it is.
- [ ] T029 Raise the versions:
  - `version.toml` 1.10.7 → 1.11.0;
  - `packages/maxitor/pyproject.toml` 3.16.0 → 3.17.0, and `uv.lock` if it records it;
  - `packages/maxitor/tools/repo-graph-port/version.toml` 1.4.3 → 1.4.4 if its graph file changed;
  - every other level version-gate names.

## Phase 6: The closing check run

- [ ] T030 Push. Take CI's closing check run on the pull request to zero. On every pushed commit, start `scripts/check_before_pr.sh` at once, alongside CI (rule 71). It covers the three engines, rooms and the three browser scenarios of quickstart.md.

## Phase 7: Documentation

- [ ] T031 [P] `README.md` §2 "ERD: Data Model From Code":
  - the Resources section, painting by resource, Boundary with the resource's name in its header;
  - one colour per resource for everyone;
  - the card's `Resource:` line;
  - Diff: a table changes by its resource only when both versions name one.
- [ ] T032 [P] `client/src/components/diagrams/ErdViewer/README.md`, `client/src/components/diagrams/ErdViewer/parts/ErdGraphvizCanvas/README.md` (the resource clusters and their nesting) and `client/src/components/ui/ErdFilterPanel/README.md` (the Resources section and its gear point).

## Phase 8: Changelog

- [ ] T033 `packages/maxitor/CHANGELOG.md` `## 3.17.0 — <YYYY-MM-DD HH:MM>` (the constitution's heading): one article about the work, covering:
  - what the reader sees: the Resources filter, the paint, the Boundary contours;
  - one colour for everyone;
  - the card;
  - a 1.6 graph opens;
  - older graphs unchanged;
  - the Diff rule.

## Dependencies

Phase 1 → Phase 2 → Phases 3 and 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8.

- Phase 1 leaves Maxitor working: AOA, its entity and DuckDB move together in one push.
- Phase 2 is foundational: the card, the filter, the paint and Boundary read `resource_id` and the colours.
- Phases 3 and 4 touch different files (`erdCard.ts` / the rest), but stay in issue order, one commit each.
- Inside Phase 4:
  - T016–T017 (Diff), T018–T020 (filter), T021 (paint) and T022–T023 (Boundary) touch different files;
  - T021 and T022 both edit `buildDotSource.ts`, so they run one after the other;
  - T024–T026 join them in the canvas;
  - T027, the browser check, comes last: it needs all of them.

## Parallel examples

- Phase 2: T008 + T012 (server palette name, client types) side by side.
- Phase 4: T018 (`erdResourceFilter.ts`), T019 (`viewUrl.ts`), T020 (`ErdFilterPanel`) and T016 (`erdDiff.ts`) side by side; then T021 → T022 in `buildDotSource.ts`; then T024.
- Phase 7: T031 and T032.

## Implementation strategy

There is no partial delivery: the pull request opens whole after Phase 8.

- Phase 1 makes a 1.6 graph open, so Maxitor's own graph and graph history keep working on the new AOA from its second commit on.
- Phase 4 is the feature the reader asked for.
- Phase 3 reads `previous_resource_id`, whose type Phase 2 declares. Its test builds the moved table by hand; Phase 4's `mergeErdSlices` fills that field on real pairs.
