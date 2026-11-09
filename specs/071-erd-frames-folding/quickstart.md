# Quickstart: checking the ERD's frames, folding, paint, filters and speed

Paths are from the repository root; `client` = `packages/maxitor/maxitor-web/client`.

## Unit tests and drawing checks

```bash
cd packages/maxitor/maxitor-web/client && npx vitest run src/lib/erd src/lib/useCaseDiff src/lib/lifecycleDiff src/lib/eventsExplorer src/lib/mapFilterRows src/components/ui/ErdFilterPanel
```

```bash
cd packages/maxitor/maxitor-web/client && node scripts/check-erd-physical-view.ts && node scripts/check-erd-logical-view.ts && node scripts/check-erd-contour-fold.ts && node scripts/check-erd-contour-hover.ts
```

Expected: each prints `ok` lines only and exits 0. The physical and logical checks lay the shop out in all five layouts and assert one frame per resource or domain, no nested frame, no two frames overlapping, no table in a frame not its own; the fold check folds and unfolds by a click inside a frame and finds no corner control; the hover check opens the frame's card on its border, name and empty space, and a table's card on a table inside it.

```bash
cd packages/maxitor/maxitor-web && uv run pytest tests -k "room and (frames or folded)"
```

Expected: the room accepts `frames` and `dc:` folds.

## Layout determinism (browsers, local)

```bash
cd packages/maxitor/maxitor-web/client && npx playwright install chromium firefox webkit && node scripts/check-layout-determinism.ts
```

Expected: one line per page and mode, both ERD views in all five layouts among them, with frames on and off; one hash each.

## Speed (by hand, production build)

```bash
cd packages/maxitor/maxitor-web/client && node scripts/generate-large-graph.ts ../tests/fixtures/ref-graph-2026-10-26.json.gz /tmp/erd-large --tables 1000,5000
```

```bash
cd packages/maxitor/maxitor-web/client && node scripts/measure-erd.ts /tmp/erd-large/1000/graph.json
```

Expected on 1 000 tables, Dot left to right, frames on: every line `ok` against SC-007 — no blocked stretch over 100 ms, first picture ≤ 3 s, hover and repaint ≤ 100 ms, pan and zoom ≥ 30 frames a second, a fold and a filter change shown ≤ 100 ms and settled ≤ 1 s, a room follower ≤ 0.5 s. On 5 000 tables: the numbers printed, no threshold. Both go into `specs/071-erd-frames-folding/measurements.md`, before and after.

## By eye, on the AOA demo

1. Open the whole system's ERD, logical view: domain frames drawn; turn the frames switch off and on.
2. Click empty space in a domain frame: it folds; click the box: it unfolds. No minus or plus anywhere.
3. Rest the pointer on a frame's border, name and empty space: the frame's card; on a table inside: the table's card.
4. Switch to Neato, FDP, Circo: frames in each, none overlapping. Physical view: the same, one frame per database, nothing nested.
5. Move the paint switch: the tables repaint at once. Make the window short: the switch stays at the panel's foot.
6. On a domain's ERD, turn a 1-hop table off in the panel: it stays hidden with 1-hop on; turn 1-hop off: its row stays, dimmed. On the whole system's ERD: no 1-hop switch.
