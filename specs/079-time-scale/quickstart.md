# Quickstart: walking the time scale

## Prerequisites

- The worktree on `feature/issue-98-time-scale`, `uv sync`, `npm ci` in `packages/maxitor/maxitor-core/web` and in the template's `web`.
- The local stand: `scripts/core-stand.sh` (the core at `http://localhost:3000`, the template installed, the demo account of `.core-stand/demo-login.txt`).

## Unit checks

```bash
cd packages/maxitor-panel && node --experimental-strip-types --test tests/*.test.ts
cd packages/maxitor/maxitor-core/web && node --experimental-strip-types --test tests/*.test.ts
uv run pytest packages/maxitor-plugin-sdk packages/maxitor-plugin-template -q
```

## Walks on the stand

1. **The scale** — Published, open the pill: bars and purple points, one size, no flags; the "i" lists Published and Rolled back, Bars, the marks and the keys; hover a point: a ring, its card. (spec, US1, US2)
2. **The test page** — load each fixture: bars alone, milestones alone, both, the graph's kinds with small points and flags, a milestone of an undeclared kind (named in the console). (US2)
3. **Comparing** — Diff from a past moment: halo under changed notes, the rest faded; Shift + ↓ steps with the change card; Side by side: A and B with their heads. (US3)
4. **Following** — on the test page, the screens 1.1–1.9, 2.1–2.17 and 3.1–3.4 of `specs/079-time-scale/mockup`. (US4)
5. **The frame** — canvas surface, tree pictograms, filter disks, the account's circle, the head's left edge, crumbs, Back to `/w/demo`, the collapsed strip. (US5)
6. **The template's pages** — Published's head with `Your draft: N`, before the first publication, publish and land on Published, the zoom-only bar, the filters Written and Last change. (US6)
7. **The past and Roll back** — `at` exactly on v3: Roll back to v3, confirm: v6 red, v4 and v5 still on the scale; between two publications: no button. (US7)
8. **The phone** — repeat 1, 3, 4 and 7 at 375 px. (US8)

Each walk compares the stand's screen with the mockup's screen of the same number.
