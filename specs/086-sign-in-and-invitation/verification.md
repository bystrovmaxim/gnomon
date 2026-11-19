# Verification: issue #13

Checked on 2026-11-16 in `feature/issue-13-sign-in-and-invitation`, including its uncommitted changes over `35b980cf`. The remaining local checks are green and the change is ready for review. T020 is complete. T021 still includes the closing CI run and committing the graph files; the issue stays open until its pull request merges. This report is working-tree evidence, not a browser receipt for a pushed commit.

## Agreed user lifecycle

`active` is initial, `blocked` can return to `active`, and `removed` is final. AOA requires a path to a final state, so the declared graph includes `blocked` → `removed`. No application action, API route or UI control takes that edge. An organization and an account keep the same user for good. The core and the concept model now declare the same lifecycle; issue #13 and the contracts describe the same rule.

## Previously completed checks

These checks were already recorded before the completion below. They were not repeated unless a later code change or the original environment failure required it.

| Check | Result |
|---|---|
| Users, invitations and migrations | 80 passed |
| New user regressions after restoring mutations | 12 passed |
| Three adversarial mutations | Only the intended test cases failed; each source file restored |
| Python check run, excluding client and graph groups | 1,667 passed, 3 skipped; its blocked tests were retried below |
| Core, panel and template TypeScript tests | 132 passed |
| Graph viewer unit tests | 1,087 passed in 106 files |
| Core Next.js production build | Passed |
| Graph viewer Vite production build | Passed |
| Ruff, Mypy, Pylint, package boundaries, Vulture and Radon | Passed |
| Secret scan | Passed after reviewing six disposable test-password findings |
| Core design tokens | Passed |
| Five configured graph exports and checks | Passed; three files rebuilt, two unchanged |
| Concept model export | Rebuilt successfully through the AOA coordinator; JSON parsed |

The adversarial mutations renamed the terminal state, restored a removal route and accepted extra fields on user operations. Their failures were respectively one lifecycle test, both removal tests (active and blocked), and both client-supplied-state tests (block and unblock).

A real in-process API exercise, using the test storage and a second user, returned:

| Request | HTTP | User afterwards |
|---|---|---|
| `POST /api/v1/organizations/users/block` | 200 | `blocked`, same id |
| `POST /api/v1/organizations/users/remove` | 404 | `blocked`, same id |
| `POST /api/v1/organizations/users/unblock` | 200 | `active`, same id |
| Block with extra `state` and `status` fields set to `removed` | 422 | `active`, same id |

## Completion checks

The isolated stand uses `maxitor-13-verify-pg` on database port 55443, the backend on 8023 and the application at `http://localhost:3013`. Letters stay in the local outbox. Existing stands and their data were preserved.

| Check | Result | Local evidence |
|---|---|---|
| Previously blocked graph-viewer network tests | 120 passed | `archive/logs/issue-13-network-recheck.txt` |
| Runner integration with real unprivileged Docker containers | 1 passed; its test containers removed | `archive/logs/issue-13-docker-recheck.txt` |
| Plugin frontend built in the core 4.12.0 builder | Passed | `archive/logs/issue-13-plugin-build.txt` |
| Diagram checks not covered by the earlier run | 9 passed; component README guard also passed | `archive/logs/issue-13-diagram-checks.txt` |
| Invitation foreign-key regression before the fix | The new test alone failed with HTTP 500; 14 passed | `archive/logs/issue-13-invitation-regression-red.txt` |
| Invitations and who-may-invite tests after the fix | 21 passed | `archive/logs/issue-13-invitation-regression-green.txt` |
| Full core browser walk on PostgreSQL | All 49 scenarios passed | `archive/logs/issue-13-browser.txt` |
| Core production build after the mobile form fix | Passed | `archive/logs/issue-13-core-build.txt` |
| Ruff, Mypy and Pylint on the changed invitation code | Passed; Pylint 10.00/10 | Completion command output |
| Complexity and maintainability after the new regression | Passed | `archive/logs/issue-13-complexity.txt` |
| Secret scan after the test changes | Passed | `archive/logs/issue-13-secrets.txt` |
| Five configured graph exports and checks after green tests | Passed; generated files current | `graph-builder write` and `graph-builder check` |
| Concept graph export | Regenerated into a temporary file, parsed and identical to the working-tree graph | `specs/059-maxitor-concept/model/build_graph.py` |

The current session has no inherited SOCKS proxy. All 120 network tests passed without adding `socksio` or changing dependencies. The Docker checks used the authorized elevated execution mechanism.

## What the stand found and what changed

The first invitation returned HTTP 500 because `send_letter` inserted `invitation_letter` before the referenced invitation existed. PostgreSQL rejected its immediate composite foreign key. Sending and recording are now separate steps: send the mail, insert the invitation and its first version, then record the delivered letter, all writes within the organization's transaction. The regression enforces the database's foreign key at the storage boundary. It failed alone against the old order and passes with the fix; the existing failed-delivery and resend checks remain green.

On a phone, the invitation form used the desktop dialog class and sat near the top of the screen. It now uses the existing `dlg sheet` styling and grab handle, like the plugin dialogs. The real 375 × 812 viewport measured a sheet 375 px wide with its bottom at 812 px. The failing browser assertion before the fix and the passing final walk verify this change. Screenshots are in `.core-stand/users-desktop.png` and `.core-stand/invite-phone.png`.

