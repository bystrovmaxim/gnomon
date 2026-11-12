# Tasks: the time scale — one moment for the screen, its comparison panels, and the template's pages walked on it

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: requested by the spec (FR-052): unit tests in `node:test` and `pytest` for every phase, the browser check at the end.

**Organization**: the phases are the issue's 11 phases, one commit each; a task names the user story it serves. After each phase only that phase's tests run; the closing check run is in phase 11.

Paths: `CORE` = `packages/maxitor/maxitor-core/web`, `PANEL` = `packages/maxitor-panel`, `TOKENS` = `packages/maxitor-tokens`, `SDK` = `packages/maxitor-plugin-sdk`, `TPL` = `packages/maxitor-plugin-template`, `GV` = `packages/maxitor/maxitor-web/client/src` (the graph viewer, the reference).

## Phase 1: The frame and the canvas as the graph viewer draws them (issue 1.3, US5)

**Goal**: the canvas's surface, the comparison's marks, the tree's pictograms, the filter's disks, the account's circle, the tree's head, the crumbs, Back, the collapsed tree.

**Independent test**: open Draft, Published and the test page on the stand; compare with the graph viewer and `archive/makets/085-entered-tree-node`; enter Notes, open Published, press Back.

- [x] T001 [P] [US5] Set `--mx-canvas: #f4f5f7`, `--mx-dot: rgba(160, 168, 180, 0.42)`, `--mx-dot-step: 20px` in `TOKENS/tokens.css` and give `.mx-canvas` `background-color: var(--mx-canvas)` in `PANEL/src/canvas/canvas.css`
- [x] T002 [P] [US5] Write `PANEL/src/compare/marks.css`: `[data-change="added|changed|removed"]` frame colours `#16a34a`, `#d97706`, `#dc2626` and the halo `box-shadow: 0 0 44px 34px` of the colour at 0.16; `[data-paint="changes"] [data-change="unchanged"] { opacity: .32 }`; export it from `PANEL/src/index.ts` with `panel.css`
- [x] T003 [P] [US5] Replace the hand-drawn `Icon` set in `CORE/components/marks.tsx` with the SVG paths of `GV/components/navigation/LeftSidebar/SidebarToggleIcon.tsx` and of Material's `ChevronRight`, `ExpandMore`, `ChevronLeft` and outlined node icons (`DescriptionOutlined`, `FolderOutlined`, `SettingsOutlined`), 16 px, opacity 0.88; name the sources in the file's head
- [x] T004 [P] [US5] In `PANEL/src/shell/shell.css`, fade only the label of `.mx-filter-row.absent` to 0.4, keep the disk; `.mx-filter-row.off` fades whole to 0.42; draw disks with `statusDiskUri` of `GV/lib/erdFilterPresence.ts` ported to `PANEL/src/shell/disks.ts` (20 px, 1 px ring `rgba(0,0,0,.12)`)
- [x] T005 [P] [US5] Fill `.mx-avatar` in `CORE/components/frame/frame.css` and `TopRow.tsx` with the person's colour (`paletteOf(account.id)` of `@maxitor/tokens`) and white initials
- [x] T006 [US5] In `CORE/components/frame/TreeHead.tsx` and `frame.css`: the head's buttons on the level's left edge (head padding so the icon's left equals `.mx-level-icon`'s); Back not rendered at the root (no `off` span); collapsed, only the expand button
- [x] T007 [US5] In `CORE/components/frame/Frame.tsx`: crumbs = the organization then the entered levels only (no page title), each after `›`; Back pops the deepest level and pushes the address of that level's page — the entered node's page, else `/w/<code>`
- [x] T008 [P] [US5] Tests: `CORE/tests/levels.test.ts` (crumbs without the page, Back's address at a level and at the root), `PANEL/tests/marks.test.ts` (the marks' CSS holds the values of T002), `PANEL/tests/filters.test.ts` (an absent row keeps its disk)

**Checkpoint**: phase 1 tests green; commit "feat(core): the frame and the canvas as the graph viewer draws them (#98, phase 1)".

