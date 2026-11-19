# Scale and icon verification — 17 November 2026

The maintainer reported upper clicks moving B, a missing way to move the entire comparison interval, shading overlapping time labels and a move label that stayed visible. They also requested an icon audit across the application and every mockup, with regression checks.

## Result

Upper clicks now choose A and lower clicks choose B, including beside the opposite handle and with coincident handles. The Move interval control moves both bounds, preserves duration and clamps the whole interval to history and Now. It appears over the shaded interval, during its drag or with keyboard focus. Shift-drag takes priority over individual handles. Shading ends at the axis. The Notes history and Draft/Published mockups use the same boundary rule and interval gesture.

The tree-icon sync replaces older standalone redraws with the core's production SVG paths. The earlier shared status-disk correction remains in place: absent statuses keep their signs. The rendered-icon inspector visits nested frames explicitly and checks empty SVGs, broken images and missing Changes signs. The core browser walk invokes it after each scenario.

The reported missing New note button was withdrawn by the maintainer: historical pages correctly hide mutation actions. That behavior was preserved. A visible read-only explanation with a return-to-current action remains a proposal, not an implemented change.

## Named mockup screens

All 311 named states were opened, captured and inspected; phone presets and dialogs are included. This counts named states, not every possible combination of filters and inputs.

| Mockup | States |
| --- | ---: |
| 028 — Rooms | 21 |
| 030 — Graph history | 12 |
| 059 — Concept | 56 |
| 072 — Core, authentication and users | 85 |
| 073 — Plugin marketplace | 37 |
| 074 — Notes history | 27 |
| 079 — Time scale and panel tracking | 30 |
| 084 — Draft and Published | 36 |
| 085 — Entered tree nodes | 7 |

The rendered-icon inspection reported no empty SVGs, broken images or missing Changes signs in those captures. Screenshot contact sheets were reviewed; the graph-history state was also reopened separately. Current application checks covered Notes, creation and publication dialogs without submitting, user and invitation views, organization and plugin settings, the private-plugin dialog, a panel fixture and phone filters/tree. The historical Published view retained all four signs even when no status had data.

## Regression evidence

The final affected test run passed 27 tests: scale geometry/selection, actual mockup pointer handlers, comparison rows and both icon guards. Core TypeScript checking and syntax checks of the browser scripts passed.

In the running demo, dragging the interval changed `20:33:22–20:33:33` to `20:33:19–20:33:30`, preserving its 11 seconds. The upper click then changed only A to `20:33:29`; the lower click changed only B to `20:33:29`. The browser check also compared the SVG shading bottom with the axis and verified opacity 1 under the pointer, then 0 outside the interval. Pointer checks run after the scale has settled on its zoom preset.

Adversarial checks restored the old line-first handle selection, removed interval clamping, made the hover predicate always true and extended shading eight pixels over the labels. Each relevant regression failed before restoration. Replacing a tree icon with an empty SVG failed the tree guard while the three status-disk checks stayed green. The SVG-size regression also rejected treating `stroke-width` as an icon width; generated icons preserve only explicit root dimensions.

Local evidence is under `.core-stand/ui-audit-2026-11-17/`: `icons-v2.json`, per-state screenshots and contact sheets, `live-icons.json`, `final-unit.txt`, `final-interval-browser.json`, `final-boundaries-browser.json`, `tree-icons-mutation.txt`, `icon-size-mutation.txt`, `interval-bounds-mutation.txt`, `interval-hover-mutation.txt` and `range-shading-mutation.txt`.

The full core browser suite was extended with boundary and interval scenarios but was not rerun in full on this uncommitted tree. The official pushed-commit run and CI remain publication steps. No commit, push, pull request or merge was made. Real touch-device dragging was not simulated by the desktop pointer checks.

## Crossing boundaries

Upper selection chooses A and lower selection chooses B. Crossing is allowed, as clarified by the maintainer: the committed endpoints exchange places to preserve chronological order and both selected times. The temporary clamp has been removed from production, drag previews and both Notes mockups.

