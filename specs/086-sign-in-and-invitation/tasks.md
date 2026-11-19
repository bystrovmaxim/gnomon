# Tasks: sign-in and invitation

**Input**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/actions.md](contracts/actions.md), [quickstart.md](quickstart.md)

The phases are the issue's; one phase is one commit, and each phase's tests run after it. The stories: US1 an administrator invites and the person accepts; US2 an ordinary user invites; US3 who may invite; US4 the refusals; US5 managing users; US6 the last place; US7 the phone.

## Phase 1 — The mockup (US1–US7)

- [x] T001 `specs/072-maxitor-core/mockup/index.html`: screens 8.1–8.14, 9.1–9.12, 10.1–10.6, 11.1 and M13–M15, the frame as the core draws it; accepted by the maintainer.

## Phase 2 — The invitation (US1, US2, US4)

- [x] T002 [US1] `maxitor/core/migrations/organization/0004_invitations.sql`: `organization.who_may_invite` with its CHECK, its version column, existing rows `any_user`; `invitation` and `invitation_versions` with the keys, checks and indexes of data-model.md; `invitation_letter`; `user_status` with the states `active`, `blocked` and the terminal `removed`; `watermark()` counting `invitation_versions`.
- [x] T003 [P] [US1] `maxitor/core/entities.py`: `WhoMayInviteEnumEntity`, `InvitationCoreEntity`, `InvitationLifecycle`, the links on `OrganizationCoreEntity` and `UserCoreEntity`; `maxitor/core/events.py`: the events of invitations; `maxitor/core/codes.py`: the invitation's limits; `maxitor/core/settings.py` and `tokens.py`: `MAXITOR_INVITATION_DAYS`, default 14.
- [x] T004 [US1] `maxitor/core/storage/core_storage.py`: `VERSIONED` and `organization_lock` with `invitation`; `confirmed_emails`, `user_by_email`, `sent_invitation`, `invitation`, `invitations_of_account`, `invitations_by`, `invitation_counts`, `letter_counts`, `new_letter`, `prune_letters`, `active_administrators`, `organization_settings`; `tests/fakes.py`: the same in memory.
- [x] T005 [P] [US1] `maxitor/core/gateways/letters.py` and `mail.py`: `invitation(...)` and `send_invitation`: the inviter and the organization in the subject, no link, until when it waits, the "did not expect it" note.
- [x] T006 [US1] `maxitor/core/actions/invitations_flow.py` and `actions/invitations.py`: `SendInvitationAction` with the inviter's membership, the setting, the mark, the user already there, the Sent invitation, the limits, the letter, the events; `ResendInvitationAction`; `ListMyInvitationsAction`; the expiry written when touched.
- [x] T007 [US1] `maxitor/core/actions/invitation_choice.py`: `ListAccountInvitationsAction` by the account's confirmed emails, `AcceptInvitationAction` under the organization's lock making the new user with the account's name and the mark, `DeclineInvitationAction`; `maxitor/core/actions/account.py`: `invitations_waiting` in `me`; `maxitor/core/actions/organizations.py`: `who_may_invite` and `user.may_invite`, registering writes `any_user`; `maxitor/core/server.py`: the routes.
- [x] T008 [US1] `web/app/(core)/w/page.tsx`: the invitations on the screen of choosing an organization, Accept and Decline, the account brought there when one waits; `web/app/actions.ts`: `acceptInvitation`, `declineInvitation`; `web/lib/core.ts`: `Me.invitations_waiting`.
- [x] T009 [US1] `web/components/InviteDialog.tsx` and `web/app/users.ts`: the form with the mark for an administrator, the refusals as the mockup words them, the list of the user's own invitations with "Send again" for an ordinary user; `web/components/frame/TopRow.tsx`: "Invite to <organization>" by `user.may_invite`; `web/app/globals.css`: the dialog's rows and the alerts of the mockup.
- [x] T010 [US1] `tests/test_invitations.py`: sending and the letter's text, the mark from an administrator and refused from an ordinary user, every refusal of US4 with its reason, the limits with their events, sending again within the limits, the account's invitations by its confirmed emails and in lower case, accepting with the policy, the new user and the lock, declining, expiry by time; each broken once.

## Phase 3 — Who may invite (US2, US3)

- [x] T011 [US3] `maxitor/core/actions/organization_settings.py`: `ReadOrganizationSettingsAction`, `SetWhoMayInviteAction` under the lock withdrawing the Sent invitations of ordinary users with `by_setting`; the events; `maxitor/core/server.py`: the routes; `maxitor/core/navigation.yaml`: `settings.organization` and `settings.users` for administrators.
- [x] T012 [US3] `web/app/(core)/w/[code]/core/settings/organization/page.tsx` and `web/components/OrganizationPage.tsx`: the two choices, the confirmation naming what it withdraws, the notice after the switch; `web/components/frame/treeMarks.tsx` and `Tree.tsx`: the pictograms `organization` and `users`.
- [x] T013 [US3] `tests/test_who_may_invite.py`: `any_user` at registration, a change by an ordinary user refused, the check on an invitation from a saved request, the withdrawal of the users' invitations and not the administrators', the menu's `may_invite`; `tests/test_frame_tree.py` and `test_organizations.py`: the two new nodes.

## Phase 4 — Managing users (US5)

