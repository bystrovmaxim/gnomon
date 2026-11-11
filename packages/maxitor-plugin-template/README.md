# Maxitor plugin template

A small but complete Maxitor plugin, `notes`: notes on catalog items. It holds every part a real plugin has, so a new plugin starts as a copy of this package with the names changed.

A Maxitor plugin is an independent application that installs into Maxitor: a pip package or a ready wheel carrying a passport, an AOA backend, a built Next.js frontend and the declaration of its tables. It carries no SQL and no migrations. Maxitor's installer reads the passport, checks the dependencies, and deploys each version once: its schema `notes_<version>` and database user `plg_notes_<version>`, the tables of `schema.yaml` with their version tables, its key to the core. The plugin's user sees only its own schema; what it needs of the core — the organization's lock and change time, the watermark, membership, a member's name — it gets from the core's functions.

Maxitor installs this plugin: an organization's administrator finds it in Settings → Plugins, and the local stand fills its marketplace with this package's wheel ([Run Maxitor core locally](../../docs/how-to/run-the-core-locally.md)). Running its processes behind Maxitor's gateway (bystrovmaxim/gnomon#75), the frame's place for its pages and `@maxitor/panel` are still to be built; until then its backend runs in its tests: its files have the shape a plugin must have, its backend is built and checked without a database, and it does not run against Maxitor. Its files are checked by `maxitor-plugin-sdk`, the same code Maxitor checks a plugin with: `maxitor-plugin-check .` from this folder, and `maxitor plugin check . --core <version>` for whether it fits a core.

## Documentation

- [The plugin concept](../../docs/plugins/concept.md): the passport, the core as a node of the dependency graph and the one compatibility check, delivery, database roles and schemas, cross-plugin foreign keys, one sign-in, the frame with its tree, panel, canvas and controls, rooms, the lifecycle, the rules, and a tutorial on this template.
- [Versioned storage](../../docs/plugins/versioned-storage.md) — how tables, versions and time are kept so that any past moment reads by the same actions as the present.

## Files

| File | What it is |
|---|---|
| `pyproject.toml` | The pip package; the entry point `maxitor.plugins` leads the installer to the passport. |
| `src/maxitor_notes/maxitor-plugin.yaml` | The passport: id, name, version, required Maxitor version, dependencies on other plugins, backend, frontend, database, and the comparisons its pages can draw (`history.compare`). It declares no roles: the actions check the core's `member`. |
| `src/maxitor_notes/navigation.yaml` | The plugin's nodes in Maxitor's left tree: the item's notes, its published notes and its draft under every catalog item, one in the root; the address of each page, how it behaves in a room, and how it answers the time scale (`history`). |
| `src/maxitor_notes/foreign-keys.yaml` | The keys from a note's writer and a revision's publisher to the core's user of that account, as identifiers only; the installer creates them. |
| `src/maxitor_notes/schema.yaml` | The plugin's tables: `note` and `revision`. Maxitor builds them with `note_versions` and `revision_versions`, the service fields and the indexes. |
| `src/maxitor_notes/app.py` | The passport's `backend.app`: the backend Maxitor's runner runs in a container of its own behind the gateway; every route lies under `/p/notes/api/{organization}` and is an action; a missing role answers 403, another organization's object 404. |
| `src/maxitor_notes/organization_auth_coordinator.py` | Checks the core's EdDSA token for this plugin by the core's JWKS (`MAXITOR_CORE_JWKS_URL`) and puts the address's organization into the context beside the person and the core's roles. |
| `src/maxitor_notes/membership.py` | The second lock: each action's `@access_decide` lets only a member of the organization of the address in, and its main step finds the organization's id again. |
| `src/maxitor_notes/storage/notes_storage.py` | The plugin's own schema: a write is one transaction whose change time comes from the core's `change_time`, an edit or a deletion refused when the note changed after `base_moment`; a read is bound to one organization and one moment, written through the SDK's moment condition, a moment later than the watermark refused. |
| `src/maxitor_notes/actions/` | Add, edit and delete a note; list an item's notes at a moment, or its bars over a stretch; publish a revision; the published notes and the draft at a moment; the writers for the page's author filter (Maxitor's list contract). |
| `src/maxitor_notes/history/` | What the core's time scale asks: the milestones of a stretch (`list_note_history`) and one milestone's card (`note_milestone_card`). |
| `src/maxitor_notes/notes_refusal_error.py` | The refusals and their HTTP answers: a moment not come, a note changed or deleted since, nothing to publish. |
| `graph.json` | The plugin's graph, built by `graph-builder write` from its code. |
| `web/` | The frontend: a Next.js application under `/p/notes` whose pages keep every view setting in their address. |
| `web/scripts/copy-build.mjs` | Puts the standalone build into `src/maxitor_notes/_web`, where the wheel carries it. |

## Building a release

```bash
npm --prefix web run build
uv build
```

The first command builds the frontend into `src/maxitor_notes/_web`; the second builds the wheel with it inside.
