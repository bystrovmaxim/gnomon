# Implementation Plan: a draft of my own over everyone's published notes

**Branch**: `feature/issue-121-notes-draft-published` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/084-notes-draft-published/spec.md`; issue bystrovmaxim/gnomon#121; the accepted mockup [`mockup/index.html`](mockup/index.html).

## Summary

The published notes of an item stop being written by edits: they change only when a revision is published. A member's writes go to their own draft, kept as a versioned table `note_change` — one row per (person, note) with its state (new, changed, deleted), the text, and the published version it was made over (base text and revision). Draft and Published are read at any moment from the version tables: Draft is one person's changes at that moment, Published is everyone's notes of the revision in force. Publishing takes the whole draft as one revision in one transaction; a change whose base no longer reads as the published note is a conflict, and the publish action refuses with the list until each is overwritten or given up. The template's pages become two — Draft and Published notes — with the states marked inside the text by one marking component built on jsdiff's `diffWords`.

## Technical Context

**Language/Version**: Python 3.12 (the template's backend), TypeScript/React 19/Next.js 16 (its pages).

**Dependencies**: `diff` (jsdiff) added to the template's frontend; `@maxitor/panel` unchanged; the core's installer builds `note_change` and `note_change_versions` from `schema.yaml`.

**Storage**: PostgreSQL through `NotesStorage`; all new tables versioned, so Draft reads at any moment.

**Testing**: `pytest` over the template's storage and actions with a recording database; `node --experimental-strip-types --test` over the pages' pure rules; `check-core.mjs` on the local stand for the browser walk.

**Constraints**: no SQL in the plugin; reads at a moment not later than the watermark; nothing of a draft reaches another person before publication.

**Scale/Scope**: one item's notes; the template is the reference every plugin is written from.

## Constitution Check

- **One term, one name**: change, state, base, conflict, draft, revision, marking — the spec's words in tables, entities, actions, pages and docs.
- **The database does not decide**: ids come ready; no `DEFAULT`; every column described; no cascade.
- **Actions only**: every write stays one of the template's actions through the gateway.
- **Spec ahead of code**: this plan follows [spec.md](spec.md).

Post-design: no violation.

## Project Structure

```text
specs/084-notes-draft-published/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/publishing.md
└── mockup/index.html

packages/maxitor-plugin-template/
├── src/maxitor_notes/
│   ├── schema.yaml, foreign-keys.yaml, navigation.yaml
│   ├── storage/notes_storage.py
│   ├── entities/note_change_entity.py, conflict_entity.py
│   └── actions/{add,edit,delete,revert}_note_action.py, list_note_draft_action.py, publish_notes_action.py
├── tests/{test_notes_changes,test_revisions,test_notes_actions,test_history_data,test_navigation,test_app}.py
└── web/
    ├── app/[org]/notes/{draft.ts,marking.tsx,parts.tsx,revision.tsx,api.ts,server.ts}
    ├── app/[org]/items/[item_id]/{page.tsx,DraftView.tsx}
    ├── app/[org]/items/[item_id]/published/{page.tsx,PublishedView.tsx}
    └── tests/{draft.test.ts,notes.test.ts}
```

## Phases (as in the issue)

1. The mockup — accepted, committed.
2. The template's server: `note_change` and its versions; a draft per person; reverts; publishing a whole draft with its conflicts; Draft and Published at any moment.
3. The template's pages: Draft and Published on the canvas, the State and Authors filters, the states, the marking, New note, the publishing dialog with conflicts, the phone.
4. The tests and the browser check of 1.6 on a desktop and a phone; the walk on the stand, its result on the pull request.
5. Documentation, changelog, versions.

## Design decisions

- **Draft is stored, not derived**: a person's change is a row with its base; publications do not rewrite it, so a conflict is found at publishing, not at the first edit. See [data-model.md](data-model.md).
- **Conflicts are decided by value**: the published note now reads otherwise than the change's base, or is deleted. A change whose text came to equal the published one leaves the draft without a question.
- **Publishing is one transaction with two calls**: the first answers the conflict list; the second carries a choice for each and publishes. See [contracts/publishing.md](contracts/publishing.md).
- **The marking is one component**: `notes/marking.tsx` draws `diffWords`' answer as struck or green spans; the draft card, both sides of a conflict and the revert dialog use it.
- **Published reads the draft too**: the page marks "In your draft" and counts the waiting changes without a new action; Edit opens the Draft page with the note's editor, and nothing is written until it is saved.
- **The Notes page goes**: the item's nodes are Draft (`/items/{item_id}`) and Published (`/items/{item_id}/published`).
