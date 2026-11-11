# Tasks: Maxitor core — the frame

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/).

One phase is one commit and one numbered phase of issue bystrovmaxim/gnomon#74. After each phase only its own tests run; the closing check run is CI's.

## Phase 1: `@maxitor/tokens` (issue phase 1)

- [ ] T001 Create `packages/maxitor-tokens/` with `package.json` (`@maxitor/tokens`, 0.1.0), `version.toml` (`kind = "package"`, `driver = "node"`), `CHANGELOG.md`, `README.md`.
- [ ] T002 Write `packages/maxitor-tokens/tokens.css`: the `--mx-*` colours, palette, radii, shadows, blur, type sizes and spacing from `packages/maxitor/maxitor-web/client/src/index.css` and `theme.ts`.
- [ ] T003 Write `packages/maxitor-tokens/index.ts`: `PALETTE` (the colour names a control may name) and the token names.
- [ ] T004 Write `packages/maxitor/maxitor-core/web/scripts/check-tokens.mjs`: no colour code or size number outside `var(--mx-…)` in the given folders; a test of it on a file with a colour code (refused) and one without (accepted).

## Phase 2: the frame (issue phase 2)

- [ ] T005 Add `@maxitor/tokens` to the core's application (`file:`, `transpilePackages`).
- [ ] T006 `app/w/[code]/layout.tsx` and `components/frame/Frame.tsx`, `Tree.tsx`, `TopRow.tsx`, `Panel.tsx`, `frame.css` with tokens only: the tree on the left, the top row (organization and its switch, path, the empty places of the scale and of presence, the user), the right panel with its dotted field; the phone's drawer.
- [ ] T007 Move Settings → Plugins to `app/w/[code]/core/settings/plugins/page.tsx`, drawn in the panel; redirect `/w/<code>/settings/plugins`.
- [ ] T008 `lib/address.ts`: parse and build `/w/<code>/<owner>/<path>?…&at=`; the organization switch to the same page or the root.
- [ ] T009 Add the frame's folders to `check-tokens.mjs`'s list in the check run.

## Phase 3: the tree (issue phase 3)

- [ ] T010 The core's `maxitor/core/navigation.yaml` (`settings`, `settings.plugins`), read and checked at start.
- [ ] T011 SDK `checks.py`: reserved and taken control parameters, a filter with both or neither of `options` and `source`, `source`/`counts` naming an action of `actions/` or `history/`; tests per refusal.
- [ ] T012 `plugins/tree_builder.py`: `resolve_nodes` (one version's nodes with full names, parents and scope) and `build_tree` (the organization's set: attachments found, direct dependencies only, scope defined, no nested equal keys, order ties); `TreeRefusedError`; tests per refusal and for the template's file.
- [ ] T013 Migration `plugins/0003_plugin_nodes.sql` and `PluginNodeCoreEntity` replacing `plugin_section`; `PluginsStorage.nodes(version_ids)`.
- [ ] T014 `CheckVersionAction` writes the version's nodes and refuses by the one-file rules; `RequestInstallAction` and `EnablePluginAction` build the organization's tree and refuse `navigation`; `PluginDetailsAction` reads its sections from the top nodes; tests.
- [ ] T015 `ReadOrganizationTreeAction` (`GET /api/v1/organizations/{code}/tree`) and `ReadWatermarkAction` (`GET …/watermark`); `OpenOrganizationAction` without `plugins`; tests.
- [ ] T016 The frame's tree from the tree action: roles, hidden empty parents, list nodes loaded through the gateway at the panel's moment in parts of 50 with "More…", the error of one branch with Try again, the path opened from an address.

## Phase 4: the panel protocol and `@maxitor/panel` (issue phase 4)

- [ ] T017 Create `packages/maxitor-panel/` (`@maxitor/panel` 0.1.0, `version.toml`, `CHANGELOG.md`, `README.md`).
- [ ] T018 `src/protocol.ts`: the message types and shape checks; `PanelDocument`, `PanelPage`, `usePanelRouter`, `usePanelQuery`, `useWatermark`, `momentFrom`, `openPanel`; `Card`, `DataTable`.
- [ ] T019 `components/frame/Panel.tsx`: the transparent `iframe` at `/p/<owner>/<code>/<path>`, `panel.location` for same-owner changes, a new address for another owner, `panel.navigate` into the window's history (push/replace), `panel.title`, `panel.open` limited to the core and direct dependencies, "no such page", "could not open", "does not answer"; `panel.watermark` from the watermark action every 5 s for a page without `at`.
- [ ] T020 The test page `app/panel-test/[code]/page.tsx` and its address `/w/<code>/core/panel-test` for administrators.
- [ ] T021 The gateway: a document request to `/p/<name>/<org>/**` redirected to `/w/<org>/<name>/**`; `frame-ancestors 'self'` on `/p/**`.

## Phase 5: `<MaxitorCanvas>` (issue phase 5)

- [ ] T022 `src/canvas/`: the camera, gestures from maxitor-web's `wheelGesture.ts`, limits, keys, fit, `ZoomBar`, the dotted field moving with it, `useCanvas`; a scene on the test page.

## Phase 6: the controls (issue phase 6)

- [ ] T023 `components/frame/Controls.tsx`: `ModePill` (top centre, `counts`), `ViewSwitch` (top right), `FilterPanel` (left accordion, `options` or `source`), `Legend` (bottom left), from maxitor-web's `ModePill`, `ErdFilterPanel`, `DomainLegend`; parameters in the address, defaults dropped, a filter's options on listed; the phone's fold; the test page's controls.

## Phase 7: the template in step (issue phase 7)

- [ ] T024 The template's `web/` on `@maxitor/panel` and `@maxitor/tokens` by path; the notes page with `Card` and `DataTable` by `view` and `author`; Published notes and Draft pages that say what they will show; no frame of its own; the wheel built with the frontend.
- [ ] T025 The browser check `check-core.mjs`: the frame, the address, Back and Forward, the protocol, the canvas, the controls on the test page, and the template's notes page in the panel, desktop and phone, on the local stand.

## Phase 8: documentation, changelog, versions (issue phase 8)

- [ ] T026 The tutorial's chapter 7 "A place in the tree", linked from the index; chapter 13 grown by this step's tests.
- [ ] T027 The plugin concept's section 7 as built (the tree builder's runs, the address, the protocol, the canvas, the controls, the tokens); the core's README and `docs/how-to/run-the-core-locally.md`: the frame and a plugin's page in it; the READMEs of both packages.
- [ ] T028 Versions: `maxitor` (minor), the core's application (minor), the SDK (minor), the template (minor) and its frontend; graph files rebuilt; the changelogs: one entry about what the work created.
