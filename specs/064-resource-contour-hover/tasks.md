# Tasks: Hovering a resource contour lights up its links to other resources

One phase = one commit, referencing (#55).

- [x] T001 Phase 1: the contour hover in the ERD — id and tooltip on resource contours (`buildDotSource.ts`), hit areas, cross-resource lines lit and the rest dimmed (`erdPostPass.ts`), the hovered border (`ErdGraphvizCanvas.tsx`); Vitest for the DOT and the post-pass
- [x] T002 Phase 2: the room — focus kind `contour` on the client (`focusStore.ts`, `graphvizFocus.ts`) and on the server (`room_registry.py`); Vitest and pytest; the drawing check `check-erd-contour-hover.ts` in the check run
- [x] T003 Phase 3: rebuild the graph files if they changed; raise the versions of `maxitor-web` and `maxitor`
- [ ] T004 Phase 4: the closing check run, browser checks included
- [x] T005 Phase 5: documentation — the ERD section of the `maxitor-web` README, beside Boundary
- [x] T006 Phase 6: changelog
