# Implementation Plan: Maxitor core — the page shell

**Branch**: `feature/issue-109-page-shell` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/078-page-shell/spec.md` (issue bystrovmaxim/gnomon#109).

## Summary

`PanelPage` of `@maxitor/panel` becomes the shell of every page: a page gives it its filters, layer pills, bottom-bar sections and actions as data, and the shell draws them where maxitor-web and the mockup of spec 074 draw them, writing each value into the panel address through the panel router. `<MaxitorCanvas>` gives its zoom to the shell's bottom bar instead of drawing a bar of its own. The router refuses the core's names (`at`, `mode`, `from`, `_…`), and the core refuses them and the open node's path parameters too. The core stops drawing anything over the panel: `Controls.tsx` and its styles go, the `controls` block leaves `navigation.yaml` with navigation format 2, its column leaves `plugin_node` by a migration, and the SDK's checks of controls and their sources go. The head of the tree gets collapse and up. `maxitor-plugin-check` keeps the shell's boundary (the page's root, `fixed`, a layer above the shell), and `panel.ready` carries `shell` and the shell's version, a page without it marked by a red strip on the stand. The template's notes page and the core's test page move onto the shell.

## Technical Context

**Language/Version**: TypeScript 5.9 with Next.js 16 and React 19 for `@maxitor/panel`, the core's application and the template's frontend; Python 3.12 (CI also 3.14) for the core's backend and the SDK.

**Primary Dependencies**: AOA from `external/aoa`; `jsonschema` and `PyYAML` for the navigation; Node's own test runner for `@maxitor/panel`'s logic; Playwright for the browser check on the local stand.

**Storage**: PostgreSQL schema `plugins`: migration `plugins/0004_plugin_node_no_controls.sql` drops `controls` from `plugin_node` and `plugin_node_versions`.

**Testing**: `node --experimental-strip-types --test packages/maxitor-panel/tests/*.test.ts` (the shell's address rules, the router's refusals, the folding, the version mark); pytest — `packages/maxitor-plugin-sdk/tests` (navigation format 2, the frontend's boundary checks), `packages/maxitor/maxitor-core/tests` (the tree builder on format 2, the version check, the tree action without controls, the migration), `packages/maxitor-plugin-template/tests` (its navigation and pages); the browser check `check-core.mjs` on the local stand, desktop and phone.

**Target Platform**: browsers on desktop and phone.

**Project Type**: web application (the core), an npm library (`@maxitor/panel`), a plugin (the template), a Python SDK.

**Performance Goals**: controls change in place, with no reload of the page; the first paint of a server-rendered page carries its controls.

**Constraints**: the address is the panel's only state; the shell's props are serializable where a server component gives them; every colour and size of the shell from `@maxitor/tokens`; maxitor-web is not changed.

**Scale/Scope**: the shell and its parts in `@maxitor/panel`, the canvas's zoom moved into it; the core without controls, navigation format 2, one migration, the tree's head; the SDK's boundary checks; `panel.ready`'s mark; the template's notes page, the test page; the concept, the tutorial's chapters 7 and 13, three READMEs.

## Constitution Check

- **I. One term, one name**: shell, controls, bottom bar, section, page actions, reserved names, panel router, navigation format — the same in the spec, the concept, the code and the READMEs.
- **II. Spec ahead of code**: spec 078 with its clarifications; issue #109 carries the same five phases.
- **III. The database does not decide**: the migration only drops a column the code no longer writes.
- **IV. Decision apart from idea**: the page decides what it offers; the shell only draws and writes the address.
- **V. Measurement**: SC-001 – SC-007 each name a test, a search or the browser check.
- **Versioned storage**: `plugin_node` and `plugin_node_versions` lose the same column in one migration.
- **Rules 60, 67 (graph)**: the core's, the SDK's and the template's graph files rebuilt by `graph-builder write`.

Post-design: no violation.

## Project Structure

### Documentation (this feature)

```text
specs/078-page-shell/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── shell-api.md
│   └── navigation-2.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/maxitor-panel/
├── src/PanelPage.tsx              # the shell: grid, parts, address
├── src/shell/                     # Filters, Layers, BottomBar, Actions, icons, address rules, folding
├── src/hooks.ts                   # usePanelRouter refuses reserved names
├── src/PanelProvider.tsx          # panel.ready with shell and version
├── src/protocol.ts                # panel.ready's new fields
├── src/canvas/MaxitorCanvas.tsx   # zoom given to the shell
└── tests/shell.test.ts, router.test.ts, protocol.test.ts

packages/maxitor/maxitor-core/
├── maxitor/core/maxitor-core.yaml           # reads navigation [2]
├── maxitor/core/navigation.yaml             # format 2
├── maxitor/core/migrations/plugins/0004_plugin_node_no_controls.sql
├── maxitor/core/plugins/{tree_builder,organization_tree,entities}.py, storage/, actions/check_version_action.py
├── maxitor/core/actions/organizations.py    # the tree without controls
├── web/components/frame/{Panel,PageFrame,Tree,Frame}.tsx, frame.css   # no Controls; refusals; red strip; head
├── web/app/(panel)/panel-test/…             # the drawing and the page without the shell
└── web/scripts/check-core.mjs

packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/
├── schemas/navigation-2.schema.json         # format 1 removed
└── checks.py                                # no controls; frontend boundary

packages/maxitor-plugin-template/
├── src/maxitor_notes/navigation.yaml        # format 2
└── web/app/[org]/items/[item_id]/…          # the shell's filters and bottom bar
```

**Structure Decision**: the shell lives in `@maxitor/panel` beside the canvas it takes the zoom from; the core keeps the frame and its refusals.

## Complexity Tracking

None.
