# Versioned storage: current tables, versions and time

How the tables of the database are laid out so that any past moment is read by the same actions and the same SQL as the present; how they are written and how they are read. The document is about the mechanism: the table and field names below are an example, the service fields and the rules are mandatory.

In short: every data table has a pair — a version table; every change gets a **time**, one per transaction; everything shown on a screen is read from the version tables at one moment; everything that changes is written to the current tables and to the versions in one transaction. There are no service tables: everything there is to know about changes lies in the versions themselves.

The example used throughout: an entity `items`, its children `parts` (field `parts.item_id`), a reference entity `places` (field `parts.place_id`) and a many-to-many link `item_tags(item_id, tag_id)`. The data boundary is the **organization** — the area inside which changes are ordered and data is isolated.

## Two kinds of tables

**Current tables** are the ordinary tables of a schema: `items`, `parts`, `places`, `item_tags`, one per entity and per pure link. All the database's constraints live in them: primary keys, foreign keys, uniqueness, checks. Only changing actions read them. For screens they do not exist.

**Version tables** — one per current table, named `<table>_versions`. A version row is a full copy of the current row plus service fields:

```text
item_versions
    organization_id      -- always, even if it could be derived from other fields
    id                   -- the entity's id, the same in all its versions
    valid_from_at        -- the change time from which the version is in force
    valid_to_at          -- the change time from which it is not; NULL — in force now
    valid_during         -- tstzrange(valid_from_at, valid_to_at), a stored generated field
    author_id            -- who opened the version; NULL for a system operation
    operation            -- the name of the action or system operation that opened it
    closed_by            -- who closed it; NULL while the version is open
    closed_operation     -- what closed it
    <every field of the current table items>
```

The period is half-open: `[valid_from_at, valid_to_at)`. At a moment `T` the version whose period contains `T` is in force. The primary key is `(organization_id, id, valid_from_at)`. The field `valid_during` serves the constraint below and is convenient for a person; reading queries use the two bounds (section 5). Overlapping periods of one entity are forbidden by the database:

```sql
ALTER TABLE item_versions
    ADD CONSTRAINT item_versions_no_overlap
    EXCLUDE USING gist (organization_id WITH =, id WITH =, valid_during WITH &&);
```

For a pure link the key of a version is the pair instead of `id`: for `item_tag_versions` it is `(item_id, tag_id)`.

**The change time** is a `timestamptz` to the microsecond, one per transaction, issued after the organization's lock (section 3). All versions opened and closed by one transaction carry the same time, and by it they gather into one change. Times are comparable across organizations and schemas because they come from one database's clock.

The four authorship fields stand in every version, not in a separate journal. That is the price of having no service tables, and it is small: two identifiers and two short names per row. What it gives and what it costs — sections 4 and 8.

## 1. Are all tables kept this way

Yes — every data table. The rule: **if a past screen can show it, it has versions.** That includes the ones easy to forget: entities that are people, many-to-many links, position and order fields, reference lists.

Only tables that are not the state of data but the mechanics of work stay without versions: sessions, tokens, queues. There are no tables of the versioning mechanism itself.

**Reference lists** are kept like any entity: a current table with constraints and a version table. Their history shows everything that happened to a value:

| Event | How it looks in the versions |
|---|---|
| the value appeared | the first version `[T, ∞)` with an author |
| renamed or its parameters changed | the version closed at `T`, a new version with the new fields |
| blocked | a new version with a blocking field (for example `blocked_at`); the value is still referenced and cannot be deleted |
| deleted | the current row deleted, the version closed at `T` with `closed_by`; the database allows this only when nothing refers to it (`RESTRICT`) |

A past row referring to a deleted or blocked value reads without loss: a join with the reference list's version table at the same moment finds the value as it was then.

If a reference list's values come with the code, on deployment a system change (`author_id = NULL`, `operation` — the migration's name) writes them into each organization the list belongs to. A value a user changes gets an ordinary change with an author.

References kept as fields of an entity (`parts.item_id`, `parts.place_id`) are part of its version and need no tables of their own. The other side of a link — "the parts of an item" — is derived from the children's rows and has no version of its own.

## 2. How foreign keys work

