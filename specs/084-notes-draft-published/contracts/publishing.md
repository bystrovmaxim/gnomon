# Contract: publishing a draft

## The action

`POST /p/notes/api/{organization}/revisions`

```json
{
  "item_id": "…",
  "title": "…",
  "comment": "…",
  "release": null,
  "resolutions": [{ "note_id": "…", "choice": "overwrite" }]
}
```

`resolutions` is absent on the first call and carries one choice per conflict on the second. `choice` is `overwrite` or `give_up`.

## The first call

Under the organization's lock the action reads the caller's draft, compares every change's base with the published note now (see [data-model.md](../data-model.md)), and:

- with no conflict: publishes every change as one revision and answers `{"number": n, "changed_at": "…"}`;
- with at least one conflict: writes nothing and answers 409

```json
{
  "error": "conflicts",
  "conflicts": [
    {
      "note_id": "…",
      "state": "changed",
      "body": "my text",
      "base_body": "the text at v6",
      "published_body": "Olga's text",
      "published_by_name": "Olga Sidorova",
      "published_at": "2026-11-10T11:05:00.000000Z"
    }
  ]
}
```

`published_body` is `null` when the note was deleted; `published_by_name` and `published_at` say who published the change or the deletion and when.

## The second call

The action recomputes the conflicts at the moment of the call — never reusing the first call's list — and:

- refuses again with the new list when a conflict has no choice; a conflict that appeared since the first call is answered, not overwritten;
- drops `give_up` changes from the draft, applies `overwrite` ones and every change that has no conflict, and publishes one revision;
- refuses `nothing_to_publish` (409) when nothing is left to apply, naming the revision in force.

## The rules the contract keeps

1. One revision per call; numbers are consecutive per item under the lock.
2. A conflict's choice never publishes more than the note it names.
3. A change given up is removed from the draft; a change applied is removed with the publication.
4. A note restored by an overwrite keeps its id, its author and its creation moment, and takes the member's text.
5. Nothing is written when a call refuses.
