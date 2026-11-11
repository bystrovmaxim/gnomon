# Implementation Plan: Maxitor core — running plugins: the gateway, the processes and one sign-in

**Branch**: `feature/issue-75-plugin-hosting` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/075-plugin-hosting/spec.md` (issue bystrovmaxim/gnomon#75).

## Summary

The core runs every plugin version enabled in at least one organization and puts it behind its own site. A new process of the core, `maxitor-plugin-runner`, builds each version's Docker images from its wheel, runs its backend (and its frontend when the wheel carries one) in unprivileged containers of the version's own with ports on `127.0.0.1` only, records the addresses, restarts what exits and removes what no organization runs. The core's Next.js application becomes the gateway: for `/p/<name>/**` it asks the core's backend, by an action, for a pass — the session, the membership, the plugin enabled there, the address — and hands the request on with a plugin token in place of the core's cookies. Plugin tokens are signed with EdDSA by the core's private key and checked by plugins through the core's JWKS. A plugin has no roles of its own: the token carries `member`, `administrator` or `service`, which `maxitor-plugin-sdk` gives as role classes. A plugin calls a direct dependency through the gateway, which exchanges its token for the callee, and asks for a service token with the service key its version gets on deployment. The template follows: no `roles`, `MemberRole`, tokens checked by JWKS; the local stand runs the gateway, the runner and the template's backend.

## Technical Context

**Language/Version**: Python 3.12 (CI also 3.14); TypeScript in the core's Next.js application (Next.js 16, its `proxy.ts`).

**Primary Dependencies**: AOA from `external/aoa` (`JwtAuthCoordinator` with `jwks_url` and `algorithm="EdDSA"`); `PyJWT[crypto]` (`cryptography` for Ed25519); Docker on the runner's host; the images `python:<x.y>-slim` and `node:22-slim`.

**Storage**: PostgreSQL schema `plugins`: a new mechanics table `plugin_process` (no versions: it is not the state of data) and a column `service_key_hash` on `plugin_version` and its version table, in migration `plugins/0002_plugin_processes.sql`. Tests run on the recording connection the core's tests already use.

**Testing**: pytest — `packages/maxitor/maxitor-core/tests`, `packages/maxitor/tools/plugin-runner/tests` (new), `packages/maxitor-plugin-sdk/tests`, `packages/maxitor-plugin-template/tests`; one test runs a probe wheel's backend and frontend in real containers; the gateway is checked in the browser check of the local stand.

**Target Platform**: Linux and macOS hosts running the core; one gateway origin.

**Project Type**: web service (the core's backend and application), a process (the runner), a library (the SDK), a plugin (the template).

**Performance Goals**: one pass per request to a plugin — one indexed read of membership, the organization's plugin and the process address, and one signature.

**Constraints**: every endpoint is an action (rules 41–46, 66); no secret of the core in a plugin's environment; the private key only in a file named by the environment; `/api/v1/gateway/pass` and `/exchange` are not reachable from outside the site.

**Scale/Scope**: four new core actions on HTTP (`PassRequestAction`, `ExchangeTokenAction`, `ServiceTokenAction`, `CoreJwksAction`), three runner actions in process (`ListRunnableAction`, `RunVersionAction`, `StopVersionAction`), two controllers (`PluginTokensController`, `PluginProcessesController`), one migration, one new tool, the SDK's role classes and checks, the template in step.

## Constitution Check

- **I. One term, one name**: gateway, pass, plugin token, service key, service token, runner, plugin process, inner address — the same in the spec, the code, the concept and the README.
- **II. Spec ahead of code**: spec 075 with its clarifications; issue #75 rewritten to the same decisions; rule 56 amended first (1.7.0).
- **III. The database does not decide**: identifiers from the writer; `plugin_process` declared with every column described; the service key's hash computed by the core.
- **IV. Decision apart from idea**: the gateway's passing on lives in the application, the decision in an action.
- **V. Measurement**: SC-001 – SC-006 each name a test or the stand's browser check.
- **Rules 41–46 (actions)**: every step of the gateway and the runner is an action with frozen `Params`/`Result`; the pass decides membership in `@access_decide`.
- **Rule 54 (file named like the class)**: each new action, controller and entity in a file of its name.
- **Rule 56 (tokens)**: the session stays HS256; plugin tokens EdDSA with `aud`, 60 s, checked by JWKS; no recipient holds a signing key.
- **Rules 60, 67 (graph)**: the graphs of the core, the template and the new runner tool rebuilt by `graph-builder write`.
- **Rule 66 (connections in routes)**: each new route declares exactly its connections.
- **Versioned storage**: `plugin_process` is mechanics of work and stays without versions, as the storage document allows; `service_key_hash` lives on a versioned table and its version table.

Post-design: no violation.

## Project Structure

### Documentation (this feature)

```text
specs/075-plugin-hosting/
├── spec.md
├── plan.md               # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── gateway.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
.specify/memory/constitution.md                   # rule 56, 1.7.0 (done first)
packages/maxitor/maxitor-core/maxitor/core/
├── settings.py                                   # gateway key file, JWKS address
├── server.py                                     # four new routes
├── plugins/
│   ├── plugin_tokens.py                          # PluginTokensController: sign, read, JWKS
│   ├── plugin_processes.py                       # PluginProcessesController: environments and processes
│   ├── entities.py                               # PluginProcessCoreEntity; service_key_hash
│   ├── events.py                                 # process and token events
│   ├── storage/plugins_storage.py                # pass, exchange, service and process reads and writes
│   ├── actions/pass_request_action.py
│   ├── actions/exchange_token_action.py
│   ├── actions/service_token_action.py
│   ├── actions/core_jwks_action.py
│   ├── actions/list_runnable_action.py
│   ├── actions/run_version_action.py
│   ├── actions/stop_version_action.py
│   └── actions/deploy_and_install_action.py      # the service key
├── migrations/plugins/0002_plugin_processes.sql
packages/maxitor/maxitor-core/web/proxy.ts       # the gateway
packages/maxitor/tools/plugin-runner/             # new: maxitor-plugin-runner
packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/roles.py, checks.py
packages/maxitor-plugin-template/src/maxitor_notes/   # roles, JWKS, passport, navigation
scripts/core-stand.sh                             # key, wheels folder, runner
docs/plugins/concept.md, docs/how-to/run-the-core-locally.md
```

**Structure Decision**: the runner is a tool of its own beside `plugin-installer`, built the same way (a loop of actions, no route) and shipped in the `maxitor` wheel with an extra `plugin-runner`.

## Phases and commits

1. **The gateway and the plugin processes** (issue phase 1): migration, entity, runner actions and controller, `maxitor-plugin-runner`, `PassRequestAction` with membership and enabled checks and the address, `proxy.ts`. Tests: the actions on the recording connection; the runner starting real processes from a test wheel; the gateway's refusals.
2. **Tokens, JWKS, exchange, service key, roles** (issue phase 2): `PluginTokensController`, `CoreJwksAction`, `ExchangeTokenAction`, `ServiceTokenAction`, the service key in deployment, the SDK's role classes and the refusal of `roles`.
3. **The template in step** (issue phase 3): `MemberRole`, JWKS, passport and navigation; the local stand with the key, the wheels folder and the runner.
4. **The tail**: the closing check run to zero; documentation; changelog; versions; graphs.