Constraints live in the current tables; version tables have no links between them. This is not a simplification but the only possible option: a foreign key points at a row, while the target entity has many version rows, and they change when the referring entity has not changed at all. The key would have to be moved on every change of the target, and the target's history would fall apart.

| What | Current tables | Version tables |
|---|---|---|
| primary key | `id` | `(organization_id, id, valid_from_at)` |
| foreign keys | yes, all `ON DELETE RESTRICT` | none |
| uniqueness, checks | yes | none |
| overlapping periods | — | forbidden by `EXCLUDE` |

**Why `RESTRICT` and not `CASCADE`.** A cascading delete in the database would bypass the writing of versions: the children would disappear with the parent, and their last version would stay open. The resource deletes children explicitly, row by row, and each gets a closing version. On top of that `RESTRICT` gives the rule "only what nothing refers to is deleted" by the database's own means.

**Why the past is consistent without keys anyway.** At any moment `T` a part's version refers to an item that has a version in force at `T`. It follows from the current tables: when the part was written, the item existed (the foreign key); while the part referred to it, it could not be deleted (`RESTRICT`); so the item's versions cover the whole life of the part. A join by `(organization_id, id)` with a filter by the moment always finds exactly one row.

Hence the answer to who creates versions. **Not the action.** The action calls the resource's methods — "update", "delete", "link" — and the resource writes the current row and its version in one transaction. The mechanism is one for all tables, in the resource's code, and no path of writing bypasses it. The action knows one thing about the change: the time the resource returned after commit.

## 3. How to write

Every change is one transaction of a changing action, and inside it the sequence is always the same:

1. **Take the organization's lock** — `SELECT pg_advisory_xact_lock(hashtext(:org))`. The lock lives in the database's memory, is held until the end of the transaction and released by itself. From this moment nobody else writes in this organization — into any schema.
2. **Issue the time** — once per transaction:

```sql
SELECT greatest(clock_timestamp(), :watermark + interval '1 microsecond') AS changed_at;
```

   `:watermark` is the time of the organization's last committed change (section 4). The database's clock can step back after a time correction; `greatest` guarantees that the new time is strictly greater than every one written, and since the lock is already taken, greater than every future one too. The time is taken **after** the lock: otherwise a transaction that waited on the lock would close someone else's version with a time earlier than its start.

   A plugin does both steps in one call of the core's function `change_time(:org)`, which takes the lock and answers the time after the core's last change; the plugin takes the greatest of it and one microsecond after its own last change (`maxitor_plugin_sdk.core_functions.change_time_sql`). The lock is the same for the core and every plugin.

3. **Read and check** everything the action needs, from the current tables (section 6).
4. **Change** rows through the resource's methods. For each affected row the resource:

```sql
-- the change: the current row
UPDATE items SET name = :name WHERE id = :id;

-- close the version in force
UPDATE item_versions
   SET valid_to_at = :changed_at, closed_by = :author, closed_operation = :action
 WHERE organization_id = :org AND id = :id AND valid_to_at IS NULL
   AND valid_from_at < :changed_at;

-- write the new full state; a repeated change of the same row in the same
-- transaction rewrites the version of this time rather than adding a second one
INSERT INTO item_versions (organization_id, id, valid_from_at, valid_to_at, author_id, operation, name, ...)
SELECT :org, id, :changed_at, NULL, :author, :action, name, ...
  FROM items WHERE id = :id
ON CONFLICT (organization_id, id, valid_from_at)
DO UPDATE SET name = EXCLUDED.name, ...;
```

   Creation inserts the current row and the first version `[T, ∞)`. Deletion deletes the current row and closes the version at `T` with `closed_by` and `closed_operation`; there is no new version (more in "Deletion", section 8). A row created and deleted in one transaction leaves no version at all — its version with `valid_from_at = T` is deleted, otherwise an empty period `[T, T)` would remain. A many-to-many link — the same by the pair of keys.

5. **Commit** the transaction and return `changed_at` to the caller.

Three rules inside this sequence:

