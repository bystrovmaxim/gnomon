# Tasks: a draft of my own over everyone's published notes

**Input**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/](contracts/), [research.md](research.md)

Phases follow the issue's five; one phase is one commit. `[P]` — may run in parallel with the other `[P]` tasks of its phase.

## Phase 1 — The mockup

- [x] T000 The accepted mockup: Draft, Published, publishing with conflicts, the phone (`mockup/index.html`).

## Phase 2 — The template's server (US1, US2, US3, US4)

- [x] T001 `schema.yaml`, `foreign-keys.yaml`: the table `note_change` — item, person, note, author, state, body, base body, base revision; unique (person, note); a key to `item`; core keys for the person and the author; every column described. `note_change_versions` comes from the installer.
- [x] T002 `entities/note_change_entity.py`, `entities/note_conflict_entity.py`: the change with its state, base, author and time, and the conflict's other side; the old `kind`/`before`/`by_name` go.
- [x] T003 `draft_rules.py`: the pure rule — by value, a change is a conflict, a no-op or applies, over the draft and the published notes; `DraftDecision` with the change and the conflict's other side.
- [x] T004 `storage/notes_storage.py`: `note_change_versions` in `VERSION_TABLES`; `add_note_change`, `edit_note`, `delete_note`, `revert_note_change` write one change and its version under the lock; `draft` reads one person's changes in force at a moment with the published notes at it; `_note_identities` gives a deleted note's author and creation moment; the storage wrapper passes them on.
- [x] T005 `storage/notes_storage.py`: `publish_notes` takes the person and the choices; it recomputes the conflicts, refuses with `conflicts` while one has no choice, applies the rest in one transaction — new, changed, deleted, restored — writes the revision and empties the draft; `nothing_to_publish` when nothing is left.
- [x] T006 `actions/add_note_action.py`, `edit_note_action.py`, `delete_note_action.py`, `revert_note_change_action.py`, `publish_notes_action.py`, `list_note_draft_action.py`, `app.py`: the actions of the draft, the refusal `conflicts`, the route `DELETE /draft/{note_id}`; publishing takes `resolutions`.
- [x] T007 Tests: `tests/test_notes_changes.py` (a change per person, its base, revert, a no-op leaving), `tests/test_revisions.py` (publishing with each conflict kind, choices, the second call's list, nothing to publish, the past of Draft and Published), `tests/test_notes_storage.py` and `tests/test_reading_sql.py` (the new table's reads), `tests/test_notes_actions.py`, `tests/test_items.py`, `tests/test_app.py`, `tests/test_history_data.py`; `tests/test_draft_rules.py` (the pure rule). Each rule broken and its test seen failing.
- [x] T008 The spec's FR-004 corrected to the accepted mockup: a changed note marks the words inside one text, never a struck block above.

## Phase 3 — The template's pages (US1, US2, US3, US5, US6)

- [ ] T009 `web/package.json`, `web/package-lock.json`: `diff` (jsdiff) added.
- [x] T010 `web/app/[org]/notes/marking.tsx`: the one marking — `diffWords` drawn as struck and green spans, every part rendered.
- [x] T011 `web/app/[org]/notes/draft.ts`: the pages' rules — the state's label and colour, the State filter's rows with `absent`, the conflict's words, the draft's order, the counts; `web/tests/draft.test.ts`.
- [x] T012 `web/app/[org]/notes/parts.tsx`, `DraftView.tsx`: Draft on the canvas at `/items/{item_id}` — cards with state, author, base and marking, the race notice, Edit and Revert (menu on a phone), New note, Publish, the State filter, read only in the past.
- [x] T013 `web/app/[org]/items/[item_id]/published/*`: Published notes reads the draft too — "In your draft" marks, the waiting count, Edit opening Draft with `?edit=`, Delete in my draft, the Authors filter, read only in the past.
- [x] T014 The publishing dialog: title, comment, release, the list of what goes in, the conflicts with both marked sides and the two choices; Publish off until each conflict has one; `nothing_to_publish` in words — a sheet on a phone.
- [x] T015 `navigation.yaml`: the Notes node goes; Draft at `/items/{item_id}`, Published notes at `/items/{item_id}/published`; `NotesView.tsx` and the notes route removed; `notes.css` for the states, the marking, the race notice, the conflict blocks and the phone.
- [x] T016 `tests/test_navigation.py`, `tests/test_history_data.py`, `tests/test_shell.py`: the two pages as built; the history the pages give.

## Phase 4 — Tests, the browser check, the walk (US7)

- [x] T017 `web/tests/draft.test.ts`: every rule of the pages broken and its test seen failing; the marking's losslessness as a pure check.
- [x] T018 `packages/maxitor/maxitor-core/web/scripts/check-core.mjs`: the walk of 1.6 on the stand — two people, private drafts, publication, the conflict with the other's name and value, overwrite and give up, a deletion and a restoration, a revert; on a desktop and at 375 px.
- [ ] T019 The walk of 1.6 on the local stand by two people; its result in the phase's commit message and the template's README.

## Phase 5 — Documentation, changelog, versions (US7)

- [ ] T020 The tutorial's chapters 8, 9 and 13 and the index's rows; the plugin concept where the pages and the revisions change; the template's README.
- [ ] T021 Versions raised: the template and its pages; graph files rebuilt; changelogs of every changed level.
- [ ] T022 The closing check run to zero (`scripts/check_run.py`).

## Dependencies

Phase 1 → 2 → 3 → 4 → 5. Inside a phase, `[P]` tasks touch different files; T003 and T010 have no dependency on the storage's SQL.
