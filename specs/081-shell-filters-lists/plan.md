# Implementation Plan: the shell's filters in full and lists lying whole on the canvas

**Branch**: `feature/issue-115-shell-filters-lists` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/081-shell-filters-lists/spec.md`; issue bystrovmaxim/gnomon#115; the look in `specs/079-time-scale/mockup/index.html`, screens 2.1–2.16.

## Summary

`@maxitor/panel` grows three things. `DataTable` becomes a list lying whole on the canvas: a card at full length in canvas units, only the rows in the camera's view drawn, the head sticking to the top of the view, every row's anchor known to the canvas. The shell's filters get three kinds — a choice (a long one with a search and "N more"), a text, a range of numbers or dates — written into the address. Two date pickers, `openDateRangePicker` and `openDatePicker`, are functions a plugin calls; they are ported from the mockup into React with `@maxitor/tokens`. A page tells the core what its filters hide with `panel.hidden`. The core's test page shows a list of 10,000 rows with every kind of filter.

## Technical Context

**Language/Version**: TypeScript, React 19, Next.js 16 (the core's application and plugins' pages).

**Primary Dependencies**: `@maxitor/panel`, `@maxitor/tokens`; no new package.

**Storage**: none; the address is the state.

**Testing**: `node --test` over the pure modules (`dates.ts`, `list.ts`, `address.ts`); the core's browser check `check-core.mjs` on the local stand, a desktop and a phone.

**Constraints**: every colour and size from `@maxitor/tokens` (`check-tokens.mjs`); content never pinned to the screen; nothing changes before Apply.

## Constitution Check

- **One term, one name**: list, filter section, paint switch, bound, ready stretch, date range picker and date picker — the same in the spec, the code and the docs.
- **Spec ahead of code**: spec 081 with its clarifications; issue #115 carries the five phases.
- **Measurement**: SC-001 – SC-006 each name a unit test or a browser scenario.

Post-design: no violation.

## Project Structure

```text
packages/maxitor-panel/src/
├── canvas/MaxitorCanvas.tsx   # the viewport, the anchors' registry, the fit once the field has a size
├── content/list.ts            # the list's geometry: rows in view, the sticking head, a row's place
├── content/DataTable.tsx      # the list on the canvas, its kinds of cell
├── pickers/dates.ts           # bounds as written, typing, moving bounds, the grid, picking
├── pickers/DatePickers.tsx    # the two pickers and the functions that open them
├── pickers/pickers.css
├── shell/Filters.tsx          # the three kinds, the phone's sheet
├── shell/address.ts, types.ts # the kinds' types and their address values
├── hooks.ts, protocol.ts      # usePanelHidden and panel.hidden
packages/maxitor-tokens/tokens.css      # the pickers' tokens, --mx-mono
packages/maxitor/maxitor-core/web/
├── components/frame/PageFrame.tsx      # keeps a page's hidden anchors
├── app/(panel)/panel-test/.../TestPage.tsx   # the list of 10,000 rows
└── scripts/check-core.mjs              # the browser scenarios of 1.4
```

## Phases (as in the issue)

1. Lists on the canvas, the test page's list.
2. The three kinds of filter, hidden rows reported.
3. The date pickers.
4. The tests and the browser check, the walk.
5. Documentation, changelog, versions.
