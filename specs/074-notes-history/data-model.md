# Data model: the template's history on the server

## Tables (`schema.yaml`; the installer adds `id`, `organization_id`, `created_at`, `updated_at` and the version table)

### `note` (exists)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `item_id` | uuid | no | the catalog item |
| `writer_id` | uuid | no | the member who wrote it |
| `body` | text | no | the text |

Versions: `note_versions`. Editing opens a new version and closes the open one; deleting deletes the current row and closes the open version with `closed_by` and `closed_operation`.

### `revision` (new)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `item_id` | uuid | no | the item whose notes are published |
| `number` | integer | no | 1, 2, … per item; consecutive |
| `title` | text | no | the revision's first line |
| `comment` | text | no | the revision's words, shown under the scale |
| `release` | text | yes | a release label; empty when the revision carries none |
| `publisher_id` | uuid | no | the member who published |

Unique `(item_id, number)`; index `[item_id]`. Versions: `revision_versions`. A revision is written once and never changed; its moment is its `valid_from_at`.

## Entities (results)

- **NoteCoreEntity** (exists): `id`, `item_id`, `writer_id`, `writer_name`, `body`, `updated_at`; + `since` (the open version's start, the `base_moment` an editor sends).
- **RevisionCoreEntity**: `number`, `ref` (`v<number>`), `title`, `comment`, `release`, `publisher_id`, `publisher_name`, `at`.
- **NoteChangeCoreEntity** (the draft): `note_id`, `kind` (`added` | `changed` | `removed`), `body`, `before` (the text in the revision, for `changed` and `removed`), `by_id`, `by_name`, `at`.
- **BarCoreEntity**: `start`, `added`, `changed`, `removed`.
- **MilestoneCoreEntity**: `id` (`v<number>` or `draft`), `at`, `kind` (`revision` | `proposal`), `ref`, `title`, `minor`, `release`, `link` (the draft's page for the proposal).
- **MilestoneCardCoreEntity**: the milestone's fields + `author_id`, `author_name`, `summary` (`added`, `changed`, `removed`), `chips` (the number of notes), `comment`.

## Refusals (`NotesRefusalError`)

| Reason | Status | Details |
|---|---|---|
| `moment_not_come` | 422 | `watermark` |
| `changed_since` | 409 | `changed_by`, `changed_at` |
| `deleted` | 409 | `deleted_by`, `deleted_at` |
| `nothing_to_publish` | 409 | `revision` (the last number) |
| `no_such_note` / `no_such_milestone` | 404 | — |

## Rules

- Every reading query: one moment, the SDK's condition at every version table, `organization_id` in every condition.
- A changing action reads only `note`/`revision`, inside its transaction, after `change_time`.
- `minor` of a revision: it added and removed no note against the revision before it.
