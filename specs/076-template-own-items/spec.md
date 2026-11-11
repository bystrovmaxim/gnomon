# Feature Specification: Maxitor plugin template — its own items, what its notes are written on, and its own nodes in the tree

**Feature Branch**: `feature/issue-103-template-own-items`

**Created**: 2026-11-11

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#103, "04 · Maxitor plugin template: its own items — what its notes are written on, and its own nodes in the tree". The issue's body is the source of truth. This work has no screen of its own: the template's pages are bystrovmaxim/gnomon#102, the core's frame that draws the tree is bystrovmaxim/gnomon#74.

## What this is

The plugin template `notes` (`packages/maxitor-plugin-template`) is the small example every Maxitor plugin is copied from, and it needs nothing but the core. A note is written about something, and that something has to exist somewhere a member can create it, name it and find it in the tree. The core has no catalog, no tree node `core:item` and no table of items: a catalog of products and services comes as plugins of its own (bystrovmaxim/gnomon#12), which may or may not be installed. So the template keeps what its notes are about itself: its own items, like folders, with its own node in the tree under which every item shows its three pages.

Nothing of the template, its documentation or the plugin concept leans on a catalog. A richer model, where every record goes through a lifecycle of its own, is the plugin common data environment (bystrovmaxim/gnomon#106); the template keeps the simplest one.

Words used below:

- **Item** — what notes are written on, like a folder: a title, in one organization. Items do not nest.
- **Note** — a text written by a member of an organization about one item.
- **Member** — a person with the core's role `member` in the organization of the address.
- **Moment** — a point in time, to the microsecond, at which something is read; **watermark** — the latest moment whose answer can no longer change, "now".
- **`base_moment`** — the moment a person saw when they started changing something.
- **Tree** — the left navigation of Maxitor; the core builds it from every plugin's `navigation.yaml`.
- **List node** — a node of the tree that multiplies by records at run time: one instance per item. Its instances come from a reading action of its owner, its **source**, in the shape the plugin concept fixes (section 7.4).
- **Gateway** — the core's door to a plugin's API (bystrovmaxim/gnomon#75).

## Clarifications

### Session 2026-11-11

Decided with the maintainer while the issue was written.

- Q: Does the core or another plugin give the template what its notes are about? → A: No. The core has no catalog; a catalog comes as optional plugins. The template keeps its own items.
- Q: Do items nest, like folders inside folders? → A: Not in the template. Nesting needs a list node whose instances have instances of the same node as children, which the language of the tree does not have; it is a later step of the plugin common data environment (bystrovmaxim/gnomon#106).
- Q: Does the template take over a lifecycle of every note, as files have in a common data environment? → A: No. The template stays the small example; the lifecycle is bystrovmaxim/gnomon#106, the last step of the plugins epic. The template's documentation says so in one sentence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A member adds an item and writes notes on it (Priority: P1)

A member of an organization adds an item with a title, and from then on writes notes on that item. A note can be written only on an item that exists in the member's organization.

**Why this priority**: Without its own items the template's notes are written on nothing: every other part of this work stands on it.

**Independent Test**: On a recording connection, add an item, write a note on it and read the item's notes; then try to write a note on an item id that does not exist, and on an item of another organization: both are refused.

**Acceptance Scenarios**:

1. **Given** a member of organization A, **When** they add an item with the title "Payment service", **Then** the item exists in A with that title, and an event "item added" with who and when is written.
2. **Given** an item of A, **When** a member of A writes a note on it, **Then** the note is written and reads among the item's notes.
3. **Given** no item with a given id in A, **When** a member of A writes a note on that id, **Then** the note is refused and nothing is written.
4. **Given** an item of organization B, **When** a member of A writes a note on it, **Then** the note is refused and nothing is written.
5. **Given** an item of A titled "Payment service", **When** a member of A adds another item with the same title, **Then** it is refused and nothing is written.

---

### User Story 2 - A member renames an item (Priority: P2)

A member renames an item. The new title is read from that moment on; a past moment still reads the old one.

**Why this priority**: A folder that cannot be renamed keeps a wrong title forever; but the template works without it.

**Independent Test**: Add an item, rename it, read the list of items now and at a moment before the rename: the new title now, the old one then.

**Acceptance Scenarios**:

1. **Given** an item titled "Payment service", **When** a member renames it to "Payments", **Then** the list now reads "Payments", a moment before the rename reads "Payment service", and an event "item renamed" with who, when, the old and the new title is written.
2. **Given** two items "Payments" and "Stock", **When** a member renames "Stock" to "Payments", **Then** it is refused and nothing is written.
3. **Given** an item renamed by somebody else after the moment a member saw, **When** that member renames it from the moment they saw, **Then** it is refused as a conflict and nothing is written.
4. **Given** an item once titled "Old" and renamed to "New", **When** a member adds another item titled "Old", **Then** it is accepted: a title is unique among the items now, not among past titles.

---

### User Story 3 - The tree shows the template's own nodes (Priority: P1)

The template puts its nodes into the tree by itself: a root node "Notes", under it one node per item of the organization, and under every item its three pages — Notes, Published notes and Draft. Nothing of the template hangs under a node the core does not have.

**Why this priority**: The frame (bystrovmaxim/gnomon#74) and the template's pages (bystrovmaxim/gnomon#102) open the notes from these nodes; with a node the core does not have, the installer refuses the template.

**Independent Test**: Run the plugin's check and the installer's check on the template: both accept it. Call the list of items through the gateway at a moment, in parts: it answers in the shape of a list node's source.

**Acceptance Scenarios**:

1. **Given** the template's `navigation.yaml`, **When** the plugin's check and the installer's check run, **Then** both accept it, and no node is attached to `core:item`.
2. **Given** three items in an organization, **When** the core asks the template's list of items for that organization at a moment, **Then** the answer has three entries, each with the item's id as `key`, its title as `title` and an icon, ordered by title.
3. **Given** more items than the limit asked for, **When** the core asks for a part and then for the next one after it, **Then** every item comes exactly once across the parts, and the last part says there is nothing after it.
4. **Given** an item added at T, **When** the list is read at a moment before T, **Then** that item is not in it.
5. **Given** a person who is not a member of the organization of the address, **When** they ask for the list of items, add or rename an item, **Then** it is refused.

---

### User Story 4 - The documentation speaks of the template's own items (Priority: P3)

A person who reads the plugin concept, the tutorial or the template's README learns that the template keeps its own items, and nowhere reads of catalog items as something the core or the template has.

**Why this priority**: The documentation ships with the change it describes; a reader copying the template from the tutorial copies its own items.

**Independent Test**: Search the plugin documentation, the template's README, its passport and the descriptions in its code: no text speaks of a catalog item, of `core:item` or of a node or table of items the core does not have; the concept's tree of the core lists only the nodes the core really has.

**Acceptance Scenarios**:

1. **Given** the plugin concept, **When** a reader reads its glossary, the core's tree (7.1) and the example plugin (section 12), **Then** they read of the template's own items and its own root node, and the core's tree holds no node the core does not have.
2. **Given** the tutorial, **When** a reader follows the chapters on the passport, the tables and reading, **Then** they meet the table `item` and the list of items as the template has them.
3. **Given** the template's description of its history, **When** a reader reads it, **Then** one sentence says that publishing a whole item under a number is the simplest model of a release, and that a lifecycle of every record is the plugin common data environment (bystrovmaxim/gnomon#106).

### Edge Cases

- A title with spaces at its start or end: the spaces are dropped before it is checked and kept; a title that is empty after that is refused.
- A title of 201 characters or more is refused; one of exactly 200 is accepted.
- Two members add items with the same title at the same time: one is accepted, the other refused; never both.
- Renaming an item to the title it has now changes nothing and writes no version and no event.
- Renaming an item that does not exist in the member's organization is refused.
- The list of items asked for with a moment later than the watermark is refused with the watermark, as every reading of the template is.
- An organization with no items: the list answers no entries, and the tree shows the root node "Notes" with nothing under it.
- Notes written before this work on an item id that has no item: the template has no such data outside tests, so nothing moves.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The template MUST keep its own items: a title and the organization, versioned like everything the template stores, so that any past moment reads the items and their titles as they were.
- **FR-002**: A note's `item_id` MUST be a key to an item of the same organization; a note on an item that does not exist in the organization MUST be refused with nothing written. The same holds for a revision of an item's notes.
- **FR-003**: Adding an item MUST be an action of the template under the core's role `member`, taking a title and writing an item and a typed event "item added" with who and when.
- **FR-004**: Renaming an item MUST be an action of the template under the core's role `member`, taking the item, the new title and the `base_moment`, writing the new title and a typed event "item renamed" with who, when, the old and the new title; a rename based on a moment after which somebody else changed the item MUST be refused as a conflict.
- **FR-005**: A title MUST be 1–200 characters after the spaces at its ends are dropped, and unique among the organization's items now; the check MUST hold under concurrent adds and renames.
- **FR-006**: The list of items MUST be a reading action at a moment in the shape of a list node's source (the plugin concept, 7.4): `entries` of `key` (the item's id), `title` and `icon`, ordered by title, in parts with `limit` and `after`, and `next` for the part after.
- **FR-007**: Every new action MUST refuse a person who is not a member of the organization of the address, as the template's other actions do.
- **FR-008**: The template's `navigation.yaml` MUST hold the root node "Notes" (`attach: root`), under it the list node `item` whose source is the list of items and whose key is `item_id`, and under every item its three pages: Notes, Published notes and Draft, with the controls, rooms and history they have. No node MUST be attached to `core:item`.
- **FR-009**: The plugin's check and the installer's check MUST accept the template.
- **FR-010**: Every new action MUST be reachable through the gateway on the local stand.
- **FR-011**: The plugin concept (its glossary, the core's tree in 7.1 and the example plugin in section 12), the tutorial, the template's README, its passport and every description in its code MUST speak of the template's own items; no page MUST speak of catalog items as something the core or the template has; the core's tree in the concept MUST list only the nodes the core really has.
- **FR-012**: The template's description of its history MUST say in one sentence that publishing a whole item under a number is the simplest model of a release, and that a lifecycle of every record is the plugin common data environment (bystrovmaxim/gnomon#106).
- **FR-013**: The template's graph file MUST be rebuilt, and the template's version raised, with a changelog entry.

### Key Entities

- **Item**: what notes are written on. A title, the organization; versions like every table of the template. No parent: items do not nest.
- **Note** (exists): a text about one item; its `item_id` becomes a key to an item of the same organization.
- **Revision** (exists): an item's notes published under a number; its `item_id` becomes a key the same way.
- **Item added / item renamed**: typed events of the template's domain, with who, when and, for a rename, the old and the new title.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member adds an item and writes a note on it in two calls; every one of the acceptance scenarios above has a test that fails when the behaviour it checks is broken.
- **SC-002**: 0 nodes of the template are attached to a node the core does not have; the plugin's check and the installer's check accept the template on the first run.
- **SC-003**: Every one of the template's new actions answers through the gateway on the local stand.
- **SC-004**: A search of the plugin documentation, the template's README, passport and code descriptions finds 0 texts that speak of a catalog item, of `core:item`, or of a table or node of items the core does not have.
- **SC-005**: A list of 120 items read in parts of 50 gives every item exactly once, in three parts.

## Assumptions

- The template's actions and their tests run without a database, on a recording connection, as they do.
- Uniqueness of a title is exact after the spaces at its ends are dropped: "Payments" and "payments" are two titles.
- The icon of every item in the list is one fixed icon of the template.
- An item is added and renamed, never deleted, in this work: deleting one, with its notes, is a question of its own.
- Nested items and a lifecycle of every note are outside this work (see Clarifications).
- The frame that draws the tree (bystrovmaxim/gnomon#74) and the template's pages (bystrovmaxim/gnomon#102) come after this work; here the tree is checked by the plugin's and the installer's checks, and the list through the gateway.