## Phase 2: The template's Draft and Published as their accepted mockup draws them (issue 1.4, US6)

**Goal**: Published's head with `Your draft: N`; before the first publication; no counters; Published after publishing; zoom-only bar; the filters Written and Last change.

**Independent test**: on the stand, with no publication open Published; publish; filter by Written and Last change; compare with `archive/makets/084-notes-draft-published`.

- [x] T009 [P] [US6] `TPL/web/app/[org]/notes/revision.tsx`: `RevisionCard` as the mockup's head — chip `vN`, bold title, one line `<person> published it <when> · release <name> · <n> notes by <m> authors · read only`, and `Your draft: N` (prop `waiting`, `onOpenDraft`) at its end; the empty card says nothing is published yet and holds the same button
- [x] T010 [US6] `TPL/web/app/[org]/items/[item_id]/published/PublishedView.tsx`: drop the loose `.nt-waiting` button and the `VIEWS` bar; the empty state "the Authors filter hides every published note" only when a publication exists and the filter hides all; filters Authors, Written (`written`), Last change (`changed`) as ranges of the shell; table columns Written and Last change
- [x] T011 [US6] `TPL/web/app/[org]/items/[item_id]/DraftView.tsx`: after a successful publication close the dialog and `panelRouter.push({ path: \`${panelPath}/published\`, query: {} })`; bottom bar zoom only
- [x] T012 [P] [US6] `SDK/src/maxitor_plugin_sdk/date_bounds.py`: `parse(value, today) -> (date | None, date | None)` for `YYYY-MM-DD..YYYY-MM-DD`, `now-30d..now`, `now/M`, `now-1y/y`, open bounds; the same table of cases as `PANEL/src/pickers/dates.ts`
- [x] T013 [US6] `TPL/src/maxitor_notes/actions/list_published_notes_action.py` and `storage/notes_storage.py`: params `written` and `changed` (optional, max 64), filtering by the note's `created` and `updated` through `date_bounds`
- [x] T014 [P] [US6] Tests: `SDK/tests/test_date_bounds.py`, `TPL/tests/test_notes_actions.py` (filters), `TPL/web/tests/notes.test.ts` (head line, empty card, no loose button)

**Checkpoint**: phase 2 tests green; graph files rebuilt; commit.

## Phase 3: The scale in the top row (issue 1.1, items 1–2, US1)

**Goal**: the pill and the card, now, a chosen moment, `panel.watermark`, `panel.location`, no moment later than the watermark.

**Independent test**: open the pill on the test page; choose a moment; reload; step ‹ ›; an `at` past the watermark refused.

- [x] T015 [P] [US1] Port `GV/components/history/VersionButton/VersionButton.tsx` to `CORE/components/scale/Pill.tsx` + `scale.css` (arrows, moment label, live dot, counts slot), keeping sizes and colours
- [x] T016 [P] [US1] Port the card frame of `GV/components/history/VersionPicker/VersionPicker.tsx` to `CORE/components/scale/ScaleCard.tsx` (head: title, subtitle, switch of small points slot, "i", modes; hangs 11 px under the pill, right edges aligned; a sheet on a phone)
- [x] T017 [P] [US1] `CORE/components/scale/geometry.ts`: time ↔ x, presets 1 min, 10 min, 1 h, 1 d, 7 d, 30 d, All, bar width from a week to a second, the watermark and the hatched future
- [x] T018 [US1] Wire the pill into `CORE/components/frame/TopRow.tsx` and `PageFrame.tsx`: `at` in the address, `panel.location` with `at`, `panel.watermark` on watermark moves, refusal of `at` later than the watermark with the page's message and a link to now
- [x] T019 [US1] Stepping: port `GV/lib/stepKeys.ts` to `PANEL/src/keys.ts`, shared by the core's frame and the page; the pill's arrows and Shift + ← → step changes (or milestones); `panel.keys` from the page in `PANEL/src/protocol.ts` and `PanelProvider.tsx`
- [x] T020 [P] [US1] Tests: `CORE/tests/geometry.test.ts`, `CORE/tests/moment.test.ts` (refusal past the watermark, kept to the minute), `PANEL/tests/protocol.test.ts` (`panel.keys`)

