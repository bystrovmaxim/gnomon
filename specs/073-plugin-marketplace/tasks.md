# Tasks: Maxitor core — the marketplace, and installing, disabling and enabling a plugin in an organization

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/actions.md](contracts/actions.md), [quickstart.md](quickstart.md), [checklists/security.md](checklists/security.md)

The phases follow issue bystrovmaxim/gnomon#82: one phase is one commit, and after each commit the phase's own tests run (adversarial: break what the new test must catch, see it fail, restore). The story labels map to the spec: US1 install from the marketplace, US2 a missing dependency or a failed install, US3 disable and enable, US4 a private plugin, US5 search, US6 isolation of a version's user, US7 `schema.yaml`.

Paths: `core` = `packages/maxitor/maxitor-core`, `py` = `core/maxitor/core`, `plugins` = `py/plugins`, `web` = `core/web`, `installer` = `packages/maxitor/tools/plugin-installer`, `inst` = `installer/maxitor/plugin_installer`, `sdk` = `packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk`, `template` = `packages/maxitor-plugin-template`.

## Phase 0: The specification

- [x] T001 Commit `specs/073-plugin-marketplace/` — `mockup/index.html`, `spec.md`, `checklists/`, `plan.md`, `research.md`, `data-model.md`, `contracts/actions.md`, `quickstart.md`, `tasks.md`

## Phase 1: The `plugins` domain (issue phase 1)

- [x] T002 Add `packageurl-python` and `scramp` to the extra `core` and create the extra `plugin-installer` and the command `maxitor-plugin-installer` in `packages/maxitor/pyproject.toml`; `uv lock`
- [x] T003 [US1] Write `plugins/plugins_domain.py` (`PluginsDomain`, name `plugins`) and `plugins/events.py` with the 18 event classes of contracts (info, warning, critical), each field described, none carrying a password, a connection string or wheel content (FR-005, FR-005a, FR-005b)
- [x] T004 [US1] Write the entities and lifecycles in `plugins/entities/`: `PluginCoreEntity` (`passport_id`, `name` matching `^[a-z][a-z0-9_]{0,31}$`, `title`, `description`, `owner_organization_id` NULL for public, `PluginLifecycle` `listed` ⇄ `withdrawn`), `PluginVersionCoreEntity` (`version` `^[0-9]+\.[0-9]+\.[0-9]+$`, `purl`, `sha256` `^[0-9a-f]{64}$`, `core_range` NULL until checked, `reason` NOT NULL when `rejected`, `schema_name`, `database_user`, `PluginVersionLifecycle`), `PluginDependencyCoreEntity`, `PluginSectionCoreEntity`, `OrganizationPluginCoreEntity` (`OrganizationPluginLifecycle` with all six states)
- [x] T005 [US1] Write `py/migrations/plugins/0001_plugins.sql`: the five tables of data-model with their `_versions`, every CHECK, the partial UNIQUE (`organization_id`, `plugin_id`) WHERE `state <> 'removed'`, UNIQUE `passport_id`, UNIQUE `name`, UNIQUE `schema_name`, the keys into `organization`, a `COMMENT` on every table and column, no `DEFAULT` on an identifier, no cascade; grant `maxitor_installer` `USAGE` and `SELECT, INSERT, UPDATE` (FR-026a)
- [x] T006 [US1] Extend `py/migrate.py` and `py/schemas.py` to run the folder `plugins` third under `plugins, organization, platform, extensions`; extend `py/bootstrap.sql` with `maxitor_installer` (`CREATEROLE`, `CREATE` on the database), the group `maxitor_plugin` (granted to the installer `WITH ADMIN OPTION`) and the schema `plugins` owned by `maxitor_core`
- [x] T007 [US1] Write `plugins/storage/plugins_storage.py` — `PluginsStorage(PostgresStorage)` with `@entities`, versioned writes under `plugin:<id>` and `organization:<id>`, meaningful methods only (rule 52), no schema named in SQL, `organization_id` in every condition on `organization_plugin`
- [x] T008 Add `core`, `plugins`, `plugin_installer` to `CANONICAL` in `scripts/check_package_boundaries.py` and their sections to `scripts/package_boundaries.toml` (R1)
- [x] T009 [US1] Tests in `core/tests/plugins/`: the storage's SQL on the recording connection, the lifecycles' transitions, a line outside the domain's events refused, the migration's text has no `DEFAULT` on identifiers and no cascade; `tests/scripts/test_package_boundaries.py` sees a planted import of `maxitor.core.plugins.storage` from `maxitor.core.actions` refused

## Phase 2: `schema.yaml` (issue phase 2)

