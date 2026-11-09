# Implementation Plan: The ERD's frames, folding, paint switch, filters and speed

**Branch**: `feature/issue-80-erd-frames-folding` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

`web` = `packages/maxitor/maxitor-web`, `client` = `web/client/src`, `scripts` = `web/client/scripts`.

## Summary

The ERD draws one frame per database in the physical view and folding domain frames in the logical one, in all five layouts, without overlap; a frame folds by a click inside it and shows its card anywhere on it. The paint switch repaints without a new layout and stays at the panel's foot. Every diagram with a filter panel follows one rule: scope, then 1-hop, then the panel's filters; rows from the base, hidden ones dimmed. Layouts leave the page's main thread, so on 1 000 tables nothing freezes, alone or in a room. The research is in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript (client, React + Vite); Python 3.12 / 3.14 (room server)
**Primary Dependencies**: `@hpcc-js/wasm-graphviz` (in a Web Worker from phase 5); Playwright for the browser checks and the speed measurement
**Testing**: Vitest; the ERD drawing checks (`scripts/check-erd-*.ts`); `check-layout-determinism.ts`; pytest of the room whitelist; `scripts/measure-erd.ts` by hand
**Performance Goals**: SC-007 on 1 000 tables in the default layout; 5 000 tables measured
**Constraints**: every endpoint through an AOA action (no new endpoint here); the same bits in Chromium, Firefox and WebKit (spec 028); Maxitor assumes no language of the graph's producer

## Constitution Check

- II. The spec goes ahead of the code: spec 071, clarified; issue #80 says the same.
- IV. Decision apart from idea: the composition of Neato and Circo (R2) and the speed means (R3) are decisions of this plan; their measure is SC-001 – SC-009.
- V. Measurement: R1 is the measured basis; SC-007 – SC-009 name the metrics, `measure-erd.ts` the way they are compared, before and after.
- No new endpoint and no new store; the room server only widens a whitelist.

Post-design: no violation.

## Project Structure

```text
specs/071-erd-frames-folding/  spec.md plan.md research.md data-model.md quickstart.md contracts/erd-ui.md measurements.md tasks.md
web/client/src/lib/            buildDotSource.ts erdViews.ts erdPostPass.ts erdPaint.ts erdFilterPresence.ts useCaseDiff.ts lifecycleDiff.ts eventsExplorer.ts mapFilterRows.ts viewUrl.ts erdLayoutWorker.ts (new) erdCompose.ts (new)
web/client/src/components/     diagrams/ErdViewer/parts/ErdGraphvizCanvas/ ui/ErdFilterPanel/ ui/OneHopToggle/ diagrams/{UseCaseDiagramViewer,LifecycleFsmViewer,EventsExplorer,MapViewer}/
web/client/scripts/            check-erd-*.ts check-layout-determinism.ts generate-large-graph.ts measure-erd.ts (new)
web/maxitor/web/model/rooms/   pages.py
```

## Design

### Phase 1 — the physical view: one frame per database, every layout (1.1)

- `buildDotSource.ts`: a resource frame lists its tables directly; `cluster_resource_<i>_domain_<j>` and the `nested` branch of `domainFrame` go.
- `erdViews.ts` `viewLayout`: no layout forced, `framed` true in every layout; the toolbar offers all five layouts in both views.
- Dot: clusters. Neato, FDP and Circo: `erdCompose.ts` — each frame laid out alone, the frames laid out as boxes with `overlap=false`, tables pinned at frame place + inner place, lines routed by `neato -n2`, frames written into the SVG as `g.cluster` with the Dot frames' ids, label and outline (R2). Every engine `start=1`.
- Checks: `check-erd-physical-view.ts` in five layouts — a frame per resource, none nested, none overlapping, no foreign table; `check-layout-determinism.ts` over the physical view's five layouts.

### Phase 2 — the logical view's frames, folding, the frame's card (1.2–1.4)