**Checkpoint**: commit.

## Phase 4: The histogram, the lane, the cards, the legend, the cache (issue 1.1, items 4–8, US2)

**Goal**: history format 2 and everything the setup drives.

**Independent test**: Published's and the test fixtures' scales and legends; an undeclared kind named in the console.

- [x] T021 [US2] `PANEL/src/protocol.ts`: `PageHistory` format 2 per [contracts/page-history-2.md](contracts/page-history-2.md) — `kinds` (keys `^[a-z][a-z0-9_]{0,31}$`, at most 12; tone `neutral|purple|blue|green|amber|red`, look `filled|hollow|dashed`, lead `solid|dashed`, `term` ≤ 40, `def` ≤ 200), `small` ≤ 160, `flag` ≤ 160, `actions` (`on: "milestone"`, `kinds`, `title`, `action`, `ask`); `legend` leaves; `checkHistory` drops and names
- [x] T022 [P] [US2] `SDK/src/maxitor_plugin_sdk/schemas/history-2.schema.json` (milestone `{ id, at, ref, title, kind, small?, flag?, comment?, link?, opens? }`, `kind` a string); remove `history-1.schema.json`; `HISTORY_FORMAT = 2` in `SDK/src/maxitor_plugin_sdk/history.py`
- [x] T023 [US2] `CORE/components/scale/Histogram.tsx`: port the bars of `GV/components/history/VersionTrack/VersionTrack.tsx` — drag-zoom, wheel/pinch around the pointer, Shift-wheel and sideways swipe move, presets, hover list of a bar's changes
- [x] T024 [US2] `CORE/components/scale/Lane.tsx`: points from the setup's kinds (tone, look, lead), small only with `small`, flags only with `flag`, the hover ring (`r + 3`, `#64748b`), the switch of small points; `CORE/components/scale/accept.ts` drops and `console.warn`s a milestone of an undeclared kind, `small` without `small`, `flag` without `flag`
- [x] T025 [US2] `CORE/components/scale/Tip.tsx`: port `GV/components/history/VersionTrack/VersionTip.tsx` drawing the blocks `line`, `badge`, `title`, `text`, `fields`, `person`, `chips`, `warn` from data; `opens` opens a page without changing `at`
- [x] T026 [US2] `CORE/components/scale/Legend.tsx`: port `GV/components/history/VersionPicker/TrackLegend.tsx`, rows from the setup per the contract's table; `CORE/components/scale/Comments.tsx`: the comment of the milestone in force, in a comparison A, B and those between
- [x] T027 [US2] `CORE/components/scale/cache.ts`: answers keyed by (organization, node, parameters, bar width, bar start) kept below the watermark; a zoom asks only the missing bars and the right edge
- [x] T028 [US2] Test page fixtures in `CORE/app/(panel)/panel-test/[code]/[[...path]]/TestPage.tsx`: bars alone, milestones alone, both, the graph's kinds with `small` and `flag`, one milestone of an undeclared kind
- [x] T029 [P] [US2] Tests: `PANEL/tests/history.test.ts` (format 2, drops), `CORE/tests/legend.test.ts` (rows from the setup), `CORE/tests/cache.test.ts`, `SDK/tests/test_history.py` (format 2 schema)

**Checkpoint**: commit.

## Phase 5: Diff and Side by side, the panels, the anchors (issue 1.1, items 3, 9–11, US3, US4)

**Goal**: the modes, the context, Track through anchors, the list's rows, the change card beside a change, the keys.

**Independent test**: the screens 1.1–1.9, 2.1–2.17, 3.1–3.4 of `specs/079-time-scale/mockup` on the test page.