Eleven selection tests pass, including real commit handlers for ordinary clicks, milestones and mockups. Restoring the clamp makes exactly the production crossing regression fail (10 others pass). TypeScript checking passed.

In the reloaded localhost:3013 Published Diff demo, native input confirmed all four crossing gestures (times are on 16 November, 20:33): upper click changed 29/38 to 38/43; lower drag changed 38/43 to 28/38; upper drag changed 28/38 to 38/44; lower click changed 38/44 to 28/38. Evidence: `.core-stand/ui-audit-2026-11-17/crossing-restored.jpg` and `crossing-tests.txt`. The earlier no-crossing browser report is superseded.

## Compact scale and disk contours

The retired intermediate-version block is removed from the graph picker and standalone mockups. Gesture instructions appear only inside the information popover. A browser DOM sweep checked 441 state/viewport combinations across nine mockups (311 named states plus 130 phone variants), with no retired block or persistent hint found. This sweep checks those two conditions; it is not a claim of a full visual review of every state.

The live Notes demo was checked on desktop and at 375 × 812: status filters, author filters and cards retain the outer contour and white gap; author initials remain letters. Status signs use centred SVG paths instead of font glyphs. The mobile scale stays compact and its information button opens the gesture instructions. The rebuilt frontend image is `maxitor-plugin/notes_0_15_0-frontend:3e19690afdf0-4.12.0`.

Six panel/source-guard tests and 26 graph-picker/frame tests passed, as did core TypeScript checking. Adversarial mutations removed the disk frame, restored font-based status signs and reintroduced the retired block; each was rejected, then restored before the final passing run. Evidence is in `.core-stand/scale-cleanup/`: `results.jsonl`, `final-panel-tests.txt`, `final-graph-tests.txt`, the three mutation logs and desktop/mobile screenshots. No full CI run or physical touch-device verification was performed.

The standalone disk-frame audit now checks every style scope across all nine mockups against `packages/maxitor-tokens/disk-frames.css`, including embedded card/filter documents. Removing the contour and white background from one Notes scope failed exactly one regression test; after restoration all six disk and tree-icon tests passed. The sync command updates frames and sign geometry together.

## Plot click regression — 2026-11-19

The scale's document pointer listener now checks the original composed event path. A transient SVG hover guide can be detached during pointerdown; testing its current DOM containment could incorrectly dismiss the scale before pointerup selected the date. A regression invokes the real outside handler with a detached target and verifies the scale stays open, then checks a real outside event closes it. Restoring the containment check failed only that regression (14 other tests passed); the restored implementation passed all 15 selection tests and TypeScript.

Diff body clicks select the nearest horizontal boundary; edge clicks and direct handle dragging retain their A/top and B/bottom behavior. Ties use the vertical half. Tests cover both orders, equal positions, edges and the actual Track dispatch. Browser verification in the live Notes demo selected a date in One while leaving the dialog open. In Diff, a lower-body click near A changed from only, and an upper-body click near B changed at only. Evidence: `.core-stand/admin-canvas/scale-plot-click.jpg`.

## Trackpad wheel regression — 2026-11-19

The native Track wheel listener now accumulates deltas synchronously and applies direct input without an additional animation. Previously each event used the rendered view, so a burst before the next render overwrote earlier movement: twenty 10 px deltas moved the viewport by only 10 px instead of 200 px. A horizontal gesture stays horizontal through small vertical momentum deltas, resets after an idle gap, and gives Ctrl-pinch precedence. Reversing direction and reaching the history edges preserve the visible duration. Both standalone Notes scale mockups use the same gesture rules.

`web/tests/scale-wheel.test.ts` runs the actual mounted Track listener and both mockup listeners. Nine tests cover bursts with one, two and coincident selected moments; vertical jitter; reversal; a separate vertical zoom; Shift-wheel; Ctrl-pinch with horizontal noise; history bounds; and listener cleanup. Wheel input never invokes the date-selection callbacks. The existing check runner includes the new file through its `web/tests/*.test.ts` glob.

