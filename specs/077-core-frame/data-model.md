# Data model: Maxitor core — the frame

## Plugin node — `plugins.plugin_node` (versioned, with `plugins.plugin_node_versions`)

One node of a plugin version's `navigation.yaml`, resolved when the version is checked. Replaces `plugin_section`, which held only the top level.

| Field | Type | Rule |
|---|---|---|
| `id` | uuid | the row |
| `plugin_version_id` | uuid → `plugin_version` | the version whose file it comes from |
| `full_name` | text | `<plugin name>:<node id>`, unique within the version |
| `parent` | text | `root`, `core:<id>`, `<dependency>:<id>`, or the full name of the owner's node it stands under |
| `position` | int | its place in the file, from 1: keeps the file's order among equal `order` values |
| `order` | int | the order among the parent's children; 0 when the file names none |
| `title` | text, empty | an ordinary node's title; a list node's instances take theirs from `source` |
| `icon` | text, empty | a name of the core's icon set |
| `page` | text, empty | the page's path template inside the owner; empty for a node that only groups |
| `each_source` | text, empty | a list node's reading action |
| `each_key` | text, empty | the parameter each instance adds to the scope |
| `roles` | text[] | `member`, `administrator`; empty means any member |
| `controls` | jsonb, empty | the node's `controls` block as the file writes it |
| `room` | jsonb, empty | the node's `room` block as the file writes it |
| `created_at`, `updated_at` | timestamptz | as every versioned table |

Rows are written once, by `CheckVersionAction`, in the same transaction that makes the version `active`.

## Core node (no table)

The core's own `maxitor/core/navigation.yaml`, read and checked once at the core's start, held in memory: `core:settings` (Settings, administrators, order 10000) with `core:settings.plugins` (Plugins, page `/settings/plugins`).

## Tree node (the answer of `ReadOrganizationTreeAction`)

| Field | Meaning |
|---|---|
| `name` | full name, `<owner>:<id>` |
| `owner` | `core` or the plugin's name |
| `parent` | `root` or a full name |
| `order` | as declared; ties: the core first, then plugins in dependency order, then by `id` |
| `title`, `icon` | as declared |
| `page` | the path template, or empty |
| `each` | `{source, key}` or empty |
| `scope` | the parameters defined at its place, from the list nodes above it |
| `controls` | as declared, or empty |

Filtered by the person's roles in the organization; a parent with no visible child and no page is dropped.

## List instance (the answer of an owner's source)

`{ key, title, icon }`, in parts: `{ entries: [...], next: <key or null> }` — the plugin concept, section 7.4.

## Panel address (no table)

`/w/<code>/<owner>/<path>?<parameters>&at=<moment>`: organization, owner, path, page parameters, moment. Reserved: `at` and every name starting with `_`.

## Tree refusal

`TreeRefusedError(reason)`; the version check writes it as the version's `rejected` reason `navigation`, installing and enabling answer it as a refusal `navigation` with the reason in words.
