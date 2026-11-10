# Research: the marketplace and a plugin in an organization

`core` = `packages/maxitor/maxitor-core/maxitor/core`, `plugins` = `core/plugins`, `installer` = `packages/maxitor/tools/plugin-installer/maxitor/plugin_installer`, `sdk` = `packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk`, `template` = `packages/maxitor-plugin-template`.

## R1. Where the `plugins` domain lives and how its boundary is checked

**Decision**: a package `maxitor.core.plugins` inside the core's folder, with its own `domain`, `events`, `entities`, `storage`, `actions`, `gateways`; its migrations in `core/migrations/plugins/`, run by `maxitor-core migrate` after `platform` and `organization` under the schema `plugins`. `scripts/check_package_boundaries.py` gains the canonical names `core`, `plugins` and `plugin_installer` (its `CANONICAL` lists only three today, so `[packages.core]` is never checked); `plugins` may import `action_machine` and `maxitor_plugin_sdk`; `core` may import `plugins` only through its actions' module `maxitor.core.plugins.actions`; `plugin_installer` may import `action_machine`, `plugins` and the SDK.

**Rationale**: the checker already picks the owner of a file by the longest root and the target of an import by the longest prefix, so a package nested in the core's folder is told apart without new code — only the names are missing.

**Alternatives**: a separate distribution `maxitor-plugins` — rejected: the domain is the core's, migrated by its migrator and published in its extra.

## R2. The installer as a service of its own

**Decision**: `packages/maxitor/tools/plugin-installer/`, command `maxitor-plugin-installer run`, extra `plugin-installer` of the `maxitor` distribution, its own `version.toml`, `build_graph.py` and `graph.json` (listed in `graph-builder.toml`), its own tests. It has no HTTP adapter: a loop calls the `plugins` domain's action `TakeUpPendingAction` on start and every 60 seconds, which runs `CheckVersionAction` for each `draft` version and `DeployAndInstallAction` for each `installing` row. Each row is claimed by `pg_try_advisory_xact_lock(hashtext('install:<row id>'))`; a row another process holds is skipped.

**Rationale**: constitution rule 60 — a service is a self-contained package with its own entry point and graph; rule "API only through actions" — the loop calls actions, no route.

**Alternatives**: a thread in the core's web process — rejected by the maintainer (clarification): the installer's password must not live in the process that faces the internet.

## R3. The roles of the database

**Decision**: `bootstrap.sql` (run once by the administrator) gains:

```sql
CREATE ROLE maxitor_installer LOGIN NOSUPERUSER NOCREATEDB CREATEROLE PASSWORD :'installer_password';
GRANT CREATE ON DATABASE :"database" TO maxitor_installer;
CREATE ROLE maxitor_plugin NOLOGIN;                       -- the group of every version's user
GRANT maxitor_plugin TO maxitor_installer WITH ADMIN OPTION;
CREATE SCHEMA plugins AUTHORIZATION maxitor_core;
```

The core's migration of `plugins` grants `maxitor_installer` `SELECT, INSERT, UPDATE` on the tables of `plugins` and `USAGE` on the schema; the migration of `organization` creates the three `SECURITY DEFINER` functions (R6) and grants `EXECUTE` on them to `maxitor_plugin` only.

**Rationale**: PostgreSQL 16 gives a `CREATEROLE` role the `ADMIN` option only on the roles it creates, so `maxitor_installer` administers the `plg_…` users and nothing else; it cannot make a superuser or touch `maxitor_core`. A group role carries the `EXECUTE` right, so the installer adds a new user to the group instead of granting on the core's functions, which it does not own.

**Alternatives**: `maxitor_admin` of the plugin concept (member of every plugin role with `SET`) — superseded: no `SET ROLE` is needed when the installer owns the tables itself.

## R4. Building the DDL from `schema.yaml`

**Decision**: `sdk/schemas/plugin-schema-1.schema.json` is the file's JSON schema (closed: an unknown key is an error); `sdk/plugin_schema.py` reads it with `yaml.safe_load` and checks a table's name against `^[a-z][a-z0-9_]{0,39}$` (room for `_versions_no_overlap` within 63) and a column's against `^[a-z][a-z0-9_]{0,47}$`; a column's nullability is the key `nullable`, because YAML reads a key `null` as no key at all and every type against the closed list. `installer/ddl.py` builds statements as text from checked names only, each name passed through the core's `identifier()`; nothing from the file is formatted into SQL without it. Every declared table gets: `organization_id uuid NOT NULL` right after `id`, always added by the builder (`schema.yaml` never declares it), `created_at`, `updated_at`, its `<table>_versions` with `valid_from_at`, `valid_to_at`, `valid_during`, `author_id`, `operation`, `closed_by`, `closed_operation`, the primary key `(organization_id, id, valid_from_at)`, the `EXCLUDE USING gist` on `(organization_id, id, valid_during)`, the partial index on open versions, and in both tables an index that begins with `organization_id`. Tables of mechanics get the index by organization and nothing else. `COMMENT ON` every table and column from the file's descriptions. After the build the installer runs the versioned-storage check of `docs/plugins.md` §5.2 on the catalog.

**Rationale**: the issue's 1.4; the core uses `asyncpg` (no `psycopg`), and its `identifier()` already quotes a name by doubling quotes; together with the pattern a name can never close the quote.

**Note**: the issue says `psycopg.sql.Identifier`; the core has no `psycopg`, so the same guarantee comes from the pattern plus `identifier()`. The issue is brought in line in phase 10.