Before the correction, six of the first seven tests failed. After correction, all 32 wheel, selection and geometry tests passed, as did core TypeScript checking and `git diff --check`. Removing horizontal gesture retention then failed exactly the jitter regression while the other 31 tests passed; restoration returned all 32 to green.

The reloaded localhost:3013 demo was checked with browser-native horizontal scroll input in One, Diff and Side by side. In One, the visible interval moved from 17 November 23:54–18 November 00:54 to 18 November 01:40:57–02:40:57, then back, keeping its hour and the selected `at` unchanged. Vertical zoom still narrowed the interval. A plot click selected 00:26:44 without dismissing the scale; brushing narrowed the viewport without changing the selection. After closing and reopening, horizontal scroll still worked. Screenshot: `.core-stand/admin-canvas/scale-wheel-regression.jpg`. The dense trackpad event stream and diagonal noise were exercised by regression tests; a physical trackpad gesture was not available through browser automation. No commit or push was made.

## Continuous gesture regression — 2026-11-19

The core browser suite now includes one uninterrupted scenario, `scale gesture sequence: swipe, milestone, crossing A/B, overlap, close and reopen`, implemented in `web/scripts/check-scale-gestures.mjs` and called by `web/scripts/check-core.mjs`. It starts on the live `history/both` fixture in Diff, settles a seven-day viewport, then uses native input to pan horizontally, select v3, drag A past B, drag B past A, overlap the handles and drag the lower handle out again. It closes and reopens the scale through the pill and pans in the opposite direction. There is no reload or state reset between these steps.

Assertions check the actual URL and rendered SVG after each step: panning preserves the selected dates and zoom; the marker selects its exact timestamp and nearest boundary; crossings exchange the two dates; the scale remains open during gestures; closing removes it; reopening preserves dates and viewport; the remounted wheel listener still pans without changing the selection. The overlap uses a left-rounded screen coordinate so native pointer rounding cannot accidentally cross B; it checks visually overlapping handles within 1.1 px. Exactly equal timestamps remain covered by the existing selection tests.

The same exported scenario passed through the browser automation adapter on localhost:3013. Temporarily replacing the crossing exchange with `if (a > b) a = b` made this scenario fail at `A was clamped at B`. The source was restored byte for byte, and the complete browser sequence then passed. The closing run also passed all 32 wheel/selection/geometry tests, syntax checks for both browser scripts and `git diff --check`. The full core browser suite was not rerun; this was its newly added scenario only.

Example from the successful run: v3 changed B from 11 November 08:00 to 10 November 09:44. Dragging A past it produced A = 10 November 09:44 and B = 10 November 21:02. After the remaining crossings, closing, reopening and panning preserved A = 9 November 22:21 and B = 10 November 09:35. Evidence: `.core-stand/admin-canvas/scale-gesture-sequence.json` and `scale-gesture-sequence.jpg`. No production behavior was changed in this step, and no commit or push was made.

## Phone sequence and fresh publications — 2026-11-19

The continuous browser scenario also runs at 375 × 812, with a 343 px scale. It checks `touch-action: none` and uses a drag in the plot for panning. The first and last swipes begin away from the handles, so they cannot accidentally select B on a narrow screen. `check-core.mjs` registers a separate phone context with touch input: taps select controls and milestones, and touch start/move/end events perform the drag sequence. The complete core runner, including that CDP driver, was not run in this uncommitted session.

The same exported scenario passed in the live demo through browser-native pointer input at phone width, without reloading between gestures. v3 selected B = 10 November 09:44; dragging A across it produced B = 11 November 09:13. The subsequent B crossing, overlapping handles, lower-handle separation, closing, reopening and reverse swipe preserved A = 9 November 10:12 and B = 10 November 09:42. The phone viewport override was removed after verification. Evidence: `.core-stand/admin-canvas/scale-mobile-gesture-sequence.json` and `scale-mobile-gesture-sequence.jpg`.

