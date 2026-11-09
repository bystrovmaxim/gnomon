# ErdGraphvizCanvas


<p align="center">
  <a href="https://github.com/bystrovmaxim/gnomon"><img src="https://img.shields.io/badge/license-Apache_2.0-blue" alt="Apache-2.0"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white" alt="React 19"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="../../../../../../README.md"><img src="https://img.shields.io/badge/docs-Maxitor%20client-blue" alt="Maxitor client"></a>
</p>

**Role:** Graphviz WASM render surface for merged ERD domain payloads: layout presets, pan/zoom, domain legend and neighborhood toggle composed from `@/components/ui/*`.

## Files

| File | Responsibility |
|------|----------------|
| `ErdGraphvizCanvas.tsx` | SVG output, toolbar wiring, domain merging. |

## The two views

The bundle carries every resource of the graph with its colour and name (`resource_ids`, `resource_colors`, `resource_labels`), as the server gives them, and whether the graph says where entities lie (`storage_known`); each table carries every resource that keeps it, `resource_ids` (spec 070). The view comes from `useErdResourceSettings` (`@/lib/erdResourceSettings`), with the resources switched off and the folded frames — page settings a room shares; a graph that does not say where entities lie is drawn in the logical view whatever the setting says. `ErdModelPill` switches the view at the top of the canvas.

Both views draw their frames in all five layouts. Under Dot a frame is a cluster. Neato, FDP and Circo cannot frame reproducibly, so `erdCompose` (`@/lib/erdCompose`) composes them: each frame's tables laid out alone — a specialization block as one fixed-size unit, its own tables laid out inside it — the frames laid out as boxes with one line per pair of linked frames, every table moved to its frame's place, and each frame written as a `g.cluster` with the Dot frame's id, title and rounded outline. The cards' markup comes from one Dot layout of the whole model, the same every time; FDP lays out on an instance of its own (`loadGraphvizWasmFor`). The layout reruns when **Boundary** switches the logical view's frames off or on even where the DOT stays the same, and the room's layout digest carries the view.

- **Logical:** `buildDotSource` gets `model: "logical"` and the domains' names and colours. Each domain's tables go into one `cluster_domain_<n>` (n by sorted domain qualname) named `dc:<domain>`, rounded, in the domain's colour while domains paint, inside an invisible `_room` cluster with a 36 pt margin. With Boundary off it gets no `model` and draws no frame, and folds nothing: the folds wait in the address for the frames to come back. Switching Boundary replaces the old drawing by the new one in one step, fitted to the new one.
- **A frame's title** (`frameTitleLabel`) is one HTML label: a 16 pt slot for the disk (`fdd<n>` a domain's, `fdr<n>` a resource's), a 6 pt gap and the name in Helvetica, whatever the drawing's font, so the width Graphviz measures is the width the browser draws; a folded box adds its counts under the name. `addFrameIcons` puts the disk where Graphviz laid the slot out, its middle on the middle of the name's capitals.
- **A specialization block** says its own id, `sg:<group>@<frame>`: Graphviz would lend it the id of the frame round it. `frameOfCluster` reads the frame a block lies in, so a click, a hover and a room treat the block's empty space as the frame's.
- **Unlinked parts** (`dotWrap`): Dot puts every part of a drawing no line joins on the same ranks, one column. Under Dot those parts — inside each frame, and frames across the drawing — are wrapped into columns by invisible points, the drawing about as wide as tall.
- **Physical:** `physicalDrawing` (`@/lib/erdViews`) turns the tables into **copies** before anything is drawn — one per resource that keeps a table and is switched on, id `<entity>␟<resource>`, and one in "Not stored", `<entity>␟`, for a table no resource keeps — and each relation into a line per pair of copies, marked `across` when its ends lie in two resources; specialization containers follow their tables. Every lookup that reads a drawn table's id — cards, hover, rooms, Diff marks, folds — works on copies as it works on tables, and `copyEntity` names the entity a copy stands for. `buildDotSource` gets `model: "physical"`, the resources to frame and the copies to join: each resource the diagram frames — every one of the model on the ERD of all domains, those of its tables on the ERD of one domain (`resourcesOfDiagram`, #78) — is a `cluster_resource_<n>` named `rc:<resource>` (spec 064), headed by its name, holding its copies directly — no frame inside a frame — or an invisible point when it keeps nothing; "Not stored" is the last, dashed. A copy of a table kept N times says `×N`; its copies are joined by dashed `se<k>_<i>` lines that do not rank the layout; a line `across` two databases is dashed. Hovering a copy lights every copy of its table.