- **One row — one version per change.** If an action changes one row twice, the second write rewrites the version with `valid_from_at = T` (`ON CONFLICT ... DO UPDATE`), and the closing `UPDATE` does not touch it thanks to the condition `valid_from_at < :changed_at`. At the moment `T` the final state after the action is visible, not the intermediate ones.
- **An unchanged row gets no version.** Before writing, the resource compares the new state with the current one; if they match, it writes nothing. Rarely changing entities are not copied.
- **An empty change is not a change.** If by the end of the transaction no row has changed, the transaction is rolled back and leaves no trace: there is no time without versions.

**Why a lock, when rows are locked anyway.** A row lock protects one row: two transactions changing one record line up one after another. But the order is needed between **different** rows of one organization. Transaction A took the time `.100` and has not committed yet; B took `.200`, changed another row and committed; a reader opened the moment `.250` and saw B without A; A committed; the same moment `.250` now contains A as well — the published past has changed, though no row lock arose between A and B. One lock per organization, taken before the time is issued and held until commit, makes the order of times equal to the order of commits. It also rules out deadlocks between an organization's writers: there are never two of them at once. Writing is done by people by hand, tens of transactions per second per organization at most — a limit a per-transaction lock of a few milliseconds does not feel. Readers take no locks and do not notice it.

**Nested calls.** The resource is one per transaction; a nested call receives a wrapper by rule 26 of the constitution. The time belongs to the transaction: the wrapper writes versions with the same `changed_at`. One action never creates two changes.

**A check, not a trigger.** The invariant "the current table equals the set of open versions" could be guarded by a trigger, but it would duplicate the resource's logic in SQL. Instead a test of the closing check run checks the invariant: for each pair of tables `SELECT ... EXCEPT SELECT ...` in both directions must be empty.

## 4. How to read for today

"Today" is not `now()`. A transaction with time `T` has not committed yet; a reader at `T′ > T` does not see it, and after the commit will, so the past at `T′` would change. Reading is allowed only at the **watermark** — the time of the organization's last committed change. Thanks to the lock, any uncommitted transaction has a time greater than the watermark, so everything not later than it is final.

The watermark is computed from the versions themselves, in one query over all version tables of all schemas, which the core assembles from the schema registry (section 7):

```sql
SELECT max(t) FROM (
    SELECT max(valid_from_at) AS t FROM organization.item_versions WHERE organization_id = :org
    UNION ALL
    SELECT max(valid_to_at)          FROM organization.item_versions WHERE organization_id = :org
    UNION ALL
    SELECT max(valid_from_at)        FROM organization.part_versions WHERE organization_id = :org
    UNION ALL
    SELECT max(valid_to_at)          FROM organization.part_versions WHERE organization_id = :org
    UNION ALL
    ...                                -- so for every version table of every schema
) AS last_changes;
```

Two `max` per table, because deletion does not open a version but only closes one: without `valid_to_at`, a change that only deletes rows would not move the watermark, and "now" would show what was deleted. Each `max`, with the indexes of section 5, is one visit to the tail of an index; for a hundred or a hundred and fifty tables that is two or three hundred visits, around 5–20 ms with a warm cache, and the query is one, that is one snapshot: two separate queries could see a transaction in one table and not in another.

**The watermark is not computed for every request.** The server keeps it in process memory per organization and drops it on a `NOTIFY` the writer sends after commit; in the steady state reading the watermark is reading memory. Under the lock the writer takes it fresh from the database with the same query: that is how the protection of the time against a clock step works (section 3), and these milliseconds under the lock are the only place where the price of having no counter table shows in numbers. At 20 ms under the lock an organization's ceiling is about fifty transactions per second, an order of magnitude above the expected load.

Then it is the same reading action and the same SQL as for the past, with `moment = watermark`.

**Screens read only version tables.** No action that returns data for display touches the current tables. The temptation is great — for "now" the current table is smaller and simpler — but it would create a second reading path, with its own joins and its own response format, and two paths inevitably drift apart. The price of a single path is a version table bigger than the current one; the indexes pay it (section 5), not the code.

Two consequences for the interface:

