# Research: the template's own items and its own nodes

## R1. Where the key from a note to its item is declared

- **Decision**: in `schema.yaml`, as `keys` of the tables `note` and `revision`: `columns: [item_id]`, `table: item`, `references: [id]`. The installer builds it as `FOREIGN KEY (organization_id, item_id) REFERENCES item (organization_id, id)`, so a note can only point at an item of its own organization.
- **Rationale**: `keys` is the format's way to a table of the same plugin (`plugin-schema-1.schema.json`), and the installer already prefixes `organization_id` (`maxitor/core/plugins/ddl.py`). The SDK's schema check already refuses a key that does not reference a primary or unique key.
- **Alternatives considered**: `foreign-keys.yaml` — it builds keys to the core only and refuses any other schema (`core_keys.py`); no key at all, as spec 073 left it — the reason for that, no table of items, is gone.

## R2. Who refuses a note on an item that does not exist

- **Decision**: the `@access_decide` of `AddNoteAction`, `PublishNotesAction` and `RenameItemAction` checks, after the organization, that the item is a current row of `item` in that organization, and answers `FORBIDDEN_OBJECT` otherwise. The key only guards.
- **Rationale**: the plugin concept (6.6) gives one answer for "there is no such thing" and "it is not yours"; the database does not decide (constitution III). Items are never deleted in this work, so an item found by the decision is still there in the main step.
- **Alternatives considered**: catching the key's violation — the database would decide, and the answer would tell another organization's item from a missing one.

## R3. How a title stays unique

- **Decision**: the title is trimmed at its ends by the parameters and must then be 1–200 characters. Adding and renaming read the current `item` for the same title after the organization's lock (`change_time`), and refuse `title_taken` (409) when another item has it. `unique: [[title]]` becomes `UNIQUE (organization_id, title)` and only guards. The comparison is exact.
- **Rationale**: every writer of the organization takes the same lock, so two adds of one title are ordered and the second sees the first. Exact comparison needs no expression index, which the schema format does not have.
- **Alternatives considered**: case-insensitive titles — an expression index outside the format; uniqueness among past titles too — the issue says "now".

## R4. A rename that loses nobody's change

- **Decision**: `RenameItemAction` takes `base_moment`, as an edit of a note does; the same rule as a note's edit refuses `changed_since` (409) with who and when. The title it has now writes nothing and returns the open version's start.
- **Rationale**: one rule for every change of the template; a reader learns it once.
- **Alternatives considered**: last write wins — two members renaming at once would silently lose one title.

## R5. The list of items

- **Decision**: `ListItemsAction` at `GET /p/notes/api/{organization}/lists/list_items?at=…&limit=…&after=…`, reading `item_versions` at the moment with the SDK's moment condition. Ordered by `(title, id)`; `after` is the key of the last entry of the part before, and the next part starts after that entry's `(title, id)` at the same moment. `limit` 1–200, default 50; `next` is the last key when the part is full, else `null`. The icon of every entry is `folder`.
- **Rationale**: the shape of the plugin concept, 7.4, and of `list_note_authors`; ordering by title is what a tree reader expects, and the id breaks ties so every item comes once.
- **Alternatives considered**: ordering by the moment of adding — stable, but a tree of folders reads by name.

## R6. The events

- **Decision**: `events.py` of the template holds `ItemAddedEvent (item_id, title)` and `ItemRenamedEvent (item_id, old_title, new_title)`; `NotesDomain.events` lists them; the main steps of `AddItemAction` and `RenameItemAction` declare them with `@emits` and write them on `Channel.business`. A rename that changes nothing writes no event.
- **Rationale**: the plugin concept, 6.7; who and when come with every line from the context.
- **Alternatives considered**: events for the notes' actions too — not asked for here.

## R7. The nodes

- **Decision**: the root node `notes` (`attach: root`, page `/`, as it has) holds the list node `item` (`each: {source: list_items, key: item_id}`, no page of its own), under which stand `item-notes`, `item-published` and `item-draft` with the pages, controls, room and history they have.
- **Rationale**: two nodes may not open the same page, and the issue puts all three pages under the item; with the root, the SDK's check now checks `{item_id}` against the list node above, which a node under `core:item` skipped.
- **Alternatives considered**: the list node opening `/items/{item_id}` itself, with two children — the Notes page would no longer be one of three.
