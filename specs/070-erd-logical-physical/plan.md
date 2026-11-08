# Implementation Plan: The ERD's logical and physical views

**Branch**: `feature/issue-67-logical-physical-views` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

`web` = `packages/maxitor/maxitor-web`, `client` = `web/client/src`.

## Summary

Maxitor follows AOA to the model where a resource is a database (phase 1), then its ERD shows the model twice: a logical view of domains and a physical view of databases, where an entity kept in several databases has a copy in each. The data source leaves every screen.

## Technical Context

**Language/Version**: Python 3.12 / 3.14 (server, tools), TypeScript (client, React + Vite)
**Primary Dependencies**: AOA at `external/aoa` `3f34c730`; Graphviz WASM; DuckDB
**Testing**: pytest per package, Vitest, the ERD drawing checks (`client/scripts/check-erd-*.ts`), the browser checks of `scripts/check_before_pr.sh`
**Constraints**: every endpoint through an AOA action, every store through a resource (constitution); Maxitor assumes no language of the graph's producer

## Constitution Check

- No new endpoint: `list-entities` changes its answer; the room server changes a whitelist of an existing action.
- Maxitor's own model follows AOA's rules after the move: its store lists its entities, every resource ends with its kind.
- Rule 26 of the constitution still names `PostgresResource` and a wrapper for every nested call; the maintainer holds that text. This work names nothing that contradicts AOA; the amendment is the maintainer's.

## Design

### Phase 1 — Maxitor on AOA `3f34c730`

- `DuckDBGraphResource` → `DuckDBGraphStorage(BaseStorage)` with `@entities(...)` listing every entity class its public methods return; its `@meta` loses its domain; `GraphDataSource` and the other data sources of Maxitor are deleted, with their type arguments.
- `duckdb_graph_resource.py` stops using `ExternalServiceResource`; every resource of `maxitor-web` and `repo-graph-port` ends with its kind; wrappers end with `…Wrapper`; `ParamsStub`/`ResultStub` → `StubParams`/`StubResult`.
- The concept model of spec 059: `@entity(description, domain=…)` on every entity, `@entities` on its store.
- The return check runs on every public method of a resource: a method that returns rows, not entities, passes at one type check; one that returns an entity it does not list is a defect to fix in the resource, not a reason to list more.

### Phase 2 — `list-entities` and the card

- An entity row carries `resource_ids: string[]` (sorted; empty when no resource lists it) in place of `resource_id`/`resource_label`.
- The answer's `resources` lists **every** resource of the graph — not only those that keep an entity — each with `id`, `label` and `color` (palette by its place in the sorted list of all resources); `data_sources` and every `data_source_*` field leave.
- The answer carries `storage_known: bool` — the graph is at 1.6 or later, so it says where entities lie.
- The card (`client/lib/erdCard.ts`): `Domain: …` and `Resources: A, B`, or "Not stored"; no data source line.

### Phase 3 — the switch and the logical view

- `client/lib/urlState.ts`: `model=logical|physical`, logical when absent or unknown; `boundary`, `off_data_sources`, `data_source=` are read as absent.
- A capsule switch `Logical · Physical` in the ERD's toolbar, built like the events page's switch, its counter the domains or resources drawn; the Physical half is disabled with a tooltip when `storage_known` is false.
- `buildDotSource` takes `model`. Logical: one cluster per domain (the domain's colour on its outline and name), entities in it, specialization containers inside their domain's cluster; no resource anywhere; paint and filter by domain.

### Phase 4 — the physical view

- **Copies.** A node per (entity, resource) pair; its DOT id is `<entity id>␟<resource id>` (`␟`, U+241F, appears in no qualname); an entity no resource lists has one copy in the "Not stored" cluster, `<entity id>␟`. `copyEntity(id)` and `copyResource(id)` split it; every post-pass lookup, card, hover, Diff mark and room focus that now reads a node's `<title>` as an entity id reads it through `copyEntity`.
- **Frames.** `cluster_resource_<i>` per resource of `resources` (an empty one holds an invisible point so Graphviz draws it), inside it `cluster_resource_<i>_domain_<j>` per domain of its copies; "Not stored" is the last cluster. Resource frames keep `id="rc:<resource>"` (spec 064) so hover and rooms keep working.
- **×N.** A copy of an entity listed by N > 1 resources carries `×N` in its header; the copies are joined by `constraint=false style=dashed` "same entity" edges with ids `se<k>`; the post-pass binds hovering one copy to highlighting all copies of the same entity.
- **Relations.** Each relation becomes one edge per pair of copies of its ends, id `re<k>_<a>_<b>`; an edge between copies in two resources is `style=dashed`. Line hover, Diff marks and cards read the relation index `k` from the id prefix.
- **Kept:** the Resources filter (whole frames), the paint by resource, the fold of a resource frame (spec 065, with copies as holders), the contour hover (spec 064).

### Phase 5 — the data source leaves the screens

Deleted: `erdDataSourceFilter.ts`, the paint `data_source`, `DATA_SOURCE_CONTOUR_ID_PREFIX` and its contour, the Boundary switch and `boundary` in the payload, the left panel's Data sources block (server `left_sidebar_action.py`, client `LeftSidebar.tsx`, `sidebarNavigation.ts`), the `DataSource` icon and colour (`graph_node_disk_icons.ts`), and the room keys `data_source`, `disabled_data_sources`, `boundary`, `paint: data_sources`.

### Phase 6 — Diff, rooms, old graphs

- `erdDiff.ts`: an entity is changed in storage when its set of `resource_ids` differs between A and B; `previous_resource_ids` replaces `previous_resource_id`; Side by side matches a copy by entity and resource.
- Rooms: the room state carries `model` and the turned-off resources; `rooms/pages.py` whitelists `model` (`logical|physical`) and drops `boundary`, `disabled_data_sources`, `data_source`.
- Before 1.6 (`storage_known` false) the physical view is unavailable: a stored `model=physical` opens logical.

### Phases 7–10

Graph files rebuilt at 2.0 (`graph-builder write`), versions raised, the closing check run with the browsers, documentation (`docs` of Maxitor: the ERD's two views), the changelog.

## Checks

- Phase 1: every package's tests on the new AOA; `graph-builder check` on Maxitor's own graph files.
- Phase 2: pytest of `list-entities`; Vitest of the card.
- Phases 3–4: Vitest of `buildDotSource` per view; drawing checks `check-erd-logical-view.ts` and `check-erd-physical-view.ts` — a shop with one entity in two databases, an empty resource and a "Not stored" entity laid out by the client's Graphviz build, asserting frames, copies, `×N`, dashed lines and hover; in the browser on the AOA demo's graph.
- Phase 6: Vitest of `erdDiff` (a moved and a duplicated entity) and of room focus on a copy; pytest of the room whitelist.

## Levels whose version is raised

`packages/maxitor/maxitor-web`, `packages/maxitor/tools/repo-graph-port` (if its resources rename), `packages/maxitor`, and the repository root for `external/aoa`.