## A large model stays live

The picture is made off the page (#85). `layOutErd` (`@/lib/erdLayout`) builds the DOT, lays it out — Dot's clusters or the composer — and runs the post-pass, all text; `erdLayout.worker.ts` (`src/workers`) runs it in a Web Worker, and `layOutErdOffPage` (`@/lib/erdLayoutClient`) asks it, so the drawing on the page stays live while a model of a thousand tables is laid out. Every colour the paint gives — a table's header, frame, zebra and name, a kind glyph, a frame's outline and disk — enters the picture as a **stand-in** (`painted(slot, colour)`, `withPaintStandIns`), the same in every paint, so one layout and one markup serve every paint and the worker keeps both. FDP is the exception: in this WebAssembly build it lays some models out two ways when their colours are stand-ins and one way in the paint's own colours, so under FDP the picture is made in those and a repaint lays it out again.

- **A repaint** lays nothing out: the drawing on the page takes its new colours by slot (`erdPaintColours`, `standInColoursOf`) before the next frame, on the attributes `indexPaint` found when it was placed (`paintDrawing`, `@/lib/erdRepaint`); the worker's picture confirms them.
- **Each view keeps its own** layout and tables' collapse: the logical view in `layout`, `collapsed` and `except`, the physical one in `physical_layout`, `physical_collapsed` and `physical_except`.
- **A step through changes** lights and centres what changed; a change inside a folded frame stands on the frame's box and opens its card there. The highlight of what the pointer rests on is held while the pointer is on its card.
- **A fold or a filter change** shows at once: what the new DOT no longer declares, and every line with an end among it, leaves the drawing on the page (`hideWhatLeaves`, `@/lib/erdLeaving`); the new picture replaces it when it is laid out. A room follower applies a received setting the same way.
- **The drawing's own work is light:** a wheel zoom covers the drawing with a clear sheet instead of switching its pointer events, the fit reads the drawing's own box, a line's label plates are made when it is first lit or while the page is idle (`addEndLabelBadgesLazily`), a hover reads the zoom it is shown at rather than where a row is (`seenFromAfar`), and from afar the bars of a table's rows are one shape per colour.

`client/scripts/measure-erd.ts` measures it; `specs/071-erd-frames-folding/measurements.md` keeps the numbers before and after.

A framed drawing fits Graphviz's own box (`fitToViewBox`), which holds the frames and their names and is the same in every browser, so a follower never glides after a new picture; a drawing without frames fits its tables and lines. `scripts/check-erd-logical-view.ts` and `scripts/check-erd-physical-view.ts` check both drawings on the real WASM build.

## A card's fills follow its contour

Graphviz draws a table card as an HTML-like label: the outline is a rounded rectangle
(`STYLE="ROUNDED"` on the `<TABLE>`), while the header band and the row tints are plain rectangles
painted inside it. Their square corners therefore stand outside the rounded corners of the card —
two tabs at the top, two more at the bottom whenever the last row is tinted.

The post-pass closes that gap before the markup reaches the page: the string `gv.layout(...)`
returns goes through **`containNodeFills`** from **`@/lib/containNodeFills`**, which

- reads each node group's contour from the backdrop path the renderer emits — its bounds, and the
  corner radius from the path's first `M`;
- measures the **inset** the fills already keep from that contour (one unit today), which is also
  where a fill now stops, so the hairline between a fill and the stroke is exactly what it was;
- inserts one `<clipPath>` per card holding the contour shrunk by that inset as a rounded `<rect>`,
  and points every fill of the card at it.

The step is **markup-level and pure**, not a DOM pass: the check that guards it runs the very same
function in plain Node. It changes the drawing by insertion only — strip the clips and the markup is
byte-identical — and it is a no-op for a node that is not a card, which is why the lifecycle
automaton and the use-case diagram are untouched.

The geometry is derived, never assumed: a constant for the radius or the inset would be a defect the
day the renderer changes either. The check lives in
**`packages/maxitor/maxitor-web/client/scripts/check-erd-card-containment.ts`** and runs in the repository's
closing check run; its printed `info` line says how many cards in the fixtures still show the defect
before the pass, which is a measurement, not an assertion.

## The table style

A table looks as on screen 21 of the rooms mockup (spec 028, FR-110 … FR-115): a header 30 high in the
domain colour, flush with the frame and sharing its rounded top corners, with the kind icon and the
entity name white, bold and at the left; the frame in the domain colour around a white body; rows 20
high, every second one tinted with the domain colour at 6 %; `PK` bold rust-red and `FK` bold slate in a
column of their own before the field name; the type smaller and grey on the right; grey lines, a
generalization dashed with a filled arrowhead. Associations keep their crow's-foot and bar ends: they
carry the cardinality. `buildDotSource` writes the style, `placeKindIcons` places icon and name, and
**`packages/maxitor/maxitor-web/client/scripts/check-erd-table-style.ts`** asserts each rule on the real WASM
Graphviz output in the closing check run.

## A dictionary's values, and a field that references one

A closed dictionary is an ordinary entity node whose payload carries two extra things: `entity_kind`
identifies the kind, and `values` is the list of declared codes, labels and descriptive properties in declaration order. The card
draws those values as rows under the fields, with no PK/FK marker and a green tint, so a reader sees
what the dictionary can hold without opening it. Each value's `properties` is an array of `{name, value}` text rows; these appear beneath the label, with HTML escaping applied to both names and values.

A field whose type is a dictionary carries `reference_qualname`. The card shows the dictionary's
short name after the type in teal, prefixed with an arrow: the field is not a string, it is a reference,
and the payload names the target.

## Render the server's group label once

The group response contains a complete `label`, for example
`pressing (by VinylRecordKindEnumEntity)`. `buildDotSource` escapes and displays that text;
it does not append a dictionary name. `dictionary_label` is absent from the current
`ErdGroup` type and response schema. It still exists in the underlying graph metadata,
which the server reads to produce the label. A stale extra field on an old payload must
not cause the name to be appended again.

The property list is a display representation: strings remain text and other JSON values
arrive as JSON text. Empty properties produce no extra lines. `check-erd-dictionary-values.ts`
checks escaping and actual SVG rendering; `check-erd-group-label.ts` checks that a complete
label remains unchanged, including with a stale dictionary_label beside it.

Nothing here knows a domain's vocabulary: every name comes from the payload, and a model that declares
no dictionary has an empty `values` array, and ordinary scalar fields have no `reference_qualname`.

## Two versions at once (spec 038)

In Diff the bundle holds A's and B's slices merged and marked (`@/lib/erdDiff`, loaded by
`loadErdDomainsBundle` when `@/api/client` names an older version): every table, row and line carries
`diff` — `added`, `removed`, `changed` or `unchanged`. `buildDotSource` draws added green, removed red,
changed amber, each with its sign (`+`, `−`, `~`) as well as its colour; a removed row is struck through; a
type that changed reads `~~old~~ → new` when it fits; a field that now points at another table is one amber
line, solid to where it points now, with a thin dashed line (`rp<k>`) to where it pointed. `drawErdCards`
fades the tables that did not change and dashes the frame of a removed one. The drawn diagram's counts go to
the version button through `@/lib/diffCounts`; when they are all zero the diagram is drawn unmarked, as One
draws it. `scripts/check-erd-table-style.ts` checks each mark on the real WASM build.
