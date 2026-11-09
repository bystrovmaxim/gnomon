# Measurements: the ERD of a large model

`client/scripts/measure-erd.ts` on a production build (`vite build`, served by `vite preview`), Chromium, a 1600 × 900 window, Apple Silicon. The models are the demo's graph copied by `client/scripts/generate-large-graph.ts --tables=1000,5000`: 1 065 and 5 112 tables. Default layout: Dot left to right, frames on. A hover is measured as the work after its 100 ms intent: the event a page acts on at once. A change is **shown** when the drawing on the page first changes after the click, measured in the page; it is **settled** when the new picture is placed.

## 1 065 tables

| Measure | Before (#80) | After (#85) | Threshold (SC-007) |
|---|---:|---:|---:|
| First picture | 22 798 ms | 2 896 ms | 3 000 ms |
| Longest task while it was drawn | 18 959 ms | 652 ms | 100 ms |
| A hover's work | 146 ms | 124 ms | 100 ms |
| Worst frame while zooming | — | 167 ms | 33 ms |
| Worst frame while panning | 17 ms | 17 ms | 33 ms |
| Repaint (paint by kinds), shown | 20 324 ms | 73 ms | 100 ms |
| Repaint, settled | 20 324 ms | 205 ms | — |
| Fold every frame, shown / settled | — / 432 ms | 30 / 301 ms | 100 / 1 000 ms |
| Unfold every frame, shown / settled | — / 19 764 ms | 48 / 758 ms | 100 / 1 000 ms |
| A domain filtered off, shown / settled | — / 424 ms | 15 / 300 ms | 100 / 1 000 ms |
| Longest task during the interactions | — | 625 ms (unfold) | 100 ms |
| `GET /api/v1/list-entities`, every domain | 2 150 ms | 520 ms | — |

Before, Graphviz's Dot laid the model out on the main thread, and a repaint and an unfold laid it all out again. After:

- the layout and the post-pass run in a Web Worker (`src/workers/erdLayout.worker.ts`), with stand-ins for the paint's colours, so one layout and one markup serve every paint and both are kept;
- a repaint sets the colours of the drawing on the page, by slot (`src/lib/erdRepaint.ts`), and lays nothing out;
- a fold and a filter change hide at once what the new picture no longer holds (`src/lib/erdLeaving.ts`);
- a wheel zoom no longer restyles every element of the drawing, the fit measures nothing, the line labels' plates are made when first needed, and the rows' bars from afar are one shape per colour;
- `list-entities` reads every domain in a few queries for the whole request, not a few per domain.

The after column was taken with `--headless`; the window of a shown Chromium that is hidden stops its frames.

Three lines stay above their thresholds: placing a whole new picture of some 130 000 SVG elements blocks the page for about 0.6 s (the first picture and an unfold); a hover's highlight dims some 2 000 groups, which costs about 125 ms to paint; and the one zoom frame that crosses from near to far restyles every text. They are bystrovmaxim/gnomon#87.

## 5 112 tables

Before, the page did not survive the first layout: Chromium closed the tab while Graphviz laid the whole model out on the main thread. A model of this size is not measured again in #85.
