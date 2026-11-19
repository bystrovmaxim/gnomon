# Administration on the common canvas

## Accepted requirements — 2026-11-17

The maintainer accepted moving Organization, Users, Invitations and Plugins into the same panel shell, canvas, room context and time scale as plugin pages. Every persisted organization setting, user, invitation and installed-plugin state must be readable at a selected time and comparable between A and B. Current authorization always governs historical reads. History never performs a mutation or expiry sweep. Editing is offered only at Now, with an explicit historical-view notice and a return-to-Now action. Marketplace offerings and runtime installation diagnostics are current operational information, not historical organization state; they must not masquerade as a past snapshot.

Typography uses one stable set of sizes for headings, body, labels, fields and buttons across tabs, dialogs, validation, loading, historical mode and mobile. Forms remain readable at browser zoom. Administration enters the shared MaxitorCanvas at 100%; data changes never trigger an automatic camera refit. Explicit user zoom still works. Editing dialogs use the common portal outside the transformed scene.

## Plan

1. Add typed, administrator-authorized snapshot and history actions over existing version tables, with half-open validity intervals. Reuse the existing AOA action/connection/access pipeline; no new history store or schema.
2. Route core administration through ComparedFrames and PanelDocument/PanelPage, with the common history contract, semantic object anchors and comparison counts. Every content surface uses MaxitorCanvas; no private document pointer transport or room.shared configuration is introduced. Preserve current mutation actions and their authorization. Render historical state read-only; compare actual persisted fields.
3. Use transparent canvas content and common typography, responsive forms and dialogs. Align every admin mockup and embedded document, preserving canonical icons.
4. Verify temporal boundaries, current authorization, absence of historical writes, stale-response handling, comparison and type stability. Verify desktop/mobile in the live demo and adversarial regressions. Update documentation and changelog after checks.

## Room integration

Navigation format 4 deliberately has no room.shared parameters. The panel protocol carries semantic pointer/selection anchors; page filters remain local. Issue #76, a child of #72, owns presence and following and explicitly replaces rooms. The maintainer directed this change to extend that issue rather than implement another collaboration transport here. Section 1.8 of #76 now includes administration, current-access enforcement, historical views, shared dialogs and stable typography. This change supplies the common panel/canvas/history integration; live multi-user presence and following remain in #76.

## Tasks

- [x] Typed snapshot/history action and temporal storage reads.
- [x] Shared frame, canvas, time and comparisons for all administration sections.
- [x] Stable responsive typography and all admin mockups.
- [x] Resolve integration scope: administration requirements added to #76; no separate transport here.
- [ ] Regression, adversarial and desktop/mobile demo verification.
- [ ] Documentation, graph exports where required, changelog and reviewable diff.

## Constitution check

Specifications precede data behavior. Existing version tables remain authoritative. Actions declare typed inputs/results, resources, current access decisions and context. SQL stays in storage; no action reads global mutable state or environment. Constitution changes require a separate maintainer instruction. The maintainer authorized commits and a pull request on 2026-11-19; no merge is authorized.

## Local verification — 2026-11-17

The targeted server suite passed 23 tests; the panel suite passed 86 tests and the administration comparator passed its test. TypeScript and targeted Ruff checks passed. The complete core suite produced 358 passes and one stale template-version expectation (0.15.0 instead of the existing 0.15.1 passport); correcting the expectation and rerunning that file produced two passes. No CI run or pushed-commit browser check is claimed.

Adversarial verification changed the snapshot interval from `< valid_to_at` to `<= valid_to_at`: only the four section variants of the temporal test failed. Restoring the implementation returned the targeted suite to green. Changing the administration h2 from 20px to 31px made the browser typography guard report exactly that mismatch; restoring 20px returned no problems.

In the running demo at port 3013, Organization, Users, Invitations and Plugins were read at 2026-11-16T20:34:10Z without edit actions. Organization comparison from 20:33:30Z to 20:34:10Z showed one change: Any active user → Administrators only. At 390px, the comparison scene was 342px wide, translated (24,72), zoom 1, clear of the mobile filter button. Filtering Changed off hid the card and preserved both moments in the address. Return to Now restored editing. Desktop and phone plugin dialogs retained 16px headings/inputs and 14px body/buttons; page headings retained 20px. Evidence is in `.core-stand/admin-canvas/` (local, not committed).