- [x] T014 [US5] `maxitor/core/actions/users_flow.py` and `actions/users.py`: `ListUsersAction` with the invitations and the expiry written first, `BlockUserAction`, `UnblockUserAction`, `SetAdministratorAction`, the last active administrator counted inside the transaction, `WithdrawInvitationAction` in `actions/invitations.py`; the events; the routes.
- [x] T015 [US5] `web/app/(core)/w/[code]/core/settings/users/page.tsx`, `web/components/UsersPage.tsx`, `UserCard.tsx`, `InvitationCard.tsx`: the two tabs, the search, the tables, the drawers with the lifecycle's buttons, the mark's switch, the last administrator's hint, "Send the letter again" and "Withdraw"; `web/app/users.ts`: the server actions; `globals.css`: the tables, the drawer, the toggle, the badges.
- [x] T016 [US5] `tests/test_users.py`: the list and its fields, each move of the lifecycle with who and when, the mark only while active, the last administrator refused for block and dismiss, two administrators stepping down with exactly one refused, the terminal `removed` state retained for AOA but no removal route for active or blocked users, no client-supplied terminal state, a blocked user refused on the next request to the organization and by the gateway's pass, withdrawing an invitation.

## Phase 5 — The last place (US6)

- [x] T017 [US6] `maxitor/core/migrations/platform/0002_account_place.sql`; `core_storage.py`: `last_place`, `keep_place`; `maxitor/core/actions/account.py`: `KeepLastPlaceAction` stripping `at`, `mode` and `from`, `me.last_place`; the route.
- [x] T018 [US6] `web/components/frame/Frame.tsx`: `keepPlace` on every address change; `web/app/(core)/w/page.tsx`: the landing at the last place, the fallbacks to the organization's root and to the chooser, the invitations first; `web/app/actions.ts`: `keepPlace`.
- [x] T019 [US6] `tests/test_last_place.py`: the place kept without the moment, refused outside `/w/`, answered by `me`; `web/tests/place.test.ts`: the address stripped of the core's names.

## Phase 6 — The closing check run (US1–US7)

- [x] T020 [US7] `web/scripts/check-core.mjs`: the administrator's invitation and the letter's text, the invited person in a second context accepting, the user listed and blocked, the setting switched and an invitation withdrawn, the ordinary user's menu, the last place, and the phone's invitation row, sheet and rows; all 49 scenarios passed on the isolated local stand on 2026-11-16.
- [ ] T021 `scripts/run_checks_with_log.sh` taken to zero; `graph-builder write` and the graph files committed.

## Phase 7 — Documentation (US1–US6)

- [x] T022 [P] `packages/maxitor/maxitor-core/README.md`: Users and invitations, Who may invite, the last place; `docs/how-to/run-the-core-locally.md`: inviting a second person; `docs/plugins/tutorial/01-what-you-will-build.md`: a second person of the organization on the stand.
- [x] T023 [P] `docs/plugins/concept.md`: membership by invitation, the user's two operational states and the declared terminal state, the role read on every request; `specs/059-maxitor-concept/terms.md` and `data-model.md`: the invitation as an entity of its own, who invites, the user's lifecycle without `invited`.

## Phase 8 — The changelog and the versions

- [x] T024 `packages/maxitor/CHANGELOG.md`: one article; `packages/maxitor/pyproject.toml` and `version.toml` 4.12.0; `packages/maxitor/maxitor-core/web/version.toml` 1.11.0; the versions of the packages whose graph files changed.

## Dependencies

Phase 2 before 3 and 4 (the entity and the storage); phase 3 before the menu's item of 4 is final; phase 5 independent of 3 and 4; 6 after 2–5; 7 and 8 last, in that order. Inside a phase the tasks marked [P] touch files of their own.

## Verification status — 2026-11-16

See [verification.md](verification.md). T020 is complete. Docker integration, the plugin frontend build and all 120 previously blocked network tests passed; no SOCKS dependency was needed in the current environment. The stand exposed an invitation-letter foreign-key violation and the missing mobile sheet style; both are fixed and verified. The new regression failed alone before the fix, and all 21 invitation and invitation-setting tests passed afterwards. The final core browser walk passed all 49 scenarios, and the production build and graph exports passed.

T021 remains open for the closing CI run and committing the graph files. The maintainer authorized commits and a pull request on 2026-11-19. Phases 6, 7 and 8 are committed separately; CI runs the closing checks and `scripts/check_before_pr.sh` runs on the pushed commit. This working-tree browser run is not a commit receipt. Documentation and changelog edits are prepared; the issue's phase checkboxes stay unchanged until their commits.

## Phase 9: Convergence

These acceptance gates and CI follow-up fixes belong to issue #13's phase 9; they do not introduce another feature.

- [x] T025 [US7] Replace literal button and disk-frame styling with platform tokens without changing computed dimensions; keep standalone mockups synchronized and pass the frame token guard (constitution: shared platform styling).
- [x] T026 [US7] Reconcile FR-023 and the phone story with the accepted full-width canvas directory, pinned identity and inline controls documented in admin-canvas.md (FR-023, accepted follow-ups).
- [ ] T027 Complete the closing CI run and pushed-commit browser receipt before reporting the PR ready (T021, constitution: local browser verification).

- [x] T028 Fix the CI dependency ordering, canonical-icon assertions and versioned tutorial fixtures; update the full browser journey for embedded administration panels and completed invitation history. The current full journey remains a verification gate on the stand.