The browser check also now reads the multipart letter through Python's standard MIME parser, selects the exact email field and status labels, identifies the administrator's row by email, closes the invitation card before opening another form and observes the address-wide one-minute sending limit. Its breadcrumb assertion follows spec 079 FR-040: `Settings` is the entered section; the Users page adds no breadcrumb.

## Live API example

The same operations were exercised through the running application's authenticated API and real PostgreSQL, in addition to the earlier in-process checks. For organization `check-mwjpxmdy`, user `4d8dc54f-a5bd-4b63-bcbf-cfbe0d1316ce`:

```http
POST /api/v1/organizations/users/block
Content-Type: application/json

{"code":"check-mwjpxmdy","user_id":"4d8dc54f-a5bd-4b63-bcbf-cfbe0d1316ce"}
```

The answer was HTTP 200 with `user.state = "blocked"` and that same `user.id`. Removal returned 404, unblocking returned 200 with `active` and the same ID, and supplying extra `state` and `status` fields set to `removed` returned 422. The test user was left active. The compact response trace is `archive/logs/issue-13-live-api.json`.

## Remaining publication steps

No commit, push, pull request or merge was made during this completion. The repository's `AGENTS.md` requires an explicit maintainer instruction for each of those actions. Once authorized, commit phases 6, 7 and 8 separately and tick the issue's phases after their commits; then open the complete pull request. CI runs the closing checks, while `scripts/check_before_pr.sh` runs on the pushed commit and supplies its `Local check run` receipt. The graph viewer's three-engine browser check belongs to that pushed-commit run; it was not repeated on this dirty tree. Merge only after every required check is green.

`archive/logs/check-all.txt` preserves the original failed run. Its historical aggregate is not a claim that the current tree still has those failures, and it has not been overwritten to manufacture a clean full-run receipt. The later logs above resolve its environmental failures and verify the final fixes.


## Production status icons — 2026-11-17

The maintainer requested the graph viewer's production icons throughout the application and all mockups. Filters previously put a text sign in a CSS circle; the change card and Draft's counts had separate renderers. Published's Changes filter and the core's test drawing supplied only colours, leaving the signs blank. The concept mockup also used a generic dot for these statuses.

The graph viewer's SVG now lives in `packages/maxitor-tokens/status-disks.js`. The graph viewer imports it, `StatusDisk` and `StatusIcon` render it in React, and the five mockups that draw change statuses embed checked copies. The other four mockups have no such icons. All nine were opened in Chromium without script errors. Old CSS/text status renderers and private copies have been removed. The repository's instructions require production icons; the guard is part of the panel tests.

Before, Published supplied `key`, `label` and `colour` without a mark. It now calls `changeFilterRows(compared.status.values())`. A real call to `changeFilterRows([]).map(({ mark }) => mark)` returns `["+", "~", "−", "="]`: absence dims only the label and never removes a sign. The reported Published address was checked at `from=2026-11-16T20:33:30.000000Z` and `at=2026-11-16T20:33:32.000000Z`. The browser assertion first failed with four empty signs against the old running image; it then checks all four production SVGs on desktop and phone after replacement.

Validation: 79 panel tests passed before the additional Changes regression; the final comparison and icon phase has 9 passing tests, including that new regression. The graph viewer's affected tests passed (22), the template passport checks passed (17), core and graph production builds passed, and the plugin frontend built in the real Docker builder. The final core changes also passed TypeScript checking. All five graph exports remain current. Restoring the retired CSS disk and changing a generated mockup's font each failed only the repository icon guard; both mutations were restored. The full core walk now includes a Published filter scenario, but was not rerun in full for this icon correction.

Evidence is in `.core-stand/icon-fix/`: `panel-tests.txt`, `status-tests-final.txt`, `regression-red.txt`, `mockup-regression-red.txt`, `published-red.txt`, `published-green.txt`, `browser.txt`, `docker-build.txt`, `core-build.txt` and `graph-build.txt`. `published-after.png`, `published-filters.png`, `demo-after.png` and `demo-phone.png` show the running result. The demo's frontend image was replaced in its isolated database; users and notes were retained. No commit, push or pull request was made.

## Pull request preparation — 2026-11-19

The maintainer authorized commits and a pull request. Commit `aa9b423a` contains the accepted administration, shared controls, time-scale and tree refinements, their regression tests and regenerated graph exports. The closing CI run and the browser receipt on the pushed head remain required; earlier working-tree evidence is not substituted for that receipt.

Preparation passed 213 core/panel/template frontend tests and 41 targeted backend tests. After declaring historical-access aspects directly on both actions, all six administration tests passed again. Mypy, Pylint, package boundaries, secret scanning, Vulture and both Radon checks passed. Ruff, TypeScript, the Next.js production build and five graph exports passed.

The platform token guard caught 22 literal-style violations in the new common controls. They were replaced by tokens with the same values; the guard then passed, together with 11 button/icon checks and the administration mockup guard. The prototypes embed the canonical token values, so opening a standalone file uses the same dimensions as the live application. This preserves the observed failure before the fix as the token regression evidence.

The phone requirement now records the accepted full-width canvas tables, pinned identity and inline controls; it no longer describes the superseded stacked-row layout. Local stand configuration remains outside the pull request.