- **An answer at a moment does not change.** An action's result for the triple (organization, moment, parameters) never changes if the moment is not later than the watermark: it can be cached forever, tagged with an `ETag`, kept at any level. The "Now" mode comes down to "learn the watermark and take the answer"; the server tells subscribers the new watermark after each commit, and there is no need to poll it.
- **After a write — an ordinary read.** The changing action returned `changed_at`; a client in "Now" mode rereads the screen with ordinary reading actions at it. The state "after" and the state "before" are one and the same action with `T` and `T − 1 µs`: thanks to the rule of issuing times there is always at least a microsecond between two changes.

**A moment is an opaque string.** Between client and server a moment travels as ISO 8601 with microseconds and is compared as a string of the same form. The client does not turn it into a `Date`: JavaScript is precise to the millisecond, and a moment that went through `Date` would stop falling into its period.

## 5. How to read at any moment

A moment on the scale, not later than the watermark, is passed to the action as it is; there is no translation into a number. Inside, every table of the query has the same condition on the moment, in the same form:

```sql
valid_from_at <= :moment AND (valid_to_at IS NULL OR valid_to_at > :moment)
```

This is the same as `valid_during @> :moment`, but in a form a B-tree understands (see "Indexes" below). One shared function writes the condition, not each action by hand. An example:

```sql
SELECT i.id, i.name, p.id AS part_id, pl.name AS place_name
  FROM item_versions i
  JOIN part_versions p
    ON p.organization_id = i.organization_id
   AND p.item_id = i.id
   AND p.valid_from_at <= :moment AND (p.valid_to_at IS NULL OR p.valid_to_at > :moment)
  JOIN place_versions pl
    ON pl.organization_id = p.organization_id
   AND pl.id = p.place_id
   AND pl.valid_from_at <= :moment AND (pl.valid_to_at IS NULL OR pl.valid_to_at > :moment)
 WHERE i.organization_id = :org
   AND i.valid_from_at <= :moment AND (i.valid_to_at IS NULL OR i.valid_to_at > :moment);
```

Three rules of a query:

- **one moment for the whole query** — all participants of a join, whatever schemas they come from, are taken at the same `T`;
- **a condition at every table** — no version table without a condition on the moment; a test that parses the SQL of reading actions checks this;
- **`organization_id` in every condition** — both in `WHERE` and in every `JOIN`. The organization is the one in the request's address, whose membership the gateway and the action have checked (see [plugins, section 6.5](concept.md)); it never comes from the request body.

**Indexes.** Each version table has one GiST for the constraint and a B-tree for each access path; the set is confirmed by plans and measurements:

- GiST on `(organization_id, id, valid_during)` via `btree_gist` — serves `EXCLUDE` and a point read by `id`. For reading by other keys GiST is no good: every open version has an infinite upper bound, and any index page holding even one open version "contains" any recent moment. Open versions lie mixed with closed ones, so for a wide read GiST walks almost all pages of the key's subtree, and the cost grows with the depth of history;
- B-tree on `(organization_id, <parent key>, valid_to_at)` — the main reading index, one per access path. With the condition in the form above the planner makes two passes over it: open versions (`valid_to_at IS NULL`) and those closed after the moment (`valid_to_at > :moment`), merges them and filters by `valid_from_at`. For "now" and recent moments that is exactly the current rows plus a little, and the cost does not depend on the depth of history; for a distant moment — all versions closed after it, and such reads are rare. A B-tree on `valid_from_at` is not needed for reading at a moment: it would walk the key's whole history;
- B-tree on `(organization_id, valid_from_at)` — for the watermark and the list of changes;
- B-tree on `(organization_id, valid_to_at) WHERE valid_to_at IS NOT NULL` — for the same. **Partial, and that matters:** open versions have an empty `valid_to_at`, a B-tree keeps `NULL` at the end, and `max()` without a partial index would first walk all open versions, that is all current rows of the table, before reaching the last closing. With the partial index it is one visit to the tail.

The keys of all version tables start with `organization_id`, so that partitioning by organization can be turned on without rebuilding the schema; partitioning by time, if an archive needs it, falls on `valid_from_at`.

**The list of changes over an interval** — for the time scale, the journal and the volume of changes — is read from the same tables: in each version table, rows with `valid_from_at` in the interval give the openings, rows with `valid_to_at` in the interval and `closed_by IS NOT NULL` give the closings; their union over all tables, grouped by time, is the changes, one per transaction, with author and operation. The core assembles the query from the schema registry; the time indexes make it a range read in each table.