- Page setting `frames` (`viewUrl.ts`: `frames`, switch; `pages.py`: boolean); a switch beside `ErdModelPill`; off, `buildDotSource` emits no domain cluster.
- Domain frames in all five layouts through the same paths as phase 1.
- `foldPlan` folds domain frames too: ids `dc:<domain qualname>`, kept in `folded_contours`; `pages.py` accepts them.
- `erdPostPass.ts`: `addContourHitAreas` covers every frame's whole outline (`pointer-events="all"`); a click (pointer moved < 4 px) on it folds, a click on a folded box unfolds; `addFoldControls`, `scaleFoldControls`, `FOLD_*` and the canvas's fold zoom tracking go; the frame's card binds to the hit area and to the folded box.
- Checks: `check-erd-logical-view.ts` in five layouts, frames on and off; `check-erd-contour-fold.ts` by click, no `erd-fold-scale`; `check-erd-contour-hover.ts` on border, name, empty space and a table inside; Vitest of `foldPlan` for domains; pytest of the whitelist.

### Phase 3 — the paint switch (1.5)

- First reproduce the defect on the whole system's ERD in the browser and name its cause; the test of this phase fails on it.
- Paint leaves the DOT: `buildDotSource` writes `data-domain`, `data-kind`, `data-resource`, `data-change` on tables and frames and no colour; `erdPaint.ts` sets CSS custom properties on the SVG's root; the layout hash no longer depends on paint (R3).
- `ErdFilterPanel.tsx`: the panel is a column — the sections scroll, the paint switch is a fixed foot.
- The other diagrams with a paint switch — use cases, lifecycle, events, the full graph — are checked the same way; where a repaint lays out again or does not apply at once, it gets the ERD's treatment.
- Checks: Vitest — a repaint changes no layout input; the panel's foot stays in view in a short container.

### Phase 4 — the filter rule on every diagram (1.6)

- One order per diagram: scope → base (scope + 1-hop) → drawn (without 1-hop neighbours when off, without what a panel filter hides) → rows (the base) → dimmed (in the base, not drawn). `erdFilterPresence.ts` `tablesToDraw` applies the filters after 1-hop; `useCaseDiff.ts`, `lifecycleDiff.ts`, `eventsExplorer.ts`, `mapFilterRows.ts` the same.
- `OneHopToggle` only on a domain's ERD and use cases and on a lifecycle.
- Checks: Vitest per diagram on one domain of a fixture: off stays off with 1-hop on; rows = base; nothing outside the base; dimmed = in base and not drawn; no 1-hop on the whole system.

### Phase 5 — speed (1.7)

- `generate-large-graph.ts --tables 1000,5000`; `measure-erd.ts` (R6); the numbers before go into `measurements.md` first.
- `erdLayoutWorker.ts`: Graphviz in a Web Worker, an LRU of layouts keyed by engine + input; the canvas keeps the current drawing live while a layout runs and swaps it in with the camera kept.
- A fold or filter acts on the current drawing at once (fade the hidden tables and lines, show the folded box over the frame), then the new layout replaces it.
- Hover from maps built once per drawing; the post-pass once per drawing; pan and zoom one transform.
- The room follower applies a setting the same way: at once on its drawing, then its own layout.
- Checks: `measure-erd.ts` against SC-007, the numbers after into `measurements.md`; the determinism check still green (the worker gives the same bits).

### Phases 6–7

Versions raised, the graph files rebuilt if they change, the closing check run with the browsers; documentation of the ERD, the filter panel and the filters of every diagram; the changelog.

## Levels whose version is raised

`packages/maxitor/maxitor-web`, `packages/maxitor`, and the repository root if a file outside the packages changes.

## Complexity Tracking

| Addition | Why | Simpler option rejected because |
|---|---|---|
| `erdCompose.ts` for Neato, FDP and Circo | Neato and Circo ignore clusters, FDP's are not reproducible, and frames must not overlap (FR-007) | hulls round a free layout overlap and hold foreign tables |
| Layout in a Web Worker | a layout of 1 000 tables takes 0.4–2 s (R1); on the main thread the page freezes | none keeps the page live during a layout |
