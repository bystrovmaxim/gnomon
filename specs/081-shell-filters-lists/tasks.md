# Tasks: the shell's filters in full and lists lying whole on the canvas

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 — Lists on the canvas (US1)

- [x] T001 `canvas/MaxitorCanvas.tsx`: the viewport measured, `register` and `locate` for anchors, the first fit once the field has a size.
- [x] T002 `content/list.ts`, `content/DataTable.tsx`: the card at full length, the rows in view, the sticking head with the name and counts, the kinds of cell; a list alone lays its own canvas.
- [x] T003 The core's test page: `/panel-test/list` with 10,000 accounts.

## Phase 2 — The three kinds of filter (US2)

- [x] T004 `shell/types.ts`, `shell/address.ts`: choice, text and range; numbers in the address; the count on the phone's button; the long choice's search and folding.
- [x] T005 `shell/Filters.tsx`, `shell/shell.css`: the three kinds; the paint switch opening its section; the phone's sheet with Done.
- [x] T006 `protocol.ts`, `hooks.ts`, `PageFrame.tsx`: `panel.hidden`, `usePanelHidden`.

## Phase 3 — The date pickers (US3, US4)

- [x] T007 `pickers/dates.ts`: bounds, typing, moving bounds, the grid, picking, holding inside the bounds.
- [x] T008 `pickers/DatePickers.tsx`, `pickers.css`, `tokens.css`: the two pickers, the wheels, the phone's sheets; `openDateRangePicker`, `openDatePicker`.

## Phase 4 — Tests and the browser check (US1–US4)

- [x] T009 `tests/dates.test.ts`, `tests/filters.test.ts`; each rule broken and its test seen failing.
- [x] T010 `check-core.mjs`: the list, the filters, the pickers, the phone; the walk of 1.4 on the stand.

## Phase 5 — Documentation, changelog, versions (US5)

- [x] T011 The plugin concept, the README of `@maxitor/panel`, the tutorial's chapters 7 and 13 and the index.
- [x] T012 Versions of `@maxitor/panel`, `@maxitor/tokens`, the core's application; changelogs.