**Comparing two moments A → B** is the same query: what changed is whatever has `valid_from_at` or `valid_to_at` in `(A, B]`. A record only in B — added, only in A — deleted, in both with a difference — changed; matched by `id`.

## 6. What changing actions read

**Only the current tables, inside their own transaction, after the lock.** The reasons:

- constraints and conflicts are about the present: you cannot delete what is referenced *now*, whatever moment the user has open;
- row locks (`FOR UPDATE`) work on current rows;
- foreign keys and uniqueness are there too.

A changing action has no `moment` parameter for reading. But it may have a **`base_moment`** parameter — the moment the user saw while editing. Version tables give a conflict check for free: if the open version of a row the action is about to change has `valid_from_at > base_moment`, someone changed it after the user looked at it. The action answers with a conflict, the client rereads. The check is per row, not per organization, so parallel edits of different rows do not get in each other's way. The parameter is optional and makes sense for editing existing rows, not for creating.

**History is only looked at.** No action restores or rewrites the past: a screen at a past moment and every comparison of two moments offer no writing. The one thing a changing action takes from the version tables is when and by whom a row was last changed or closed — for the conflict of `base_moment` and its answer.

The right to read the past is the present one: whoever has access to the data now sees its whole history.

## 7. Several schemas: the core and plugins

The data of the core and of each plugin lies in a PostgreSQL schema of its own. A plugin depends on the core and possibly on other plugins; the core and the plugins it depends on know nothing of it. Versioning does not break this:

- **A schema has nothing but its tables.** Deploying a plugin's version creates its schema with current tables and version tables, built by the core from the plugin's `schema.yaml`; it is deployed once for every organization on that version. Removing the plugin from an organization deletes that organization's rows, current rows and versions alike; the schema stays for the others (bystrovmaxim/gnomon#94).
- **The mechanism is one and belongs to the core.** The shape of the service fields, the organization's lock, the issuing of time, the watermark, the list of changes, the check of reading actions' SQL — the core gives all of it to every schema as it is. A plugin does not write its own versioning, it only declares its tables. Its database user sees only its own schema, and reaches the core through five functions: `change_time`, `watermark`, `is_member`, `member_organization`, `member_name` (plugins, section 5.4).
- **The schema registry is the domain `plugins`.** It knows every deployed version's schema; the core's `watermark` answers the core's tables, and a plugin takes the greatest of it and its own. No order of locks is needed, because the lock is one per organization.
- **The moment is one for all schemas.** Time is a common coordinate: the core's and a plugin's tables in one query are taken at the same `T`. A plugin writes only its own schema, so each transaction lies in one schema; times of different schemas are still comparable, because they come from one clock under one lock.
- **A foreign key between schemas goes only down.** A plugin's current table may refer to a current table of the core — an organization's user or the organization — never the other way; a key to a dependency's tables waits for moving organizations between versions. Such a `RESTRICT` key means that deleting a core row runs into the data of a plugin the core does not know about. That is the price of the dependency, and the core passes it to the plugin through an extension point "may this be deleted", not through a database error; how extension points work is a question of the plugin architecture, not of this document.
- **Version tables do not refer to each other across schemas** — just as inside a schema (section 2).

## 8. The remaining questions of principle

**Why there are no service tables and what it costs.** A journal of changes with author and operation, and a counter row with the last time, can both be derived from the versions, and both would be caches. Without them there is no second source of truth that can drift from the versions, no foreign keys from every version table into a journal, and a plugin's schema has nothing but its own tables. The price is four authorship fields in every version and two queries assembled over all version tables: the watermark and the list of changes. The watermark, with the partial index and the memory cache (section 4), is cheap. The list of changes over a short interval is a range read in each table, cheap too. The weak spot is one: **the time scale over a long period** for a large organization. A union of a hundred tables over a year, with ten times more rows in versions than there would be in a journal — a transaction of a hundred rows is a hundred versions against one record — will take hundreds of milliseconds, maybe seconds. Screens do not feel it, only the chart of the volume of changes does. If measurement confirms it, what comes back first is not the journal but an incremental aggregate "changes per hour per organization", filled in the same transaction; the journal second. Both are a cache, rebuildable from the versions at any moment, not a source of truth.

