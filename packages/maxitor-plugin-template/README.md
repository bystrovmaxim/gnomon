# Maxitor plugin template

A small but complete Maxitor plugin, `notes`: notes on catalog items. It holds every part a real plugin has, so a new plugin starts as a copy of this package with the names changed.

A Maxitor plugin is an independent application that installs into Maxitor: a pip package or a ready wheel carrying a passport, an AOA backend, a built Next.js frontend and the declaration of its tables. It carries no SQL and no migrations. Maxitor's installer reads the passport, checks the dependencies, and deploys each version once: its schema `notes_<version>` and database user `plg_notes_<version>`, the tables of `schema.yaml` with their version tables, its key to the core. The plugin's user sees only its own schema; what it needs of the core — the organization's lock and change time, the watermark, membership, a member's name — it gets from the core's functions.

Maxitor installs this plugin: an organization's administrator finds it in Settings → Plugins, and the local stand fills its marketplace with this package's wheel ([Run Maxitor core locally](../../docs/how-to/run-the-core-locally.md)). Running its processes behind Maxitor's gateway (bystrovmaxim/gnomon#75), the frame's place for its pages and `@maxitor/panel` are still to be built; until then its backend runs in its tests: its files have the shape a plugin must have, its backend is built and checked without a database, and it does not run against Maxitor. Its files are checked by `maxitor-plugin-sdk`, the same code Maxitor checks a plugin with: `maxitor-plugin-check .` from this folder, and `maxitor plugin check . --core <version>` for whether it fits a core.

## Documentation

- [docs/plugins.md](docs/plugins.md) — the plugin concept: the passport, the core as a node of the dependency graph and the one compatibility check, delivery, database roles and schemas, cross-plugin foreign keys, one sign-in, the frame with its tree, panel, canvas and controls, rooms, the lifecycle, the rules, and a tutorial on this template.
- [docs/versioned-storage.md](docs/versioned-storage.md) — how tables, versions and time are kept so that any past moment reads by the same actions as the present.

## Files

| File | What it is |
|---|---|
| `pyproject.toml` | The pip package; the entry point `maxitor.plugins` leads the installer to the passport. |
| `src/maxitor_notes/maxitor-plugin.yaml` | The passport: id, name, version, required Maxitor version, dependencies on other plugins, roles, backend, frontend, database. |
| `src/maxitor_notes/navigation.yaml` | The plugin's nodes in Maxitor's left tree: one under every catalog item, one in the root; the address of each page and how it behaves in a room. |
| `src/maxitor_notes/foreign-keys.yaml` | The key from a note's writer to the core's user of that account, as identifiers only; the installer creates it. |
| `src/maxitor_notes/schema.yaml` | The plugin's tables: `note`. Maxitor builds it with `note_versions`, the service fields and the indexes. |
| `src/maxitor_notes/app.py` | The passport's `backend.app`: the backend Maxitor runs behind its gateway; every route lies under `/p/notes/api/{organization}` and is an action. |
| `src/maxitor_notes/organization_auth_coordinator.py` | Checks the core's EdDSA token for this plugin and puts the address's organization into the context beside the person. |
| `src/maxitor_notes/membership.py` | The second lock: each action's `@access_decide` lets only a member of the organization of the address in, and its main step finds the organization's id again. |
| `src/maxitor_notes/storage/notes_storage.py` | The plugin's own schema: a write is one transaction whose change time comes from the core's `change_time`; a read is bound to one organization and one moment, a writer's name from the core's `member_name`. |
| `src/maxitor_notes/actions/` | Add a note; list an item's notes at a moment; list the writers for the page's author filter (Maxitor's list contract). |
| `graph.json` | The plugin's graph, built by `graph-builder write` from its code. |
| `web/` | The frontend: a Next.js application under `/p/notes` whose pages keep every view setting in their address. |
| `web/scripts/copy-build.mjs` | Puts the standalone build into `src/maxitor_notes/_web`, where the wheel carries it. |

## Building a release

```bash
npm --prefix web run build
uv build
```

The first command builds the frontend into `src/maxitor_notes/_web`; the second builds the wheel with it inside.