- [ ] T010 [P] [US7] Write `sdk/schemas/plugin-schema-1.schema.json` (closed: tables, columns with type from `uuid`, `text`, `integer`, `bigint`, `numeric`, `boolean`, `date`, `timestamptz`, `jsonb`, `null`, `description`; primary key, unique keys, indexes, keys inside the plugin, `mechanics`) and `sdk/plugin_schema.py` that reads it with `yaml.safe_load` and checks names against `^[a-z][a-z0-9_]{0,47}$`
- [ ] T011 [US7] Write `inst/ddl.py`: statements for every table and its `_versions` (service fields, PK `(organization_id, id, valid_from_at)`, `EXCLUDE USING gist`, the open-version index, the index starting with `organization_id` in both), tables of mechanics with the index by organization only, `COMMENT ON` from descriptions, every name through `identifier()`; the column `organization_id` is always added by the builder and never declared in `schema.yaml`; the keys of `foreign-keys.yaml` checked against the catalog (both tables current, columns and types equal, the target a primary key or unique) and built `ON DELETE RESTRICT`, named `xfk_` and 16 characters of the declaration's hash (FR-022)
- [ ] T012 [US7] Tests: `sdk/tests/test_plugin_schema.py` refuses a quote, a dot, a space, a semicolon, a 49-character name and an unknown type before any SQL; `installer/tests/test_ddl.py` builds the template's file and finds the version table, the overlap constraint and the index by organization for each table

## Phase 3: Deploying a version (issue phase 3)

- [ ] T013 [US6] Write `py/migrations/organization/0002_plugin_functions.sql`: `change_time`, `watermark`, `is_member` — `SECURITY DEFINER`, `SET search_path`, refusing an unknown organization, `is_member` false for blocked or removed; `REVOKE ALL … FROM PUBLIC`, `GRANT EXECUTE … TO maxitor_plugin` (FR-025, FR-026b)
- [ ] T014 [US6] Create the service `installer/`: `pyproject` wiring, `inst/settings.py` (DSN, wheel store, runtime dir, limits — never in a `repr`), `inst/launch.py` (`maxitor-plugin-installer run`), `inst/loop.py` (calls `TakeUpPendingAction` on start and every 60 s), `inst/build_graph.py`, `installer/graph.json`, `installer/version.toml` 1.0.0, `installer/README.md`, `installer/CHANGELOG.md`, `installer/pytest.ini`; an entry in `graph-builder.toml`
- [ ] T015 [US6] Write `inst/deploy_storage.py` (`DeployStorage(PostgresStorage)` as `maxitor_installer`: `deploy_version` in one transaction under `version:<id>` — role with SCRAM verifier, schema, tables from `ddl.py`, grants, group membership, `search_path`, connection limit 20, the keys of `foreign-keys.yaml`; `version_deployed`) and `plugins/actions/deploy_and_install_action.py` (`DeployAndInstallAction`: deploy or skip, write `plugin.env` with mode 0600, `installing` → `enabled` or `failed`) (FR-015, FR-016, FR-023, FR-024, FR-026, FR-026c)
- [ ] T016 [US6] Tests: the recording connection sees the deploy as one transaction and never the plain password; a deploy broken at each statement leaves no schema, role or file; marked `stand` and run only when `MAXITOR_STAND_DSN` is set: on the stand, `plg_…` cannot read `organization`, `public` or another version's schema, cannot `CREATE TABLE`, can call the three functions; `maxitor_core` cannot `CREATE SCHEMA` or `CREATE ROLE`

## Phase 4: Checking a version (issue phase 4)

- [ ] T017 [US4] Write `plugins/gateways/wheel_source_gateway.py` (purl → https address on the allowed hosts only, redirects checked, 50 MB and 60 s, "needs signing in" on 401/403/404) and `plugins/storage/wheel_store.py` (`WheelStore`: `put(sha256, bytes)` atomic and once, `open(sha256)`) (FR-010a, FR-013a, FR-026d, FR-026f)
- [ ] T018 [US4] Write `plugins/actions/check_version_action.py` (`CheckVersionAction`: read the wheel as a zip only — no path outside its root, at most 200 MB expanded; `sha256`, passport 2, `schema.yaml`, `navigation.yaml` top level into `plugin_section`, core range, `passport_id` and `name` unique; `active`, `rejected` with reason, or `draft` with reason) and `plugins/actions/take_up_pending_action.py` (claims each row by `pg_try_advisory_xact_lock`) (FR-009a, FR-010, FR-011, FR-026e)
- [ ] T019 [US4] Tests with a fake gateway: every reason of `rejected` (hash, passport 1, bad `schema.yaml`, core range, `id` taken, `name` taken, closed repository, too large, not a wheel, a path outside the root), a timeout leaving `draft`, a redirect to another host stopped; two takers never take the same row

## Phase 5: Installing, disabling, enabling (issue phase 5)

