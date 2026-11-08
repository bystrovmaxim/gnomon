# Maxitor plugin template

A small but complete Maxitor plugin, `notes`: notes on catalog items. It holds every part a real plugin has, so a new plugin starts as a copy of this package with the names changed.

A Maxitor plugin is an independent application that installs into Maxitor: a pip package or a ready wheel carrying a passport, an AOA backend, a built Next.js frontend and the migrations of its own database schema. Maxitor's installer reads the passport, checks the dependencies, gives the plugin its own role and schema in the shared database, builds the left tree with the plugin's nodes in it, and shows the plugin's pages in the right panel of its frame.

Maxitor cannot host plugins yet: the installer, the frame on Next.js, `maxitor-plugin-sdk` and `@maxitor/panel` are still to be built. Until then this package is a skeleton — its files have the shape a plugin must have, and they do not run against Maxitor.

## Documentation

- [docs/plugins.md](docs/plugins.md) — the plugin concept: the passport, the core as a node of the dependency graph and the one compatibility check, delivery, database roles and schemas, cross-plugin foreign keys, one sign-in, the frame with its tree, panel, canvas and controls, rooms, the lifecycle, the rules, and a tutorial on this template.
- [docs/versioned-storage.md](docs/versioned-storage.md) — how tables, versions and time are kept so that any past moment reads by the same actions as the present.

## Files

| File | What it is |
|---|---|
| `pyproject.toml` | The pip package; the entry point `maxitor.plugins` leads the installer to the passport. |
| `src/maxitor_notes/maxitor-plugin.yaml` | The passport: id, name, version, required Maxitor version, dependencies on other plugins, roles, backend, frontend, database. |
| `src/maxitor_notes/navigation.yaml` | The plugin's nodes in Maxitor's left tree: one under every catalog item, one in the root; the address of each page and how it behaves in a room. |
| `src/maxitor_notes/foreign-keys.yaml` | Foreign keys from the plugin's tables to Maxitor's, as identifiers only; the installer creates them. |
| `src/maxitor_notes/migrations/0001_note.sql` | The current table `note` and its version table `note_versions`. |
| `web/` | The frontend: a Next.js application under `/p/notes` whose pages keep every view setting in their address. |
| `web/scripts/copy-build.mjs` | Puts the standalone build into `src/maxitor_notes/_web`, where the wheel carries it. |
| `checks/` | What Maxitor's installer checks in a plugin's own files: the JSON schemas of the passport, `navigation.yaml` and `foreign-keys.yaml`, and `plugin_check.py` for the rules across fields. They move into `maxitor-plugin-sdk` when it exists. |

## Building a release

```bash
npm --prefix web run build
uv build
```

The first command builds the frontend into `src/maxitor_notes/_web`; the second builds the wheel with it inside.
