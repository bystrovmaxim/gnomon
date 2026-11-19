# Verification

Verified on 2026-11-19 on `feature/issue-130-admin-pill-tabs`, based on PR #129. Local demo: `http://localhost:3013`, organization `check-mwjq0ijz`. No user, invitation or plugin data was created or edited by these checks.

Users and Plugins publish choices through `PanelPage.layers`. The core shell creates the controls outside the transformed scene and writes the existing `tab` parameter. There is no local pill group in either page. Choosing Installed produces `?tab=installed`; Marketplace is the default and omits that parameter. Existing explicit links remain valid. Users shows nine users, Invitations three pending entries and History twelve completed entries; counts match filtered lists.

## Checks and evidence

- **31 affected tests passed**, covering the core layer parameter, default selection, keyboard behavior, shell registration, invitation/user cards, buttons, canvas/mockup guards and isolation from the Now control.
- **Adversarial API check:** ignoring the custom layer parameter failed exactly the new API test, while the other 29 tests then present passed. Restoring the API returned that suite to green.
- **Accepted-user regression:** a route-change effect initially cleared the user opened from an accepted invitation. The added test failed with the other 30 passing; the corrected effect preserves that user and all 31 pass.
- **130 browser cases passed** in Chromium: 20 live cases, 42 core-prototype screen/device cases and 68 marketplace-prototype screen/device cases. Desktop was 1360×900; phone was 375×812 with touch emulation, not physical hardware.
- Live coverage includes all five page choices, keyboard navigation, reload, settled search, counts, past views, Diff and Side by side. A/B preserves `at`, `from` and `mode`; the phone comparison targets visible B. Accepted invitations open their actual user cards on desktop and phone after URL navigation completes.
- **Real camera regression:** on each live view, desktop wheel movement or native CDP touch swipes move the canvas, then the core zoom controls change its scale. The test verifies the scene really changed while pill x/y/width/height remain within one pixel and labels remain 14px. The same check runs on historical Users, Diff and Side by side.
- **Adversarial browser check:** deliberately moving the shell control into `.admin-scene` changed its x coordinate by 110px during the wheel gesture and failed `auditStationaryPills`. The normal implementation passed the full run. This catches a locally rendered lookalike even when it uses `position: fixed` inside a transformed ancestor.
- Existing drawing layers still select Events, restore the default Domains URL and retain their compact phone labels. Page choices keep 14px labels, 11px counts and 44px phone touch targets. Phone Filters stands below the pills without overlap.
- The prototypes render the production pills as siblings of scrolling content. All named Users and marketplace scenarios were checked on desktop and phone; nine standalone documents receive synchronized canonical styles.
- TypeScript and both mockup synchronization guards passed. The earlier graph check for this branch passed all five graph files; this correction changes no graph declarations. `git diff --check` is clean.
- A separate demo recording captured 27 frames for each of Users and Plugins at desktop and phone sizes. After panning, zooming from 100% to 144%, zooming out and reversing the pan, pill coordinate and size drift was exactly 0px; labels stayed 14px and the canvas returned to its original transform. Recordings and measured states are under `.core-stand/pill-demo-motion/`.

The runner is `packages/maxitor/maxitor-core/web/scripts/check-admin-pills.mjs`, with its camera assertion in `audit-core-pills.mjs`. It accepts `MAXITOR_STAND_URL`, `MAXITOR_STAND_CODE`, `MAXITOR_STAND_EMAIL`, `MAXITOR_STAND_PASSWORD` and `MAXITOR_PILLS_OUTPUT`. Credentials are supplied locally. `MAXITOR_PILLS_MUTATE=1` deliberately puts controls inside the canvas to prove failure; use only for that regression check.

Ignored local evidence: `.core-stand/pill-tabs/results.json` and screenshots; `pill-shell-browser-green.log`, `pill-shell-browser-red.log`, `pill-shell-tests-red.log`, `pill-shell-tests-green.log`, `pill-shell-accepted-red.log` and `pill-shell-typecheck.log` under `.core-stand/`.

## Delivery status

All six requirements and six tasks are implemented. Versions are panel 0.8.0, tokens 0.5.2, core web 1.11.1 and Maxitor 4.12.1. PR #129 has merged; [PR #131](https://github.com/bystrovmaxim/gnomon/pull/131) targets `main` and closes #130. Each issue phase is checked after its commit. The PR records the CI closing run and the pushed-commit browser receipt, including a repeat of the live stationary-pills check. The unrelated local `.claude/launch.json` change, credentials, demo fixtures and recordings are excluded. No Spec Kit extension hooks are configured.

## Publication correction

Phase 1 is commit `990ac1c4`. Its clean pushed-commit `Local check run` passed the production client build and all three browser engines. All 130 administration browser scenarios passed again on that commit.

[CI run 44554172249](https://github.com/bystrovmaxim/gnomon/actions/runs/44554172249) caught one release mismatch: `SHELL_VERSION` still announced 0.7.1 while `package.json` declared 0.8.0. In the panel suite, the existing version regression failed and the other 100 tests passed. Phase 2 updates the advertised version to 0.8.0; that exact regression now passes. No interaction code changes in this correction. CI and the browser receipt are repeated on the new pushed commit, with final results recorded in the PR.
