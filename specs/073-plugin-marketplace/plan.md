# Implementation Plan: Maxitor core — the marketplace, and installing, disabling and enabling a plugin in an organization

**Branch**: `feature/issue-82-plugin-marketplace` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

`core` = `packages/maxitor/maxitor-core`, `py` = `core/maxitor/core`, `plugins` = `py/plugins`, `web` = `core/web`, `installer` = `packages/maxitor/tools/plugin-installer`, `sdk` = `packages/maxitor-plugin-sdk`, `template` = `packages/maxitor-plugin-template`.

## Summary

The core gets a domain `plugins` with its own schema, storage, actions and typed events: the marketplace (a plugin and its versions), a plugin in an organization, and the page Settings → Plugins of the mockup. A process of its own, `maxitor-plugin-installer`, holding the only password of the role `maxitor_installer`, checks versions and deploys them: a schema and a database user per version, tables built from the plugin's `schema.yaml` by the rules of versioned storage, rights limited to that schema and three `SECURITY DEFINER` functions of the core. The SDK holds the formats (`schema.yaml`, passport 2); the plugin template moves to them. Decisions are in [research.md](research.md), tables in [data-model.md](data-model.md), addresses in [contracts/actions.md](contracts/actions.md).

## Technical Context

**Language/Version**: Python 3.12 / 3.14; TypeScript, Next.js 16, React 19 (the core's application)
**Primary Dependencies**: the core's (`aoa-action-machine[postgres,jwt]`, `aoa-fastapi-adapter`, `asyncpg`, `httpx`, `PyYAML`, `packaging`) plus `packageurl-python` and `scramp`
**Storage**: PostgreSQL 16 — schemas `platform`, `organization`, `plugins` (owned by `maxitor_core`), one schema per deployed plugin version (owned by `maxitor_installer`); the wheel store, a directory
**Testing**: pytest on the recording connection; the live checks on the local stand (`scripts/core-stand.sh`); the browser checks of the page with `check-core.mjs`
**Target Platform**: Linux server (the stand)
**Project Type**: web service + a worker service + web application
**Performance Goals**: SC-001 — install from Settings to the tree in under 1 minute; the installer takes up rows every 60 s
**Constraints**: every endpoint an action; the installer an action-running process with no route; every outside service a typed gateway; every line a typed event; no password of a version's user outside its environment file; 50 MB and 60 s per wheel
**Scale/Scope**: 37 screens of the mockup (desktop and phone); 3 domain tables + 2 child tables; 9 actions over HTTP + 3 in the installer

## Constitution Check

- **I. One term, one name**: `plugin`, `plugin_version`, `plugin_dependency`, `plugin_section`, `organization_plugin` — the same in spec, data model, entities (`PluginCoreEntity`, …) and tables; a passport's id is `passport_id` everywhere.
- **II. Spec ahead of code**: spec 073, clarified; issue #82 brought to the same decisions.
- **III. The database does not decide**: identifiers from the writer, no `DEFAULT` on them, no cascades, every column described with explicit nullability — in the core's migration and in every DDL the installer builds.
- **IV. Decision apart from idea**: moving an organization to another version is named as not decided (spec, Assumptions); nothing builds it.
- **V. Measurement**: SC-001 – SC-010 name metric and way.
- **Rule 6 (identifiers)**: tables keep the core's singular names of #73 (`account`, `sign_in`); `id uuid` first, the passport id a separate column.
- **Rules 41–46 (actions)**: each operation an action with frozen `Params`/`Result`; the installer's loop only calls actions.
- **Rule 50 (explicit fields)**, **52–53 (resources)**: `PluginsStorage` and `WheelStore` expose only meaningful methods; the DDL builder is a pure function the installer's storage runs.
- **Rule 54 (file named like the class)**: every new class in a file of its name.
- **Rules 58, 63 (secrets, environment)**: the installer's DSN, the wheel store path and limits enter actions through declared context keys; passwords never in a `repr`, log or event.
- **Rules 60, 67 (graph)**: the installer is a service: `build_graph.py`, `graph.json`, an entry in `graph-builder.toml`.
- **Rule 66 (connections in routes)**: the core's new routes declare `PerCallConnection` for `PluginsStorage` and the wheel store in place.
- **Technology frame (snapshot)**: the core keeps the numbered SQL migrations #73 established; the installer's DDL is built at run time from `schema.yaml`, which is the plugin's snapshot.

Post-design: no violation.

## Project Structure

```text
specs/073-plugin-marketplace/  spec.md plan.md research.md data-model.md quickstart.md contracts/actions.md mockup/ checklists/ tasks.md
py/plugins/                    domain.py events.py entities/ storage/plugins_storage.py storage/wheel_store.py gateways/wheel_source_gateway.py actions/
py/migrations/plugins/         0001_plugins.sql
py/migrations/organization/    0002_plugin_functions.sql
py/bootstrap.sql               + maxitor_installer, maxitor_plugin, schema plugins
installer/maxitor/plugin_installer/  launch.py loop.py ddl.py deploy_storage.py settings.py build_graph.py
installer/                     tests/ graph.json version.toml README.md CHANGELOG.md
sdk/src/maxitor_plugin_sdk/    plugin_schema.py schemas/plugin-schema-1.schema.json schemas/plugin-passport-2.schema.json versioned_time.py
template/                      src/maxitor_notes/schema.yaml (migrations/ and migrate.py removed) storage/ maxitor-plugin.yaml foreign-keys.yaml
web/app/w/[code]/settings/plugins/  page.tsx; components/Plugins*.tsx; Header settings crumb; the tree's foot
scripts/                       check_package_boundaries.py package_boundaries.toml core-stand.sh
graph-builder.toml             + plugin-installer
```

## Design — one phase per phase of the issue

### Phase 0 — the specification
Commit `specs/073-plugin-marketplace/`: the mockup, the spec, its checklists, this plan's documents and the tasks.

### Phase 1 — the `plugins` domain
`plugins/` with the domain, its typed events (FR-005a), the entities and lifecycles of data-model, `PluginsStorage` (versioned writes under `plugin:<id>` and `organization:<id>`); `0001_plugins.sql`; `migrate.py` runs the folder `plugins` third; `bootstrap.sql` gains the schema and the two roles; the boundary names in `check_package_boundaries.py` and the toml. Tests: the storage's SQL on the recording connection (no schema named, `organization_id` in every condition, versions written with rows), the lifecycles, a line outside the event list refused, the boundary check on a planted import.

### Phase 2 — `schema.yaml`
SDK: `plugin-schema-1.schema.json`, `plugin_schema.py` (read, check names and types). Installer: `ddl.py` builds the statements with version tables, service fields, the overlap constraint, the index by organization, comments. Tests: an unsafe name (quote, dot, space, semicolon, too long) and an unknown type refused before SQL; the built DDL for the template passes the versioned-storage check on the catalog of the stand; every table has the index by organization.

### Phase 3 — deploying a version
`0002_plugin_functions.sql` (R6); the installer service (`launch.py`, `loop.py`, settings, `build_graph.py`, `graph.json`); `DeployAndInstallAction` with the deploy in one transaction under `version:<id>`, SCRAM verifier, environment file (R9). Tests: the recording connection sees one transaction and no plain password; on the stand, `plg_…` cannot read another schema or create a table, and `maxitor_core` cannot create a schema or a role; a deploy broken at each step leaves nothing.

### Phase 4 — checking a version
`WheelSourceGateway` (R7), `WheelStore`, `CheckVersionAction`: download within limits, `sha256`, passport 2, `schema.yaml`, navigation, core range, uniqueness; `TakeUpPendingAction`. Tests with a fake gateway: each reason of `rejected`, the timeout leaving `draft`, 50 MB refused.

### Phase 5 — installing, disabling, enabling
`RequestInstallAction`, `RetryInstallAction`, `DropFailedInstallAction`, `DisablePluginAction`, `EnablePluginAction`, `ListPluginsAction`, `PluginDetailsAction`, the routes; `OpenOrganizationAction` answers the enabled plugins and `is_admin`. Tests: refusals by core range and missing dependency, the disable refusal naming dependents, the partial unique index on two concurrent installs, search matching and counts, a private plugin invisible elsewhere, 404 for a non-administrator; a test that stops the installer mid-install and sees it finish.

### Phase 6 — a private plugin
`AddPrivatePluginAction` (purl forms), `UploadPrivatePluginAction` (base64, size, zip check, `pkg:generic`). Tests: each refusal of the dialog; an upload creates a `draft` version with the computed hash.

### Phase 7 — the page
`web/`: the Settings link at the foot of the tree, the settings column, the header crumb, `settings/plugins` with tabs, search, rows, cards, details panel, the dialogs of install, disable, disable refused, private plugin (release and upload); the tree groups of enabled plugins; the phone layout (drawer, sheets, cards). Server actions call the routes. Check: `next build`; browser checks of every screen at 1360 and 375.

### Phase 8 — on the stand
`core-stand.sh` starts the installer and fills the marketplace with the template; the quickstart's scenarios run in the browser checks; Notes installed in two organizations, disabled in one, working in the other.

### Phase 9 — the template in step
`schema.yaml` replaces `migrations/0001_note.sql` and `migrate.py`; passport 2; `foreign-keys.yaml` to `core.user`; the storage takes time, watermark and membership from the SDK's helper (R6, R12). Tests: the template deploys as `notes_0_4_0` with `plg_notes_0_4_0`; its tests pass against the new storage.

### Phase 10 — documentation, changelog, versions
`docs/plugins.md` (roles, a schema and user per version, `schema.yaml`, the installer, the page), `versioned-storage.md` (the core's functions), the template's docs, the core's README and the installer's README; issue #82's wording (`psycopg` → the core's identifier); changelogs of `maxitor`, the installer, the SDK, the template; versions raised; graphs rebuilt.