All nine HTML mockups (twelve style scopes) pass the shared typography/icon guards. The Organization desktop comparison, Users phone history, and Plugins desktop/phone comparison were exercised at port 3089. These standalone history selectors use stated fixtures, not the live temporal database. Port 3088 serves an older working copy and is not evidence for this change.

Graph exports were rebuilt. Live presence/following and two-participant acceptance remain in #76; its phases remain unchecked. Side-by-side desktop and phone acceptance was completed on 2026-11-18 (see the follow-up verification below). Commits, pushes and pull requests remain unperformed.

## Accepted follow-up — 2026-11-18

Invitations lists only records awaiting a response. History lists accepted, declined, withdrawn and expired invitations, preserving the accepted-user link. Each badge counts the same search-filtered rows its tab renders. Search is a panel-address parameter so resizing does not reset it. Side-by-side uses each side's own snapshot values with consistent A-to-B change classifications; filtering to zero records explains the empty view and reports hidden anchors. Local demo fixtures add people in active, blocked and removed states, all invitation outcomes, and six explicitly labelled marketplace demonstration packages through the installer.

## Follow-up verification — 2026-11-18

At desktop width, both frames showed their own persisted policy: A at 2026-11-16T20:33:30Z showed Any active user, B at 20:34:10Z showed Administrators only. Both classified the record as changed. Switching Changed off in A removed both cards without changing either moment; switching it on from B restored both. At 390 × 844, switching A/B showed the corresponding values and times, and the same filter behavior passed. Return to Now removed the comparison and restored editing. Computed typography in both frames and on the phone remained h2 20px, h3 16px and buttons 14px, at canvas zoom 1.

The local organization now contains nine users (active, blocked and removed/Left), three pending invitations and twelve completed invitations. The browser audit found exactly three Sent rows under Invitations and twelve non-Sent rows under History. Searching Anna produced one history row and a badge of one. Its accepted-user control opened Anna Karimova's user card. Search survived resizing after moving it into the panel address. No seed operation sent mail or created sign-in credentials.

Six explicitly marked Demo marketplace entries were added through add-wheel and the normal installer check: Tasks, Documents, Contacts, Calendar, Approvals, Reports and Analytics. All reached active catalog state. They are Notes-derived demonstration packages, not implementations of those business functions. The populated catalog, phone layout, search for Reports and its detail dialog were checked; no package was installed into the organization. Local seed scripts and wheels remain in `.core-stand/demo-catalog/`.

Four administration regression tests pass. Adversarially replacing A's own value with B's value failed only the side-by-side test; restoring completed records to the pending list failed only the invitation test. Both mutations were restored. TypeScript, the two mockup guards, script syntax and diff whitespace checks passed. Browser audit helpers and screenshots live in `web/scripts/audit-administration.mjs` and `.core-stand/admin-canvas/`. No commit, push or PR was made.

## Bare Plugins address — 2026-11-18

The maintainer reported the catalog disappearing at `/core/settings/plugins` after refresh. That address lacked `tab=market` and selected Installed by default. The bare address now opens Marketplace; `tab=installed` explicitly preserves Installed. Browser reload checks passed for both addresses (six catalog entries, one installed plugin). Five regression tests and TypeScript pass; reverting the default intentionally failed only the new URL-selection regression. Six desktop/phone screenshots of Users, Invitations and History were captured under `.core-stand/admin-canvas/preview-*.jpg`.

## Responsive plugin grid — accepted 2026-11-18

Marketplace and Installed use the same card grid. Available panel content width determines one column below 601px, two from 601px, and three from 1150px. Plugin content fills the canvas viewport instead of stopping at 1100px. Font sizes and the initial 100% camera remain unchanged. Standalone prototypes receive the canonical container-query CSS; the marketplace prototype uses the same grid for installed, removed, private and offered plugins.


