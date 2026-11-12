# Implementation Plan: sign-in and invitation

**Branch**: `feature/issue-13-sign-in-and-invitation` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/086-sign-in-and-invitation/spec.md`; issue bystrovmaxim/gnomon#13; the mockup `specs/072-maxitor-core/mockup/index.html`, screens 8–11 and M13–M15, built in phase 1 and accepted before any code.

## Summary

The organization gets the setting **Who may invite** (a column of `organization` and its versions) and the **invitation** as an entity of its own in the schema `organization`, versioned under the organization's lock, with the states Sent, Accepted, Declined, Withdrawn and Expired. An administrator invites from Settings → Users, an ordinary user from the menu under their icon when the setting allows; the server checks the setting and the administrator mark on every invitation. The letter holds no link: the invited person signs in with the invited email, and the screen of choosing an organization (`/w`) shows the invitations to the account's confirmed emails, accepted or declined there. Settings → Users lists the users and the invitations, with the user's card to block, unblock, remove and appoint, and the invitation's card to send the letter again or withdraw; the organization always keeps one active administrator, decided under its lock. The account keeps its last place in an unversioned table, and signing in lands there.

The core's model, storage, actions, letters, events and tests take the same shape as those of bystrovmaxim/gnomon#73: an action per address in `server.py`, the memory storage of `tests/fakes.py` extended with the new tables, `check-core.mjs` walking the stand.

## Technical Context

**Language/Version**: Python 3.12 (the core's actions, AOA's action machine); TypeScript, React 19, Next.js 16 (the application).

**Primary Dependencies**: none added. `MailGateway` gains `send_invitation`; `SessionTokensController` carries `invitation_days` beside `policy_version`, as the one place the actions read the process's settings from.

**Storage**: PostgreSQL, the schema `organization`: `organization.who_may_invite` and its version column; the table `invitation` with `invitation_versions`; the user's uniqueness narrowed to users not removed; the schema `platform`: `account_place`, unversioned, the account's last place; migration `organization/0004_invitations.sql` and `platform/0002_account_place.sql`. The `watermark()` function counts the invitations' versions.

**Testing**: `pytest` over the core with the memory storage of `tests/fakes.py` (new tables and readers), `node --test` over `web/lib`, `check-core.mjs` on the local stand with a second browser context for the invited person; every new test broken once and watched failing alone.

**Target Platform**: the core's backend and application on the local stand and the production stand; Chromium on a desktop and at 375 px.

**Project Type**: web service with a web application.

**Performance Goals**: the users' page answers one query for the users and one for the invitations; the limits are counted by indexed columns; the last place is one unversioned row per account, written once per page change.

**Constraints**: every address an action; every outside service a gateway; no route by hand; the password and the token never in a log; an email in an event only masked; a refusal never says whether an address has an account beyond what the organization already knows of its own users.

**Scale/Scope**: 8 phases of the issue; 14 new actions; 2 migrations; 2 new pages of the core and 1 dialog shared by the page and the menu; 1 letter; ~10 events; 4 test modules; 6 scenarios of the browser check.

## Constitution Check

- **One term, one name**: invitation, inviter, administrator, ordinary user, Who may invite, confirmed email, the organization's lock, the last place — the spec's words in the code, the tests and the docs; the user's states stay Active, Blocked, Removed, and `invited` leaves spec 059's lifecycle.
- **The spec goes ahead of the code**: spec 086, its clarifications and the mockup are accepted first; the issue names the mockup as phase 1.
- **The database does not decide for us**: identifiers are written by the actions, no `DEFAULT` on an identifier, nothing cascades; the partial unique index on a Sent invitation per email and the one on users not removed are the database's rules the actions rely on, as the code's uniqueness is.
- **A decision is kept apart from an idea**: `who_may_invite` is a column with two values, not a flag with a guessed default; registering writes `any_user` explicitly.
- **Actions only** (rules 41–46): one action per address; the steps shared by the four user actions and the three invitation actions live in `users_flow.py` and `invitations_flow.py`, as `codes_flow.py` does, each writing its events through the caller's box.
- **A resource is a database and names its entities** (24–25): `CoreStorage` gains `InvitationCoreEntity` in `@entities`; the account's place is a row of the schema `platform` read and written by the same storage.
- **A state is a lifecycle** (22): `InvitationLifecycle` on `InvitationCoreEntity` — Sent initial; Accepted, Declined, Withdrawn, Expired final.
- **Authentication** (55–57): the roles stay the session's one role; the organization's role is read from the user's row on every request, so a block or a mark takes effect from the next request, and the gateway's token for a plugin carries the role read at issue.
- **A password is sensitive data** (58): nothing of this work touches passwords.
- **Changelog, versions** (workflow): `packages/maxitor/CHANGELOG.md` gets one article; `maxitor` 4.12.0, the core's application 1.11.0, and the graph files rebuilt with the versions of the packages whose graphs change.
- **Graph history** (67): `./update-graphs.sh` / `graph-builder write` after the tests are green, the files committed in the same phase.

Post-design: no violation.

## Project Structure

### Documentation (this feature)

```text
specs/086-sign-in-and-invitation/
├── plan.md              # this file
├── research.md          # the decisions of the design and why
├── data-model.md        # the tables, the columns, the rules the actions keep
├── quickstart.md        # the scenarios on the local stand and the checks of the code
├── contracts/actions.md # the addresses, their actions and their answers
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/maxitor/maxitor-core/maxitor/core/
├── entities.py                                   InvitationCoreEntity, InvitationLifecycle, who_may_invite, last place
├── events.py                                     the events of invitations, users and the setting
├── errors.py                                     the refusals' statuses as today
├── codes.py                                      the invitation's limits beside the codes'
├── settings.py, tokens.py                        MAXITOR_INVITATION_DAYS, carried to the actions
├── navigation.yaml                               settings.organization and settings.users
├── migrations/organization/0004_invitations.sql  who_may_invite, invitation, its versions, the users' uniqueness, watermark()
├── migrations/platform/0002_account_place.sql    account_place
├── storage/core_storage.py                       the readers and writers of invitations, users, the setting, the place
├── gateways/letters.py, gateways/mail.py         the invitation's letter
├── actions/invitations.py                        Send, Resend, Withdraw, ListMy; invitations_flow.py: the checks and the limits
├── actions/invitation_choice.py                  ListAccountInvitations, Accept, Decline
├── actions/users.py                              ListUsers, Block, Unblock, Remove, SetAdministrator; users_flow.py: the last administrator
├── actions/organization_settings.py              ReadOrganizationSettings, SetWhoMayInvite
├── actions/account.py                            me: last_place, invitations_waiting; KeepLastPlaceAction
├── actions/organizations.py                      who_may_invite and may_invite in the organization's answer
└── server.py                                     the routes