**Deletion: physical in the current tables, none in the versions.** Deletion has two layers, and they differ.

- In the **current table** the row is really deleted. Only so do `RESTRICT`, uniqueness and checks work: the database itself refuses to delete what is referenced, and lets a freed unique value be taken again. There is no "deleted" flag in the current tables; if an entity by its meaning needs blocking or revoking, that is its own field (`blocked_at`), not a substitute for deletion.
- In the **version table** nothing is deleted. Deletion is closing the last version with time `T`, `closed_by` and `closed_operation`; no new version appears. A deleted entity is one without an open version; at any moment before `T` it reads as it was, at `T` and later it is not there. There is no "deleted" flag in the versions either: the absence of an open version is the deletion, and a reading query knows nothing about it — the condition on the moment selects what is needed by itself.
- Recreating an entity with the same `id` after deletion is allowed: a new version `[T₂, ∞)` beside the closed `[T₀, T₁)`, the periods do not overlap, `EXCLUDE` is satisfied. This is not a resurrection of the old row but a new life of the same identifier; returning to a past state (section 6) does exactly this.

Version rows physically disappear in three cases only, and none of them is a user deleting data: a row created and deleted in one transaction (section 3); moving an old period to an archive; erasing personal data on request, which does not delete rows but rewrites fields (below). Everything else is only adding versions and closing periods.

**What counts as one change.** One transaction of one action — one change, one time. A continuous user action — dragging, typing — is one change when it ends, not one per step: the client sends the result. A bulk import is one change.

**Schema evolution.** A plugin has no migrations: each of its versions is a new schema built from its own `schema.yaml`. In the core, a migration changes a current table and its version table alike: a column added — `NULL` or the default in old versions; renamed — in both; dropped — the history loses the field, and that goes into the changelog. A structural migration creates no change. A data migration that changes the meaning of records does: a system one, with `author_id = NULL` and `operation` named after the migration. Only it changes the past, and only by the maintainer's decision.

**Personal data.** Versions keep old values of fields about people. Erasing personal data on request is a system operation that rewrites the fields in all versions and in the current row, without a new change. This is the second and last case where the past is rewritten; it is documented separately.

**Isolating organizations.** `organization_id` in every version table and in every condition; the organization from the address, checked by membership. This also prepares the next steps: partitioning by organization, then a database per organization, a database per plugin schema and an archive database for an old period. The choice of connection is central: an action asks a resource, the resource knows where to go by (schema, organization, moment). Reading actions know neither the address nor that there may be several databases.

**The archive.** The boundary of a period is a moment `B`: the active database starts with the full state at `B`, everything earlier lies in the archive with the same reading contract. Moving and managing archives is not the first implementation, but the layout does not rule them out: a full row in every version is exactly what lets a database start from any moment. Separate databases have different clocks, so a moment is comparable between them to the accuracy of their drift; for a scale where a person picks seconds that is enough, and inside one database the time is exact.

**Throughput and the rule of the lock.** The lock per organization makes writing sequential inside an organization, across all its schemas, and an organization's writing ceiling is the inverse of the time under the lock. The watermark, writing rows and the commit give 10–30 ms, that is tens of transactions per second against the expected few. Two things break the ceiling, and against both there is a rule: **under the lock — only work with the database.** All input is gathered, checked and parsed before the lock; under it there is not a single call outside — HTTP, a model, a queue, files — otherwise the lock becomes a queue waiting on the network for all of the organization's writers. A bulk import in one transaction holds the lock for seconds and stops the organization for that time; it is allowed as a declared operation, not as an ordinary action. If measurement shows the ceiling is not enough, the next step is not giving up the lock but issuing the time under the lock with the commit outside it and publishing the watermark by the oldest uncommitted transaction; that is more complex and is done only on facts.

**Large fields.** A version is a full row, and PostgreSQL copies large values into the new row whole: reusing an unchanged TOAST value works for `UPDATE` but not for the `INSERT` of a new version. A ten-kilobyte description on an entity whose position is moved five hundred times gives five megabytes of the same text in history. Hence a modelling rule: **a frequently changing field and a large rarely changing one do not live in one table.** A large text moves into an entity of its own with a reference from the main one; its versions appear only when it changes itself.