Responsive grid verification: both live tabs passed at 1800, 1280 and 390 CSS pixels (3, 2 and 1 columns). Computed font sizes stayed identical across widths. Temporarily replacing the wide three-column rule with two columns produced `expected 3 columns at 1497px, got 2`; restoring the rule returned zero problems. The browser helper is `web/scripts/audit-plugin-grid.mjs` under maxitor-core. The standalone marketplace mockup also rendered Installed as two columns on desktop and one on phone. The shared mockup guards (2 tests), web typecheck, script syntax check and diff whitespace check passed.

## Organization and people cards — accepted 2026-11-18

Use the reviewed BuildFlow prototype as the visual reference: white semantic cards, quiet borders and local editing actions. Organization shows identity, current invitation policy and invitation limits in separate cards. Edit opens policy choices; restrictive changes retain the existing withdrawal confirmation. Cancel must leave settings unchanged. Users, pending invitations and history remain comparable tables inside one card, with a contained toolbar and responsive rows on phones. Existing type sizes, room anchors, panel navigation and historical read-only behavior remain intact. Apply shared surfaces to all mockups and retain their scenario-specific actions.

Verify desktop and phone rendering, policy edit/cancel/confirmation, list filtering, historical controls and unchanged typography. Regression checks must catch the return of exposed policy choices or loss of the contained people list, including an intentional failing mutation.


Verification of the card redesign: live Organization and Users passed at 1280×900 and 390×844. The policy editor enables Save only after selection changes; cancelling leaves the current policy unchanged. The prototype's restrictive switch still names the withdrawn invitation before confirmation. Pending invitations showed 3 rows and a badge of 3; searching completed history for `timur` returned one accepted invitation and its user link opened Timur Usmanov. Side-by-side displayed separate A and B snapshots, kept read-only actions, and switched sides on a phone. Computed sizes remained 20px page headings, 16px card/dialog headings, 14px body/actions and 12px secondary user text. Room anchors and the panel/time integrations remain unchanged.

The browser regression helper `packages/maxitor/maxitor-core/web/scripts/audit-admin-surfaces.mjs` checks semantic cards, contained list controls, horizontal overflow and typography. Removing the people card class intentionally failed only its containment check; restoring it passed. Seven administration comparison/mockup tests, web typecheck, syntax and whitespace checks passed. All nine mockup documents share the card styles; the Organization and mobile Users scenarios were also checked in the browser. Local screenshots and results are in `.core-stand/admin-canvas/`.


Follow-up corrections accepted on 2026-11-18: redundant page subtitles are removed, including repeated organization identity. Organization uses a bounded two-column card composition (one column on phones). Invite is registered as a PanelPage action, so the core shell controls its placement and historical visibility. User names are explicit keyboard-accessible buttons. The user dialog shows only the current status with its lifecycle action opposite, a concise role label and membership details; the duplicate technical footer is removed. These changes do not introduce user deletion or editing another account's identity.

Verified the core Invite action opens the existing form, user-name buttons open the card, and the balanced card renders on desktop and phone. Typography checks remain green. Shared mockup synchronization, web typecheck and whitespace checks pass.


Card alignment follow-up: neighboring Organization cards stretch to equal row height and reserve equal heading height; the first fact rows share a baseline. On phones they stack with independent heights. The live desktop measured both cards at 217px, with matching heading and facts coordinates; phone cards were 342px wide without horizontal overflow. Add a private plugin now registers with the core page-action shell like Invite. Its form opens from the desktop shell and the phone shell places it above the bottom bar. Record actions and form confirmations remain contextual. The shared mockup guard and typecheck pass; redundant invitation version footer copy is removed in live and mockup cards.

## Shared action button — accepted 2026-11-18

The panel package owns the Button primitive for page actions, contextual card actions and form confirmations. Placement and handlers remain with the caller. Variants cover secondary, primary, danger, link and icon-only actions; native disabled semantics, keyboard activation and focus visibility are preserved. Administration uses this primitive rather than local button skins. Standalone mockups consume its exact CSS, including dynamic button states. Navigation tabs retain their navigation styling. Verify native type defaults, disabled behavior, callback forwarding, variant rendering and shared mockup coverage; exercise Edit, Invite and plugin forms on desktop and phone.

