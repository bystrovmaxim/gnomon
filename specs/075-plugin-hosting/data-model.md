# Data model: running plugins

## plugins.plugin_process (new, mechanics of work, no versions)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `plugin_version_id` | uuid | no | The deployed version the process runs; key to `plugin_version` |
| `kind` | text | no | `backend` or `frontend` |
| `address` | text | yes | `http://127.0.0.1:<port>` once the process accepts; empty while it starts or waits |
| `container` | text | yes | The Docker container that runs it, `maxitor-<schema>-<kind>` |
| `started_at` | timestamptz | yes | When the running process started |
| `failures` | integer | no | Failures in a row since the last good start |
| `next_start_at` | timestamptz | yes | The earliest next start after a failure |
| `updated_at` | timestamptz | no | When the row last changed |

Primary key `(plugin_version_id, kind)`. Written only by the runner; read by the pass. `maxitor_core` may select, insert, update and delete it.

## plugins.plugin_version (changed)

| Column | Type | Null | Meaning |
|---|---|---|---|
| `service_key_hash` | text | yes | SHA-256 (hex) of the version's service key; empty until it is deployed |

The same column on `plugin_version_versions`.

## The plugin token (claims)

| Claim | Value |
|---|---|
| `iss` | `maxitor` |
| `aud` | the plugin's passport id |
| `sub` | the account's id; `plugin:<passport id>` for a service token |
| `sid` | the session's id; a new one for a service token |
| `org` | the organization's code |
| `roles` | `["member"]`, `["member", "administrator"]` or `["service"]` |
| `iat`, `exp` | issue time and 60 s later |

## The version's environment file (changed)

`<runtime>/<schema>/plugin.env`, mode 0600: `MAXITOR_PLUGIN_DSN`, `MAXITOR_PLUGIN_SCHEMA` and, new, `MAXITOR_PLUGIN_SERVICE_KEY`.

## A container's environment

The environment file's three variables — the DSN with the database's address as the containers reach it — and `MAXITOR_GATEWAY_URL`, `MAXITOR_CORE_JWKS_URL` (the JWKS through the gateway), `MAXITOR_PLUGIN_API` (its backend at `http://maxitor-<schema>-backend:8000`). The frontend gets no DSN and no service key. Nothing else.
