# 2. A copy of the template

**Builds on**: [1. What you will build](01-what-you-will-build.md). **Next**: [3. Your tables](03-your-tables.md).

## Copy and rename

```bash
cp -R packages/maxitor-plugin-template ../acme-notes
```

Then choose three names, once and for good:

- **`id`** — the global identifier in reverse domain notation, `io.github.acme.notes`; it never changes, and a token for your plugin carries it in `aud`;
- **`name`** — the name in one Maxitor installation, `notes`: each version's schema `notes_<x>_<y>_<z>`, its database user `plg_notes_<x>_<y>_<z>`, its addresses `/p/notes/...`;
- **the package** — the Python package's name in `pyproject.toml` and the folder under `src/`.

Outside this repository the copy takes AOA and the SDK from PyPI: drop the `[tool.uv.sources]` table of its `pyproject.toml`.

## The passport

The passport `maxitor-plugin.yaml` is what Maxitor's installer reads from the wheel before it installs anything:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/maxitor-plugin.yaml -->
```yaml
passport: 3

# The global identifier: reverse domain notation, never changes.
id: io.github.bystrovmaxim.notes
# The name in one Maxitor installation: each version's schema notes_<version>, its user plg_notes_<version>, the path /p/notes.
name: notes
title: Notes
description: >
  Notes on the plugin's own items: who wrote what, and how it read at any past moment.
# Strictly x.y.z, equal to the version in pyproject.toml.
version: 0.12.0
# The major version of maxitor-plugin-sdk the plugin is built with; Maxitor must be built with the same.
sdk: 1
```

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/maxitor-plugin.yaml -->
```yaml
backend:
  app: maxitor_notes.app:create_app

frontend:
  # The frontend's sources in the wheel: package.json, package-lock.json and the pages. Maxitor builds them with its
  # own @maxitor/panel; the wheel carries no built site.
  source: maxitor_notes/web
  navigation: maxitor_notes/navigation.yaml

# The plugin carries no SQL and no migrations: it declares its tables, and Maxitor builds them.
database:
  schema: maxitor_notes/schema.yaml
  foreign_keys: maxitor_notes/foreign-keys.yaml
```

- `version` equals the version in `pyproject.toml`, strictly `x.y.z`;
- `requires.maxitor` is the range of core versions your plugin works with;
- `backend.app` is the factory Maxitor's runner starts; `frontend.source` is where the frontend's sources travel inside the wheel: the installer builds them with the core's own `@maxitor/panel` before it deploys the version;
- there is no `roles` section: a plugin works with the core's roles (chapter 6).

## Check it

```bash
uv run maxitor-plugin-check packages/maxitor-plugin-template
```

It prints nothing and exits with 0. A passport that declares roles is refused:

```text
passport: a plugin declares no roles of its own; its actions check the core's member, administrator or service
```

Against a given core:

```bash
uv run --all-extras maxitor plugin check packages/maxitor-plugin-template --core 4.7.0
```

```text
the plugin fits maxitor 4.7.0
```

and against one outside `requires.maxitor`, with exit 1:

```text
core_range: io.github.bystrovmaxim.notes 0.12.0 needs maxitor >=4.7,<5; this core is maxitor 3.29.0
```

## Build the frontend as Maxitor will

Your wheel carries `web/` as sources; Maxitor's installer builds them with the core's own `@maxitor/panel`, whatever version your `package.json` names, and installs only what the core's npm list allows. Run the same step yourself, with Docker running and the core you target installed:

```bash
uv run --all-extras maxitor plugin build packages/maxitor-plugin-template --core 4.7.0
```

```text
maxitor-plugin/notes_0_12_0-frontend:fad7af0dee62-4.7.0
```

A page that does not compile ends the build with exit 1 and the line the installer would record:

```text
app/[org]/page.tsx(12,7): error TS2322: Type 'number' is not assignable to type 'string'.
```

Keep `package-lock.json` beside `package.json`: the build installs strictly by it and refuses a lock that does not match.