- [x] T030 [US3] Modes in `CORE/components/scale/ScaleCard.tsx` and the address: `mode`, `from`; A and B handles; only the page's offered modes; an unoffered mode opens `at` as one moment
- [x] T031 [US3] `PANEL/src/protocol.ts`: `panel.location` gains `against`, `side`, `milestone`; `PanelProvider.tsx` exposes them in `useMoment()`/`useContext`
- [x] T032 [US3] `CORE/components/frame/SidePanels.tsx`: port `GV/components/diagrams/SideBySide/SideBySide.tsx` and `HalfNote.tsx` — two panels with their heads (A brown, B blue, their moment), Track on B, one panel with an A / B switch on a phone
- [x] T033 [US4] `PANEL/src/canvas/anchors.ts`: chain under the pointer (`panel.pointer`, once per frame), `panel.choose`, obeying `panel.mark` / `panel.bring` (deepest held anchor, keep zoom, glide 450 ms) and answering `panel.shown`; wire into `MaxitorCanvas.tsx`
- [x] T034 [US4] `PANEL/src/content/DataTable.tsx` and `list.ts`: keep anchors of all rows; bring a row into view by its anchor; `panel.shown` with `hidden` for a row the filters leave out
- [x] T035 [US4] Core relay in `CORE/components/frame/SidePanels.tsx`: pointer → mark on the other panel; choose → bring; the notes of [contracts/panel-protocol-time.md](contracts/panel-protocol-time.md) from `panel.shown`; on a phone bring on the A / B switch
- [x] T036 [US3] Shift + ↑ ↓ relayed as `panel.step`; comments under the scale for A and B
- [x] T037 [P] [US3] [US4] Tests: `PANEL/tests/anchors.test.ts` (deepest held, notes), `PANEL/tests/protocol.test.ts` (new messages and limits), `CORE/tests/sidepanels.test.ts` (relay rules)

**Checkpoint**: commit.

## Phase 6: `DiffCard`, `StatusIcon`, `VersionsBetween`, `ChangeStepper` in `@maxitor/panel` (issue 1.1, items 11–12, US3)

