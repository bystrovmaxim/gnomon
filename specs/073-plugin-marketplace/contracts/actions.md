# Contracts: the actions of the `plugins` domain

Every address is declared by the chain of `FastApiAdapter` in `maxitor/core/server.py`, served by the core's web process; every action belongs to the domain `plugins`. Auth is the core's `CoreAuthCoordinator`. "Admin" means the action's `@access_decide` lets through only an active administrator of the organization `<code>`; anyone else is answered `404 {error: "not_found"}`, the same as an organization or page that does not exist. Bodies and answers are Pydantic models in the action's module. A refusal is `{error: <reason>, ...details}` with the status named.

## The page

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `GET /api/v1/organizations/{code}/plugins?query=` | `ListPluginsAction` | admin | — → `{installed: [Row], removed: [Row], marketplace: [Card], private: [Card], counts: {installed, marketplace}}` |
| `GET /api/v1/organizations/{code}/plugins/{passport_id}` | `PluginDetailsAction` | admin | — → `{passport, wheel: {purl, sha256}, tables: [..], schema_name, database_user, deployed: bool, sections: [..], fits_core: bool, dependencies: [{passport_id, installed: bool}]}`; a private plugin of another organization → `404` |

`Row` = `{passport_id, name, title, version, state, reason, purl, installed_by_name, installed_at, depends_on: [..], withdrawn: bool, private: bool}`; `Card` = `{passport_id, name, title, version, description, owner, fits_core, dependencies: [{passport_id, title, installed}], state, reason}`.

## Installing, disabling, enabling

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `POST /api/v1/organizations/{code}/plugins/{passport_id}/install` | `RequestInstallAction` | admin | — → `{state: "installing"}` or `409 core_range` with `{range, core}`, `409 missing_dependency` with `{missing: [..]}`, `409 already_installed`, `409 not_installable` (withdrawn or not active) |
| `POST /api/v1/organizations/{code}/plugins/{passport_id}/retry` | `RetryInstallAction` | admin | — → `{state: "installing"}` or `409 not_failed` |
| `POST /api/v1/organizations/{code}/plugins/{passport_id}/drop` | `DropFailedInstallAction` | admin | — → `{state: "removed"}` or `409 not_failed` |
| `POST /api/v1/organizations/{code}/plugins/{passport_id}/disable` | `DisablePluginAction` | admin | — → `{state: "disabled"}` or `409 needed_by` with `{dependents: [..]}`, `409 not_enabled` |
| `POST /api/v1/organizations/{code}/plugins/{passport_id}/enable` | `EnablePluginAction` | admin | — → `{state: "enabled"}` or `409 not_disabled` |

## A private plugin

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `POST /api/v1/organizations/{code}/private-plugins` | `AddPrivatePluginAction` | admin | `{purl, sha256}` → `{passport_id: null, version_id, state: "draft"}` or `422 pypi_is_public`, `422 no_file`, `422 not_a_purl`, `422 sha256_form` |
| `POST /api/v1/organizations/{code}/private-plugins/upload` | `UploadPrivatePluginAction` | admin | `{file_name, content_base64}` → `{version_id, sha256, purl, state: "draft"}` or `413 too_large`, `422 not_a_wheel` |

## The installer's actions (no address)

Run by `maxitor-plugin-installer` in its own process, never exposed over HTTP.

| Action | What it does |
|---|---|
| `TakeUpPendingAction` | finds every `draft` version and every `installing` row, claims each by an advisory lock, runs the two below; writes "the installer started" and "a row taken up after a stop" |
| `CheckVersionAction` | downloads or reads the wheel, compares `sha256`, reads the passport, `schema.yaml`, `navigation.yaml`, checks the core range and the uniqueness of `passport_id` and `name`; `draft` → `active` or `rejected`, or stays `draft` with the reason |
| `DeployAndInstallAction` | under the lock `version:<id>`, deploys the version if not deployed (schema, user, tables, rights, environment file) in one transaction; then `installing` → `enabled`, or `failed` with the reason |

## The installer's command

`maxitor-plugin-installer add-version <purl> <sha256>` runs `AddMarketplaceVersionAction`: a public plugin's version in `draft` from `pkg:pypi`, which the installer then checks. It is how the marketplace is filled in this work (FR-004) — a command of the operator, not a screen.

## The organization's tree

`GET /api/v1/organizations/{code}` (`OpenOrganizationAction` of bystrovmaxim/gnomon#73) answers also `plugins: [{passport_id, title, sections: [{title, path}]}]` for the enabled plugins, and `is_admin`, which shows the Settings link.

## Events

The closed list of the domain `plugins` (FR-005a), each a `BaseEvent` in `maxitor/core/plugins/events.py`: `VersionAddedEvent`, `PrivatePluginAddedEvent`, `VersionActivatedEvent`, `VersionDeployedEvent`, `DeploySkippedEvent`, `PluginInstalledEvent`, `PluginDisabledEvent`, `PluginEnabledEvent`, `FailedInstallDroppedEvent`, `InstallerStartedEvent`, `RowTakenUpEvent` (info); `VersionRejectedEvent`, `DownloadTimedOutEvent`, `InstallRefusedEvent`, `DisableRefusedEvent`, `PrivatePluginRefusedEvent` (warning); `DeployFailedEvent`, `InstallerConnectionRefusedEvent` (critical).
