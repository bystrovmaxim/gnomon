# 3. Your tables

**Builds on**: [2. A copy of the template](02-a-copy-of-the-template.md). **Next**: [4. Reading](04-reading.md).

A plugin carries no SQL and no migrations. It declares its tables in `schema.yaml`, and Maxitor's installer builds each one — with its version table, the service fields (`id`, `organization_id`, `created_at`, `updated_at`), the overlap constraint and the indexes — by the rules of [versioned storage](../versioned-storage.md).

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/schema.yaml -->
```yaml
schema: 1
tables:
  item:
    description: 'What notes are written on, like a folder: a title in one organization. Items do not nest. Screens read item_versions.'
    columns:
      title: {type: text, nullable: false, description: 'The item''s title: 1–200 characters, no spaces at its ends, unique among the organization''s items now.'}
    unique:
      - [title]
  note:
    description: A note on an item. Read only by changing actions; screens read note_versions.
    columns:
      item_id: {type: uuid, nullable: false, description: The item the note is about.}
      writer_id: {type: uuid, nullable: false, description: The account of the member who wrote the note.}
      body: {type: text, nullable: false, description: The text of the note.}
    indexes:
      - [item_id]
    keys:
      - {columns: [item_id], table: item, references: [id]}
```

Each column has a type from a closed list, `nullable` and a description. You write what is yours; what every table needs, Maxitor adds. A note is never changed in place: an edit closes its version and opens a new one in `note_versions`, so every past moment can be read.

An `item` is what notes are written on, and the plugin keeps it itself: the core has no items of its own. `unique: [[title]]` becomes a key on the organization and the title, so two items of one organization never share a title. `keys` joins two tables of the same plugin: the installer builds it with the organization in front, `(organization_id, item_id) → item (organization_id, id)`, so a note can point only at an item of its own organization. The key only guards; the action checks the item before it writes.

## Keys to the core

A key out of the plugin goes only down to the core, and only to what the core offers. `foreign-keys.yaml` names identifiers, nothing else; the installer creates the keys with `RESTRICT`:

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

On the local stand, after Notes is installed, `psql` shows the schema `notes_0_10_0` with `item`, `item_versions`, `note`, `note_versions`, `revision` and `revision_versions`, and the user `plg_notes_0_10_0`, which reads and writes only that schema.