**Bloat of version tables.** Closing a version is an `UPDATE`, that is one dead row per closing. Autovacuum copes with it, and partitioning by organization gives it parallelism. Not a bottleneck, but one more reason to partition from the start.

**Partial loading.** `BaseEntity.partial()` works unchanged: a version table repeats the columns of the current one, a query lists its fields explicitly (rule 50), the resource returns a partial entity just as from a current table.

**Where the mechanism lives.** Rule 26 of the constitution forbids a resource intermediate base classes between it and `PostgresStorage`. So the shared mechanism of writing versions is not a base class but a module of functions in the storage package, which a resource's methods call for each affected row. When the mechanism has proved itself, its place is in AOA as the framework's `VersionedPostgresStorage`; that is separate work in the AOA repository.

**What the tests check.** Code breaks — a test catches it, each of these:

1. two versions of one row with overlapping periods — the database refuses;
2. after any action the current table equals the open versions;
3. a rolled-back transaction leaves neither a row nor a version;
4. two parallel writers of one organization get strictly increasing times in commit order, including when the database clock is replaced by a step back;
5. reading at `T − 1 µs` and at `T` shows the state before and after;
6. a change that only deletes rows moves the watermark, and "now" does not show what was deleted;
7. a request to an organization the person does not belong to is refused before any query runs, and an `organization_id` in a request body is never used;
8. a reading action with a version table without a condition on the moment fails the SQL check;
9. at any moment the rows of a plugin's schema refer only to rows of the core and of its dependencies that exist at that moment;
10. dropping a plugin's schema changes not a single row of the core.

**What changes in the constitution.** Proposals to the maintainer, not edits:

- rule 5 "four kinds of tables" — add version tables as a fifth kind, with their naming and service fields;
- rule 11 — an entity's time fields stay and are copied into the versions with the rest; `valid_from_at` does not replace them, because it answers a different question: not when the record was created or changed, but from what moment this state of it is in force;
- rules 24 and 26 — the resource writes the current row and its version in one transaction; where the lock and the time come from; the action does not write versions itself.

## 9. The pattern on the plugin template's notes

The plugin template `notes` (`packages/maxitor-plugin-template`) keeps its data exactly as this document says, and shows each rule on one small table, `note`, and its revisions, `revision`.

**Now and the past.** Every reading action takes `at`; without it the storage reads at the watermark, and a moment later than the watermark is refused (`moment_not_come`, 422) with the watermark in the answer. Every reading query writes its moment condition through one function of `maxitor-plugin-sdk` — `moments.in_force(alias, moment)` — at every version table, with `organization_id` in every condition; a test of the template runs every reading method and parses its SQL.

**Editing with `base_moment`.** `EditNoteAction` takes the start of the version the editor saw. In one transaction after `change_time`: the current row is locked `FOR UPDATE`; if the note's open version began after `base_moment`, the action writes nothing and answers `changed_since` (409) naming who changed it and when; the same text writes nothing; otherwise the current row is updated, the open version closes with `closed_by` and `closed_operation`, and the new version opens at the change time.

**Deleting.** `DeleteNoteAction` makes the same checks, deletes the current row and closes its version with who deleted it and by which action — no new version. At every earlier moment the note is still there; editing a deleted note answers `deleted` (409) naming who deleted it and when.

**Revisions.** `PublishNotesAction` takes the item's last number from the current table under the organization's lock and writes the next one, with its title, comment and optional release label; with no note changed since the last revision it answers `nothing_to_publish`. A revision copies nothing: it names a moment, and the published notes at any moment are the notes read at the moment of the revision in force then. The draft is the difference between those and the notes at the moment.

**The time scale's bars.** The page's reading action, given a stretch instead of a moment, runs the same query and filters with the stretch form of the condition, `moments.overlaps(alias, start, end)`, and gets every version that was part of the page at some time in the stretch. `history.bars_of` counts an opening alone as added, an opening where a version closed at the same time as changed, and a closing alone as removed — what the versions themselves say, with no journal.

