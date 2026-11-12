# Tasks: the template's pages now, on the canvas

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 — The Notes canvas and now (US1)

- [x] T001 `notes/notes.ts`, `notes/server.ts`: the cards' grid, the order, `newSince`; reading the backend with the gateway's token.
- [x] T002 `NotesView.tsx`, `notes/parts.tsx`: cards and `DataTable` on the canvas, anchors `note:<id>`, `useFresh` on `panel.watermark`.

## Phase 2 — Writing, editing, deleting (US2)

- [x] T003 `Dialog` of `@maxitor/panel`; "New note" as the page's action; `NoteCard` editing through `changed_since` and `deleted`, deleting after one question; `refusalText` for every reason.

## Phase 3 — Published notes and Draft (US3)

- [x] T004 `notes/revision.tsx`, `PublishedView.tsx`, `DraftView.tsx` and their pages; publishing from a dialog.

## Phase 4 — The phone, tests, the browser check (US4)

- [x] T005 The phone: a note's actions behind ⋯ in a sheet, dialogs as sheets (`notes.css`, `panel.css`).
- [x] T006 `web/tests/notes.test.ts`; its step in the check run; each rule broken and its test seen failing.
- [x] T007 `check-core.mjs`: writing, a conflict, deleting, a colleague's note, publishing, the phone; the walk on a fresh stand.

## Phase 5 — Documentation, changelog, versions (US5)

- [x] T008 The tutorial's chapters 8 and 9 (now), chapter 13, the index; the template's README; the plugin concept's page example.
- [x] T009 The template 0.12.0 and its pages 0.6.0, `@maxitor/panel` 0.6.0, the core's application 1.7.0, maxitor 4.8.0; changelogs.
