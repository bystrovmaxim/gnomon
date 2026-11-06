# Tasks: Data source contours — one name, copying names, folding, and a Data sources node

One phase = one commit, referencing (#56).

- [x] T001 Phase 1: a data source's name once — empty labels on the spacing frames, `dc:` id and tooltip on a data source contour (`buildDotSource.ts`); Vitest; `check-erd-data-sources.ts` counts the name
- [ ] T002 Phase 2: copying a contour's name (`erdCopy.ts`); Vitest
- [ ] T003 Phase 3: the Data sources node — sidebar listing (`left_sidebar_action.py`), page keys (`pages.py`, `pageKey.ts`), the scoped ERD selection and address (`diagramSelection.ts`, `urlState.ts`, `sidebarNavigation.ts`), narrowing (`loadErdDomainsBundle.ts`), the panel; pytest and Vitest
- [ ] T004 Phase 4: folding — `foldPlan` and the folded DOT, fold controls, bundle plates and hover, canvas clicks and cards, `folded_contours` setting and address, room settings of the ERD (`pages.py`); Vitest, pytest, `check-erd-contour-fold.ts`
- [ ] T005 Phase 5: rebuild the graph files if they changed; raise the versions of `maxitor-web` and `maxitor`
- [ ] T006 Phase 6: the closing check run, browser checks included
- [ ] T007 Phase 7: documentation — the ERD and navigation sections of the `maxitor-web` README
- [ ] T008 Phase 8: changelog
