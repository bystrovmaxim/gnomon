# Contract: the template's items

Every route lies under `/p/notes/api/{organization}`, is an action under the core's role `member`, and answers a person who is not a member of `{organization}` with `403 FORBIDDEN_OBJECT`.

| Method | Path | Action | In | Out |
|---|---|---|---|---|
| POST | `/items` | `AddItemAction` | `{title}` | `{item_id, changed_at}` |
| PATCH | `/items` | `RenameItemAction` | `{item_id, title, base_moment}` | `{changed_at}` |
| GET | `/lists/list_items` | `ListItemsAction` | `at?`, `limit?` (1–200, 50), `after?` | `{entries: [{key, title, icon}], next}` |

## Refusals

| Reason | Status | When |
|---|---|---|
| `FORBIDDEN_OBJECT` | 403 | not a member; the item is not a current item of the organization (rename, a note, a revision) |
| `title_taken` | 409 | another item of the organization has the title now |
| `changed_since` | 409 | a rename based on a moment after which the item changed; with `changed_by`, `changed_at` |
| `moment_not_come` | 422 | a `base_moment` later than the watermark, as for a note |
| validation | 422 | a title empty after trimming or longer than 200 characters |

## Changed

`POST /notes` and `POST /revisions` refuse `403 FORBIDDEN_OBJECT` for an `item_id` that is not a current item of the organization.

## The tree

```yaml
- id: notes
  attach: root
  title: Notes
  page: /
  children:
    - id: item
      each: {source: list_items, key: item_id}
      children:
        - {id: item-notes, title: Notes, page: /items/{item_id}, …}
        - {id: item-published, title: Published notes, page: /items/{item_id}/published, …}
        - {id: item-draft, title: Draft, page: /items/{item_id}/draft, …}
```
