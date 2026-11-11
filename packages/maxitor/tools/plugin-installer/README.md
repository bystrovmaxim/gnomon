# maxitor-plugin-installer

**The process that checks Maxitor plugin versions and deploys them.** It is the only holder of the password of the database role `maxitor_installer`, which may create a role and a schema; the core's web process, which faces the internet, never knows it.

```bash
pip install "maxitor[plugin-installer]"
MAXITOR_INSTALLER_DSN=postgresql://maxitor_installer:…@db/maxitor maxitor-plugin-installer run
```

## What it does

On start and then every minute it takes up its queue, running the actions of the core's domain `plugins` in itself — there is no HTTP route:

1. **A version in `draft`** is checked: its wheel downloaded (PyPI, a release on GitHub or GitLab — only those hosts, at most 50 MB within 60 seconds) or read from the wheel store, its `sha256` compared, its passport 2, `schema.yaml`, `navigation.yaml` and `foreign-keys.yaml` read — never run — and its core range checked; a passport with `roles` or a node asking for a role other than the core's `member` or `administrator` is rejected. It becomes `active`, or `rejected` with the reason; a download that fails stays `draft` and is tried again.
2. **A plugin in `installing`** is finished: its version is deployed if no organization has it yet — in one transaction, the user `plg_<name>_<x>_<y>_<z>` with a SCRAM verifier, the schema `<name>_<x>_<y>_<z>`, the tables of `schema.yaml` with their version tables, the keys to the core, the rights — then enabled. A failure leaves nothing built and the row `failed` with the reason. The version user's password and the version's service key — the key with which the plugin asks the core for a token when no person is behind a call — go only into `<runtime>/<schema>/plugin.env` (mode 0600); the core keeps the key's SHA-256. The runner [`maxitor-plugin-runner`](../plugin-runner/README.md) starts the version from there.

Each row is claimed, so two installers never work on one row; a row a stopped installer left is taken up when one starts. A refused database connection is written as a critical event and tried again the next round. Every line is a typed event of the domain `plugins`.

## Filling the marketplace

```bash
maxitor-plugin-installer add-version pkg:pypi/maxitor-notes@0.4.0 <sha256>   # a wheel on PyPI
maxitor-plugin-installer add-wheel dist/maxitor_notes-0.4.0-py3-none-any.whl  # a wheel at hand
```

Each adds a public version in `draft`; the next round checks it.

## Settings

| Variable | What it is |
|---|---|
| `MAXITOR_INSTALLER_DSN` | The database, connected to as `maxitor_installer`. Required. |
| `MAXITOR_WHEEL_STORE` | The directory of wheels, kept by `sha256`; shared with the core. |
| `MAXITOR_PLUGIN_RUNTIME` | Where each deployed version's environment file is written. |
| `MAXITOR_WHEEL_MAX_BYTES`, `MAXITOR_WHEEL_TIMEOUT_SECONDS` | A wheel's size and download time limits: 50 MB and 60 s. |
| `MAXITOR_INSTALLER_PERIOD_SECONDS` | How often it takes up its queue: 60 s. |
| `MAXITOR_SCHEMA_ORGANIZATION`, `MAXITOR_SCHEMA_PLUGINS`, `MAXITOR_SCHEMA_EXTENSIONS` | The schemas' names when they are not the logical ones. |

The roles `maxitor_installer` and `maxitor_plugin` are created once by the administrator's [`bootstrap.sql`](../../maxitor-core/maxitor/core/bootstrap.sql). Running it all locally: [Run Maxitor core locally](../../../../docs/how-to/run-the-core-locally.md).
