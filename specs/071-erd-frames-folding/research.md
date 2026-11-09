# Research: The ERD's frames, folding, paint switch, filters and speed

`web` = `packages/maxitor/maxitor-web`, `client` = `web/client/src`, `scripts` = `web/client/scripts`.

## Where the code stands

- `client/lib/erdViews.ts` `viewLayout`: frames are drawn only in the two Dot layouts. The ERD's documentation (`web/README.md`, section 2) gives the reason: with clusters FDP gives one diagram two different pictures, so a room's pointers land on different spots. In Neato, FDP and Circo the logical view drops its frames, and the physical view is forced to Dot; the toolbar offers only the Dot layouts in the physical view (`ErdGraphvizCanvas.tsx`, `LAYOUT_TOOLS.filter`).
- `client/lib/buildDotSource.ts`: the physical view nests a domain frame (`cluster_resource_<i>_domain_<j>`) in each resource frame; the logical view's domain frame cannot fold (`foldPlan` reads `folded_contours` only in the physical view).
- `client/lib/erdPostPass.ts`: `addFoldControls` and `scaleFoldControls` draw the minus and plus in a frame's corner (spec 068); `addContourHitAreas` makes only a frame's 10 px border hoverable (`pointer-events="stroke"`), and only for resource frames.
- Paint: the colours are written into the DOT (`setErdPaint`), so a new paint lays the diagram out again and changes the layout hash a room compares (`rooms/layout_authority.py`).
- Filters: `client/lib/erdFilterPresence.ts` `tablesToDraw` applies 1-hop **after** the panel's filters, so 1-hop brings back what a filter hid; use cases (`withUseCaseOneHop`) and lifecycle (`withLifecycleOneHop`) do the same. The 1-hop switch is shown on the whole system's ERD and use cases too.
- Filter panel: `client/components/ui/ErdFilterPanel/ErdFilterPanel.tsx` scrolls as one block (`overflowY: auto` on the panel), the paint switch (`gear shift` in the code) with it.
- Measurement precedent: `scripts/generate-large-graph.ts` and `scripts/measure-map.ts` (spec 040) — a generated graph and a Playwright session that prints each number beside its threshold, run by hand, not in the check run.

## R1 — Graphviz times on 1 000 tables

Measured on 2026-11-09 with the client's WASM Graphviz build on a generated logical model (about 25 tables a domain, 1.3 relations a table, 6 fields a table), in Node:

| Tables | Engine | Framed | Unframed |
|---|---|---|---|
| 200 | dot | 77 ms | 131 ms |
| 200 | fdp | 108 ms | 1 739 ms |
| 200 | neato | — | 173 ms |
| 1 000 | dot | 412 ms | 1 968 ms |
| 1 000 | fdp | 537 ms | 37 867 ms |
| 1 000 | neato | — | 6 711 ms |

The SVG of 1 000 tables is about 8 MB.

**Consequences.** A layout of 1 000 tables takes 0.4 s at best; any interaction that lays the diagram out again cannot show its result in 100 ms, and a layout on the page's main thread freezes it for that long. Frames make every engine faster: Graphviz lays out each frame apart.

## R2 — Frames in every layout

**Decision.** Dot draws frames as Graphviz clusters, as today. Neato and Circo ignore clusters, and FDP's clusters give one diagram two different pictures (see above); these three are laid out in two steps:

1. each frame's tables are laid out alone by the chosen engine, which gives the frame's size;
2. the frames, as boxes of those sizes, and the lines between them (one per pair of frames, weighted by the count) are laid out by the same engine with `overlap=false`;
3. the final drawing places every table at its frame's place plus its place inside the frame, pinned (`pos="x,y!"`), and routes the lines with `neato -n2`; the frames are drawn into the SVG as `g.cluster` groups with the same ids, classes, label and outline the Dot frames have, so hover, cards, folds and rooms read them the same way.

Every engine gets a fixed seed (`start=1`), so the same input gives the same bits; the layout determinism check covers the five layouts of both views.

