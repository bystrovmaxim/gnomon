# 3. Your tables

**Builds on**: [2. A copy of the template](02-a-copy-of-the-template.md). **Next**: [4. Reading](04-reading.md).

A plugin carries no SQL and no migrations. It declares its tables in `schema.yaml`, and Maxitor's installer builds each one — with its version table, the service fields (`id`, `organization_id`, `created_at`, `updated_at`), the overlap constraint and the indexes — by the rules of [versioned storage](../versioned-storage.md).

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/schema.yaml -->
```yaml
schema: 1
tables:
  note:
    description: A note on a catalog item. Read only by changing actions; screens read note_versions.
    columns:
      item_id: {type: uuid, nullable: false, description: The catalog item the note is about.}
      writer_id: {type: uuid, nullable: false, description: The account of the member who wrote the note.}
      body: {type: text, nullable: false, description: The text of the note.}
    indexes:
      - [item_id]
```

Each column has a type from a closed list, `nullable` and a description. You write what is yours; what every table needs, Maxitor adds. A note is never changed in place: an edit closes its version and opens a new one in `note_versions`, so every past moment can be read.

## Keys to the core

A key goes only down to the core, and only to what the core offers. `foreign-keys.yaml` names identifiers, nothing else; the installer creates the keys with `RESTRICT`:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/foreign-keys.yaml -->
```yaml
foreign_keys:
  # A note's writer is a member of the note's organization: the core's user of that account there.
  - from: { table: note, columns: [organization_id, writer_id] }
    to:   { schema: core, table: user, columns: [organization_id, account_id] }
```

## Check it

An unknown type is refused before any SQL exists:

```text
schema.yaml: tables/note/columns/body/type: 'varchar' is not one of ['uuid', 'text', 'integer', 'bigint', 'numeric', 'boolean', 'date', 'timestamptz', 'jsonb']
```

On the local stand, after Notes is installed, `psql` shows the schema `notes_0_6_1` with `note`, `note_versions`, `revision` and `revision_versions`, and the user `plg_notes_0_6_1`, which reads and writes only that schema.
