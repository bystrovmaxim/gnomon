# maxitor-plugin-runner

**The process that runs Maxitor's plugins.** It keeps every deployed plugin version that is enabled in at least one organization running in Docker containers of its own, and records where each one answers for the core's gateway.

```bash
pip install "maxitor[plugin-runner]"
MAXITOR_CORE_DSN=postgresql://maxitor_core:…@db/maxitor maxitor-plugin-runner run
```

## What it does

On start it removes every plugin container a stopped runner left; then every round (10 s) it runs the actions of the core's domain `plugins` in itself — there is no HTTP route:

1. **The versions to run**: every deployed version enabled in at least one organization.
2. **Each version kept running.** The backend's image is built once from the version's wheel, on `python:<x.y>-slim` with the wheel and its requirements; the frontend's image is the one the installer built for the serving core version (`plugins.plugin_build` of `plugins.frontend_generation`'s serving version) — without such a build no frontend runs, and a frontend container running another image is restarted on the new one once the site moves to a new core. An image that cannot be built is a critical message, `The images of <plugin> <version> could not be built: <reason>`, the reason being the first error of the step that failed — pip's, when a requirement is missing — and the next round tries again. Each runs as a container `maxitor-<schema>-<kind>`: user 65534, no capabilities, no new privileges, a read-only file system, limits of memory, CPU and processes, a network `maxitor-<schema>` of its own, its port published on `127.0.0.1` of the host only. Its address goes into `plugins.plugin_process` once it answers HTTP. A container that exits is started again after a pause that doubles from 5 seconds up to 5 minutes; its failures are forgotten after a minute of running.
3. **The rest stopped**: the containers of a version no organization runs any more are removed with their rows.

One runner works at a time: it holds the advisory lock `plugin-runner`, and a second one waits. Every line is a typed event of the domain `plugins`.

## What a container gets

Its version's environment file — the database address as its own role, `MAXITOR_PLUGIN_DSN`, and its service key, `MAXITOR_PLUGIN_SERVICE_KEY` (the frontend gets neither) — the gateway's address `MAXITOR_GATEWAY_URL`, the core's JWKS `MAXITOR_CORE_JWKS_URL` through the gateway, and its backend's address `MAXITOR_PLUGIN_API`. Nothing of the core's settings: it cannot read another version's file or the core's processes, and it reaches another plugin only through the gateway.

## Settings

| Variable | What it is |
|---|---|
| `MAXITOR_CORE_DSN` | The core's database, as `maxitor_core`. Required. |
| `MAXITOR_PLUGIN_RUNTIME` | Where each deployed version's environment file lies, as the installer writes it. |
| `MAXITOR_WHEEL_STORE` | The directory of wheels, kept by `sha256`; shared with the core. |
| `MAXITOR_PLUGIN_GATEWAY_URL` | The gateway as the containers reach it: `http://host.docker.internal:3000`. |
| `MAXITOR_PLUGIN_DB_ADDRESS` | The database as the containers reach it, `host:port`, in place of the one in the environment file. |
| `MAXITOR_PLUGIN_DB_CONTAINER` | When the database is a container: it joins each version's network as `maxitor-db`. |
| `MAXITOR_PLUGIN_FIND_LINKS` | A folder of wheels a version's requirements are taken from when PyPI does not have them yet. |
| `MAXITOR_PLUGIN_MEMORY`, `MAXITOR_PLUGIN_CPUS` | A container's limits: `512m` and `1`. |
| `MAXITOR_RUNNER_PERIOD_SECONDS` | How often it takes its round: 10 s. |
| `MAXITOR_RUNNER_NAME` | The runner's name, `maxitor` by default. Its containers carry the label `maxitor.plugin.runner=<name>`, and a runner of another name puts its name in front of its containers' and networks' names: it starts, watches and removes only its own, so two stands share a host. |

The runner needs Docker on its host and reads the environment files of the versions, so it runs as the operating-system user the installer writes them as. Running it all locally: [Run Maxitor core locally](../../../../docs/how-to/run-the-core-locally.md).
