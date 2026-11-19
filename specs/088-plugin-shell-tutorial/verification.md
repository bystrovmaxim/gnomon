# Verification — issue 132

The change documents the existing Maxitor 4.12.1 / panel 0.8.0 behavior. No runtime source, schema, package version or graph export changes.

## Chapter audit

| Chapter | Finding and disposition |
|---|---|
| 1 — What you will build | Updated the illustrative build versions and linked the optional API to its minimum core version. |
| 2 — A copy of the template | Explained why a plugin adopting the new pills must raise its core lower bound, even if its frontend already names a newer panel package. |
| 3 — Your tables | Corrected the old schema suffix and included the draft's `note_change` table. |
| 4 — Reading | Reviewed moment and organization isolation; no shell/canvas omission applies. Source quotations pass. |
| 5 — Writing | Reviewed draft writes and publication conflicts; no shell/canvas omission applies. Source quotations pass. |
| 6 — The backend | Updated the illustrative container suffix and made it depend on the installed version. |
| 7 — A place in the tree | Distinguished controls declared through `PanelPage` from navigation declarations and canvas camera state; corrected the path to Published. |
| 8 — The page | Replaced the claim that nothing is pinned with an ownership table, a complete optional Cards/Table API example, URL behavior, phone behavior, contextual buttons, dialogs and gesture checks. |
| 9 — Now and the past | View and filter changes can read at the same fixed moment; they do not return to Now. |
| 10 — History on the scale | Distinguished page pills from the core time pill and removed the obsolete permanent text below the scale. |
| 11 — Comparing | Explained the same content rendering with change marking, per-panel pills and the phone's separate A/B switch. |
| 13 — Tests | Added real pan/zoom, touch, history, URL, keyboard, count, font-size and dialog-placement checks, with links to existing regressions. |
| Index and compatibility | Listed the new material and the panel 0.8.0 / core 4.12.1 contract. |

Chapters 12 and 14–17 are explicitly unwritten in the existing index and assigned to other issues. This task does not claim to implement those chapters or their features.

## Checks before the phase commit

- `python -m pytest tests/scripts/test_tutorial_quotes.py -q`: **36 passed**. The new marked `Layers` quote is checked against `packages/maxitor-panel/src/shell/types.ts` by the existing parametrized test.
- Adversarial quotation check: changed only the documented `param?: string` to `param?: number`. Result: **1 failed, 35 passed**, with the sole failure naming the chapter 8 `Layers` quote. Restored the quote before the passing run.
- Extracted the TSX block marked `example: core-pill-page` to a temporary `.tsx` file under the core web workspace. TypeScript passed against its installed panel 0.8.0 types with `--noEmit --strict --skipLibCheck --jsx react-jsx --target ES2022 --module esnext --moduleResolution bundler --esModuleInterop`.
- Adversarial example check: changed only `param: "view"` to `param: 7` in that temporary file. TypeScript failed with **TS2322: Type 'number' is not assignable to type 'string'**. Restored the extracted example and typechecked successfully; removed the temporary file.
- Checked **52 relative links**, including **8 heading anchors**, across the existing tutorial and compatibility page. All resolve.
- Compared ownership, selection/default rules, phone targets, initial camera behavior and dialogs with the current panel source. The example is explicitly an optional adaptation; the template still offers Cards/Table in its bottom bar.

The quotation test runs automatically when the repository test suite runs. Example extraction/typechecking and the link audit above are local checks, not newly installed CI jobs. The documentation-only CI path can skip runtime suites. The mandatory pushed-commit browser receipt and final CI results are recorded on the pull request after publication, not claimed here in advance.

The unrelated `.claude/launch.json` edit is excluded from the commit. Auto-fix cannot be enabled through the tools available in this session; CI is monitored directly through completion, without merging the PR.
