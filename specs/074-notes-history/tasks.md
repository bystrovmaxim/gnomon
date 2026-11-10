# Tasks: Maxitor plugin template — history on the server

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/history-contract.md](contracts/history-contract.md), [quickstart.md](quickstart.md).

**Tests**: requested by the spec (section "What the template's tests prove" of issue #97, SC-001 – SC-008); every phase writes its tests with it.

**Phases**: one phase is one commit and one phase of issue #97; after each phase only that phase's tests run. Paths: `SDK` = `packages/maxitor-plugin-sdk`, `TPL` = `packages/maxitor-plugin-template`, package `TPL/src/maxitor_notes`.

## Phase 1: Reading at any moment (US1, P1) — issue phase 1

**Goal**: every reading action answers at one moment, through the SDK's condition; a future moment is refused.

**Independent test**: `uv run pytest SDK/tests/test_moments.py TPL/tests/test_notes_storage.py TPL/tests/test_reading_sql.py TPL/tests/test_notes_actions.py`.

- [X] T001 [US1] Add `SDK/src/maxitor_plugin_sdk/moments.py`: `MOMENT_PATTERN` (`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$`), `moment_text(expr)` (the `to_char` form the template uses today), `in_force(alias, moment)` = `{a}.valid_from_at <= {m} AND ({a}.valid_to_at IS NULL OR {a}.valid_to_at > {m})`, and `overlaps(alias, start, end)` = `{a}.valid_from_at <= {end} AND ({a}.valid_to_at IS NULL OR {a}.valid_to_at > {start})`; aliases checked like table names.
- [X] T002 [P] [US1] Tests of the two forms and of a refused alias in `SDK/tests/test_moments.py`.
- [X] T003 [US1] Add `TPL/src/maxitor_notes/notes_refusal_error.py`: `NotesRefusalError(reason, status, **details)` with `body`, as the core's `CoreRefusalError`; register its handler in `TPL/src/maxitor_notes/app.py`.
- [X] T004 [US1] In `TPL/src/maxitor_notes/storage/notes_storage.py`: replace `_in_force` and `_MOMENT` by the SDK's; add `_moment(organization_id, at)` — the watermark when `at` is `None`, `NotesRefusalError("moment_not_come", 422, watermark=…)` when `at` is later than it; use it in `notes_of_item` and `note_authors`; `ListItemNotesParams.at` uses the SDK's `MOMENT_PATTERN`.
- [X] T005 [P] [US1] `TPL/tests/test_reading_sql.py`: run every reading method of `NotesStorage` on the recording connection and parse each reading query: every `*_versions` alias has the moment (or interval) condition from the SDK and `organization_id`; a query built without them fails the test.
- [X] T006 [P] [US1] In `TPL/tests/test_notes_storage.py`: a moment later than the watermark is refused with its watermark and reads nothing.

## Phase 2: Editing and deleting (US2, P1) — issue phase 2

**Goal**: edit with `base_moment` and its conflict; delete closing the last version; a deleted note refused for editing.

**Independent test**: `uv run pytest TPL/tests/test_notes_changes.py TPL/tests/test_notes_actions.py`.

- [X] T007 [US2] `NoteCoreEntity` in `TPL/src/maxitor_notes/entities/note_entity.py` gains `since` (the open version's start); `notes_of_item` returns it.
- [X] T008 [US2] `NotesStorage.edit_note(organization_id, note_id, body, base_moment, editor_id, operation)`: one transaction — `change_time`, the current row `FOR UPDATE`; no row → `deleted` (409) with `deleted_by`/`deleted_at` from the closed version; open version later than `base_moment` → `changed_since` (409) with `changed_by`/`changed_at`; same text → no write; else update `note`, close the open version (`valid_to_at`, `closed_by`, `closed_operation`), insert the new version `ON CONFLICT (organization_id, id, valid_from_at) DO UPDATE`; return the change time.
- [X] T009 [US2] `NotesStorage.delete_note(organization_id, note_id, base_moment, editor_id, operation)`: the same checks; delete the current row and close its version with `closed_by` and `closed_operation`; no new version.
- [X] T010 [P] [US2] `TPL/src/maxitor_notes/actions/edit_note_action.py` (`EditNoteAction`, editor role, `note_id`, `body` 1–10000, `base_moment` by `MOMENT_PATTERN`) and `TPL/src/maxitor_notes/actions/delete_note_action.py` (`DeleteNoteAction`); routes `PATCH /notes/{note_id}` and `DELETE /notes/{note_id}` in `app.py`; wrapper methods in `NotesStorageWrapper`.
- [X] T011 [P] [US2] `TPL/tests/test_notes_changes.py`: the statements and their order for edit and delete; a stale `base_moment` is a conflict naming who and when and writes nothing; a deleted note is refused; the same text writes nothing; an edit closes the open version and opens one. Extend `ACTION_CALLS` in `TPL/tests/test_notes_actions.py` with both actions.

## Phase 3: Revisions (US3, P2) — issue phase 3

**Goal**: publish an item's notes as a numbered revision; read the published notes and the draft at any moment.

**Independent test**: `uv run pytest TPL/tests/test_revisions.py TPL/tests/test_notes_actions.py TPL/tests/test_passport.py`.

- [X] T012 [US3] `TPL/src/maxitor_notes/schema.yaml`: table `revision` — `item_id` uuid not null, `number` integer not null, `title` text not null, `comment` text not null, `release` text nullable ("empty when the revision carries none"), `publisher_id` uuid not null; unique `[item_id, number]`; index `[item_id]`. `VERSION_TABLES` gains `revision_versions`.
- [X] T013 [P] [US3] Entities `RevisionCoreEntity` and `NoteChangeCoreEntity` in `TPL/src/maxitor_notes/entities/` (fields of data-model.md).
- [X] T014 [US3] `NotesStorage.publish_notes(organization_id, item_id, title, comment, release, publisher_id, operation)`: under `change_time`, the last number from `revision`; no note changed since the last revision's moment → `nothing_to_publish` (409); else insert `revision` and its version with `number + 1`; return the number and the change time.
- [X] T015 [US3] `NotesStorage.revision_at(organization_id, item_id, moment)`, `published_notes(…)` (the notes at the revision's moment) and `draft(organization_id, item_id, moment)` (the changes between the revision in force and the moment: added, changed, removed with who and when), each with the SDK's moment condition.
- [X] T016 [P] [US3] Actions `PublishNotesAction` (editor; `title` 1–200, `comment` 1–2000, `release` 0–80 or none), `ListPublishedNotesAction` and `ListNoteDraftAction` (reader; `at`) in `TPL/src/maxitor_notes/actions/`; routes in `app.py`.
- [X] T017 [P] [US3] `TPL/tests/test_revisions.py`: consecutive numbers; nothing to publish refused; published notes between two revisions are the earlier one's; the draft lists added, changed and removed; release kept or empty; no action but publishing writes to `revision`, and no route changes a published revision (FR-015).

## Phase 4: The history contract in the SDK (US4, P1) — issue phase 4

**Goal**: the declarations, their schemas, the shapes, the bars and the check.

**Independent test**: `uv run pytest SDK/tests/test_history.py SDK/tests/test_history_check.py`.

- [ ] T018 [US4] `SDK/src/maxitor_plugin_sdk/schemas/plugin-passport-2.schema.json`: optional `history` `{compare: [diff|side_by_side], unique}`; `navigation-1.schema.json`: optional per-node `history` `{compare, read, bars, milestones, card}` (names `^[a-z][a-z0-9_]{0,62}$`).
- [ ] T019 [P] [US4] `SDK/src/maxitor_plugin_sdk/schemas/history-1.schema.json`: `$defs` `context`, `bar`, `milestone`, `card` as in the contract.
- [ ] T020 [US4] `SDK/src/maxitor_plugin_sdk/history.py`: `Change(entity_id, at, opened, closed)`, `bars_of(versions, start, end, width)` grouping openings and closings into added / changed / removed by research §2, only times in (start, end], only bars with a change; `HISTORY_FOLDER = "history"`.
- [ ] T021 [US4] `SDK/src/maxitor_plugin_sdk/checks.py`: read the passport's `history`; for each node's `history`, refuse `compare` outside the passport's (no passport history → only none) and `bars`/`milestones`/`card` with no `src/<package>/history/<name>_action.py`, naming the node and the fault.
- [ ] T022 [P] [US4] `SDK/tests/test_history.py` (bars from known versions: added, changed, removed, edges of the stretch, empty) and `SDK/tests/test_history_check.py` (accepted, wider compare refused, missing action refused, no history accepted).

## Phase 5: The template's data of the scale (US5, P2) — issue phase 5

**Goal**: bars from the reading action, milestones and cards.

**Independent test**: `uv run pytest TPL/tests/test_history_data.py TPL/tests/test_navigation.py TPL/tests/test_passport.py`, and `uv run maxitor-plugin-check TPL`.

- [ ] T023 [US5] `ListItemNotesParams` gains `from_at`, `to_at` (by `MOMENT_PATTERN`) and `bar` (60–2 592 000 seconds), all or none; with them `ListItemNotesAction` answers `bars` (`BarCoreEntity`) from `NotesStorage.note_versions_between(...)` — the same query and filters as `notes_of_item` with the SDK's `overlaps` — grouped by `bars_of`; `to_at` cut to the watermark.
- [ ] T024 [US5] `TPL/src/maxitor_notes/history/list_note_history_action.py` (`ListNoteHistoryAction`: `item_id`, `from_at`, `to_at` → milestones: each revision in the stretch with `minor` and `release`, and the draft last as `proposal` with `link` `/items/{item_id}/draft` when there are changes) and `TPL/src/maxitor_notes/history/note_milestone_card_action.py` (`NoteMilestoneCardAction`: `item_id`, `id`, `at` → the card with author, summary, chips, comment); routes `/history/list_note_history` and `/history/note_milestone_card`.
- [ ] T025 [US5] `TPL/src/maxitor_notes/maxitor-plugin.yaml`: `history: {compare: [diff, side_by_side]}`; `TPL/src/maxitor_notes/navigation.yaml`: the item nodes Notes (`/items/{item_id}`, `read`, `milestones`, `card`), Published notes (`/items/{item_id}/published`, `milestones`, `card`) and Draft (`/items/{item_id}/draft`, `compare: []`).
- [ ] T026 [P] [US5] `TPL/tests/test_history_data.py`: bars count by kind and respect the author filter; milestones in order with the draft last; a revision that only edited is `minor`; card fields valid against `history-1.schema.json`; another organization refused. Update `TPL/tests/test_navigation.py` and `TPL/tests/test_passport.py` for the new nodes and history.

## Phase 6: Documentation, graph, versions, changelog (US6, P3) — issue phase 6

**Goal**: the plugins' documentation in `docs/plugins/`; the template's graph rebuilt; versions raised; changelogs.

- [ ] T027 [US6] `git mv TPL/docs/plugins.md docs/plugins/concept.md` and `git mv TPL/docs/versioned-storage.md docs/plugins/versioned-storage.md`; move the Russian drafts beside them on disk; fix every live link (`TPL/README.md`, `packages/maxitor/maxitor-core/README.md`, `packages/maxitor-plugin-sdk/README.md`, `docs/README.md`, links inside the moved files); add a "Plugins" section to `docs/README.md`.
- [ ] T028 [US6] `docs/plugins/versioned-storage.md`: the notes example — now, the past, editing with `base_moment`, deleting, publishing revisions, the bars from a reading query; `docs/plugins/concept.md`: history in the passport and `navigation.yaml`, the folder `history/`, the contract's shapes; the template's README lists the new files.
- [ ] T029 [US6] Rebuild `TPL/graph.json` (`graph-builder write`), raise the SDK to 1.2.0 and the template to 0.5.0 (`pyproject.toml`, passport, `uv.lock`); changelogs of the SDK, the template and `docs/CHANGELOG.md`.
- [ ] T030 Closing check run taken to zero (the repository's closing script), then the quickstart walked.

## Dependencies

Phase 1 → 2 → 3 → 4 → 5 → 6. Phase 4 needs only phase 1's `moments.py`; phase 5 needs phases 3 and 4.

## Implementation strategy

MVP is phase 1 (reading right at every moment); each later phase is a commit that keeps every earlier test green.
