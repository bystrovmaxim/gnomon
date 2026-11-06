# Implementation Plan: Data source contours — one name, copying names, folding, and a Data sources node

**Branch**: `feature/issue-56-data-source-contours` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

## Summary

Four changes to Maxitor's ERD and navigation, all in `packages/maxitor/maxitor-web`: an empty label on the invisible spacing frames; copying a contour's name through the existing name copy; a Data sources branch of the sidebar listing with ERDs scoped to a data source or a resource; and folding contours, done in the DOT source (a folded contour becomes a node, its relations bundled) with the control, hover and card in the post-pass and the canvas.

## Technical Context

**Language/Version**: TypeScript (client: React, Vite, MUI), Python 3.12 / 3.14 (server: AOA actions)
**Primary Dependencies**: Graphviz WASM (`@hpcc-js/wasm-graphviz`), DuckDB (sidebar listing)
**Testing**: Vitest, pytest, drawing checks (`client/scripts/check-erd-*.ts`, rows of `scripts/check_run.py`), the browser on the AOA demo graph
**Constraints**: every endpoint stays an AOA action; nothing in production for the sake of tests

## Constitution Check

- The sidebar listing grows inside its existing action (`GetLeftMenuSidebarDataAction`), reading DuckDB through its resource.
- The scoped ERD needs no new endpoint: the client narrows the listing of all domains.
- The room's page settings stay validated by `pages.py`.

## Design

### 1. One name (`buildDotSource.ts`)

Every `cluster_*_room` spacing frame writes `label="";`, so it never inherits the data source's label. The data source contour gets `id="dc:<id>"` and `tooltip="<id>"` like a resource contour (`rc:`), for the copy and the fold control.

### 2. Copying a contour's name (`erdCopy.ts`)

`bindNameCopy` also takes a press on a `<text>` inside a cluster group whose id starts with `rc:` or `dc:`; the text is the name. Every other rule (slop, clipboard refusal, touch) is the one a table's name has.

### 3. Data sources in the navigation (`left_sidebar_action.py`, `pages.py`, client)

- Level 1: `data_sources_root` "Data sources" (type `DataSources`) after Domains, only when `data_source` has a row.
- Level 2 nodes: one per data source (`parent_id = data_sources_root`, id = the data source id, type `DataSource`), sorted by label; `no_data_source` "No data source" last when some resource stored an entity and names none.
- Level 3 rows: `erd_data_source:<ds>` (type `erd_data_source`, ordinal 0, label `ERD — <ds label> view`) and one `erd_resource:<res>` per resource with entities (type `erd_resource`, ordinal 1, label `ERD — <res label> view`), under its data source or `no_data_source`.
- `DiagramSelection` ERD gains `data_source?` / `resource?`; the address carries `data_source=` / `resource=`; `pageKeyOf`, `selectionOfPageKey`, `selectionKey` and the server's `_KEY_ORDER` / `page_keys` name the page.
- `loadErdDomainsBundle` for a scoped selection loads all domains, as "ERD all domains", and keeps the entities stored in the scope; with 1-hop on, also those one relation away.
- The panel opens the branch of the diagram on screen.

### 4. Folding (`buildDotSource.ts`, `erdPostPass.ts`, canvas, settings)

- `ErdGraphPayload.folded_contours?: ReadonlySet<string>` of contour ids (`rc:<res>`, `dc:<ds>`), used only with Boundary on.
- `foldPlan(data)` (pure, exported): which contour each entity's table is drawn in when folded (the outermost folded contour holding it), the counts of each folded contour, and the bundles — `{ id: "rb<j>", source, target, relations: number[] }` for every pair of drawn ends with a folded box among them.
- DOT: a folded contour is a node named by its id (`shape=box`, `style="rounded,filled"`, white, its contour's colour, `tooltip` its id), label `<B>name</B>` and the counts line, plus in Diff `~N changed` in amber. Relations with a folded end are not drawn as themselves; each bundle is one edge `id="rb<j>"`, `arrowhead=none`, `penwidth` 1 for one relation and up to 4.4 for the widest bundle, `label="×N"` when N > 1. A relation inside one folded box is not drawn.
- Post-pass: `addFoldControls(root, folded)` draws a 12-unit rounded square with a minus (unfolded contour) or a plus (folded box) at the top right of each contour border or folded box, class `erd-fold-control`, `data-fold="<id>"`; `erdFoldSx` keeps it faint until its contour or box is hovered. `addEndLabelBadges` gives a bundle's `×N` its plate where Graphviz put it, and the plate stays visible. `bindLineHover` takes the bundles: a bundle's hover and a folded box's hover light as a line's does.
- Canvas: a click on `[data-fold]` toggles the fold; a click on a bundle unfolds its folded ends; the generic table hover skips folded boxes; `erdSubject` gives a bundle its card (title `A ↔ B`, detail `N relations`, one row per relation).
- Settings: `folded_contours` in `useErdResourceSettings` (`toggleFold`, `unfold`), `folded` in `viewUrl.ts`; `pages.py` accepts on `domain-erd` the settings `disabled_resources`, `disabled_data_sources`, `boundary`, `folded_contours`, and the paints `resources`, `data_sources`.

### Checks

- Vitest per phase; pytest for the sidebar listing and `pages.py`.
- Drawing checks: `check-erd-data-sources.ts` counts the data source's name once; `check-erd-contour-fold.ts` lays out a folded resource and a folded data source and asserts the boxes, bundles, widths and plates.
- Browser, AOA demo graph: the Messaging ERD, folding `OutboxPrimaryDatabase`; Data sources → MessagingDataSource.

## Levels whose version is raised

`packages/maxitor/maxitor-web` and `packages/maxitor`.
