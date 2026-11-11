# Tasks: Maxitor plugin template — its own items and its own nodes in the tree

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/items-contract.md](contracts/items-contract.md), [quickstart.md](quickstart.md).

**Tests**: requested by the spec (every acceptance scenario has a test, SC-001); every phase writes its tests with it.

**Phases**: one phase is one commit and one phase of issue #103; after each phase only that phase's tests run. Paths: `TPL` = `packages/maxitor-plugin-template`, package `PKG` = `TPL/src/maxitor_notes`. The tutorial quotes the template's files and `tests/scripts/test_tutorial_quotes.py` fails on any drift, so a phase that changes a quoted file brings its quote in step in the same commit.

## Phase 1: Items (US1 P1, US2 P2) — issue phase 1

**Goal**: the template keeps its items; a note and a revision point only at an item of their organization; an item is added, renamed and listed at a moment.

**Independent test**: `uv run pytest TPL/tests/test_items.py TPL/tests/test_notes_actions.py TPL/tests/test_revisions.py TPL/tests/test_reading_sql.py TPL/tests/test_foreign_keys.py tests/scripts/test_tutorial_quotes.py`.

- [X] T001 [US1] `PKG/schema.yaml`: table `item` — `title` text not null ("The item's title: 1–200 characters, no spaces at its ends, unique among the organization's items now"); `unique: [[title]]`; description "What notes are written on, like a folder: a title in one organization. Items do not nest." `note` and `revision` gain `keys: [{columns: [item_id], table: item, references: [id]}]`; their `item_id` and descriptions name the template's item, never a catalog.
- [X] T002 [US1] `PKG/storage/notes_storage.py`: `VERSION_TABLES` gains `item_versions`; `add_item(organization_id, title, author_id, operation)` — under `change_time`, a current item with the title → `NotesRefusalError("title_taken", 409)`; else insert `item` and its first version; return `(item_id, changed_at)`. `item_of(organization_id, item_id)` — whether it is a current item of the organization.
- [X] T003 [US2] `NotesStorage.rename_item(organization_id, item_id, title, base_moment, editor_id, operation)`: under `change_time`, the current row `FOR UPDATE`; open version later than `base_moment` → `changed_since` (409) with who and when; the same title → no write, return `(old_title, since, False)`; another current item with the title → `title_taken`; else update, close the open version, open the new one; return `(old_title, changed_at, True)`. The wrapper forwards all three methods.
- [X] T004 [US1] `NotesStorage.items_at(organization_id, moment, limit, after)`: `item_versions` at the moment through the SDK's `in_force` and `_moment`, ordered by `(title, id)`, starting after the `(title, id)` of `after` at the same moment, `limit + 1` rows to tell whether a next part exists.
- [X] T005 [P] [US1] `PKG/entities/item_entry_entity.py` (`ItemEntryCoreEntity`: `key`, `title`, `icon`), registered in the storage's `@entities`; a rename's `base_moment` is the panel's moment the member saw, so no entity carries an item's `since`.
- [X] T006 [P] [US1] `PKG/events.py`: `ItemAddedEvent(item_id, title)`, `ItemRenamedEvent(item_id, old_title, new_title)`; `PKG/notes_domain.py` lists them in `events` and describes the domain as notes on the template's own items.
- [X] T007 [US1] `PKG/actions/add_item_action.py` (`AddItemAction`: `title` stripped at its ends, 1–200; `@check_roles(MemberRole)`; `@access_decide` on the organization; `@emits(ItemAddedEvent)` writing on `Channel.business`; result `item_id`, `changed_at`).
- [X] T008 [US2] `PKG/actions/rename_item_action.py` (`RenameItemAction`: `item_id`, `title`, `base_moment`; `@access_decide` refuses `FORBIDDEN_OBJECT` unless the item is a current item of the organization; `@emits(ItemRenamedEvent)`, written only when the title changed; result `changed_at`).
- [X] T009 [US1] `PKG/actions/list_items_action.py` (`ListItemsAction`: `at`, `limit` 1–200 default 50, `after`; `entries` with icon `folder`, `next` the last key when there is a next part, else `null`).
- [X] T010 [US1] `AddNoteAction` and `PublishNotesAction`: their `@access_decide` refuses `FORBIDDEN_OBJECT` unless `item_id` is a current item of the organization; every description in `PKG` that says "catalog item" says "item".
- [X] T011 [US1] `PKG/app.py`: `POST /items`, `PATCH /items`, `GET /lists/list_items`, each with the storage's connection.
- [X] T012 [US1] `TPL/tests/test_items.py`: every acceptance scenario of US1 and US2 and the spec's edge cases on the recording connection — add, a taken title read only after the organization's lock, trimming, 200 and 201 characters, a note and a revision on a missing item and on another organization's item refused, a rename, a rename to the same title writing nothing and no event, a rename to a taken title, a rename's conflict, a past title reused, the list at a moment, the list before an item was added, the list at a moment not come refused, 120 items in parts of 50 coming once each in three parts, a stranger refused on all three actions; every new reading query passes `test_reading_sql.py`'s condition check.
- [X] T013 [US1] The quotes of `docs/plugins/tutorial/03-your-tables.md` (schema) and `04-reading.md`, `05-writing.md` (the actions and the storage they quote) in step with the code; `test_tutorial_quotes.py` passes.
- [X] T014 Adversarial check: drop the item check from `AddNoteAction`'s decision, the title check from `add_item`, and the `(title, id)` start of `items_at`, one at a time; each time the test that must catch it fails and no other test of the phase does; restore.