Verified the shared button in the live desktop policy form and user card, the 390×844 user card and plugin form, and desktop/mobile prototype scenarios. Edit, Cancel and disabled-to-enabled Save preserve their behavior. Five phase tests and web typecheck pass. Changing the default type to submit deliberately failed only the native-semantics test; restoring it passed. Native navigation tabs remain separate. Screenshots: `.core-stand/admin-canvas/core-button-user-desktop.jpg` and `core-button-user-phone.jpg`.

Accepted: remove duplicate section headings from administration canvas content, including historical comparisons and standalone mockups. Preserve shell navigation titles, card headings, tabs and action placement. Remove empty heading wrappers so their spacing does not remain.

Section-title verification: six phase tests and web typecheck passed. Restoring Organization in the content deliberately failed only the duplicate-title guard. Live screenshots at 1280×900 and 390×844 cover Organization, the user card and Marketplace after removing the titles. Card headings and shell navigation remain.

Accepted: policy Edit uses the primary core button like Install, in its card header. Policy choices are compact radio rows with a subtle selected background, without heavy outlines. Keep font sizes and the withdrawal confirmation unchanged.

Primary Edit and compact policy rows were checked in the live demo at 1280×900 and 390×844. Cancel closed without saving. Seven tests passed; deliberately reverting Edit to secondary failed only its primary-variant regression test. Shared mockup CSS remains synchronized.

Accepted: apply compact choice rows throughout administration dialogs and mockups. Record actions (Block, Enable, Disable, resend and Add again) use the same primary button as Edit and Install. Cancel/Close remain secondary and destructive withdrawal retains danger styling.

Form consistency verification: reviewed live invitation creation and private-plugin release/upload forms at desktop and phone sizes, the desktop installation confirmation and user card, and pending-invitation lists. Reviewed invitation-card and phone invitation prototype scenarios. All mockup style scopes share compact choice rules. Eight phase tests pass; changing Block back to secondary deliberately fails only the record-action test. The live invitation-row click did not open its card during this audit; the card styling was inspected in source and the prototype rather than claimed as browser-verified in the live demo.

Accepted: invitation emails are native core link buttons, like user names, so canvas pointer capture cannot swallow card activation. Activation selects the matching invitation without changing it; close clears selection. Pending and historical invitations share this behavior.

Invitation opening is now verified in the live demo: clicking sardor@demo.example opens its card at 1280×900 and 390×844; Enter on reviewer@demo.example opens the matching card; Close returns to the list. The previous audit limitation is resolved. Two component regressions cover pending/history selection and close without data mutation. Restoring the plain text cell makes both regressions fail. Screenshots: invitation-fixed-desktop.jpg and invitation-fixed-phone.jpg in `.core-stand/admin-canvas/`.

Accepted: invitation cards share the user-card status/action layout, show only the current status, and omit the duplicate sent-date footer. Dates in the details and accepted-user navigation remain.

Verified the simplified invitation card in the live demo at 1280×900 and 390×844. Six phase checks pass, including all five invitation statuses and mockup synchronization. Reintroducing the date footer fails only the card-presentation regression. Typecheck passes.

Accepted invitation user navigation uses the core link Button, with native keyboard activation, rather than an anchor without href.

Live phone history verification covers Accepted (timur), Declined, Withdrawn and Expired demo invitations: one status badge, no footer, separate sent/completion facts. The accepted-user action opens Timur Usmanov by click and Enter. Three component tests pass; replacing the native link button with the old anchor fails only the presentation/navigation test. Typecheck passes.

Accepted: invitation role text reflects lifecycle. Sent says “Will join as”; accepted says “Joined as”; declined, withdrawn and expired say “Invited as”. The role describes this invitation, not the current user role, which may subsequently change. Apply both user and administrator roles in live and mockup cards.