- [ ] T020 [US1] Write `RequestInstallAction`, `RetryInstallAction`, `DropFailedInstallAction` in `plugins/actions/` with `@access_decide` for an active administrator, refusals `core_range`, `missing_dependency`, `already_installed`, `not_installable` (FR-014, FR-026h)
- [ ] T021 [US3] Write `DisablePluginAction` (refused with the enabled dependents named) and `EnablePluginAction` in `plugins/actions/` (FR-017, FR-018)
- [ ] T022 [US5] Write `ListPluginsAction` (both tabs, counts, `ILIKE` with `%` and `_` escaped, private plugins of other organizations filtered) and `PluginDetailsAction` (404 for another organization's private plugin) in `plugins/actions/` (FR-029, FR-030, FR-013)
- [ ] T023 [US1] Add the routes of contracts to `py/server.py` with `PerCallConnection` for `PluginsStorage` and `WheelStore` declared in place; `OpenOrganizationAction` answers `is_admin` and the enabled plugins with their sections
- [ ] T024 [US2] Tests: each refusal; a disabled dependency counts as installed; two concurrent installs — one row; the disable refusal names dependents; search matches title, `name`, `passport_id`, description and counts both tabs; a private plugin of another organization appears nowhere; a non-administrator gets 404 on every address; the installer stopped mid-install and started again finishes the row

## Phase 6: A private plugin (issue phase 6)

- [ ] T025 [US4] Write `AddPrivatePluginAction` (`pypi_is_public`, `no_file`, `not_a_purl`, `sha256_form`) and `UploadPrivatePluginAction` (`content_base64` at most 50 MB decoded, checked by length first; `not_a_wheel`; `pkg:generic/<dist>@<version>?checksum=sha256:<hash>`) in `plugins/actions/` (FR-012, FR-013)
- [ ] T026 [US4] Tests: each refusal of the dialog; an upload stores the wheel once under its hash and creates a `draft` version owned by the organization

## Phase 7: The page (issue phase 7)

- [ ] T027 [US1] In `web/`: the Settings link at the foot of the tree (administrators only), the settings column, the header crumb "<organization> / Settings" with the name leading back, the tree's groups of enabled plugins (FR-027, FR-028)
- [ ] T028 [US1] `web/app/w/[code]/settings/plugins/page.tsx` and its components: tabs Installed and Marketplace, rows, cards, the details panel, the install dialog with its checks, the disable dialog and the disable refusal, the private plugin dialog (release and upload), the search with counts and the empty result; server actions calling the routes (FR-029, FR-030)
- [ ] T029 [US1] The phone layout of every screen at 375 px: drawer for the tree and the settings column, sheets for dialogs, cards for rows, the details as a whole screen (FR-031)
- [ ] T030 [US1] Check: `next build`; browser checks in `web/scripts/check-core.mjs` of the mockup's 1.1–3.4 and 5.1–7.2 at 1360 × 840 and 375 × 812, no horizontal scrollbar on the phone

## Phase 8: On the stand (issue phase 8)

- [ ] T031 Write `AddMarketplaceVersionAction` (writes `VersionAddedEvent`) and the installer's command `maxitor-plugin-installer add-version <purl> <sha256>` that runs it; extend `scripts/core-stand.sh`: the extended bootstrap, the installer process, the wheel store and runtime dirs, the marketplace filled with the template's wheel through `add-version`
- [ ] T032 Run the quickstart's scenarios on the stand: Notes in two organizations, disabled in one, working in the other (SC-010)

## Phase 9: The template in step (issue phase 9)

- [ ] T033 [P] [US7] `sdk/schemas/plugin-passport-2.schema.json` and the core's passport reading formats `passport: [2]`, `schema: [1]` (R5); the SDK's time and watermark helper over the core's functions (R6)
- [ ] T034 [US7] In `template/`: `schema.yaml` replaces `migrations/0001_note.sql` and `migrate.py`; passport 2, version 0.4.0; `foreign-keys.yaml` to `core.user (organization_id, id)`; the storage and `membership.py` use the SDK's helper and `is_member` (R12)
- [ ] T035 [US7] Tests: the template's tests pass against the new storage; marked `stand`: on the stand it deploys as `notes_0_4_0` with `plg_notes_0_4_0`

## Phase 10: Documentation, changelog, versions (issue phase 10)

- [ ] T036 The closing check run taken to zero
- [ ] T037 Documentation: `template/docs/plugins.md` (roles, a schema and user per version, `schema.yaml`, the installer, the page), `template/docs/versioned-storage.md` (the core's functions), the template's README, `core/README.md`, `installer/README.md`, `docs/how-to/run-the-core-locally.md`; issue #82's wording on identifiers
- [ ] T038 Changelogs of `maxitor`, the installer, the SDK and the template; versions raised for every level changed; graphs rebuilt

## Dependencies

Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9 → 8 → 10: phase 9 runs before phase 8, because the stand fills its marketplace with the template's wheel on passport 2. Tests marked `stand` need the local stand and are not run by CI. Phase 2's SDK part (T010) and phase 9's passport schema (T033) touch only the SDK and may run beside their phase's other tasks. US1 needs phases 1–5 and 7; US2 phases 3–5; US3 phase 5; US4 phases 4 and 6; US5 phase 5; US6 phase 3; US7 phases 2 and 9.

## Implementation strategy

The order follows the issue: the domain, the formats, the database side, the installer, the actions, the page, the stand, the template, the tail. Each phase is committed with its tests green; the browser checks run against the stand after the push.
