# Research: the time scale

## R1. Port the graph viewer's history components, never re-draw them

- **Decision**: port `VersionButton`, `VersionPicker`, `VersionTrack`, `VersionTip`, `TrackLegend`, `SideBySide`, `HalfNote`, `DiffCard`, `StatusIcon`, `VersionsBetween`, `ChangeStepper` and `lib/stepKeys.ts`, `lib/halfPicking.ts` from `packages/maxitor/maxitor-web/client/src` into the core and `@maxitor/panel` as React with CSS on `@maxitor/tokens`, keeping their sizes, colours, texts and behaviour; each file names its source in its head.
- **Rationale**: the maintainer accepted the graph viewer's look as the standard; the core and `@maxitor/panel` carry no MUI, and a plugin's page must not pull MUI in.
- **Alternatives**: importing MUI into the core (a second design system in the frame; refused); drawing anew from the mockup (the mockup is the target, the code is the source; refused).

## R2. History format 2: the page's own vocabulary of points

- **Decision**: `PageHistory` gains `kinds: Record<string, { tone, look, lead, term, def }>`, `small?: string`, `flag?: string`, `actions?: [{ on: "milestone", kinds, title, action, ask }]`; `legend` leaves. A milestone becomes `{ id, at, ref, title, kind, small?, flag?, comment?, link?, opens? }`, `kind` one of the page's keys. `schemas/history-2.schema.json` replaces format 1; the SDK's `HISTORY_FORMAT` is 2.
- **Rationale**: one declaration feeds the lane, the card's badge, the switch of small points and the legend, so they cannot disagree (spec, FR-006 – FR-010); a closed enum of kinds made every plugin's points look like the graph's.
- **Alternatives**: keeping a per-milestone `point` (the legend would list kinds no point uses; refused); keeping format 1 beside 2 (no plugin but the template answers history; refused).

## R3. The context of a comparison travels with the location

- **Decision**: `panel.location` carries `at`, `against`, `side` and `milestone`; the page derives its comparison from them and shows an action declared `on: "milestone"` only when `milestone` is set and no comparison is chosen.
- **Rationale**: the page draws one canvas from its context and never knows the panels (FR-019); the action's visibility is decided by the core, which knows the milestones.
- **Alternatives**: a separate `panel.context` message (two messages that can disagree; refused).

## R4. Anchors through the canvas, relayed by the core

- **Decision**: the page sends `panel.pointer { chain }` and `panel.choose { chain }`; the core sends `panel.mark { chain | null }` and `panel.bring { chain }`; the page answers `panel.shown { anchor, held, hidden, inView }` so the core can write its note. The canvas, the list and the table implement them; a plugin only sets `data-room-anchor`.
- **Rationale**: a place on one canvas means nothing on the other; only identities pass (FR-024 – FR-029), as `lib/halfPicking.ts` does today.
- **Alternatives**: the core reading the page's DOM (cross-frame; refused).

## R5. The halo and the fading as data attributes

- **Decision**: `@maxitor/panel`'s `marks.css` styles `[data-change]` — `added`, `changed`, `removed` get the frame colour and a halo (`box-shadow: 0 0 44px 34px <colour at .16>`, the CSS equal of a 40 px rect blurred by 22); `unchanged` fades to 0.32 while the document carries `data-paint="changes"`.
- **Rationale**: one rule for a note's card, a table and a row; the values are `lib/erdPostPass.ts`'s.
- **Alternatives**: an SVG filter per element (does not apply to HTML cards; refused).

## R6. The canvas's surface and the tree's pictograms

- **Decision**: `--mx-canvas: #f4f5f7`, `--mx-dot: rgba(160, 168, 180, 0.42)`, `--mx-dot-step: 20px`, and `.mx-canvas` takes `background-color: var(--mx-canvas)`; the tree's `Icon` set in `components/marks.tsx` takes the SVG paths of `SidebarToggleIcon` and of Material's `ChevronRight`, `ExpandMore`, `ChevronLeft` and outlined node icons (Apache-2.0), at 16 px, opacity 0.88.
- **Rationale**: `ErdGraphvizCanvas` and `LeftSidebar` are the reference (spec, Clarifications).

## R7. Back through the address, crumbs from the entered sections

- **Decision**: Back pops the deepest entered level and pushes the address of that level's page — the entered node's page, else the organization's home `/w/<code>`; the crumbs are `pageLevels` without the page title. Back is not drawn at the root; the collapsed tree renders the expand button only.
- **Rationale**: the tree, the crumbs, the address and the page must show one place (spec, FR-040 – FR-041).

## R8. Rollback as a publication

- **Decision**: `RollbackPublicationAction` (`POST /revisions/rollback`) takes `item_id`, `to_revision`, `title`, `comment`; in one transaction it reads the notes of `to_revision` and writes them as the next revision with `back = to_revision`, closing and opening note versions as a publication does; the person's draft is untouched.
- **Rationale**: nothing is erased; v4 and v5 stay readable (spec, FR-051).

## R9. Date filters read by the server

- **Decision**: `maxitor_plugin_sdk.date_bounds.parse(value, today)` reads the address's form (`2026-09-01..2026-09-30`, `now-30d..now`, `now/M`) as `@maxitor/panel`'s `pickers/dates.ts` writes it; `ListPublishedNotesAction` and the bars filter by `created` and `updated` with it.
- **Rationale**: the bars count what the page shows (spec, 1.5); one parser per language, both tested against the same table of cases.

## R10. Tests and the browser check

- **Decision**: unit tests in `node:test` and `pytest`; the browser check extends `check-core.mjs` with a walk of both mockups' screens on the stand, desktop and 375 px, and a screenshot per screen attached to the pull request.
- **Rationale**: CI cannot run the browser; rule 71 runs it beside CI.
