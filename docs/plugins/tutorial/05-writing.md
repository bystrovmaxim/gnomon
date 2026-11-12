# 5. Writing

**Builds on**: [4. Reading](04-reading.md). **Next**: [6. The backend](06-the-backend.md).

A changing action makes one change in one transaction: the organization's lock and its change time from the core's function `change_time`, then the row and its version. Two changes of one organization never share a moment, and a reader never sees half of one.

## Adding a note

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/storage/notes_storage.py -->
```python
    async def add_note_change(self, organization_id: str, item_id: str, person_id: str, body: str, operation: str) -> str:
        """Write a new note into the person's draft and its first version in one transaction; return the change time."""
        await self.begin()
        try:
            changed_at, now = await self._change_time_now(organization_id)
            change_id, note_id = str(uuid4()), str(uuid4())
            await self._execute(
                "INSERT INTO note_change (id, organization_id, item_id, person_id, note_id, writer_id, state, body,"
                " base_body, base_revision, created_at, updated_at)"
                " VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid, $4::text::uuid, $5::text::uuid,"
                " $4::text::uuid, 'new', $6, NULL, NULL, $7, $7)",
                (change_id, organization_id, item_id, person_id, note_id, body, changed_at),
            )
            await self._open_change_version(organization_id, person_id, note_id, changed_at, person_id, operation)
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return now
```

The action passes the writer from the token, never from the request, and the organization of the address:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/actions/add_note_action.py -->
```python
    @summary_aspect("Write the change and its version, and return the change time")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def write_summary(self, params: AddNoteParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> AddNoteResult:
        """The organization's id again, then one transaction: the organization's lock, the time, the row, its version."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        changed_at = await storage.add_note_change(
            organization_id=organization_id,
            item_id=params.item_id,
            person_id=str(ctx.get(Ctx.User.user_id)),
            body=params.body,
            operation=type(self).__name__,
        )
        return AddNoteResult(changed_at=changed_at)
```

## Editing without losing someone else's change

An edit and a deletion write the person's own draft, never the published notes: `edit_note` takes the published text the person saw as `base_body` and the revision in force as `base_revision`; `delete_note` takes the revision alone and keeps the published text it reads itself, so a note's text never travels in an address. Both keep their base with the change. Whether that base still holds is decided when the draft is published, not when it is written: a change over a note that is unchanged goes in as it is, one that meets someone else's publication is a conflict the person overwrites or gives up there. A change that leaves the note as published leaves the draft.

## Check it

On the local stand, signed in, from the site's own page (`Origin` is the site's):

```text
POST /p/notes/api/<code>/notes  {"item_id": "00000000-0000-4000-8000-000000000001", "body": "Written through the gateway"}
200 {"changed_at":"2026-11-11T13:37:36.360615Z"}
```

The same request with another site's `Origin` is refused by the gateway with `403 foreign_origin`.
