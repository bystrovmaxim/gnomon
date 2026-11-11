# Implementation Plan: Maxitor plugin template — its own items and its own nodes in the tree

**Branch**: `feature/issue-103-template-own-items` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/076-template-own-items/spec.md` (issue bystrovmaxim/gnomon#103).

## Summary

The plugin template `notes` keeps what its notes are written on: a versioned table `item` with a unique title, keys from `note` and `revision` to it, the actions to add and rename an item with their typed events, and the list of items as a list node's source. Its `navigation.yaml` puts a root node "Notes", a list node of items and the three pages under every item; nothing hangs under `core:item`. The plugin concept, the tutorial, the README, the passport and the code's descriptions speak of the template's own items.

## Technical Context

**Language/Version**: Python 3.12 (CI also 3.14).

**Primary Dependencies**: AOA from the submodule `external/aoa`; `maxitor-plugin-sdk` (moments, roles, checks, core functions).

**Storage**: PostgreSQL, the plugin's own schema `notes_<version>`; the new table declared in `schema.yaml` and built by the core's installer with its version table, its unique key and its keys. Tests run without a database, on the template's recording connection.

**Testing**: pytest in `packages/maxitor-plugin-template/tests`; `maxitor-plugin-check`; the gateway on the local stand of bystrovmaxim/gnomon#75 for every new action.

**Target Platform**: the plugin's backend behind Maxitor's gateway.

**Project Type**: a plugin backend with its declarations.

**Performance Goals**: a part of the list is one read of `item_versions` at a moment by `(organization_id, title, id)`.

**Constraints**: no SQL names a schema; `organization_id` in every condition; changing actions read only current tables after the organization's lock; a moment travels as an opaque string.

**Scale/Scope**: one table, three actions (`AddItemAction`, `RenameItemAction`, `ListItemsAction`), two events, two changed decisions (`AddNoteAction`, `PublishNotesAction`), one `navigation.yaml`, the plugin documentation.

## Constitution Check

- **I. One term, one name**: `item` is the table, the entry entity (`ItemEntryCoreEntity`), the path `/items`, the list `list_items` and the key `item_id`; `title` everywhere.
- **II. Spec ahead of code**: spec 076; issue #103 holds the same decisions.
- **III. The database does not decide**: the id from the writer (`uuid4`); the title's uniqueness and the item's existence are decided by the actions under the organization's lock and in `@access_decide`; the unique key and the keys only guard; no default, no cascade; every column described with explicit nullability.
- **IV. Decision apart from idea**: deleting an item, nested items and a lifecycle of every note are named outside this work (spec, Assumptions; bystrovmaxim/gnomon#106).
- **V. Measurement**: SC-001 – SC-005 each name a test, a check or a search.
- **Rules 41–46 (actions)**: every operation an action with frozen `Params`/`Result`, `@check_roles(MemberRole)`, one `@access_decide`.
- **Rule 54 (file named like the class)**: `actions/add_item_action.py`, `actions/rename_item_action.py`, `actions/list_items_action.py`, `entities/item_entry_entity.py`, `events.py`.
- **Rules 60, 67 (graph)**: the template's `graph.json` rebuilt by `graph-builder write`.
- **Rule 66 (connections in routes)**: each new route declares the connection of `NotesStorage`.
- **Versioned storage**: `item` has versions; the list reads `item_versions` only.

Post-design: no violation.

## Project Structure

### Documentation (this feature)

```text
specs/076-template-own-items/
├── spec.md
├── plan.md               # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── items-contract.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
packages/maxitor-plugin-template/
├── src/maxitor_notes/
│   ├── schema.yaml                    # + item; keys from note and revision
│   ├── navigation.yaml                # root, list node item, three pages
│   ├── maxitor-plugin.yaml            # description
│   ├── notes_domain.py                # events
│   ├── events.py                      # ItemAddedEvent, ItemRenamedEvent
│   ├── app.py                         # three routes
│   ├── actions/add_item_action.py
│   ├── actions/rename_item_action.py
│   ├── actions/list_items_action.py
│   ├── actions/add_note_action.py     # the item checked in the decision
│   ├── actions/publish_notes_action.py
│   ├── entities/item_entry_entity.py
│   └── storage/notes_storage.py       # add_item, rename_item, item_of, items_at
├── tests/test_items.py                # new
├── tests/test_navigation.py
├── graph.json
├── README.md
└── pyproject.toml                     # version
docs/plugins/concept.md
docs/plugins/tutorial/{01,02,03,04}-*.md
docs/CHANGELOG.md
```

**Structure Decision**: everything lies in the template's package and the plugin documentation; the SDK and the core do not change.

## Phases (one phase is one commit)

1. **Items** — `item` in `schema.yaml`, the keys from `note` and `revision`; `VERSION_TABLES`; the storage's add, rename, existence and list; the three actions, their routes, events; the item checked in `AddNoteAction` and `PublishNotesAction`; tests on a recording connection.
2. **Nodes** — `navigation.yaml` (R7); `test_navigation.py`; the plugin's check and the installer's check; every new action through the gateway on the local stand.
3. **Documentation** — spec FR-011, FR-012; `graph.json`; the changelog; the template's version.
