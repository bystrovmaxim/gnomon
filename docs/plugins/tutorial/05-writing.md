# 5. Writing

**Builds on**: [4. Reading](04-reading.md). **Next**: [6. The backend](06-the-backend.md).

A changing action makes one change in one transaction: the organization's lock and its change time from the core's function `change_time`, then the row and its version. Two changes of one organization never share a moment, and a reader never sees half of one.

## Adding a note

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/storage/notes_storage.py -->
```python
    async def add_note(self, organization_id: str, item_id: str, writer_id: str, body: str, operation: str) -> str:
        """Write a new note and its first version in one transaction; return the change time."""
        await self.begin()
        try:
            changed_at = await self._fetchval(change_time_sql(VERSION_TABLES), (organization_id,))
            note_id = str(uuid4())
            await self._execute(
                "INSERT INTO note (id, organization_id, item_id, writer_id, body, created_at, updated_at)"
                " VALUES ($1::text::uuid, $2::text::uuid, $3::text::uuid, $4::text::uuid, $5, $6, $6)",
                (note_id, organization_id, item_id, writer_id, body, changed_at),
            )
            await self._execute(
                "INSERT INTO note_versions (organization_id, id, valid_from_at, valid_to_at, author_id, operation,"
                " item_id, writer_id, body, created_at, updated_at)"
                " SELECT organization_id, id, $3, NULL, $4::text::uuid, $5, item_id, writer_id, body, created_at, updated_at"
                " FROM note WHERE organization_id = $1::text::uuid AND id = $2::text::uuid",
                (organization_id, note_id, changed_at, writer_id, operation),
            )
            moment = await self._fetchval(f"SELECT {moment_text('$1::timestamptz')}", (changed_at,))
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return str(moment)
```

The action passes the writer from the token, never from the request, and the organization of the address:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/actions/add_note_action.py -->
```python
    @summary_aspect("Write the note and its version, and return the change time")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def write_summary(self, params: AddNoteParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> AddNoteResult:
        """The organization's id again, then one transaction: the organization's lock, the time, the row, its version."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        changed_at = await storage.add_note(
            organization_id=organization_id,
            item_id=params.item_id,
            writer_id=str(ctx.get(Ctx.User.user_id)),
            body=params.body,
            operation=type(self).__name__,
        )
        return AddNoteResult(changed_at=changed_at)
```

## Editing without losing someone else's change

An edit and a deletion send back `base_moment` — the moment the person saw. If the note changed after it, nothing is written and the answer names who changed it and when (`changed_since`); a note deleted meanwhile is refused as `deleted`.

## Check it

On the local stand, signed in, from the site's own page (`Origin` is the site's):

```text
POST /p/notes/api/<code>/notes  {"item_id": "00000000-0000-4000-8000-000000000001", "body": "Written through the gateway"}
200 {"changed_at":"2026-11-11T13:37:36.360615Z"}
```

The same request with another site's `Origin` is refused by the gateway with `403 foreign_origin`.