`scale-touch.test.ts` additionally runs the real Track handlers with `pointerType: touch` and the real Scale commit handlers in one sequence, including exact coincidence and Track remount. Temporarily routing the phone drag through desktop brushing made the live phone scenario fail after the first swipe, and made exactly this unit regression fail; the other 35 tests passed. Restoration returned the browser sequence to green. This verifies the responsive UI and component touch-event behavior, not physical iOS/Android browser gesture arbitration.

The reported missing publication was present in storage and in the live Published page: v7, written at 2026-11-19 09:44:23 UTC, with seven rendered milestone labels. `useWatermark` polls every 5,000 ms with `no-store`. The scale already rereads milestones and open bar chunks on a new watermark, but its viewport only clamped the old endpoints; a new publication could lie outside the retained interval. `refreshedView` now expands All and moves a live viewport containing Now by the watermark delta. Historical selections and views panned away from Now remain fixed. The same rule applies on reopening.

`scale-refresh.test.ts` runs the actual Scale refresh effect and covers All, a zoomed live interval, historical/panned views, and updates received while the scale is closed. Restoring the old clamping behavior for All failed exactly the new-publication regression while the other 35 tests passed. After restoration, all 36 scale geometry, selection, wheel, touch and refresh tests passed. Core TypeScript, both browser-script syntax checks and `git diff --check` passed. Evidence includes `mobile-pan-mutation.txt`, `scale-refresh-mutation.txt`, `scale-mobile-refresh-tests.txt` and `scale-latest-publication.jpg` in the same directory. The existing v7 was inspected without publishing additional user data. No commit or push was made.

## Publication from a second tab and the live boundary — 2026-11-19

A real publication from another browser tab exposed a second defect: the milestone appeared, but the graph still counted zero additions after 5,031 ms instead of one. The bar query passed its end through `momentOf`, rounding it to the minute and excluding the just-written publication. It now uses `historyEnd(chunk.to, watermark)`, preserving the server's six-digit fraction at the live endpoint. The request identity also uses the full watermark, so writes in the same millisecond cause separate refreshes. Chunk selection includes a watermark a few microseconds beyond a chunk boundary.

The current bar previously extended to the end of its bucket, into the hatched future beyond Now. `barBounds` clips that bar at Now while keeping a newly started bar visible to its left. Track and both independent Notes mockup bar renderers use this rule. In All, the Now boundary can keep the same pixel coordinate as its time and the whole-history viewport advance together; a historical selection deliberately remains fixed.

`web/scripts/check-scale-live.mjs` exports a shared browser assertion used by `check-core.mjs`. The core scenario creates an isolated item, opens Published in an observer tab, then adds a note and publishes it from Draft in a second tab. A second publication changes the note. Each publication must add one marker and the expected rendered bar counts within 5,000 ms, keep Now at or beyond the newest marker, keep every bar out of the future, and leave the observer's URL and navigation counter unchanged. No interaction, reload or reopening of the observing scale is part of the measured sequence.

The shared assertion passed through browser automation on localhost:3013: publishing v3 changed the markers from v1/v2 to v1/v2/v3 and the counts from added 1 / changed 1 / removed 0 to added 1 / changed 2 / removed 0 in **638 ms**, measured from the Publish click. The live boundary and newest marker both had x = 700.4878; the last bar ended at x = 700.0184. The demo item is `e79d3eba-2a35-46ef-9684-c8b1a27c2e63`, titled “Live refresh regression 2026-11-19”. An existing unrelated deletion in Payments was left unpublished; only the isolated item was published for this check. The observer was reloaded once to load the fix before the successful measured sequence, never during it. The screenshot uses 1 h for readability, selected after timing ended.