Role text verification covers all five states for both roles in the component test. Reintroducing future tense for accepted invitations fails the presentation test. Three tests and typecheck pass; the live accepted card shows “Joined as an ordinary user”.

Accepted lifecycle-copy audit: the shared invitation/history role column says “Invited role”, never “Will be”. Administrator help describes capabilities (“Can invite…”), not promised actions. Future tense remains in pending invitations and pre-action confirmations only. Installation-in-progress copy remains while the asynchronous install is pending.

Lifecycle-copy audit reviewed administration components and standalone mockups for future-tense role/status labels, results and confirmations. Fixed the shared history column and capability help. Seven phase tests pass; deliberately restoring Will be in the mockup fails only its lifecycle-copy guard. Live component assertions cover both invitation tabs and all five states for both roles. Typecheck passes.

Accepted: isolate the page layer selector CSS from the core time pill. The layer selector uses mx-layer-pill; mx-pill belongs to the core scale and stays in its header slot. Mockup shell styles follow the same separation.

Core header verification: before the fix the time pill computed to position:fixed at viewport centre and its header slot had zero size. After isolating layer styles it stays in flow. At widths 320, 390, 520, 768 and 1280 it is contained in the header, before the avatar. The scale opens on desktop and phone; desktop popup stays within viewport. Two regressions pass; restoring the colliding selector fails only the live-style isolation test. Typecheck passes.

Accepted: constrain organization and comparison controls in the header. Organization and path may truncate; the time control and avatar stay inside the viewport, including long A/B labels at tablet widths.

Stress verification uses captured live A/B header markup and production styles, with a long organization name and nested path. It exposed overflow at 768px before the fix. After bounding text, widths 320, 390, 521, 768 and 1280 keep pill and avatar inside the header without overlap. Live A/B was also checked at desktop and 390px. Three regression checks and typecheck pass; removing the organization bound fails only the new layout guard.

## Accepted directory parity and job titles — 2026-11-18

Users at a historical moment and in A/B use the same directory rows, responsive layout, search and user dialog as Now. Comparison decorates changed records; it must not substitute a generic field dump. Historical dialogs expose no mutation controls. Missing historical activity must be labelled unavailable rather than inferred from current activity. Both sides keep their own values and the shared change filter.

A nullable `job_title` belongs to a user in an organization, separately from the administrator permission. Invitations accept an optional title (at most 160 characters); accepting copies it to the new user. Administrators can edit or clear it in the user's card. The original invitation retains the offered title. Both fields are versioned, and A/B compares titles at each moment. Existing records remain unspecified; no title is guessed.

Implementation: reuse UsersPage/UserCard for historical rendering; add a versioned nullable field through an organization migration; carry it through invitation creation/acceptance and user reads; add an administrator-authorized edit action; update the forms, directory and prototypes. Verify rendering parity, historical read-only behavior, title validation, acceptance transfer, editing and temporal comparison, followed by desktop/phone browser checks.

### Directory and title verification

The final accepted layout keeps Job title as a separate optional column. Unspecified values show an em dash. The user table occupies a 1150px scene at 100% camera zoom, including on phones; canvas dragging reveals further columns without shrinking fonts. Tabs, search and the historical notice stay sized to the visible pane. Record tracking anchors to the person's identity rather than the centre of the wide row.

UsersPage and UserCard now render both current and historical users. Before this change, historical users went through generic AdministrationRow articles. The adapter now maps only the selected snapshot into the normal user view; current records are never used to fill historical gaps. Creation and inviter metadata are read from versions. Sign-in activity is not versioned and is explicitly shown as not recorded in history. Historical tabs/search omit core-owned time parameters when navigating. Invitation tab counts are omitted in this users-only snapshot instead of falsely showing zero.

At 1920×1000 and 390×844 the live demo showed Anna Karimova with no title in A (2026-11-18T11:56:05.041581Z) and “Руководитель проекта” in B. Saving the title through the ordinary user card returned that value and preserved the user role; re-entering A/B read the persisted change and reported one changed record. Both A and B user dialogs opened and remained read-only. Disabling Changed removed Anna from both panes and changed their visible counts from nine to eight; enabling it restored her. Phone dragging revealed the Job title column, and the invitation form showed the optional title field. Screenshots are local under `.core-stand/admin-canvas/users-columns-*` and `user-job-title-*`.

