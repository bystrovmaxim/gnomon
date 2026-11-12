# Data model: sign-in and invitation

What this work adds to the core's model of [spec 072](../072-maxitor-core/data-model.md). Every entity is a table of its name in the schema of its domain; every column has explicit nullability and a description; identifiers are `uuid` assigned by the writer; nothing cascades.

## Schema `organization`

| Table | Columns added or new | Keys and checks | Versioned |
|---|---|---|---|
| `organization` | `who_may_invite text` | CHECK `who_may_invite IN ('any_user', 'administrators')`; existing rows become `any_user` | yes, `organization_versions` gains the column (existing versions `any_user`) |
| `"user"` | — | `user_once_per_account` dropped; partial UNIQUE INDEX `user_once_among_not_removed (organization_id, account_id) WHERE status <> 'removed'` | as before |
| `invitation` | `organization_id uuid`, `id uuid`, `email text`, `invited_by uuid`, `is_admin bool`, `status text`, `sent_at timestamptz`, `letter_sent_at timestamptz`, `expires_at timestamptz`, `decided_at timestamptz NULL`, `decided_by uuid NULL`, `by_setting bool`, `accepted_user_id uuid NULL`, `created_at`, `updated_at NULL` | PK (`organization_id`, `id`); UNIQUE `id`; FK `organization_id → organization`; FK (`organization_id`, `invited_by`) → `"user"`; FK (`organization_id`, `accepted_user_id`) → `"user"`; CHECK `email = lower(email)`; CHECK `status IN ('sent','accepted','declined','withdrawn','expired')`; partial UNIQUE INDEX `invitation_one_sent (organization_id, email) WHERE status = 'sent'`; index (`organization_id`, `invited_by`, `sent_at`) and (`organization_id`, `sent_at`) for the limits; index (`email`) for the account's invitations | yes, `invitation_versions`, the organization's lock |
| `invitation_letter` | `id uuid`, `organization_id uuid`, `invitation_id uuid`, `email text`, `sent_at timestamptz` | PK `id`; index (`email`, `sent_at`) | no: mechanics, pruned an hour after sending |

`watermark(uuid)` is replaced to count `invitation_versions` too, so the frame's "now" moves when an invitation changes. `organization_lock` guards `invitation_versions` as it guards the users'.

## Schema `platform`

| Table | Columns | Keys and checks | Versioned |
|---|---|---|---|
| `account_place` | `account_id uuid`, `address text`, `changed_at timestamptz` | PK `account_id`; FK `account_id → account`; CHECK `address ~ '^/w/'` | no: the interface's state, not history |

## Entities

- **OrganizationCoreEntity** gains `who_may_invite: WhoMayInviteEnumEntity` — `ANY_USER` (`any_user`), `ADMINISTRATORS` (`administrators`) — and `invitations: CompositeMany[InvitationCoreEntity]`.
- **InvitationCoreEntity** (domain `organization`): `id`, `email`, `is_admin`, `status: InvitationLifecycle`, `sent_at`, `letter_sent_at`, `expires_at`, `decided_at`, `by_setting`; links `organization` (AssociationOne, inverse `invitations`), `invited_by` (AssociationOne to `UserCoreEntity`, inverse `invitations_sent`), `decided_by` (AssociationOne to `UserCoreEntity`, no inverse, optional), `accepted_user` (AssociationOne to `UserCoreEntity`, no inverse, optional).
- **InvitationLifecycle**: `sent` initial → `accepted`, `declined`, `withdrawn`, `expired`, each final.
- **UserCoreEntity** gains `invitations_sent: AssociationMany[InvitationCoreEntity]` (inverse `invited_by`).
- **AccountCoreEntity** gains `last_place: str | None` as a field of the model (kept in `account_place`); the storage answers it with the account.

## Rules the actions keep

- An invitation is created only Sent, by `SendInvitationAction`, after: the inviter is an active user of the organization; the setting allows them; the mark is off unless the inviter is an administrator; the email is not an active or a blocked user's confirmed email in the organization; no Sent invitation to the email exists; the limits hold — the email: one letter a minute, ten an hour (`invitation_letter`); the inviter: thirty invitations an hour; the organization: a hundred a day (`invitation.sent_at`); the letter was handed to the mail.
- `expires_at = sent_at + MAXITOR_INVITATION_DAYS days`; sending the letter again changes `letter_sent_at` only.
- An invitation leaves Sent by exactly one of: `AcceptInvitationAction` (by an account whose confirmed emails include its email; makes a new active user with `is_admin` from the invitation and the account's name; sets `accepted_user_id`), `DeclineInvitationAction` (the same account), `WithdrawInvitationAction` (an administrator; `decided_by` set), `SetWhoMayInviteAction` to `administrators` (`by_setting = true`, `decided_by` the administrator who switched), or its time (`expired`, written when next read or touched, `decided_at = expires_at`).
- Every change of `organization`, `"user"` and `invitation` takes `organization_lock`; accepting an invitation included.
- The organization keeps at least one active administrator: `BlockUserAction`, `RemoveUserAction` and `SetAdministratorAction(false)` count the other active administrators inside the transaction and refuse `last_administrator` at zero.
- A user's `status` moves by `UserLifecycle` only; `is_admin` changes only while `status = 'active'`.
- `organizations_of` and `organization_for` answer active users only, as before: a blocked or removed user is a stranger on the next request.
- `account_place.address` is a path of Maxitor starting with `/w/`, with `at`, `mode` and `from` removed by the writer.
