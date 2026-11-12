# Research: the core builds every plugin's frontend

Spec: [spec.md](spec.md) · Issue bystrovmaxim/gnomon#110.

## Where things are today

- **The wheel** carries a built Next.js site under `frontend.build` (passport 2, `maxitor_notes/_web`, `output: "standalone"`, a `server.js`). The SDK's schema is `plugin-passport-2.schema.json`; the core reads `plugin-passport: [2]` (`maxitor/core/maxitor-core.yaml`).
- **The runner** (`maxitor/core/plugins/plugin_processes.py`, `PluginProcessesController`) builds two images per version from the wheel: the backend on `python:<x.y>-slim`, the frontend on `node:22-slim` by copying the wheel's `server.js` site. A failed `docker build` is `EnvironmentInstallError` with the first error of the failing step.
- **The installer** deploys a version in `DeployAndInstallAction`, one transaction under the row's claim, the version's lock and the organization's lock.
- **The library** `@maxitor/panel` 0.3.0 and `@maxitor/tokens` ship their TypeScript and CSS (`main: src/index.ts`); the template and the core's own web take them by `file:` links and compile them with `transpilePackages`.
- **The author's check** is `maxitor plugin check <path> --core <version>` (`maxitor.web.launch`, the `plugins` extra).
- **The stand** (`scripts/core-stand.sh`) runs `npm ci && npm run build` for the template before packing its wheel.

## Decisions

### R1. The build runs in the installer, outside the deploy transaction

- **Decision**: A new action of the domain `plugins`, `BuildFrontendAction`, run by the installer each round before deploying: for every version waiting to deploy (and, on an upgrade, every enabled version) without a build for the running core version, it builds the frontend and records the result in `plugins.plugin_build`. `DeployAndInstallAction` deploys only a version whose build for the running core version is `built`; a `failed` build fails the install with the build's reason.
- **Rationale**: A Next.js build takes minutes; holding the version's and the organization's locks and a database transaction for minutes would block every other install. Recording the build apart also gives the upgrade (R5) its state.
- **Alternatives**: building inside `DeployAndInstallAction` (blocks locks); building in the runner when it starts a version (the deployment would succeed and the page fail later — FR-008 asks the deployment to be refused).

### R2. The builder image is built on the host from the core's package

- **Decision**: The `maxitor` wheel carries a folder `maxitor/core/plugins/builder/`: a Dockerfile, the step's script, the npm list (R4) and the library's sources (`@maxitor/panel`, `@maxitor/tokens`, copied by the wheel's build from `packages/maxitor-panel` and `packages/maxitor-tokens`). `FrontendBuilderController` builds `maxitor-plugin-builder:<core version>` from it the first time a build needs it: `node:22-slim` pinned by digest, `TZ=UTC`, `LANG=C.UTF-8`, `NEXT_TELEMETRY_DISABLED=1`, the library under `/maxitor/lib/`.
- **Rationale**: Decided in clarify: nothing more to publish with a core release; the image follows the installed core exactly.
- **Alternatives**: an image published to a registry with each release (rejected in clarify).

### R3. `@maxitor/*` replaced by rewriting the package and lock entries, then `npm ci`

- **Decision**: Before `npm ci`, the step rewrites, in the copy of the plugin's `package.json` and `package-lock.json` inside the build container, every `@maxitor/*` entry to the core's folder `/maxitor/lib/<name>` as a `file:` link, and nothing else. Then `npm ci` installs strictly by the lock.
- **Rationale**: npm's `overrides` field changes what `npm ci` resolves, and `npm ci` refuses a lock that does not match `package.json` — an `overrides` added at build time makes the lock stale and `npm ci` fail. Rewriting both entries together is the same replacement the issue asks for ("every `@maxitor/*` package replaced by the core's"), keeps every other package exactly as locked, and is deterministic.
- **Alternatives**: `overrides` plus `npm install` (resolves anew, breaks "strictly by the lock"); copying the core's packages over `node_modules` after `npm ci` (leaves a stale tree of the plugin's own library and its dependencies).

### R4. The registry proxy: a list check, a fetch with the network, a build without it

