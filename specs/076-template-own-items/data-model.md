# Data model: the template's own items

Every table gets from the installer `id`, `organization_id`, `created_at`, `updated_at`, its version table and its indexes (versioned storage).

## `item` (new)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `title` | text | no | the item's title: 1–200 characters, no spaces at its ends, unique among the organization's items now |

Unique `[title]` (built as `(organization_id, title)`). Versions: `item_versions`. Never deleted in this work.

## `note` (exists)

`item_id` gains a key: `keys: [{columns: [item_id], table: item, references: [id]}]`. Description: "The item the note is about."

## `revision` (exists)

`item_id` gains the same key. Description: "The item whose notes are published."

## `VERSION_TABLES`

`("item_versions", "note_versions", "revision_versions")`: the change time and the watermark follow all three.

## Entities

- **ItemEntryCoreEntity**: `key`, `title`, `icon` — one entry of the list node's source.

## Events

- **ItemAddedEvent**: `item_id`, `title`.
- **ItemRenamedEvent**: `item_id`, `old_title`, `new_title`.

## Rules

1. A note and a revision point only at an item of their organization (decision R2, key R1).
2. A title is unique among the items now, checked under the organization's lock (R3).
3. A rename based on a moment after which the item changed is refused (R4); the moment it sends is the panel's moment the member saw.
