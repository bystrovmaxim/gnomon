# Maxitor plugin template

A small but complete Maxitor plugin, `notes`: notes on its own items, kept like folders. It needs nothing but the core. It holds every part a real plugin has, so a new plugin starts as a copy of this package with the names changed.

A Maxitor plugin is an independent application that installs into Maxitor: a pip package or a ready wheel carrying a passport, an AOA backend, the sources of a Next.js frontend, which Maxitor builds with its own `@maxitor/panel`, and the declaration of its tables. It carries no SQL and no migrations. Maxitor's installer reads the passport, checks the dependencies, and deploys each version once: its schema `notes_<version>` and database user `plg_notes_<version>`, the tables of `schema.yaml` with their version tables, its key to the core. The plugin's user sees only its own schema; what it needs of the core — the organization's lock and change time, the watermark, membership, a member's name — it gets from the core's functions.

Maxitor installs this plugin: an organization's administrator finds it in Settings → Plugins, and the local stand fills its marketplace with this package's wheel ([Run Maxitor core locally](../../docs/how-to/run-the-core-locally.md)). Maxitor's runner starts its backend in a container of its own, and its API answers through Maxitor's gateway at `/p/notes/api/<organization>/…` with the person's sign-in. The frame's place for its pages and `@maxitor/panel` are still to be built (bystrovmaxim/gnomon#74), so its frontend does not run yet. Its files are checked by `maxitor-plugin-sdk`, the same code Maxitor checks a plugin with: `maxitor-plugin-check .` from this folder, and `maxitor plugin check . --core <version>` for whether it fits a core.

## Documentation

- [Write a Maxitor plugin: a tutorial](../../docs/plugins/tutorial/index.md) — this template, chapter by chapter: copying it, its tables, reading, writing, the backend behind the gateway, its tests.
- [The plugin concept](../../docs/plugins/concept.md): the passport, the core as a node of the dependency graph and the one compatibility check, delivery, database roles and schemas, cross-plugin foreign keys, one sign-in, the frame with its tree, panel, canvas and controls, rooms, the lifecycle and the rules.
- [Versioned storage](../../docs/plugins/versioned-storage.md) — how tables, versions and time are kept so that any past moment reads by the same actions as the present.

## Files

| File | What it is |
|---|---|
| `pyproject.toml` | The pip package; the entry point `maxitor.plugins` leads the installer to the passport. |
| `src/maxitor_notes/maxitor-plugin.yaml` | The passport: id, name, version, required Maxitor version, dependencies on other plugins, backend, frontend, database, and the comparisons its pages can draw (`history.compare`). It declares no roles: the actions check the core's `member`. |
| `src/maxitor_notes/navigation.yaml` | The plugin's nodes in Maxitor's left tree: its section "Notes" in the root, under it one node per item from `list_items`, and under every item its notes, its published notes and its draft; and the address of each page — the tree only (navigation format 3). Each page gives its history to the time scale in its code (`PanelPage history`). |
| `src/maxitor_notes/foreign-keys.yaml` | The keys from a note's writer and a revision's publisher to the core's user of that account, as identifiers only; the installer creates them. |
| `src/maxitor_notes/schema.yaml` | The plugin's tables: `item`, what notes are written on, with a title unique in the organization; `note` and `revision`, each with a key to its item. Maxitor builds them with `item_versions`, `note_versions` and `revision_versions`, the service fields, the keys and the indexes. |
| `src/maxitor_notes/app.py` | The passport's `backend.app`: the backend Maxitor's runner runs in a container of its own behind the gateway; every route lies under `/p/notes/api/{organization}` and is an action; a missing role answers 403, another organization's object 404. |
| `src/maxitor_notes/organization_auth_coordinator.py` | Checks the core's EdDSA token for this plugin by the core's JWKS (`MAXITOR_CORE_JWKS_URL`) and puts the address's organization into the context beside the person and the core's roles. |
| `src/maxitor_notes/membership.py` | The second lock: each action's `@access_decide` lets only a member of the organization of the address in — and, for an action about an item, only an item of that organization — and its main step finds the organization's id again. |
| `src/maxitor_notes/storage/notes_storage.py` | The plugin's own schema: a write is one transaction whose change time comes from the core's `change_time`, an edit or a deletion refused when the note changed after `base_moment`; a read is bound to one organization and one moment, written through the SDK's moment condition, a moment later than the watermark refused. |
| `src/maxitor_notes/actions/` | Add and rename an item, and list the items at a moment for the tree's list node; add, edit and delete a note; list an item's notes at a moment, or its bars over a stretch; publish a revision; the published notes and the draft at a moment; the writers for the page's author filter (Maxitor's list contract). |
| `src/maxitor_notes/history/` | What the core's time scale asks: the milestones of a stretch (`list_note_history`) and one milestone's card (`note_milestone_card`). An item's notes are published together under a number with a draft between: the simplest model of a release; a lifecycle of every record is the plugin common data environment (bystrovmaxim/gnomon#106). |
| `src/maxitor_notes/events.py` | The typed events the actions write: an item added, an item renamed. |
| `src/maxitor_notes/notes_refusal_error.py` | The refusals and their HTTP answers: a moment not come, a note or an item changed since, a note deleted, a title taken, nothing to publish. |
| `graph.json` | The plugin's graph, built by `graph-builder write` from its code. |
| `web/` | The frontend: a Next.js application under `/p/notes` whose pages keep every view setting in their address. The wheel carries it as `maxitor_notes/web`, sources only: `package.json`, `package-lock.json` and the pages, without `node_modules` and `.next`. |

## Building a release

```bash
uv run --all-extras maxitor plugin build . --core 4.7.0
uv build
```

The first command builds the frontend the way Maxitor's installer will — in the core's builder image, with the core's `@maxitor/panel`, through its npm list, without a network — and prints the image or the first error; the second builds the wheel, which carries `web/` as sources. Maxitor builds them again when it installs the version, and again for every core it is upgraded to.
