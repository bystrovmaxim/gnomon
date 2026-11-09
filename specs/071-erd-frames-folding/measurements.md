# Measurements: the ERD of a large model

`client/scripts/measure-erd.ts` on a production build (`vite build`, served by `vite preview`), Chromium, a 1600 × 900 window, Apple Silicon. The models are the demo's graph copied by `client/scripts/generate-large-graph.ts --tables=1000,5000`: 1 065 and 5 112 tables. Default layout: Dot left to right, frames on. A hover is measured as the work after its 100 ms intent: the event a page acts on at once.

## 1 065 tables

| Measure | Time | Threshold (SC-007) |
|---|---:|---:|
| First picture | 22 798 ms | 3 000 ms |
| Longest task while it was drawn | 18 959 ms | 100 ms |
| A hover's work | 146 ms | 100 ms |
| Worst frame while panning | 17 ms | 33 ms |
| Repaint (paint by kinds) | 20 324 ms | 1 000 ms |
| Fold every frame, settled | 432 ms | 1 000 ms |
| Unfold every frame, settled | 19 764 ms | 1 000 ms |
| A domain filtered off, settled | 424 ms | 1 000 ms |

The first picture is the same without the wrapping of unlinked parts — 22 019 ms, its longest task 18 193 ms: the cost is Graphviz's Dot layout on a model this size, on the main thread. A fold and a filter change, which leave fewer tables to lay out, meet their thresholds; a repaint and an unfold lay the whole model out again. Bringing the rest within the thresholds — the layout in a Web Worker, by parts with a cache, a change shown on the current drawing at once — is bystrovmaxim/gnomon#85.

## 5 112 tables

The page does not survive the first layout: Chromium closes the tab while Graphviz lays the whole model out on the main thread, before any picture is shown, so no other number can be taken. Drawing a model of this size in full, as SC-008 asks, is part of bystrovmaxim/gnomon#85.