**Rationale.** One composition for the three engines that cannot frame reproducibly; no overlap by construction (FR-007); each frame laid out alone is fast (R1). Whether Neato, FDP and Circo give the same bits in all three browsers with a fixed seed is not known yet: the layout determinism check of phase 1 decides it, and a layout that differs is pinned further (positions rounded before the final pass) until it does not.
**Alternatives.** Hulls drawn round the tables of a free layout — rejected in clarification: frames would overlap and hold foreign tables. FDP's own clusters — fast (R1), but not the same picture twice.

## R3 — Nothing freezes

**Decision.**
- Graphviz runs in a Web Worker; the page's main thread never waits for a layout.
- Layouts are cached by the text of their input (a small LRU), so undoing a fold or a filter shows the earlier layout at once.
- A fold or a filter change acts on the drawing at once: the hidden tables and their lines fade out, a folded frame shows as its box over the frame's place; the new layout replaces the drawing when the worker answers, the camera kept on the same point.
- Paint leaves the DOT: the drawing carries what each table belongs to (`data-domain`, `data-kind`, `data-resource`, `data-change`), and the colours are CSS custom properties set on the SVG's root. A repaint changes a few properties, lays nothing out, and the layout hash stays the same, so a room does not reload on a repaint.
- Hover reads precomputed maps (table → lines, frame → tables) built once per drawing instead of querying the SVG on each move.
- Pan and zoom move one transform on one group; the post-pass runs once per drawing, never per frame.

**Rationale.** The targets of SC-007 are about the page never stalling; R1 shows a layout itself cannot be 100 ms, so it leaves the main thread and the interaction answers in place.
**Alternatives.** Hiding in place without a new layout — leaves holes and changes the picture. A faster layout engine (ELK) — not the layouts the reader picks, and a different picture.

## R4 — Folding and the frame's card

**Decision.** A frame's hit area is its whole outline filled transparent (`pointer-events="all"` on the fill and the border); tables and lines are drawn after it, so they stay on top and keep their own hover. A click on the hit area folds the frame; a click on a folded box unfolds it. `addFoldControls`, `scaleFoldControls` and the fold zoom tracking of `ErdGraphvizCanvas.tsx` are removed. Domain frames get the same hit area, card and fold, their ids `dc:<domain qualname>` beside the resource frames' `rc:<resource>`; `folded_contours` holds both.

A click is a click only when the pointer moved less than 4 px between down and up, so a pan that starts inside a frame does not fold it.

## R5 — The filter rule

**Decision.** One function per diagram computes, in this order: the scope; the base — the scope with its 1-hop neighbours; what is drawn — the base, without the 1-hop neighbours when 1-hop is off, without what any panel filter hides; the rows — one per element of the base; a row is dimmed when its element is in the base and not drawn. ERD (`erdFilterPresence.ts`), use cases (`useCaseDiff.ts`), lifecycle (`lifecycleDiff.ts`), events (`eventsExplorer.ts`) and the full graph (`mapFilterRows.ts`) follow it; `OneHopToggle` is shown only on a domain's ERD and use cases and on a lifecycle. The full graph keeps its "what hides it" mark; the other diagrams dim the row without one.

## R6 — Measuring

**Decision.** `scripts/generate-large-graph.ts` gets a target size in tables and writes graphs whose ERD holds 1 000 and 5 000 tables; `scripts/measure-erd.ts`, built like `measure-map.ts`, opens the whole system's ERD and measures the first picture, hover, repaint, fold, filter, pan and zoom, the longest blocked stretch of the main thread (Long Tasks), and, with a second page in a room, the follower's delay. It prints each number beside its threshold and runs by hand on a production build, like `measure-map.ts`. The numbers before and after are kept in `specs/071-erd-frames-folding/measurements.md`.

The targets of SC-007 are measured in the default layout (Dot left to right, frames on); the other layouts and frames off are measured and recorded.
