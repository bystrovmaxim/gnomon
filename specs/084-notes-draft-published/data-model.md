# Data model: a draft of my own over everyone's published notes

## Tables

### `note` (existing, unchanged shape)

The published note as it reads now. It changes only in a publication's transaction.

| Column | Type | Null | Description |
|---|---|---|---|
| `item_id` | uuid | no | The item the note is about. |
| `writer_id` | uuid | no | The account of the member who wrote the note — its author. |
| `body` | text | no | The text of the note. |

### `note_change` (new)

One note in one person's draft of one item.

| Column | Type | Null | Description |
|---|---|---|---|
| `item_id` | uuid | no | The item whose notes the draft is of. |
| `person_id` | uuid | no | The member whose draft the change is in. |
| `note_id` | uuid | no | The note, published or not yet. |
| `author_id` | uuid | no | The published note's author; the person for a new note. |
| `state` | text | no | `new`, `changed` or `deleted`. |
| `body` | text | no | The text the change gives the note; the base text for a deletion. |
| `base_body` | text | yes | The published text the change was made over; null for a new note. |
| `base_revision` | integer | yes | The revision number in force when the change was made; null before the first. |

- Unique: `(organization_id, person_id, note_id)` — one change per note in a person's draft.
- Index: `(organization_id, item_id, person_id)` — a draft's read.
- Key: `item_id` → `item.id`, restrict.
- Foreign keys to the core (`foreign-keys.yaml`): `(organization_id, person_id)` and `(organization_id, author_id)` → `core.user (organization_id, account_id)`.

`note_change_versions` is built by the installer like every version table: the draft at a moment is the row in force then.

### `revision` (existing, unchanged shape)

The whole published state published at once: `number`, `title`, `comment`, `release`, `publisher_id`, and its moment.

## Entities of the actions

### `NoteChangeCoreEntity`

`note_id`, `state`, `body`, `base_body`, `base_revision`, `author_id`, `author_name`, `changed_at`, and for the read at now the conflict's other side: `conflict` (bool), `published_body` (text or null for a deleted note), `published_by_name`, `published_at`.

### `NoteConflictCoreEntity`

`note_id`, `state`, `body`, `base_body`, `published_body`, `published_by_name`, `published_at` — one side is the member's, the other is what they would overwrite.

## State transitions

A draft's change:

- **new** — made by `AddNoteAction`; reverted by `RevertNoteChangeAction` (the row is deleted); published by inserting the note.
- **changed** — made by `EditNoteAction` over a published note, keeping the base of the first change of that note; deleted from the draft by a revert; published by updating the note, or restoring it when it was deleted since.
- **deleted** — made by `DeleteNoteAction`; reverted (the row is deleted); published by deleting the note, or dropped when the note is already gone.

The published note:

- exists at a revision's moment as `note_versions` holds it;
- changes only when a publication applies a `changed`, `new` or `deleted` change;
- is restored with its original id, author and creation moment when a publication overwrites a deletion.

## The conflict's rule

Given a change `c` and the published note `p` at the moment of publishing:

- `c.state == new`: never a conflict.
- `c.state == changed`: conflict when `p` is absent or `p.body != c.base_body`; no conflict when `p.body == c.base_body`; a no-op when `p.body == c.body`.
- `c.state == deleted`: conflict when `p` is present and `p.body != c.base_body`; a no-op when `p` is absent; no conflict when `p.body == c.base_body`.
