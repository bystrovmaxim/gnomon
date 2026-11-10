# Data model: the marketplace and a plugin in an organization

Every entity is a table of its name in the schema `plugins`, owned by `maxitor_core`; `maxitor_installer` may `SELECT`, `INSERT`, `UPDATE` them (research R3). Every column has explicit nullability and a description (`COMMENT ON COLUMN`); no identifier has a `DEFAULT`; no `ON DELETE CASCADE` (constitution III). Identifiers are `uuid` assigned by the writer; a plugin's reverse-domain id from its passport is the column `passport_id`, never the table's `id` (constitution rule 6). A version table repeats its table's columns and adds `valid_from_at`, `valid_to_at NULL`, `valid_during`, `author_id NULL`, `operation`, `closed_by NULL`, `closed_operation NULL`, with an `EXCLUDE USING gist` on overlapping periods, as `packages/maxitor-plugin-template/docs/versioned-storage.md` lays out.

## Schema `plugins`

| Table | Columns | Keys and checks | Versioned |
|---|---|---|---|
| `plugin` | `id uuid`, `passport_id text`, `name text`, `title text`, `description text`, `owner_organization_id uuid NULL` (NULL — public), `state text`, `created_at`, `updated_at NULL` | PK `id`; UNIQUE `passport_id`; UNIQUE `name`; CHECK `state IN ('listed','withdrawn')`; CHECK `name ~ '^[a-z][a-z0-9_]{0,31}$'`; FK `owner_organization_id → organization.organization` | yes, `plugin_versions`, lock `plugin:<id>` |
| `plugin_version` | `id uuid`, `plugin_id uuid`, `version text`, `purl text`, `sha256 char(64)`, `core_range text NULL` (NULL until checked), `state text`, `reason text NULL`, `schema_name text NULL`, `database_user text NULL`, `deployed_at timestamptz NULL`, `checked_at timestamptz NULL`, `created_at`, `updated_at NULL` | PK `id`; FK `plugin_id → plugin`; UNIQUE (`plugin_id`, `version`); UNIQUE `schema_name`; CHECK `state IN ('draft','active','rejected','withdrawn')`; CHECK `version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'`; CHECK `sha256 ~ '^[0-9a-f]{64}$'`; CHECK `reason IS NOT NULL OR state <> 'rejected'` | yes, `plugin_version_versions`, lock `plugin:<plugin_id>` |
| `plugin_dependency` | `id uuid`, `plugin_version_id uuid`, `passport_id text`, `version_range text`, `created_at`, `updated_at NULL` | PK `id`; FK `plugin_version_id → plugin_version`; UNIQUE (`plugin_version_id`, `passport_id`) | yes, `plugin_dependency_versions`, lock `plugin:<plugin_id>` |
| `plugin_section` | `id uuid`, `plugin_version_id uuid`, `position int`, `title text`, `path text`, `created_at`, `updated_at NULL` | PK `id`; FK `plugin_version_id → plugin_version`; UNIQUE (`plugin_version_id`, `position`) | yes, `plugin_section_versions`, lock `plugin:<plugin_id>` |
| `organization_plugin` | `organization_id uuid`, `id uuid`, `plugin_id uuid`, `plugin_version_id uuid`, `state text`, `reason text NULL`, `installed_by uuid`, `created_at`, `updated_at NULL` | PK (`organization_id`, `id`); FK `organization_id → organization.organization`; FK `plugin_id → plugin`; FK `plugin_version_id → plugin_version`; FK (`organization_id`, `installed_by`) → `organization."user"` (`organization_id`, `id`); CHECK `state IN ('installing','enabled','disabled','failed','removing','removed')`; partial UNIQUE (`organization_id`, `plugin_id`) WHERE `state <> 'removed'` | yes, `organization_plugin_versions`, lock `organization:<organization_id>` |

`plugin_dependency.passport_id` names a dependency by its passport id, not by a key: the dependency may not be in the marketplace yet when the version is checked. `plugin_section` keeps the top level of the version's `navigation.yaml` (research R10). The keys into the schema `organization` cross schemas inside the core's own database, as `user.account_id` does.

## Lifecycles

- `PluginLifecycle` on `plugin.state`: `listed` (initial) ⇄ `withdrawn`.
- `PluginVersionLifecycle` on `plugin_version.state`: `draft` (initial) → `active` | `rejected` (final); `active` ⇄ `withdrawn`.
- `OrganizationPluginLifecycle` on `organization_plugin.state`: `installing` (initial) → `enabled` | `failed`; `enabled` ⇄ `disabled`; `failed` → `installing` | `removed`; `enabled`, `disabled` → `removing` → `removed` (final; reached through `removing` in bystrovmaxim/gnomon#94).

## Rules the actions keep

- A version is installed only when it is `active` and its plugin `listed`, it fits the core's version, and every `plugin_dependency` names a plugin with an `organization_plugin` row in `enabled` or `disabled` in the organization (FR-014).
- A plugin is disabled only when no `organization_plugin` row in `enabled` of the organization belongs to a version that depends on it (FR-017).
- A version is deployed at most once: `schema_name` is set in the deploy's transaction under the lock `version:<id>`, and a deploy that finds it set skips building (FR-015).
- A private plugin is seen only by its owner: every reading of the marketplace has `owner_organization_id IS NULL OR owner_organization_id = <the organization>` (FR-013).
- A version's `schema_name` is `<name>_<major>_<minor>_<patch>` and its `database_user` `plg_<schema_name>`; both pass the name pattern before any SQL.

## A version's schema (built by the installer)

| Object | Owner | Who else |
|---|---|---|
| schema `<name>_<x>_<y>_<z>` | `maxitor_installer` | `plg_<…>` `USAGE` |
| each table of `schema.yaml` and its `_versions` | `maxitor_installer` | `plg_<…>` `SELECT, INSERT, UPDATE, DELETE` |
| role `plg_<…>` | administered by `maxitor_installer` | member of `maxitor_plugin`; `search_path` = its schema; `CONNECTION LIMIT 20` |
| `organization.change_time`, `watermark`, `is_member` | `maxitor_core` | `maxitor_plugin` `EXECUTE` |

## The wheel store

Not a table: a directory `MAXITOR_WHEEL_STORE` of files `<sha256>.whl`, the resource `WheelStore` (research R7). A version's row names its wheel by `sha256`; a file is never changed once written.
