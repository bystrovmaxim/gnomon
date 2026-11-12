# Tasks: a page gives the core its history; navigation.yaml holds the tree only

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 — The page gives its history (US1)

- [x] T001 `protocol.ts`: `PageHistory`, `historyOf`, `checkHistory`, `NO_HISTORY`, `panel.history`; `panel.ready` without `surface`.
- [x] T002 `PanelPage.tsx`: `history`, sent when the page opens and whenever it changes; `PanelDocument`, `PanelProvider` without `surface`.
- [x] T003 `PageFrame.tsx`, `Panel.tsx`, `Frame.tsx`, the organization's layout: the allowed names threaded in; refused names logged by name, the rest kept (`data-history`).

## Phase 2 — Navigation format 3 (US2, US3)

- [x] T004 `navigation-3.schema.json`; `checks.py`: `NAVIGATION_FORMAT_2`, `retired_node`; the old page-history check removed.
- [x] T005 `tree_builder.py`, `organization_tree.py`, `plugins_storage.py`, `entities.py`, `check_version_action.py`, migration 0007, `maxitor-core.yaml`, the core's `navigation.yaml`.
- [x] T006 `organizations.py`: `histories` in the organization's answer.

## Phase 3 — The template and the tests (US4)

- [x] T007 The template's pages give their history; its `navigation.yaml` in format 3.
- [x] T008 Tests of the SDK, the core, the template and the panel; each rule broken and its test seen failing; `check-core.mjs` scenario of the test drawing's history.

## Phase 4 — Documentation, changelog, versions (US5)

- [x] T009 The plugin concept (7.2, 7.4, 7.9, 8), the READMEs of the SDK, the panel and the template, chapter 13 and the index.
- [x] T010 Versions: maxitor 4.7.0, the core's application 1.6.0, `@maxitor/panel` 0.5.0, `maxitor-plugin-sdk` 1.7.0, the template 0.11.0 and its pages 0.5.0; changelogs.