All 53 affected cache, geometry, timestamp, refresh, selection, wheel and touch tests passed. Core TypeScript checking, syntax checks for the two live browser scripts, and `git diff --check` passed. Five separate adversarial runs restored minute rounding, removed live bar clipping, dropped microsecond chunk inclusion, or removed clipping from either mockup. Each run failed exactly its corresponding regression while the other 52 tests passed; all changes were restored before the final passing run.

Evidence under `.core-stand/admin-canvas/`: `scale-live-before-fix.json`, `scale-live-publication.json`, `scale-live-publication.jpg`, and the `live-minute-cutoff`, `bar-paints-future`, `microsecond-chunk`, `074-notes-history-future-bar` and `084-notes-draft-published-future-bar` mutation logs. The full core browser suite was extended but not rerun in full. No commit, push or pull request was made.

## Live B and manually selected dates — 2026-11-19

Browser checks at 375 × 812 covered Diff and Side by side with B at Now and with both dates fixed. Three defects were found: an explicitly selected latest timestamp was labelled Now; moving A normalized the untouched B back to Now and could round an exact timestamp; Published updated the scale but retained stale comparison content. The production scale, both Notes scale mockups and Published now preserve the distinction between a timestamp and live Now.

The endpoint commit previously converted both endpoints through `momentOf` / `chosenMoment`. It now converts only the moved endpoint and exchanges the original values on crossing. Track receives `live={at === null}` and labels explicit dates as dates. Published previously called `useFresh(ids, !at && other === null)`; it now calls `useFresh(ids, !at)`, retaining the separate read-only comparison guard.

The rebuilt Notes frontend is `maxitor-plugin/notes_0_15_0-frontend:467535e9494b-4.12.0`. Its isolated build was resumed from the stand's existing npm cache with lockfile verification and network disabled after registry downloads stalled. The runner replaced only this local stand's frontend. After one observer reload to load the new bundle, all measured publications occurred from the second tab while the observer remained untouched:

| Observing view | Publication | Time until marker, bars and content agreed | Selected snapshots |
| --- | --- | --- | --- |
| Phone Side by side, live B | v10 | 931 ms | A stayed v1; B changed v9 → v10 |
| Phone Side by side, fixed B | v11 | 1,169 ms | A stayed v1; B stayed v10 with the exact `11:10:13.261905Z` timestamp |
| Desktop Diff, live B, 1280 × 720 | v12 | 4,907 ms | A stayed v1; B changed v11 → v12 |

Closing and reopening the mobile scale preserved both fixed dates. The phone observer subsequently retained v10 after v12 arrived as well. Earlier phone checks of Diff and Side by side cover the scale's fixed/live selection behavior; the final checks above additionally require the actual note text, catching the stale-content defect that marker-only checks missed.

`scale-live-selection.test.ts` adds seven tests executing the actual Scale/Track and mockup handlers. `live-comparison.test.ts` exercises Published and its real refresh hook. All 60 affected core tests and all 19 template web tests passed, with TypeScript checks for both frontends. Eight separate selection/label/mockup mutations each failed exactly one of the 60 tests; restoring the comparison refresh guard failed exactly one of the 19 template tests. Every mutation was restored before the passing runs.

The shared browser helper verifies marker and bar counts, exact selection retention, live B at Now, the selected publication message, displayed note text and the five-second limit without navigation. `check-core.mjs` now applies it to desktop/phone × Diff/Side by side × live/fixed B. The full core browser runner was not executed end to end; the relevant live scenarios used the same helper through browser automation. This is responsive browser verification, not a physical phone test.

Evidence: `.core-stand/admin-canvas/scale-phone-comparison-refresh.json`, `scale-comparison-refresh-repaired.json`, `scale-phone-stale-content-before-fix.json`, `scale-phone-live-repaired.jpg`, `scale-phone-fixed-repaired.jpg`, `scale-desktop-live-repaired.jpg`, `live-selection-tests.txt`, `live-comparison-tests.txt`, and the corresponding mutation logs. No commit or push was made.