packages/maxitor/maxitor-core/tests/
├── fakes.py                                      the new tables, readers and writers in memory
├── test_invitations.py                           sending, the mark, the refusals, the limits, the letter, accepting, declining, expiry
├── test_users.py                                 the list, the card's changes, the last administrator, two at once, the effect on a session
├── test_who_may_invite.py                        the setting, the check, the withdrawal
└── test_last_place.py                            the place kept, the landing, the fallbacks

packages/maxitor/maxitor-core/web/
├── app/(core)/w/page.tsx                         the invitations on the screen of organizations; the last place
├── app/(core)/w/[code]/core/settings/users/page.tsx, organization/page.tsx
├── app/users.ts                                  the server actions of Settings → Users, the invitations and the setting
├── app/actions.ts                                keepPlace, accept and decline
├── components/UsersPage.tsx, OrganizationPage.tsx, InviteDialog.tsx, UserCard.tsx, InvitationCard.tsx
├── components/frame/TopRow.tsx                   "Invite to <organization>" in the menu
├── components/frame/Frame.tsx                    the last place written on every address change
├── components/frame/treeMarks.tsx, Tree.tsx      the pictograms of the two nodes
├── app/globals.css                               the tables, the cards, the toggles, the choice rows, the phone
├── lib/core.ts                                   Me.last_place, Me.invitations
└── scripts/check-core.mjs                        the scenarios of invitations, users, the setting and the phone

docs/                                             the core's README, run-the-core-locally.md, the tutorial's chapter 1, the plugin concept
specs/059-maxitor-concept/terms.md, data-model.md the invitation as an entity, who invites, the user's three states
packages/maxitor/CHANGELOG.md, version.toml files
```

## Phases (as in the issue)

1. The mockup — done and accepted: screens 8.1–8.14, 9.1–9.12, 10.1–10.6, 11.1 and M13–M15 of spec 072's mockup.
2. The invitation: the entity, its versions and the migration; the letter; `SendInvitationAction` with the setting's and the mark's checks, the refusals and the limits; `ResendInvitationAction`; `ListAccountInvitationsAction`, `AcceptInvitationAction`, `DeclineInvitationAction` and the screen of choosing an organization; the invitation form from Settings → Users and from the menu; the uniqueness of users not removed; the tests of this phase.
3. Who may invite: the column, `any_user` at registration, `ReadOrganizationSettingsAction`, `SetWhoMayInviteAction` with the withdrawal, Settings → Organization, the menu's item by the setting; the tests.
4. Managing users: `ListUsersAction` with the invitations, `BlockUserAction`, `UnblockUserAction`, `RemoveUserAction`, `SetAdministratorAction`, `WithdrawInvitationAction`, the last administrator under the lock with the test of two at once, Settings → Users with its cards; the tests.
5. The last place: `account_place`, `KeepLastPlaceAction`, `me.last_place`, the landing and its fallbacks; the tests.
6. The closing check run taken to zero: `check-core.mjs` with the new scenarios on the stand, the graph files rebuilt.
7. Documentation: the core's README, `run-the-core-locally.md`, the tutorial's chapter 1, the plugin concept, spec 059's terms and data model, the contracts of 086.
8. The changelog and the versions.
