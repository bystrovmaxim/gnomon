# Research: sign-in and invitation

The decisions the plan rests on, each with why and what else was weighed. The spec's clarifications settle what a person sees; these settle how the core keeps and checks it.

## The invitation's row

- **Decision**: `invitation` is a versioned table of the schema `organization` keyed by `(organization_id, id)` like `"user"`, with `id` unique on its own so the account-level actions (accept, decline) find it by `id` alone. Its columns: `email` (lower case), `invited_by` (the inviter's user), `is_admin`, `status`, `sent_at` (the first letter), `letter_sent_at` (the last), `expires_at`, `decided_at`, `decided_by` (the administrator who withdrew, or who switched the setting; NULL when the invited account or the time decided), `by_setting`, `accepted_user_id` (the user acceptance made), `created_at`, `updated_at`.
- **Rationale**: one row per invitation keeps the history the spec asks for — who sent it, when, what happened and by what — and the version table gives every change its author and moment. A partial unique index `(organization_id, email) WHERE status = 'sent'` makes "at most one Sent invitation per email" the database's rule, so two inviters at once cannot both succeed.
- **Alternatives**: a state of the user (spec 059's `invited`) — rejected by the issue: no user exists until acceptance. A separate table per decision — needless; the version table is that.

## Counting the limits

- **Decision**: the inviter's and the organization's limits count rows of `invitation` by `sent_at` in the last hour and day. The email's limits count letters, so letters get a row each in `invitation_letter` (`organization_id`, `invitation_id`, `email`, `sent_at`), unversioned mechanics pruned after an hour, as `sign_in_code` and `sign_in_attempt` are.
- **Rationale**: a letter sent again is a letter, not an invitation (spec); counting letters needs a row per letter. The constants live beside the codes' in `codes.py` with their own names.
- **Alternatives**: counting `letter_sent_at` alone — loses letters between two timestamps; counting in memory — lost at restart.

## Expiry without a job

- **Decision**: an invitation is Expired by its time: every reader of invitations that answers the state treats `status = 'sent' AND expires_at <= now()` as Expired, and the list action and every action that touches a Sent invitation write the state Expired under the lock before going on, with `decided_at = expires_at`.
- **Rationale**: the spec says no background work; the issue says the state exists. Writing it when next touched keeps the version table true and the counts of Sent right.
- **Alternatives**: a periodic job — out of scope and a new process; computing only — the state would never be in the history.

## The confirmed emails of an account

- **Decision**: the emails an invitation matches against are the account's `email` and the `email` of each of its sign-ins (a provider's verified email or an email sign-in's own address), all compared in lower case; the storage answers them in one query.
- **Rationale**: bystrovmaxim/gnomon#73 keeps an email sign-in only after its code, and a provider's email only when the provider gives one it vouches for; both are confirmed in the spec's sense.
- **Alternatives**: the account's email alone — misses a linked email; every email ever typed — not confirmed.

## Who may invite, and the role on every request

- **Decision**: `organization.who_may_invite` holds `any_user` or `administrators`; registering writes `any_user`. `SendInvitationAction` reads the organization and the inviter's row inside the lock and refuses by the setting and by the mark there. The organization's answer (`GET /api/v1/organizations/{code}`) adds `who_may_invite` and `user.may_invite`, so the menu knows. Switching to `administrators` withdraws, in the same transaction, every Sent invitation whose inviter is not an administrator at that moment.
- **Rationale**: the check under the lock sees the setting as it is at the moment of sending; the frontend only decides what to draw.
- **Alternatives**: a per-user flag — not the issue's setting; a check in the frontend — nothing.

## The last administrator, decided by the lock

- **Decision**: `BlockUserAction`, `RemoveUserAction` and `SetAdministratorAction(is_admin=false)` count the organization's active administrators inside the transaction after taking the organization's lock, excluding the target; zero means `409 last_administrator`. Accepting an invitation takes the same lock before it creates the user.
- **Rationale**: the lock serializes two administrators stepping down at once: the second counts after the first's commit and is refused.
- **Alternatives**: a database trigger — logic in the database (constitution III); a check before the lock — a race.

## The users' uniqueness among users not removed

- **Decision**: `user_once_per_account` becomes a partial unique index `(organization_id, account_id) WHERE status <> 'removed'`; accepting an invitation inserts a new user even when a removed one exists for the account.
- **Rationale**: the issue's rule; the removed user stays in history as it is.
- **Alternatives**: reviving the removed user — Removed is final by the lifecycle.

## The last place

- **Decision**: `platform.account_place (account_id PK, address text, changed_at)`, unversioned, written by `KeepLastPlaceAction` (`POST /api/v1/me/place`) whenever the frame's address changes, with `at`, `mode` and `from` stripped on the server; `GET /api/v1/me` answers it as `last_place`. The `/w` page lands there when the organization is among the account's organizations and no invitation waits; a last place whose organization answers 404 falls to that organization's root and then to the chooser — the chooser does both fallbacks itself by what `me` says.
- **Rationale**: mechanics of the interface, not history (as `organization_clock`), so no version per page view; the server strips the moment, so the page opens at Now.
- **Alternatives**: a cookie — lost between browsers; a column of `account` — a version per navigation.

## The letter

- **Decision**: `letters.invitation(to, organization, inviter_name, inviter_email, is_admin, expires_at)` in the shape of the other letters: the subject names the inviter and the organization, the body says to sign in with this email and until when the invitation waits, the note says what to do if unexpected; no link, no code.
- **Rationale**: the issue; the same page template as the codes' letters.

## Where the settings reach the actions

- **Decision**: `MAXITOR_INVITATION_DAYS` (default 14) is read into `CoreSettings` and carried to the actions on `SessionTokensController`, beside `policy_version`, the one connection that already carries a process setting the actions read.
- **Rationale**: no new connection for one number; the controller is already "the core's tokens and policy version".
- **Alternatives**: a new controller — more declaration for nothing.

## The frontend

- **Decision**: Settings → Users and Settings → Organization are pages of the core's own at `/w/<code>/core/settings/users` and `/settings/organization`, drawn as Settings → Plugins is (a server page that reads the backend, a client component with the page's state); the invitation form is one `InviteDialog` used by the users' page and by the top row's menu, with `admin` deciding the mark; the users' and the invitations' cards are drawers on the right of the panel, as the mockup draws them; the styles go into `globals.css` under the mockup's names.
- **Rationale**: the mockup; one dialog for two places.

## The browser check

- **Decision**: `check-core.mjs` gains the invited person's walk in a second browser context — the letter read from the outbox for its text (no link, the organization named), signing up with the invited email, accepting, landing in the organization; Settings → Users with the new user; blocking the user and the second context refused; the setting switched and a user's invitation withdrawn; the phone.
- **Rationale**: the stand already has the outbox and two contexts are cheap.
