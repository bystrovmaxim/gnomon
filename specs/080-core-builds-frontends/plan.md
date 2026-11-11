# Implementation Plan: the core builds every plugin's frontend with its own `@maxitor/panel`

**Branch**: `feature/issue-110-core-builds-frontends` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/080-core-builds-frontends/spec.md`; issue bystrovmaxim/gnomon#110.

## Summary

A plugin's wheel carries its frontend's sources and lock file (passport format 3, `frontend.source`). The installer builds them in the core's builder image — `maxitor-plugin-builder:<core version>`, built on the host from the core's package — with every `@maxitor/*` package replaced by the core's, packages checked against the core's npm list, fetched with the network and built without it; a failed build refuses the deployment by name. Builds belong to a core version; on an upgrade every enabled version is rebuilt in the background and the site moves to the new builds only when all are ready. The runner runs the installer's build. An author runs the same step with `maxitor plugin build --core <version>`. See [research.md](research.md).

## Technical Context

**Language/Version**: Python 3.12 (3.14 checked in CI) for the core, the installer, the runner and the SDK; TypeScript and Next.js 16 for frontends; Node 22 in the builder image.

**Primary Dependencies**: the AOA action machine (actions, controllers, events), Docker CLI, npm, Next.js `output: "standalone"`.

**Storage**: PostgreSQL, schema `plugins`: new tables `plugin_build` and `frontend_generation` with their `*_versions`; images on the host's Docker.

**Testing**: pytest (core, installer, runner, SDK), the template's browser check on the local stand; CI matrix for the template's bounds and the library's releases.

**Target Platform**: Linux host with Docker running the core, the installer and the runner; macOS for authors.

**Project Type**: services and a library in a monorepo (`packages/maxitor`, `packages/maxitor-plugin-sdk`, `packages/maxitor-plugin-template`, `packages/maxitor-panel`).

**Performance Goals**: a template build under 3 minutes on the stand; the builder image built once per core version.

**Constraints**: no lock held during a build; the build of plugin code runs with no network and as user 65534; one library at a time on the site.

**Scale/Scope**: a few plugins per installation; one builder image per core version.

## Constitution Check

- **I. One term, one name**: builder image, build, registry proxy (the npm list and its check), upgrade, serving core version — the same in the spec, research, code and READMEs.
- **II. Spec ahead of code**: spec 080 with its clarifications; issue #110 carries the same five phases.
- **III. The database does not decide**: the move of the serving version and the uniqueness of a build per version and core version are the actions'; the tables only keep them.
- **IV. Decision apart from idea**: the installer decides to build and to move; the controller only runs Docker.
- **V. Measurement**: SC-001 – SC-006 each name a test, the browser check or a log line.
- **Actions only, resources through controllers** (memory: API only through actions): building is `BuildFrontendAction` and the move `MoveFrontendGenerationAction`; Docker is reached only through `FrontendBuilderController`; no HTTP route is added.
- **Versioned storage**: `plugin_build` and `frontend_generation` keep `*_versions`, with descriptions and service time fields.
- **Graph (rules 60, 67)**: the core's, the SDK's, the installer's, the runner's and the template's graph files rebuilt by `graph-builder write`.

Post-design: no violation.

## Project Structure

### Documentation (this feature)

```text
specs/080-core-builds-frontends/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── build-step.md
│   └── passport-3.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/
├── schemas/plugin-passport-3.schema.json      # new; format 2 dropped
├── checks.py                                  # passport 3, frontend.source present, sources without node_modules/.next
└── compat.py                                  # the core reads passport 3

packages/maxitor/maxitor-core/maxitor/core/
├── maxitor-core.yaml                          # plugin-passport: [3]
└── plugins/
    ├── builder/                               # new: Dockerfile, build.sh, npm-packages.txt, lib/ (filled by the wheel's build)
    ├── frontend_build.py                      # new: the build step (lock checks, rewrite, fetch, build, image)
    ├── frontend_builder.py                    # new: FrontendBuilderController (Docker)
    ├── entities.py, ddl.py                    # plugin_build, frontend_generation
    ├── events.py                              # FrontendBuilt/BuildFailed/GenerationMoved, BuilderImageBuilt
    ├── storage/build_storage.py               # new
    ├── actions/build_frontend_action.py       # new
    ├── actions/move_frontend_generation_action.py  # new
    ├── actions/deploy_and_install_action.py   # deploys only a built version
    ├── actions/check_version_action.py        # passport 3
    ├── wheel.py                               # frontend.source
    └── plugin_processes.py                    # the runner takes the serving build's image
packages/maxitor/maxitor-core/maxitor/core/migrations/   # the two tables

packages/maxitor/tools/plugin-installer/maxitor/plugin_installer/loop.py   # build round, upgrade round
packages/maxitor/tools/plugin-runner/maxitor/plugin_runner/loop.py         # restart on a moved generation
packages/maxitor/maxitor-web/maxitor/web/launch.py, plugin_build.py        # maxitor plugin build
packages/maxitor/pyproject.toml                # the wheel carries builder/lib from maxitor-panel and maxitor-tokens

packages/maxitor-plugin-template/
├── src/maxitor_notes/maxitor-plugin.yaml      # passport 3, frontend.source
├── pyproject.toml                             # the wheel carries web/ sources, not _web
└── web/                                       # unchanged sources

scripts/make_npm_list.py                       # new: the npm list from the lock files
scripts/core-stand.sh                          # the stand installs the template's wheel and lets the installer build it
.github/workflows/ci.yml                       # template at both bounds; the library's releases; the npm list up to date
docs/plugins/concept.md, docs/plugins/tutorial/ # delivery, building, passport 3; chapters 1, 2, 13
```

**Structure Decision**: everything stays in the existing packages; the build step lives in the core (`maxitor.core.plugins`) and is imported by the installer and by `maxitor plugin build`, so both run one code path.

## Phases (as in the issue)

1. The builder image and its step; the npm list and its check; passport format 3 with `frontend.source` in `maxitor-plugin-sdk`.
2. The installer builds a version's frontend before deploying it and refuses a failed build by name; the runner runs the built frontend.
3. Upgrading the core: builds per core version, the background rebuild, the move when all are built, a failed build holding the move.
4. `maxitor plugin build --core <version>`; the stand on the production build; the template's wheel with its sources; the template's CI at both bounds and the library's releases; the walk of 1.6 on the stand.
5. Documentation, changelog, versions.

## Complexity Tracking

No violation to justify.
