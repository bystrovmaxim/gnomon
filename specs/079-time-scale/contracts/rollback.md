# Contract: rolling back to a publication

`RollbackPublicationAction` — `POST /p/notes/api/{organization}/revisions/rollback`, through the gateway with the organization's token; the person must be a member of the organization.

## Request

```json
{ "item_id": "payments-service", "to_revision": 3, "title": "Back to v3", "comment": "The retry change of v4 broke the settlement import." }
```

## Answer

```json
{ "number": 6, "back": 3 }
```

## Rules

1. `to_revision` must be a revision of the item older than the one in force; otherwise refused with `not_a_past_revision`.
2. In one transaction: the notes the revision `to_revision` held become the published notes — a note it held and the item no longer publishes is opened again, a note it did not hold is closed, a note whose text differs gets a new version —, and revision `number + 1` is written with `back_revision = to_revision`.
3. The person's draft is not touched; a draft made over an older base meets the conflicts of publishing as it does after any publication.
4. The milestone the history answers for it has `kind: "rollback"`; its card names `to v<back>`.