- **Decision**: The core's door to npm has two steps in one build. **Fetch**: every package name in the plugin's lock (except the rewritten `@maxitor/*`) must be on the core's list, and every `resolved` URL must be on `https://registry.npmjs.org/`; a name off the list or another host fails the build naming it. Then `npm ci --ignore-scripts` fills npm's cache from those URLs alone, running no code of the plugin or of its packages. **Build**: a second container, `--network none`, runs `npm ci --offline` from that cache and `next build`. The list is `maxitor/core/plugins/builder/npm-packages.txt`, one name per line, made at each core release by `scripts/make_npm_list.py` from the lock files of the template's frontend and `@maxitor/panel`, nested dependencies included; CI checks the file is up to date and that the template builds with it.
- **Rationale**: Decided in clarify: the proxy lets through only the names on the core's list, and the lock fixes versions and checksums (`integrity`). Checking the lock before any download and building with no network gives the same guarantee as a proxy server — a plugin's build cannot fetch a name off the list or reach anything else — without running and securing a registry server, and keeps the plugin's own code (`next.config`, its pages) away from the network while it runs.
- **Alternatives**: a registry server with an allow-list (Verdaccio or our own) — one more service to run, secure and update, for the same result.

### R5. The upgrade: builds per core version, one serving version switched at once

- **Decision**: A build belongs to a core version (`plugins.plugin_build`: version, core version, image, state). The serving core version of builds is one row (`plugins.frontend_generation`). When the installer starts at a core version that differs from the serving one, it builds every enabled version for the new one in the background; when all are `built`, it switches the serving row in one transaction; the runner serves each version's build of the serving core version and restarts its frontend container when that changes. A `failed` build leaves the serving row as it is and raises `FrontendBuildFailedEvent` (critical) naming the plugin, its version and the error; the installer tries it again on the next deployment of that plugin, or when it is disabled, and switches once every enabled version is built.
- **Rationale**: FR-010–FR-012 and SC-003: never two libraries at once, never a broken page during an upgrade.
- **Alternatives**: rebuilding in place one by one (two libraries at once); refusing to start the new core (the core's backend cannot wait for frontends).

### R6. The runner runs the installer's build

- **Decision**: The frontend image is the build's output: the build container's `.next/standalone`, `.next/static` and `public/` are copied into `maxitor-plugin/<schema>-frontend:<sha>-<core version>` on `node:22-slim`; the runner's `Plan` takes the image of the serving build from `plugins.plugin_build` and no longer reads a site from the wheel.
- **Rationale**: FR-009.

### R7. Passport format 3

- **Decision**: `plugin-passport-3.schema.json`: `frontend.source` (the folder of the frontend's sources in the wheel, holding `package.json` and `package-lock.json`) replaces `frontend.build`; everything else as format 2. The core reads `plugin-passport: [3]` only; `maxitor-plugin-sdk` adds format 3 and drops format 2 in a minor version of 1.x, as no plugin outside this repository uses format 2 (the same reasoning as navigation format 1 in spec 078). The template's wheel carries `web/` without `node_modules`, `.next` and `_web`.
- **Rationale**: FR-001, FR-002, FR-018.

### R8. The author's command

- **Decision**: `maxitor plugin build <path> --core <version>` in `maxitor.web.launch`, the `plugins` extra: it refuses a `--core` other than the installed `maxitor` version (naming both, and the command to install the other), builds the builder image of that version if needed, runs the same step as the installer (`maxitor.core.plugins.frontend_build`) and prints the result or the first error.
- **Rationale**: FR-013 and SC-005: one code path for both.

### R9. The template's CI at both bounds

- **Decision**: The template lives in this repository and the core 4.x is not published, so its CI builds and runs its browser check against the core of the checkout, which is the upper bound; the lower bound is the core of the newest git tag `maxitor-v4.4.*`, checked out into a second job. The tutorial's chapter 13 gives a plugin outside the repository the workflow for both bounds from PyPI.
- **Rationale**: FR-015 without a published core.

### R10. The library's versions checked against the template

- **Decision**: The core's CI runs the template's browser check once per release of `@maxitor/panel` within the core's major. The releases are the versions of the library's changelog; each release's sources are taken from the commit that wrote its changelog entry, and the template is built against them by the same step as the installer's.
- **Rationale**: FR-016, FR-017.

## Unknowns

None left: the four questions of clarify are answered in the spec.