- [x] T038 [P] [US3] Port `GV/components/history/DiffCard/DiffCard.tsx` and `StatusIcon.tsx` to `PANEL/src/compare/DiffCard.tsx`, `StatusIcon.tsx`: title, StatusIcon 14 px, "Added in B", property rows path | struck before → after, groups (600, `#475569`), part = coloured sign + label with rows; Escape and click outside close; a stepper click moves on
- [x] T039 [P] [US3] Port `GV/components/history/VersionsBetween/VersionsBetween.tsx` to `PANEL/src/compare/VersionsBetween.tsx`
- [x] T040 [US3] Port `GV/components/diagrams/MapViewer/ChangeStepper.tsx` to `PANEL/src/compare/ChangeStepper.tsx`: arrows, list grouped by object with coloured text signs, step brings and opens the card
- [x] T041 [US3] `PANEL/src/shell/Actions.tsx`: the row in the panel's top right corner — stepper first, then the page's actions; actions when B is now (`actionsShown` by `at`), actions declared `on: "milestone"` only when `milestone` is set and no comparison; on a phone above the zoom
- [x] T042 [US3] `panel.counts` from the page to the pill
- [x] T043 [P] [US3] Tests: `PANEL/tests/compare.test.ts` (grouping, the card's rows), `PANEL/tests/shell.test.ts` (the row, milestone actions)

**Checkpoint**: commit.

## Phase 7: The check of 1.2 on the test page (US1–US4, US8)

- [x] T044 [US8] Extend `CORE/scripts/check-core.mjs` with a walk of `specs/079-time-scale/mockup` screens on the test page, desktop and 375 px, a screenshot per screen
- [x] T045 Run the walk on the local stand; fix what differs

**Checkpoint**: commit.

## Phase 8: The past on the template's pages (issue 1.5, US7)

- [x] T046 [US7] `TPL/web/app/[org]/items/[item_id]/published/PublishedView.tsx` and `DraftView.tsx`: read at `at` from `useMoment()`; no writing, editing, deleting in the past or in a comparison; a moment past the watermark leads to now
- [x] T047 [US7] Comparison mode on both pages: the filter adds Changes, paint by change default, `data-paint`, the camera kept between moments
- [x] T048 [P] [US7] Tests: `TPL/web/tests/notes.test.ts` (read-only past)

**Checkpoint**: commit.

## Phase 9: Comparing on the template's pages (issue 1.5, US7)

- [x] T049 [US7] Passport `TPL/src/maxitor_notes/maxitor-plugin.yaml` keeps `compare: [diff, side_by_side]`; Draft's history narrows nothing: Diff and Side by side
- [x] T050 [US7] Both pages draw from `at`, `against`, `side`: Diff and the two sides with `data-change` on each note, `data-room-anchor = note:<id>`
- [x] T051 [US7] A note's differences for `DiffCard` (its `body` before and after) and `ChangeStepper` grouped by the item; `panel.counts`
- [x] T052 [P] [US7] Tests: `TPL/web/tests/notes.test.ts` (one test per row of the context table)

**Checkpoint**: commit.

## Phase 10: The template on the scale, Roll back (issue 1.5, 1.4 item 7, US7)

- [x] T053 [US7] `TPL/src/maxitor_notes/schema.yaml`: `revision.back_revision: {type: integer, nullable: true, description: 'The number of the revision a rollback brings back; empty for a revision published from a draft.'}`
- [x] T054 [US7] `TPL/src/maxitor_notes/history/list_note_history_action.py`, `entities/milestone_entity.py`, `storage/notes_storage.py`: milestones format 2 — `kind` `published` or `rollback`, no `minor`, no `release` flag, no draft milestone
- [x] T055 [US7] `TPL/src/maxitor_notes/history/note_milestone_card_action.py`: badge `Published` / `Rolled back`, ref, time, title, author, notes held and what changed, `to v<back>` for a rollback
- [x] T056 [US7] `TPL/src/maxitor_notes/actions/rollback_publication_action.py` + storage method per [contracts/rollback.md](contracts/rollback.md); route in `app.py`; graph files
- [x] T057 [US7] Pages' setups per the contract's table: Published `read`, `milestones`, `card`, `kinds`, `actions` (Roll back); Draft `read: list_note_draft`, the same kinds, `compare: ["diff"]`; the Roll back dialog (title `Back to vN`, comment, what changes) in `PublishedView.tsx`
- [x] T058 [P] [US7] Tests: `TPL/tests/test_revisions.py` (rollback: new publication, history kept, refusals), `TPL/tests/test_history_data.py` (format 2 milestones and cards)
- [x] T059 [US7] [US8] Extend `CORE/scripts/check-core.mjs` with the walk of `specs/074-notes-history/mockup` on the stand, desktop and 375 px

**Checkpoint**: commit.

## Phase 11: The closing check run, documentation, changelog, versions

- [x] T060 Closing check run `scripts/check_run.py` to zero
- [x] T061 [P] Docs: `packages/maxitor/README.md` scale section and a how-to; `docs/plugins/history.md`, `docs/plugins/compatibility.md`; `docs/plugins/concept.md` reserves `mode` and `from`
- [x] T062 [P] Tutorial: `docs/plugins/tutorial/10-history-on-the-scale.md`, `11-comparing.md`, `index.md` naming #98, `09-now-and-the-past.md` next link, `13-tests.md` grown
- [x] T063 Versions: `version.toml` and package versions of the core, `@maxitor/panel`, `@maxitor/tokens`, the SDK, the template (passport `version`, `requires.maxitor`)
- [x] T064 Changelogs: one article per package in plain words

## Dependencies

Phase 1 → 2 (disks, canvas) → 3 → 4 → 5 → 6 → 7; phases 8–10 need 3–6; 11 last.

## Parallel examples

Phase 1: T001–T005 in parallel. Phase 4: T022 with T023. Phase 6: T038 with T039.

## Implementation strategy

Phase by phase, each committed after its own tests; the browser walks in phases 7 and 10; the closing run in phase 11.
