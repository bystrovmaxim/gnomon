# Contracts: the actions of invitations, users, the setting and the last place

Every address is declared by the chain of `FastApiAdapter` in `maxitor/core/server.py`, beside the addresses of [spec 072](../../072-maxitor-core/contracts/actions.md). A `POST` carries its whole body as JSON, the organization's `code` included, as the plugins' addresses do; a `GET` names the organization in its path. "session" means `AccountRole`; "member" means the action's access decision admits an active user of the organization of the address, and "administrator" an active administrator — anyone else is answered `404 {error: "not_found"}`, alike for an organization that does not exist. A refusal is `{error: <reason>, ...details}` with the status named.

## Invitations of an organization

| Method and address | Action | Who | Body → answer |
|---|---|---|---|
| `POST /api/v1/organizations/invitations` | `SendInvitationAction` | member | `{code, email, is_admin}` → `{invitation: Invitation}`; `403 administrators_only` (the setting), `403 administrator_mark` (the mark from an ordinary user), `409 already_user` with `{name, state, user_id}` (`active` or `blocked`), `409 already_invited` with `{invitation_id}`, `429 too_many_invitations` with `{limit, until}` — `limit` one of `address per minute`, `address per hour`, `inviter per hour`, `organization per day` —, `503 mail_not_sent` |
| `POST /api/v1/organizations/invitations/resend` | `ResendInvitationAction` | member: the inviter or an administrator | `{code, invitation_id}` → `{invitation}`; `409 not_sent` when the invitation is not Sent, `429 too_many_invitations`, `503 mail_not_sent` |
| `POST /api/v1/organizations/invitations/withdraw` | `WithdrawInvitationAction` | administrator | `{code, invitation_id}` → `{invitation}`; `409 not_sent` |
| `GET /api/v1/organizations/{code}/invitations/mine` | `ListMyInvitationsAction` | member | → `{invitations: [Invitation]}`: the ones the user sent, newest first |

`Invitation` is `{id, email, is_admin, state, invited_by: {id, name}, sent_at, letter_sent_at, expires_at, decided_at, decided_by: {id, name} | null, by_setting, accepted_user: {id, name} | null}`; `state` is one of `sent`, `accepted`, `declined`, `withdrawn`, `expired`, and a Sent invitation past its time is answered `expired`.

## The invitations of an account

| Method and address | Action | Who | Body → answer |
|---|---|---|---|
| `GET /api/v1/invitations` | `ListAccountInvitationsAction` | session | → `{invitations: [{id, organization: {code, name}, invited_by_name, is_admin, sent_at, expires_at}]}`: the Sent invitations whose email is one of the account's confirmed emails |
| `POST /api/v1/invitations/accept` | `AcceptInvitationAction` | session | `{invitation_id}` → `{code}`; `404 not_found` for an invitation the account's emails do not match or that is not Sent, `409 already_user` when the account already has an active or blocked user there, `403 policy` when the current privacy policy is not accepted |
| `POST /api/v1/invitations/decline` | `DeclineInvitationAction` | session | `{invitation_id}` → `{declined: true}`; `404 not_found` as above |

## Users of an organization

| Method and address | Action | Who | Body → answer |
|---|---|---|---|
| `GET /api/v1/organizations/{code}/users` | `ListUsersAction` | administrator | → `{users: [User], invitations: [Invitation]}`; the list writes Expired on the Sent invitations past their time first |
| `POST /api/v1/organizations/users/block` | `BlockUserAction` | administrator | `{code, user_id}` → `{user}`; `409 not_active`, `409 last_administrator` |
| `POST /api/v1/organizations/users/unblock` | `UnblockUserAction` | administrator | `{code, user_id}` → `{user}`; `409 not_blocked` |
| `POST /api/v1/organizations/users/administrator` | `SetAdministratorAction` | administrator | `{code, user_id, is_admin}` → `{user}`; `409 not_active`, `409 last_administrator` |

`User` is `{id, account_id, name, email, is_admin, state, appeared: "registered" | "invited", invited_by: {id, name} | null, created_at, changed_at, changed_by: {id, name} | null, last_sign_in_at}`; `state` is `active` or `blocked`. The lifecycle declares a terminal `removed` state for AOA graph validation only: no action or route enters it. A request to the former `/api/v1/organizations/users/remove` route is refused without changing the user; clients cannot supply a target state to block or unblock.

## The organization's settings

| Method and address | Action | Who | Body → answer |
|---|---|---|---|
| `GET /api/v1/organizations/{code}/settings` | `ReadOrganizationSettingsAction` | administrator | → `{name, code, who_may_invite, invitation_days, pending_by_users: [Invitation]}`: the Sent invitations of ordinary users, which a switch to `administrators` withdraws |
| `POST /api/v1/organizations/settings/who-may-invite` | `SetWhoMayInviteAction` | administrator | `{code, who_may_invite: "any_user" | "administrators"}` → `{who_may_invite, withdrawn: [Invitation]}` |

## What changes in the addresses of spec 072

| Method and address | Change |
|---|---|
| `GET /api/v1/organizations/{code}` | the answer gains `who_may_invite` and `user.may_invite`; the tree gains `core:settings.organization` and `core:settings.users` for administrators |
| `GET /api/v1/me` | the answer gains `last_place` (a path or null) and `invitations_waiting` (a count) |
| `POST /api/v1/me/place` | new: `KeepLastPlaceAction`, session, `{address}` → `{address}`: the address kept, `at`, `mode` and `from` removed; `422 not_a_place` for anything not under `/w/` |
| `POST /api/v1/organizations` | registering writes `who_may_invite = any_user` |

## Gateways

| Key | Gateway | Method added |
|---|---|---|
| `mail` | `MailGateway` | `send_invitation(to, organization, inviter_name, inviter_email, is_admin, expires_at)` |
| `tokens` | `SessionTokensController` | carries `invitation_days` |

## Optional organization job title

`Invitation` and `User` include `job_title: string | null`. Sending an invitation accepts an optional `job_title` of at most 160 characters. Blank input is stored as null. Acceptance copies the offered title into the new user; later changes do not rewrite the invitation. The title never grants administrator permissions.

`POST /api/v1/organizations/users/job-title` invokes `SetJobTitleAction` for a current administrator. Input: `{code, user_id, job_title}`; output: `{user: User}`. Null or blank clears the title. Unknown or foreign users are hidden under the existing access decision. The organization lock serializes edits, identical values do not create versions, and a successful change writes the user version with its author and time. Administration snapshots expose the title of the selected version.
