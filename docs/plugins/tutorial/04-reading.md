# 4. Reading

**Builds on**: [3. Your tables](03-your-tables.md). **Next**: [5. Writing](05-writing.md).

Every reading action reads at a moment: the watermark — "now", the latest moment whose answer can no longer change — or a past one. It reads only version tables, binds the organization in every condition, and writes the moment condition through the SDK, so a past moment answers the same forever.

## The action

An action names its role, its organization check and its main step. `@access_decide` refuses a person who is not a member of the organization of the address before any step runs; the main step looks the organization up again:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/actions/list_item_notes_action.py -->
```python
@meta(description="List the notes of an item at one moment", domain=NotesDomain)
@check_roles(MemberRole)
@connection(NotesStorage, key=NOTES_CONNECTION_KEY, description="The plugin's own schema notes")
class ListItemNotesAction(BaseAction[ListItemNotesParams, ListItemNotesResult]):
    """
    AI-CORE-BEGIN
    ROLE: Answer the item's notes page.
    CONTRACT: Reads only note_versions and the core's member versions, all at one moment.
    INVARIANTS: The answer for (organization, moment, parameters) never changes once the moment is not later than the watermark.
    AI-CORE-END
    """

    @access_decide("Refuse a person who is not a member of the organization of the address")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def organization_access_decide(self, params: ListItemNotesParams, box: ToolsBox, connections: Connections, ctx: ContextView) -> Verdict:
        """The organization of the address must be one the person of the token belongs to."""
        _ = (params, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        return await organization_access(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))

    @summary_aspect("Read the item's notes at the moment")
    @context_requires(Ctx.User.user_id, "user.organization")
    async def list_summary(self, params: ListItemNotesParams, state: BaseState, box: ToolsBox, connections: Connections, ctx: ContextView) -> ListItemNotesResult:
        """The notes of the item at the moment, of one writer when the filter names one."""
        _ = (state, box)
        storage = cast(NotesStorage, connections[NOTES_CONNECTION_KEY])
        organization_id = await member_organization_id(storage, ctx.get("user.organization"), ctx.get(Ctx.User.user_id))
        if params.from_at is not None and params.to_at is not None and params.width is not None:
            end, versions = await storage.note_versions_between(organization_id, params.item_id, params.from_at, params.to_at, params.author)
            bars = bars_of(versions, params.from_at, end, params.width) if params.from_at < end else []
            return ListItemNotesResult(bars=[BarCoreEntity(start=found.start, added=found.added, changed=found.changed, removed=found.removed) for found in bars])
        notes = await storage.notes_of_item(organization_id, params.item_id, params.at, params.author)
        return ListItemNotesResult(notes=notes)
```

## The query

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/storage/notes_storage.py -->
```python
    async def notes_of_item(self, organization_id: str, item_id: str, moment: str | None, writer_id: str | None) -> list[NoteCoreEntity]:
        """The notes of ``item_id`` at ``moment`` (the watermark when ``None``), of one writer when ``writer_id`` is given."""
        at = await self._moment(organization_id, moment)
        if at is None:
            return []
        when = "$3::text::timestamptz"
        rows = await self._fetch(
            f"SELECT n.id::text AS id, n.item_id::text AS item_id, n.writer_id::text AS writer_id,"
            f" {member_name('n.organization_id', 'n.writer_id', when)} AS writer_name, n.body AS body,"
            f" {moment_text('n.updated_at')} AS updated_at, {moment_text('n.valid_from_at')} AS since,"
            f" {member_name('n.organization_id', 'n.author_id', 'n.valid_from_at')} AS changed_by"
            f" FROM note_versions n"
            f" WHERE n.organization_id = $1::text::uuid AND n.item_id = $2::text::uuid AND {in_force('n', when)}"
            f" AND ($4::text IS NULL OR n.writer_id = $4::text::uuid)"
            f" ORDER BY n.updated_at, n.id",
            (organization_id, item_id, at, writer_id),
        )
        return [NoteCoreEntity(**_mapping(row)) for row in rows]
```

`in_force` is the SDK's moment condition; `member_name` is the core's function that names a member as they were named at that moment. A moment later than the watermark is refused, because its answer could still change:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/storage/notes_storage.py -->
```python
    async def _moment(self, organization_id: str, moment: str | None) -> str | None:
        """
        The moment a read answers at: the watermark when none is given; a given moment later than the watermark is
        refused, because its answer could still change. ``None`` before the organization's first change.
        """
        watermark = await self._watermark(organization_id)
        if moment is None:
            return watermark
        if watermark is None or moment > watermark:
            raise NotesRefusalError("moment_not_come", 422, watermark=watermark)
        return moment
```

## Check it

```bash
uv run --extra dev pytest packages/maxitor-plugin-template/tests/test_reading_sql.py packages/maxitor-plugin-template/tests/test_notes_changes.py -q
```

```text
17 passed
```

On the local stand the reading is `GET /p/notes/api/<code>/items/<item>/notes`, and `?at=<moment>` reads the past. The list of items reads the same way, `GET /p/notes/api/<code>/lists/list_items?at=<moment>`: it is the source of the list node `item` in Maxitor's tree, so the tree at a past moment holds the items as they were then.