## Phase 2: Nodes (US3 P1) — issue phase 2

**Goal**: the tree shows the template's own nodes; nothing hangs under `core:item`; every new action answers through the gateway.

**Independent test**: `uv run pytest TPL/tests/test_navigation.py TPL/tests/test_controls.py TPL/tests/test_passport.py`, then `uv run maxitor-plugin-check TPL`, then the gateway on the local stand.

- [X] T015 [US3] `PKG/navigation.yaml`: the root node `notes` (`attach: root`, page `/`) holds the list node `item` (`each: {source: list_items, key: item_id}`, no page) and under it `item-notes`, `item-published`, `item-draft` with their pages, controls, room and history; no `attach: core:item`; the comments say what each node is without a catalog.
- [X] T016 [US3] `TPL/tests/test_navigation.py` and `TPL/tests/test_controls.py`: the tests that pointed at a node attached to `core:item` point at the item's pages; a new test asserts no node of the template is attached outside the root, and that `{item_id}` in the three pages is defined by the list node above them.
- [X] T017 [US3] `maxitor-plugin-check` on the template and the core's installer check (`CheckVersionAction`'s reading of the navigation) accept it.
- [ ] T018 [US3] On the local stand of bystrovmaxim/gnomon#75, once the template's version is raised (T024): the steps of [quickstart.md](quickstart.md), "Through the gateway", walked by `check-core.mjs`, each answering as written.
- [X] T019 Adversarial check: attach `item-notes` to `core:item` again and drop `each` from `item`, one at a time; the new navigation test fails each time and no other test of the phase does; restore.

## Phase 3: Documentation (US4 P3) — issue phase 3

**Goal**: no page speaks of catalog items as something the core or the template has; the reader meets the template's own items.

**Independent test**: the search of [quickstart.md](quickstart.md), "The documentation"; `uv run pytest tests/scripts/test_tutorial_quotes.py`.

- [ ] T020 [US4] `docs/plugins/concept.md`: the glossary's list node example; the core's tree in 7.1 holds only the nodes the core has; 7.2's example of a plugin's node attached to the template's root, not `core:item`; section 12 — the template's own items, its table `item`, its root node; one sentence on the simplest model of a release and bystrovmaxim/gnomon#106.
- [ ] T021 [P] [US4] `docs/plugins/tutorial/01-what-you-will-build.md`, `02-a-copy-of-the-template.md`, `03-your-tables.md`, `04-reading.md`: the prose around the quotes speaks of the template's own items; 03 shows the table `item` and its key; 02's passport description.
- [ ] T022 [P] [US4] `PKG/maxitor-plugin.yaml` description ("Notes on the template's own items …"), `TPL/README.md`, `TPL/pyproject.toml` description.
- [ ] T023 [US4] The closing check run taken to zero.
- [ ] T024 `TPL/graph.json` rebuilt by `graph-builder write`; the template's version raised in `TPL/pyproject.toml` (minor: new actions); `TPL/CHANGELOG.md` and `docs/CHANGELOG.md` — one article on what the work created.

## Dependencies

Phase 1 → Phase 2 (the list node's source is `list_items`) → Phase 3 (the documentation describes both). T005, T006 in parallel inside phase 1; T021, T022 in parallel inside phase 3.
