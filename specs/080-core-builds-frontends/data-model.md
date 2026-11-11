# Data model: the core builds every plugin's frontend

Spec: [spec.md](spec.md) · Research: [research.md](research.md).

## Tables of the schema `plugins`

Both follow the schema's rules: a description on every table and column, the service time fields, a `*_versions` table keeping their history (constitution, "Technology frame and schema rules").

### `plugins.plugin_build` — one frontend build of one plugin version for one core version

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid | The build |
| `version_id` | uuid → `plugins.plugin_version` | The plugin version built |
| `core_version` | text | The core version whose builder image and library made it, `4.5.0` |
| `state` | text | `building`, `built`, `failed` |
| `image` | text, null | The frontend image when built: `maxitor-plugin/<schema>-frontend:<sha12>-<core version>` |
| `error` | text, null | When failed: the first error of the failing step, as the message shows it |
| `started_at`, `finished_at` | timestamptz | When the build started and ended |

- Unique: (`version_id`, `core_version`) — one build per version and core version; a retry replaces a `failed` row's state.
- States: `building` → `built` | `failed`; `failed` → `building` on a retry (a redeployment of the plugin, or the next upgrade round).

### `plugins.frontend_generation` — the core version whose builds the site serves

| Column | Type | Meaning |
|---|---|---|
| `id` | smallint, always 1 | The one row |
| `serving_core_version` | text | Builds of this core version are served |
| `target_core_version` | text, null | The core version being built for during an upgrade; null when none |

- The move: in one transaction, when every enabled version has a `built` build for `target_core_version`, `serving_core_version := target_core_version` and `target_core_version := null`.
- A first start (no row) or a core version equal to the serving one is no upgrade.

## Files

### Passport format 3, `frontend`

| Field | Meaning |
|---|---|
| `frontend.source` | The folder of the frontend's sources in the wheel; it holds `package.json` and `package-lock.json` |
| `frontend.navigation` | As in format 2 |

`frontend.build` does not exist in format 3; a passport of format 2 is refused by name.

### The npm list, `maxitor/core/plugins/builder/npm-packages.txt`

One package name per line, sorted, with a header saying which lock files made it and when. Names only: versions and checksums are the plugin's lock file's.

## Events of the domain `plugins`

| Event | Level | Fields | When |
|---|---|---|---|
| `FrontendBuiltEvent` | info | plugin, version, core version, seconds | A build finished |
| `FrontendBuildFailedEvent` | critical | plugin, version, core version, error | A build failed; the deployment is refused, or the upgrade's move waits |
| `FrontendGenerationMovedEvent` | info | from, to, plugins | The site moved to the builds of a new core version |
| `BuilderImageBuiltEvent` | info | core version, seconds | The builder image was built on the host |