**Alternatives**: SQLAlchemy Core DDL (the constitution's schema frame) — rejected for runtime building: a dependency for one builder, and the core's own migrations are plain SQL already.

## R5. The passport and the formats

**Decision**: passport format 2: `backend.migrate` is gone; `database.schema` names the `schema.yaml` inside the package; `database.mechanics` moves into `schema.yaml`. `sdk/schemas/plugin-passport-2.schema.json`; the core's passport `maxitor-core.yaml` reads `passport: [2]`, `schema: [1]`, `foreign_keys: [1]`, `navigation: [1]`. A wheel with passport 1 is `rejected` ("passport 1 carries migrations; Maxitor builds tables from schema.yaml since passport 2").

**Rationale**: a plugin carries no SQL or migrations (FR-019); the format number says so to every reader, and the SDK's compatibility check already refuses a format the core does not read.

## R6. What a plugin needs of the core

**Decision**: three functions in the schema `organization`, `SECURITY DEFINER`, `SET search_path = organization, platform, extensions`, owned by `maxitor_core`:

| Function | Answer |
|---|---|
| `change_time(organization_id uuid) → timestamptz` | takes `pg_advisory_xact_lock(hashtext('organization:' || id))` and answers the core's change time for it (the same rule as `CoreStorage.lock`) |
| `watermark(organization_id uuid) → timestamptz` | the last change time among the core's version tables of that organization |
| `is_member(organization_id uuid, account_id uuid) → boolean` | the account has an active user there now |

The SDK's helper takes the greatest of `change_time` and one microsecond after its own schema's last change, and the greatest of `watermark` and its own last change; the template's storage uses the helper.

**Rationale**: the plugin sees no core table (FR-025), and the advisory lock is shared by every role of the database, so the organization's writers still line up in one row.

## R7. Downloading and the wheel store

**Decision**: a typed gateway `WheelSourceGateway` (httpx, streaming) per call: `pkg:pypi/<name>@<v>` → the PyPI JSON API's wheel URL; `pkg:github/<owner>/<repo>@<tag>?file=<f>` → `https://github.com/<owner>/<repo>/releases/download/<tag>/<f>`; `pkg:gitlab/<path>@<tag>?file=<f>` → `https://gitlab.com/<path>/-/releases/<tag>/downloads/<f>`; `pkg:generic` is never downloaded. It stops at 50 MB (`MAXITOR_WHEEL_MAX_BYTES`) and 60 s (`MAXITOR_WHEEL_TIMEOUT_SECONDS`); a 401/403/404 on a GitHub or GitLab address is "the release needs signing in". The purl is parsed with `packageurl-python`. The wheel store is a resource `WheelStore` over a directory (`MAXITOR_WHEEL_STORE`), files named `<sha256>.whl`, written atomically (temp file and rename); the web process writes uploads, the installer writes downloads, both on one host.

**Rationale**: constitution — every outside service is a typed gateway per call, every store a resource with meaningful methods (rule 52).

## R8. Uploading a wheel through the core's API

**Decision**: the adapter has no multipart, so `UploadPrivatePluginAction` takes `{file_name, content_base64}` as a typed `Params` (at most 50 MB decoded, checked before decoding by length); the Next.js server action receives the file from the form and sends it on. The action computes the `sha256`, refuses a file that is not a zip with a `.dist-info`, writes it to the store and creates the plugin and its `draft` version with `pkg:generic/<dist name>@<version>?checksum=sha256:<hash>`.

**Alternatives**: a hand-written FastAPI route with `UploadFile` — forbidden: every endpoint is an action.

## R9. The password of a version's user

**Decision**: the installer generates 32 bytes with `secrets.token_urlsafe`, computes the SCRAM-SHA-256 verifier itself (`scramp`), and runs `CREATE ROLE … PASSWORD '<verifier>'`, so the plain password never reaches the server's statement log. The plain password goes only into `MAXITOR_PLUGIN_RUNTIME/<schema>/plugin.env` (`MAXITOR_PLUGIN_DSN=…`), created with mode `0600` before the transaction commits and removed if it rolls back. bystrovmaxim/gnomon#75 starts the process with that file.

## R10. The tree of an organization

**Decision**: the check reads the version's `navigation.yaml` and keeps its top level in `plugin_section` (title, path, position); the core's `OpenOrganizationAction` answers the enabled plugins and their sections, and the Next.js frame draws them as groups. The pages behind them come with bystrovmaxim/gnomon#75.

## R11. Search

**Decision**: `ListPluginsAction(code, query)` answers both tabs and both counts in one call; matching is `ILIKE` on title, `name`, `passport_id` and description, the query's `%` and `_` escaped; private plugins of other organizations are filtered by `owner_organization_id` in the same query.

## R12. The plugin template

**Decision**: `migrations/0001_note.sql` and `migrate.py` go; `schema.yaml` declares `note` with its columns; `foreign-keys.yaml` keeps only the key the core can give, `note (organization_id, writer_id) → core.user (organization_id, id)`, `core` meaning the schema `organization`; `item_id` keeps no key, because the core has no catalog of items. The storage takes time, watermark and membership from the SDK's helper over R6's functions. The template's passport goes to format 2 and its version to `0.4.0`.

## R13. Stand

**Decision**: `scripts/core-stand.sh` runs the extended `bootstrap.sql`, the migrations, the core, the installer and the Next.js application; `quickstart.md` lists the scenarios; the browser checks of the page run against it with `check-core.mjs`.
