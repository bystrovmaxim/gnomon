# Tasks: the core builds every plugin's frontend with its own `@maxitor/panel`

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

Phases follow the issue's five; one phase is one commit. `[P]` — may run in parallel with the other `[P]` tasks of its phase.

## Phase 1 — The builder image, its step, the npm list, passport format 3 (US1, US2)

- [ ] T001 [P] `packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/schemas/plugin-passport-3.schema.json`: format 2 with `frontend.source` in place of `frontend.build`; remove `plugin-passport-2.schema.json` and format 2 from the SDK's reading (`checks.py`, `compat.py`); `maxitor-plugin-check` refuses format 2 and `frontend.build` by name, and a `frontend.source` folder without `package.json` and `package-lock.json` or holding `node_modules`, `.next` or a built site.
- [ ] T002 [P] `scripts/make_npm_list.py`: the npm list from `packages/maxitor-plugin-template/web/package-lock.json` and `packages/maxitor-panel`'s dependencies, nested ones included, sorted, `@maxitor/*` left out; writes `packages/maxitor/maxitor-core/maxitor/core/plugins/builder/npm-packages.txt` with its header; `--check` exits 1 when the file is stale.
- [ ] T003 `packages/maxitor/maxitor-core/maxitor/core/plugins/builder/`: `Dockerfile` (`node:22-slim` by digest, `TZ=UTC`, `LANG=C.UTF-8`, `NEXT_TELEMETRY_DISABLED=1`, `/maxitor/lib/`), and `packages/maxitor/pyproject.toml` force-including `packages/maxitor-panel` and `packages/maxitor-tokens` sources as `builder/lib/panel` and `builder/lib/tokens`.
- [ ] T004 `packages/maxitor/maxitor-core/maxitor/core/plugins/frontend_build.py`: the step of `contracts/build-step.md` — the lock's checks, the `@maxitor/*` rewrite, the list and host checks, each failure an `EnvironmentInstallError` with its sentence; pure functions for the checks and the rewrite.
- [ ] T005 `packages/maxitor/maxitor-core/maxitor/core/plugins/frontend_builder.py`: `FrontendBuilderController` — builds the builder image once per core version (`BuilderImageBuiltEvent`), runs the fetch container (registry only) and the build container (`--network none`, user 65534), builds the frontend image from the output; the first error of the failing step as today's `_first_error`.
- [ ] T006 [P] Tests: `packages/maxitor-plugin-sdk/tests/test_passport_3.py` (format 3 read, format 2 and `frontend.build` refused, sources checked); `packages/maxitor/maxitor-core/tests/plugins/test_frontend_build.py` (each step's refusal by name, the rewrite, the list check) and `test_npm_list.py` (the list is up to date). Each refusal test breaks its check and sees the test fail (adversarial).

## Phase 2 — The installer builds before it deploys; the runner runs the build (US1, US2)

- [ ] T007 `entities.py`, `ddl.py`, a migration in `maxitor/core/migrations/`: `plugins.plugin_build` and `plugins.frontend_generation` with their `*_versions`, descriptions, service time fields (data-model.md).
- [ ] T008 `storage/build_storage.py`: read and write builds and the generation; the latest build of a version for a core version.
- [ ] T009 `events.py`: `FrontendBuiltEvent`, `FrontendBuildFailedEvent` (critical), `FrontendGenerationMovedEvent`, `BuilderImageBuiltEvent`.
- [ ] T010 `actions/build_frontend_action.py`: build one version for the running core version — `building`, then `built` with the image or `failed` with the error; no lock held while building.
- [ ] T011 `actions/deploy_and_install_action.py`, `actions/check_version_action.py`, `wheel.py`, `maxitor-core.yaml`: passport 3; deploy only a version with a `built` build for the running core version; a `failed` build fails the install with its reason, shown in Settings → Plugins.
- [ ] T012 `tools/plugin-installer/.../loop.py`: each round builds every version waiting to deploy that has no build for the running core version, before deploying it.
- [ ] T013 `plugin_processes.py`: the frontend image is the serving build's (`plugin_build` of the serving core version); no site read from the wheel; `FRONTEND_DOCKERFILE` and `frontend_files` removed.
- [ ] T014 Tests: the build action's states; a version without a build is not deployed; a failed build refuses the install by name; the runner's plan takes the build's image.

## Phase 3 — Upgrading the core (US3)

- [ ] T015 `actions/move_frontend_generation_action.py`: on a core version differing from the serving one, set the target; when every enabled version has a `built` build for it, move the serving version in one transaction and emit `FrontendGenerationMovedEvent`; a failed build holds the move and emits `FrontendBuildFailedEvent`; a disabled version is no longer waited for.
- [ ] T016 `tools/plugin-installer/.../loop.py`: the upgrade round in the background, after the deploy round, one build at a time.
- [ ] T017 `tools/plugin-runner/.../loop.py`: when the serving core version changes, restart each version's frontend container on its new image.
- [ ] T018 Tests: no move while one build is missing or failed; the move switches all at once; a disabled plugin stops holding the move; the runner restarts on a move.

## Phase 4 — The author, the stand, the template, CI (US4, US5)

- [ ] T019 `maxitor-web/maxitor/web/launch.py`, `maxitor-web/maxitor/web/plugin_build.py`: `maxitor plugin build <path> --core <version>` per `contracts/build-step.md`.
- [ ] T020 Template: `maxitor-plugin.yaml` passport 3, `frontend.source: maxitor_notes/web`; `pyproject.toml` packs `web/` sources without `node_modules`, `.next` and `_web`; its version raised.
- [ ] T021 `scripts/core-stand.sh`: no `npm run build` of the template; the stand installs its wheel and the installer builds it; the production build answers behind the gateway.
- [ ] T022 `.github/workflows/ci.yml`: the npm list up to date; the template built by the step at the checkout's core and at the newest `maxitor-v4.4.*` tag; the template's browser check against each release of `@maxitor/panel` from its changelog.
- [ ] T023 The walk of 1.6 on the local stand in the browser — the template from its wheel, the core's library whatever its `package.json` names, a failing plugin refused by name, an upgrade moving and an upgrade held — its result recorded for the pull request.

## Phase 5 — Documentation, changelog, versions (US6)

- [ ] T024 `docs/plugins/concept.md`: delivery, building, passport 3, the library's versions; the tutorial's chapters 1 and 2 where they speak of the frontend and chapter 13 with this step's tests, their rows in the index naming #110.
- [ ] T025 READMEs of the installer, the runner, the template and `maxitor-plugin-sdk`; the core's README (passport 3, `maxitor plugin build`).
- [ ] T026 Graph files rebuilt (`graph-builder write`); versions raised (maxitor, the core, the installer, the runner, the SDK, the template); changelogs of every changed package and the repository's.
- [ ] T027 The closing check run to zero (`scripts/check_run.py`).

## Dependencies

Phase 1 → 2 → 3 → 4 → 5. Inside a phase, `[P]` tasks touch different files.
