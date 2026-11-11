# Tasks: Maxitor core — the page shell

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/).

One phase is one commit and one numbered phase of issue bystrovmaxim/gnomon#109. After each phase only its own tests run; the closing check run is CI's.

## Phase 1: the shell in `@maxitor/panel` (issue phase 1)

- [x] T001 `src/shell/address.ts`: the filter, choice and layer address rules, the default after a missing value, the reserved names; `tests/shell.test.ts` for each.
- [x] T002 `src/shell/icons.tsx`: the shell's icon set and the neutral icon; `src/shell/Filters.tsx`, `Layers.tsx`, `BottomBar.tsx`, `Actions.tsx` from maxitor-web's `ErdFilterPanel`, `ModePill`, `ZoomToolbar`; `src/shell/shell.css` with tokens only; the phone's folding.
- [x] T003 `PanelPage` as the shell: grid, insets, parts from its props, actions hidden at `at` or `mode`; the shell's context the canvas gives its zoom to; `<MaxitorCanvas>` without its own `ZoomBar`; the token `--mx-layer-shell`.
- [x] T004 `usePanelRouter` refuses the reserved names (error in development and tests, a console line in production); `tests/router.test.ts`.
- [x] T005 `index.ts` exports and the shell's types.

## Phase 2: the core (issue phase 2)

- [x] T006 SDK: `schemas/navigation-2.schema.json` (no `controls`, `param` without `at`, `mode`, `from`), `navigation-1.schema.json` removed; `checks.py` reads format 2, refuses format 1 by name, no control or control-source checks; tests.
- [x] T007 Core: `maxitor-core.yaml` reads navigation `[2]`; the core's and the template's `navigation.yaml` format 2; `tree_builder.py` on format 2; migration `0004_plugin_node_no_controls.sql`; `controls` gone from the entity, the storage, `check_version_action.py`, `organizations.py`, `organization_tree.py`; tests and fakes.
- [x] T008 Core web: `Controls.tsx` and its styles removed; `TreeNode.controls` gone; `PageFrame` refuses reserved names and the node's path parameters in `panel.navigate` and `panel.open`; the tree's head with collapse and up.

## Phase 3: the boundary checks (issue phase 3)

- [x] T009 SDK `checks.py`: a page's root is `PanelPage`, no `fixed`, no layer of 30 or more, each refusal with file and line; tests with a faulty copy and a passing one.
- [x] T010 `panel.ready` with `shell` and `shellVersion`; `SHELL_VERSION` equal to `package.json` by a test; `PageFrame`'s red strip and console warning; `NEXT_PUBLIC_MAXITOR_MARK_UNFRAMED=1` in `core-stand.sh`; protocol tests.

## Phase 4: the template and the test page (issue phase 4)

- [ ] T011 The template's notes page gives its authors (read by the page) to the shell's filters and list/table as a bottom-bar choice; its other pages in the shell; its tests.
- [ ] T012 The core's test page: the drawing with three layers, counts, a comparison-only filter section, two bar sections; the page without the shell.
- [ ] T013 `check-core.mjs`: the shell's parts on the notes page and the drawing, desktop and phone; the router's refusals; the red strip; the tree's head.

## Phase 5: documentation, changelog, versions (issue phase 5)

- [ ] T014 The plugin concept: the shell, navigation format 2, the reserved names; nothing of the core drawing controls or a legend.
- [ ] T015 The tutorial's chapter 7 on controls as built, its row in the index; chapter 13 grown by this step's tests.
- [ ] T016 READMEs of `@maxitor/panel`, the core, `docs/how-to/run-the-core-locally.md`.
- [ ] T017 Versions of every changed level; graph files rebuilt; one changelog entry per changed level.
