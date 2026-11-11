# Tasks: Maxitor core — running plugins: the gateway, the processes and one sign-in

**Input**: `specs/075-plugin-hosting/` — spec, plan, research, data model, contracts, quickstart.

One phase is one commit. After each phase only that phase's tests run; the closing check run is at the end.

## Phase 1 — The gateway and the plugin processes (issue phase 1)

- [x] T001 Migration `packages/maxitor/maxitor-core/maxitor/core/migrations/plugins/0002_plugin_processes.sql`: table `plugin_process` with its comments and grants to `maxitor_core`; column `service_key_hash` on `plugin_version` and `plugin_version_versions` (filled in phase 2).
- [x] T002 `PluginProcessCoreEntity` in `plugins/entities.py`, declared by `PluginsStorage`; storage reads and writes: `runnable_versions`, `processes_of`, `record_process`, `clear_process`, `pass_target` (membership, `is_admin`, enabled version, process address).
- [x] T003 Typed events in `plugins/events.py`: a process started, exited, failed to come up, stopped; a pass refused is not written (it would log people's addresses).
- [x] T004 `PluginProcessesController` in `plugins/plugin_processes.py`: the version's environment (`uv venv`, `uv pip install` with find-links), a free port, starting the backend and the frontend with the cleaned environment, waiting for the port, telling whether a process lives, stopping it.
- [x] T005 Runner actions in `plugins/actions/`: `ListRunnableAction`, `RunVersionAction` (start what is missing, restart what exited with the growing pause, record addresses), `StopVersionAction`; role `RunnerRole`.
- [x] T006 The tool `packages/maxitor/tools/plugin-runner/` (`maxitor-plugin-runner run`): settings, the single-runner lock, the loop, launch, README, `version.toml`, `graph.json`, `pytest.ini`; the `maxitor` extra `plugin-runner` and its script.
- [x] T007 `PassRequestAction` (`POST /api/v1/gateway/pass`) with `@access_decide` on membership; a temporary token is not issued here — phase 2 signs it; in this phase the action answers the address and the roles only, and the gateway passes the request without a token.
- [x] T008 `web/proxy.ts`: `/p/<name>/**` routed by `pass`; cookies and incoming `Authorization` removed; the `Origin` check for changing requests; `/api/v1/gateway/pass` and `/exchange` refused from outside; `502` when the plugin does not answer.
- [x] T009 Tests: the storage's reads on the recording connection; `RunVersionAction`'s start, restart with pause and stop with a fake controller; a real start of a test wheel's backend and frontend (R9); `PassRequestAction`'s `404`/`401`/`502`.

## Phase 2 — Tokens, JWKS, exchange, service key and the core's roles (issue phase 2)

- [x] T010 `PluginTokensController` in `plugins/plugin_tokens.py`: the Ed25519 key from `MAXITOR_GATEWAY_KEY_FILE`, `issue`, `read`, `jwks`; `CoreSettings` reads the file and the core refuses to start without it.
- [x] T011 `PassRequestAction` answers the plugin token; `proxy.ts` puts it in `Authorization`.
- [x] T012 `CoreJwksAction` (`GET /api/v1/jwks`).
- [x] T013 `ExchangeTokenAction` (`POST /api/v1/gateway/exchange`): the caller from `aud`, its direct dependencies, the callee enabled; `proxy.ts` exchanges a bearer request.
- [x] T014 The service key: written by `DeployAndInstallAction` into the environment file, its hash on the version; `ServiceTokenAction` (`POST /api/v1/gateway/service-token`).
- [x] T015 `maxitor-plugin-sdk`: `roles.py` with `MemberRole`, `AdministratorRole`, `ServiceRole`; `checks.py` refuses a passport's `roles` and a node's role other than `member`/`administrator`; the core's `CheckVersionAction` the same.
- [x] T016 Tests: tokens for a member and an administrator, an expired one, one with another key; the JWKS checks a token through AOA's `JwtAuthCoordinator`; exchange to a dependency, refused to a non-dependency; service token by key, refused by another key or organization; the SDK's refusals.

## Phase 3 — The processes in containers (issue phase 3)

- [x] T016a `PluginProcessesController` over Docker: an image per version (the wheel and its requirements on `python:<x.y>-slim`; the built pages on `node:22-slim`), a container per kind as user 65534 with no capabilities, no new privileges, read-only, memory, CPU and process limits, a network of its own version, its port on `127.0.0.1` only.
- [x] T016b The database and the gateway as containers reach them: `MAXITOR_PLUGIN_DB_ADDRESS`, `MAXITOR_PLUGIN_DB_CONTAINER`, `MAXITOR_PLUGIN_GATEWAY_URL`; the JWKS through the gateway.
- [x] T016c The runner removes every plugin container a stopped runner left; `plugin_process` records the container's name.
- [x] T016d Tests: the probe wheel's backend and frontend in real containers, unprivileged, with nothing of the core's settings.

## Phase 4 — The template in step (issue phase 4)

- [x] T017 The template: passport without `roles`, actions guarded by `MemberRole`, the role registry of the core's roles, tokens checked by `MAXITOR_CORE_JWKS_URL`, nodes naming `member`; its version 0.6.0.
- [x] T018 `scripts/core-stand.sh`: the gateway's key, the wheels folder built from `external/aoa` and the workspace, the runner started, `MAXITOR_GATEWAY_URL` and the JWKS address given.
- [x] T019 Tests: the template accepts a token the core issued for it and refuses one for another plugin; the walk of the quickstart on the local stand.

## Phase 5 — The tail

- [ ] T020 The closing check run taken to zero; graphs rebuilt.
- [ ] T021 Documentation: `docs/plugins/concept.md` (6.1–6.4, roles, the runner), `docs/how-to/run-the-core-locally.md`, the runner's README, the installer's README (the service key), the SDK's and the template's README.
- [ ] T022 Changelogs and versions: `maxitor`, `maxitor-plugin-sdk`, the template, the core's web, the new tool.
