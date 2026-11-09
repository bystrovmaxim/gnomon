# Tasks: The ERD's frames, folding, paint switch, filters and speed

One phase = one commit, referencing (#80); the phases are the seven of issue #80. After a phase only its own tests run; every new test is broken once on purpose — break the code the way the test must catch, see that test fail and no other test of the phase, restore. Nothing is committed, pushed or merged without the maintainer's instruction. The layout determinism check (`scripts/check-layout-determinism.ts`) runs in phases 1, 2 and 5 as each phase's own test: each of them extends what it proves.

`web` = `packages/maxitor/maxitor-web`, `client` = `web/client/src`, `scripts` = `web/client/scripts`.

## Phase 1 — The physical view: one frame per database, in every layout (US1; FR-001–FR-003, FR-007, FR-008; SC-001, SC-003)

- [x] T001 [US1] In `client/lib/buildDotSource.ts` make a resource frame list its tables directly: remove `cluster_resource_<i>_domain_<j>`, the `nested` branch of `domainFrame` and `byDomain` inside a resource frame; specialization groups stay inside the frame that holds all their tables
- [x] T002 [US1] In `client/lib/erdViews.ts` make `viewLayout` keep the chosen layout in both views and return `framed: true` for all five; in `client/components/diagrams/ErdViewer/parts/ErdGraphvizCanvas/ErdGraphvizCanvas.tsx` offer all of `LAYOUT_TOOLS` in the physical view
- [x] T003 [US1] In `client/lib/buildDotSource.ts` emit frame clusters only for the Dot layouts, and give every engine `start=1` in the graph attributes
- [x] T004 [US1] Create `client/lib/erdCompose.ts`: for `gv-neato`, `gv-fdp` and `gv-circo`, lay out each frame's tables alone with the chosen engine, lay out the frames as fixed-size boxes with one weighted line per pair of linked frames and `overlap=false`, pin every table at frame place + inner place (`pos="x,y!"`), route the lines with `neato -n2`, and write each frame into the SVG as a `g.cluster` with the Dot frame's id (`rc:<resource>`), label and rounded outline (research R2)
- [x] T005 [US1] Wire `erdCompose.ts` into the layout path of `ErdGraphvizCanvas.tsx` (`engine` from `erdGraphvizEngine`) so Neato, FDP and Circo drawings go through it and Dot through Graphviz directly; if the determinism check (T008) finds a layout that differs between browsers, round the composed positions before the final pass until it does not (research R2)
- [x] T006 [P] [US1] Vitest in `client/lib/erdCompose.test.ts`: frames never overlap, each frame's box holds exactly its tables, the same input gives the same output twice
- [x] T007 [US1] Extend `scripts/check-erd-physical-view.ts` to lay the shop out in all five layouts and assert per layout: one frame per resource, no frame inside a frame, no two frame boxes overlapping, every table's box inside its own frame and no other
- [x] T008 [US1] Extend `scripts/check-layout-determinism.ts` so the physical view is opened in all five layouts
- [x] T009 [US1] Physical view unavailable without storage: `ErdModelPill.tsx` disables the Physical half (counter "—", tooltip "No resource keeps these tables") when no table of the base has a `resource_ids` entry, beside the existing `storage_known` case; `ErdGraphvizCanvas.tsx` opens the logical view for `model=physical` then; Vitest for a graph without resources and for a domain whose base holds no stored table
- [x] T010 [US1] Adversarial check: nest a domain frame again, then let two frames overlap in `erdCompose.ts`, then enable the Physical half without storage; each time the matching test (T007, T009) fails and no other test of the phase does; restore. Commit phase 1

## Phase 2 — The logical view's frames, folding by a click, the frame's card (US2, US3, US4; FR-004–FR-011; SC-002, SC-004, SC-005)

- [x] T011 [US2] Add the page setting `frames` in `client/lib/viewUrl.ts` (`frames: { param: "frames", kind: "switch" }`, default on) and `"frames": _boolean` on the `domain-erd` page in `web/maxitor/web/model/rooms/pages.py`
- [x] T012 [US2] Add a frames switch beside `ErdModelPill` in `ErdGraphvizCanvas.tsx`, shown in the logical view; off, `buildDotSource` emits no domain cluster and `erdCompose` is skipped
- [x] T013 [US2] Draw the logical view's domain frames in all five layouts through the paths of phase 1; frame ids `dc:<domain qualname>` (a constant beside `CONTOUR_ID_PREFIX` in `client/lib/buildDotSource.ts`)
- [x] T014 [US2] Extend `foldPlan` in `client/lib/buildDotSource.ts` to fold domain frames from `folded_contours` in the logical view, drawing the folded box as a resource frame's is drawn; `pages.py` accepts `dc:` ids in `folded_contours`; a fold whose frame is not drawn is kept and ignored
- [x] T015 [US3] In `client/lib/erdPostPass.ts` make `addContourHitAreas` cover every frame (`rc:` and `dc:`), its whole outline filled transparent with `pointer-events="all"`; bind a click on it (pointer moved < 4 px between down and up) to fold, and a click on a folded box to unfold, in `ErdGraphvizCanvas.tsx`
- [x] T016 [US3] Remove `addFoldControls`, `scaleFoldControls`, `FOLD_SCALE_CLASS`, `FOLD_FACE`, `FOLD_HIT`, `FOLD_GAP` from `client/lib/erdPostPass.ts` and the fold zoom tracking (`foldZoomRef`) from `ErdGraphvizCanvas.tsx`, with their tests
- [x] T017 [US4] Bind the frame's card to the hit area and to the folded box for both frame kinds; a table or line inside keeps its own card and hover
- [x] T018 [P] [US2] Vitest: `foldPlan` folds a domain frame; `viewUrl` reads and writes `frames`; a stale fold id is ignored; a folded frame whose tables are all filtered out is not drawn
- [x] T019 [P] [US2] pytest in `web/tests`: the room accepts `frames` and `dc:` folds, refuses a non-boolean `frames`
- [x] T020 [US2] Extend `scripts/check-erd-logical-view.ts` to five layouts, frames on (a frame per domain, none overlapping, no foreign table) and off (no frame); extend `scripts/check-layout-determinism.ts` to the logical view with frames off
- [x] T021 [US3] Rewrite `scripts/check-erd-contour-fold.ts`: a click inside a frame folds it, a click on the box unfolds it, a drag of 10 px does not fold, no element of class `erd-fold-scale` exists
- [x] T022 [US4] Extend `scripts/check-erd-contour-hover.ts`: the frame's card on its border, name and empty space, for a resource and a domain frame; a table's card on a table inside
- [x] T023 [US2] Side by side and Diff: both halves draw with the same frames switch, folds and paint; Vitest on the settings each half reads, and a case in `scripts/check-erd-contour-fold.ts` folding a frame in Side by side
- [x] T024 Adversarial check: keep `pointer-events="stroke"`, then fold on any pointer-up; T022 and T021 fail in turn, nothing else; restore. Commit phase 2

## Phase 3 — The paint switch (US5; FR-012, FR-013)

- [x] T025 [US5] Reproduce the paint defect on the whole system's ERD in the browser (AOA demo graph), name its cause in the commit message, and write the Vitest that fails on it
- [x] T026 [US5] The paint switch repaints at once on every ERD, the whole system's included: the colours stay in the DOT, which carries the section that paints (`setErdPaint`), and each painted drawing is kept in the canvas's layout cache, so switching back to a paint already seen lays nothing out
- [x] T027 [US5] In `client/components/ui/ErdFilterPanel/ErdFilterPanel.tsx` make the panel a column: the sections scroll (`overflowY: auto` on them), the paint switch (`gear shift` in the code) a fixed foot outside the scrolling part
- [x] T028 [P] [US5] Vitest: a repaint changes no layout input and no layout hash; the paint switch stays in view in a container shorter than the panel; update `scripts/check-erd-physical-view.ts` colour assertions to read the CSS properties
- [x] T029 [US5] The other diagrams with a paint switch — `UseCaseDiagramViewer.tsx`, `LifecycleFsmViewer.tsx`, `EventsExplorer.tsx`, `MapViewer.tsx`: check in the browser that a repaint applies at once
- [x] T030 Adversarial check: put a colour back into the DOT, then the paint switch back inside the scroll, then a colour back into one other diagram's DOT; the matching test fails each time; restore. Commit phase 3

## Phase 4 — The filter rule on every diagram (US6; FR-014–FR-017; SC-006)

- [x] T031 [US6] ERD: in `client/lib/erdFilterPresence.ts` compute scope → base (scope + 1-hop) → drawn (without 1-hop neighbours when off, then without what a panel filter hides) → rows (the base) → dimmed (in base, not drawn); `tablesToDraw` no longer re-adds a hidden table
- [x] T032 [P] [US6] Use cases: the same order in `client/lib/useCaseDiff.ts` and `UseCaseDiagramViewer.tsx`
- [x] T033 [P] [US6] Lifecycle: its scope is the whole automaton, so it is its own base and shows no 1-hop switch; what the panel switches off is hidden (`LifecycleFsmViewer.tsx`); the room accepts its filters and its paint (`pages.py`)
- [x] T034 [P] [US6] Events: rows from the domain's scope, hidden ones dimmed, in `client/lib/eventsExplorer.ts`
- [x] T035 [P] [US6] Full graph: rows from the whole system, hidden ones dimmed with the mark it has today, in `client/lib/mapFilterRows.ts`
- [x] T036 [US6] Show `OneHopToggle` only on a domain's ERD (`qualifier` set), a domain's use cases and a lifecycle; never on `erd` with `qualifier: null` or `use_case_all`
- [x] T037 [US6] Use cases: a domain's page reads all domains' use cases, its base the scope with the use cases one action-to-action link away (`useCaseBase`), never through a role; Vitest per diagram: an element turned off stays hidden with 1-hop on; rows = base; every hidden element of the base has a dimmed row; no 1-hop on the whole system's ERD and use cases; a pytest that the room knows every setting each page keeps, and a Vitest that the address does
- [x] T038 Adversarial check: apply 1-hop after the filters again in one diagram, then take rows from the drawn set; T037 fails for that diagram only; restore

## Phase 5 — Speed (US7; FR-018, FR-019; SC-007–SC-009)

- [x] T039 [US7] Give `scripts/generate-large-graph.ts` a `--tables <n,…>` option that picks the number of copies so the whole system's ERD holds 1 000 and 5 000 tables
- [x] T040 [US7] Create `scripts/measure-erd.ts` like `scripts/measure-map.ts`: first picture, hover, repaint, fold (shown and settled), filter change (shown and settled), pan and zoom frame rate, the longest Long Task, and a room follower's delay with a second page; each number beside its SC-007 threshold, in the default layout; the other layouts and frames off printed without threshold
- [x] T041 [US7] Run the measurement on the production build before any speed change; write the numbers in `specs/071-erd-frames-folding/measurements.md`
- [ ] T042 [US7] Create `client/lib/erdLayoutWorker.ts`: Graphviz in a Web Worker with an LRU of layouts keyed by engine + input; `ErdGraphvizCanvas.tsx` keeps the current drawing live while a layout runs and swaps in the new one with the camera kept; `erdCompose.ts` runs in the worker too — moved to bystrovmaxim/gnomon#85
- [ ] T043 [US7] A fold or filter change acts on the current drawing at once (hidden tables and their lines fade out, a folded frame shows its box over the frame's place), then the worker's layout replaces it; a room follower applies a received setting the same way — moved to bystrovmaxim/gnomon#85
- [ ] T044 [US7] Hover from maps built once per drawing (table → lines, frame → tables) in `client/lib/erdPostPass.ts`; the post-pass once per drawing; pan and zoom one transform — moved to bystrovmaxim/gnomon#85
- [ ] T045 [US7] Run the measurement after; every SC-007 line `ok` on 1 000 tables; the 5 000-table numbers recorded; both into `measurements.md`; `scripts/check-layout-determinism.ts` still one hash per page and mode — moved to bystrovmaxim/gnomon#85
- [ ] T046 Adversarial check: lay out on the main thread again; the Long Task line of `measure-erd.ts` misses its threshold; restore. Commit phase 5 — moved to bystrovmaxim/gnomon#85

## Phase 6 — Versions, graph files, the closing check run

- [x] T047 Raise the versions of `packages/maxitor/maxitor-web/version.toml`, `packages/maxitor/version.toml` and the root `version.toml` if a file outside the packages changed; rebuild Maxitor's graph files if they change (`graph-builder write`)
- [ ] T048 The closing check run (`scripts/check_run.py`), taken to zero; commit phase 6

## Phase 7 — Documentation and the changelog

- [x] T049 Documentation: the ERD (frames, the frames switch, folding by a click, the frame's card, all five layouts in both views) in `web/client/src/components/diagrams/ErdViewer/README.md`, the filter panel in `web/client/src/components/ui/ErdFilterPanel/README.md`, the filter rule of every diagram in the READMEs of `UseCaseDiagramViewer`, `LifecycleFsmViewer`, `EventsExplorer`, `MapViewer`, and the ERD section of `web/README.md` (section 2 — its sentence that frames are drawn under the Dot layouts only becomes untrue)
- [x] T050 One changelog article in `docs/CHANGELOG.md`, written last; commit phase 7

## Traceability

| Requirement | Tasks |
|---|---|
| FR-001, FR-002 | T001–T005 |
| FR-003 | T009 |
| FR-004 | T011, T012, T023 |
| FR-005 | T014 |
| FR-006 | T013 |
| FR-007, FR-008 | T003–T008, T013, T020 |
| FR-009, FR-010 | T015, T016, T021 |
| FR-011 | T017, T022 |
| FR-012 | T025, T026, T029 |
| FR-013 | T027, T028 |
| FR-014–FR-017 | T031–T037 |
| FR-018, FR-019 | T039–T045 |
| FR-020 | T047–T050 |
| SC-001 | T007 |
| SC-002 | T020 |
| SC-003 | T008, T020, T045 |
| SC-004 | T021 |
| SC-005 | T022 |
| SC-006 | T037 |
| SC-007–SC-009 | T040, T041, T045 |

## Order

Phase 1 → 2 → 3 → 4 → 5 → 6 → 7. Phase 2 builds on the frames of phase 1; phase 5 moves the layouts of phases 1–2 into the worker and measures after phases 3–4 have changed what a paint and a filter do. Inside a phase, tasks marked [P] touch different files and may run side by side.

## Phase 8: Convergence

Found by bystrovmaxim/gnomon#89 on the demo's history at maxitor.aoa.run.

- [x] T051 With Boundary off the logical view folds nothing: `ErdGraphvizCanvas.tsx` hands `foldPlan` no folded frame while the frames are not drawn, every table is drawn and every line is its own, and the folds stay in the address for when the frames come back; a test that a model with folded frames, drawn with Boundary off, has no `dc:` or `rc:` node and no bundle, in Dot, Neato, FDP and Circo per Edge case "The logical view with frames off" (contradicts)
- [x] T052 No dimming outlives what lit it: find which dimming stays on in the side-by-side view of #89 section 4 — a hover's, a change step's, a picked element's — end it with what lit it, and make a step to a change the drawing does not show dim nothing; a test that repeats those steps and checks the drawing after each per Assumption "hover highlight reused" (contradicts)
- [x] T053 A hover on any table dims the others, near and from afar, in every layout: find why `InterchangeAssessmentSliceCoreEntity` in Circo with frames off dims nothing (#89 section 5) and fix it; a test that hovers every table of that view per US4/AC2 (partial)
- [x] T054 With frames off, Dot wraps the drawing's unlinked parts into columns (`dotWrap`), the drawing about as wide as tall, as with frames on; a test on the demo with Boundary off per FR-006 (partial)
- [x] T055 The frame's card keeps its head at the top and the pointed table's block at the bottom, only the list of tables scrolling; the bottom block's height fixed when the card opens, to fit its longest name and description; tests that the block stays in view on a domain of 45 tables and keeps one height while the pointer moves over descriptions of one and of three lines per US4/AC1 (partial)
- [x] T056 A step through changes shows every change: a change inside a folded frame lights and centres the folded box, and its card names the change; a change the drawing does not hold is said so; a test over every change of the side-by-side view of #89 section 3 per FR-005 and Assumption "Diff reused" (partial)
- [ ] T057 Versions, documentation of the ERD card, the change steps and Boundary, and one changelog article, written last per FR-020 (missing)
- [x] T058 The card's foot keeps the last row when the pointer leaves the list, its height following what it says, so a foot that grows over the pointer never shakes the list per FR-021 (contradicts)
- [x] T059 Switching Boundary replaces the old drawing by the new one in one step, fitted: no frame with the leaving tables hidden, no fit of the old drawing; the resize observer set up once; the ERD's steps of the layout determinism check switch Boundary off and on per FR-008 (contradicts)
- [x] T060 A marked row's type ends at its cell's right edge when its text is hidden from afar and measures nothing per US4/AC2 (contradicts)
- [x] T061 The highlight is held while the pointer is on the card of what is lit, and let go when the card closes per US4/AC2 (partial)
- [x] T062 The logical and the physical view each keep their own layout and tables' collapse; the room knows the physical view's settings and the events explorer's halves per FR-004 (missing)