Targeted backend checks passed after updating the migration ordering expectation: user management, invitations, historical reads and all 57 migration checks. Nine frontend and mockup checks passed, as did TypeScript and Ruff. Mutating acceptance to drop the title failed only the new title-transfer test (13 other user tests passed). Mutating historical rendering to use current users failed only the new A/B directory test; restoring forbidden time parameters in page navigation failed that same regression test. Restored implementations passed. Registered graph exports were rebuilt. No commit, push or PR was made; multi-user presence/following remains the separate work in #76.

### Pinned user identity

The directory counter-translates its original first column against horizontal canvas movement, bounded by the table edge and adjusted for camera zoom. It keeps the same row and clickable name rather than rendering a detached copy. Vertical movement remains shared with the row. On phones the identity column takes 16% of the wide table, wraps names and email addresses without reducing the 14px/12px text, and uses opaque backgrounds that retain comparison highlighting.

At 390×844, browser dragging in Now revealed Last sign-in while names and emails remained at the left edge. Both A and B retained identity during horizontal and vertical movement; B kept highlighted title changes, and the pinned Anna Karimova button opened the historical card in A. Screenshots are `.core-stand/admin-canvas/users-pinned-now-dates-phone.jpg`, `users-pinned-a-phone.jpg` and `users-pinned-b-phone.jpg`. Targeted frontend checks and TypeScript passed. Removing the zoom compensation made the pinning regression fail; restoring it passed the targeted suite. Shared administration styles were synchronized into the prototypes.

### Pinned invitations and completed history

Invitations and History now use the same canvas-aware table as Users, including both A/B panes. The original first cell remains interactive and fixed at the viewport's left edge while other columns move; vertical movement remains aligned with its row. Accepted invitations include the user's name and email in this cell. Pending invitations have no stored recipient name, so they show the email only. No text size changes are applied.

Historical invitations previously rendered as generic field cards. They now pass through `snapshotInvitation` into the normal directory and invitation dialog. The snapshot query joins versioned users at the selected instant for inviter, decision author and accepted-user names. Read-only lists and cards expose no resend or withdrawal actions. The accepted-user link keeps `mode` and `from` unchanged, while excluding the separate `at` and underscore context from page navigation. This fixes the router refusal discovered during the phone check. Resize observers capture their observed elements so a pending callback cannot dereference an unmounted ref.

Browser verification at 390×844 covered Invitations and History in Now and both A/B panes. After horizontal and diagonal dragging, identity cells had x=0, their y coordinates matched the corresponding date cells, and computed text remained 14px. In A, opening Anna's invitation and following her name opened her read-only user card at the same moment. Screenshots are under `.core-stand/admin-canvas/`, named `invitations-pinned-{now,a,b}-phone.jpg` and `history-pinned-{now,a,b}-phone.jpg`. Fourteen targeted frontend tests and six administration backend tests passed, together with TypeScript, Ruff and the whitespace check. Replacing the invitation pinned table with an ordinary table failed exactly the four new Now/A/B invitation/history checks; the other ten passed, and restoring it returned all fourteen to green. No commit or push was made.

### Directory controls follow the canvas

As in Plugins, directory tabs and search are inside the canvas above the table surface. There is no stationary toolbar host or portal. They move and zoom with the content. This supersedes the earlier fixed-toolbar design. The first identity column retains its separately requested horizontal pinning.

Browser checks at desktop and phone sizes confirmed the controls are descendants of the transformed canvas scene and move by the same drag delta (desktop -120/-60px, phone -100/-60px). The Plugins screen was used as the live reference. Seventeen targeted tests and TypeScript passed. Removing inline controls failed the new regression; restoring them passed. Shared mockup styles were synchronized. Screenshot: `.core-stand/admin-canvas/directory-inline-desktop.jpg`.
