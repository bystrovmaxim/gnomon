# Implementation Plan: Maxitor plugin template — history on the server

**Branch**: `feature/issue-97-notes-history` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/074-notes-history/spec.md` (issue bystrovmaxim/gnomon#97).

## Summary

The plugin template `notes` learns its whole history on the server: reading at any moment with a future moment refused, editing with `base_moment` and its conflict, deleting, publishing revisions with a draft, and answering the core's time scale. The contract by which any plugin answers the scale goes into `maxitor-plugin-sdk`: the moment condition in two forms (at a moment, over a stretch), the bars grouped from the versions a page's own reading query finds over a stretch, the history declarations in the passport and `navigation.yaml` with their JSON schemas, the shapes of the context, bars, milestones and card, and the plugin check of all of it. The plugins' documentation moves to `docs/plugins/`.

## Technical Context

**Language/Version**: Python 3.12 (CI also 3.14), as the rest of the repository.

**Primary Dependencies**: AOA (`aoa-action-machine`, `aoa-fastapi-adapter`) from the submodule `external/aoa`; `jsonschema` and `PyYAML` in the SDK, as today.

**Storage**: PostgreSQL, the plugin's own schema `notes_<version>`, reached as `plg_notes_<version>`; tables declared in `schema.yaml` and built by the core's installer with their version tables. Tests run without a database, on the template's recording connection.

**Testing**: pytest in each package (`packages/maxitor-plugin-sdk/tests`, `packages/maxitor-plugin-template/tests`).

**Target Platform**: the plugin's backend process behind Maxitor's gateway (run in bystrovmaxim/gnomon#75); the SDK as a library and a command (`maxitor-plugin-check`).

**Project Type**: a library (the SDK) and a plugin backend (the template).

**Performance Goals**: reading at a moment uses the indexes versioned storage prescribes; the bars of one item over any stretch are one range read of `note_versions` by `(organization_id, item_id, …)`.

**Constraints**: no SQL names a schema; every reading query writes its moment condition through the SDK's function and binds the organization in every condition; changing actions read only the current tables after the organization's lock; a moment travels as an opaque string `YYYY-MM-DDTHH:MM:SS.ffffffZ`.

**Scale/Scope**: one plugin and one library; four new actions in the template (`EditNoteAction`, `DeleteNoteAction`, `PublishNotesAction`, two reading actions for the published notes and the draft), two history actions (`list_note_history`, `note_milestone_card`), one new table (`revision`).

## Constitution Check

- **I. One term, one name**: `note`, `revision`, `draft`, `moment`, `watermark`, `base_moment`, `bar`, `milestone`, `milestone card` — the same in the spec, the data model, the SDK and the template; a revision's number is `number` everywhere and its short reference `v<number>`.
- **II. Spec ahead of code**: spec 074 with its clarifications; issue #97 brought to the same decisions.
- **III. The database does not decide**: identifiers from the writer (`uuid4` in the storage), no defaults or cascades; `revision` declared in `schema.yaml` with every column described and explicit nullability; the consecutive number is computed under the organization's lock, and a unique `(item_id, number)` only guards it.
- **IV. Decision apart from idea**: how the core calls a plugin's history actions over the network is bystrovmaxim/gnomon#98's; here only the shapes and the actions exist.
- **V. Measurement**: SC-001 – SC-008 each name a test.
- **Rules 41–46 (actions)**: every operation is an action with frozen `Params`/`Result`, `@access_decide` on the organization of the address, `@check_roles`.
- **Rule 54 (file named like the class)**: each new action, entity and error in a file of its name; the history actions in `history/<name>_action.py`, the navigation naming them without `_action`, as `list_note_authors` is named today.
- **Rules 60, 67 (graph)**: the template's `graph.json` rebuilt by `graph-builder write`.
- **Rule 66 (connections in routes)**: each new route declares the `PerCallConnection` of `NotesStorage`.
- **Versioned storage**: every new table has versions; screens read only version tables; a revision is never changed once written.

Post-design: no violation.

## Project Structure

### Documentation (this feature)

```text
specs/074-notes-history/
├── spec.md
├── plan.md               # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── history-contract.md
├── checklists/requirements.md
├── tasks.md              # /speckit-tasks
└── mockup/index.html     # the screens of #98 and #100
```

### Source Code (repository root)

```text
packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/
├── moments.py                     # MOMENT_PATTERN, moment_text(), in_force(), overlaps() — the moment condition in two forms
├── history.py                     # Change, Bar, bars_of(); the history declarations' rules for the check
├── checks.py                      # + history in the passport and navigation: compare within the passport's, names in history/
└── schemas/
    ├── plugin-passport-2.schema.json   # + optional history.compare
    ├── navigation-1.schema.json        # + optional history per page
    └── history-1.schema.json           # the context, bars, milestones and card

packages/maxitor-plugin-template/src/maxitor_notes/
├── maxitor-plugin.yaml            # + history.compare
├── navigation.yaml                # the Notes, Published notes and Draft nodes with their history
├── schema.yaml                    # + table revision
├── notes_refusal_error.py         # refusals with their HTTP status: conflict, deleted, future, nothing to publish
├── app.py                         # + the new routes and the refusals' handler
├── actions/
│   ├── list_item_notes_action.py  # + the stretch: answers bars instead of notes
│   ├── edit_note_action.py
│   ├── delete_note_action.py
│   ├── publish_notes_action.py
│   ├── list_published_notes_action.py
│   └── list_note_draft_action.py
├── entities/                      # + revision, change, milestone, milestone card, bar
├── history/
│   ├── list_note_history_action.py   # ListNoteHistoryAction — the milestones
│   └── note_milestone_card_action.py # NoteMilestoneCardAction — one milestone's card
└── storage/notes_storage.py       # + edit, delete, publish, published, draft, versions over a stretch, milestones

docs/plugins/
├── concept.md                     # moved from packages/maxitor-plugin-template/docs/plugins.md
└── versioned-storage.md           # moved, with the notes example
```

**Structure Decision**: two existing packages grow; no new package. The history actions sit in the template's `history/` so that the folder is the plugin's whole answer to the scale, as the contract requires.

## Complexity Tracking

No constitution violation to justify.
