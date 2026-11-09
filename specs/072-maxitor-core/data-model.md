# Data model: Maxitor core

The entities, their fields and relations are written as code in [`model/core_model.py`](model/core_model.py); its graph, [`model/graph.json`](model/graph.json), is the plan the built code is compared with. This page names the tables that follow from it and the rules the database keeps.

Every entity is a table of its name in the schema of its domain. Every column has explicit nullability and a description (`COMMENT ON COLUMN`); no identifier has a `DEFAULT`; no `ON DELETE CASCADE` (constitution III). Identifiers are `uuid` assigned by the writer.

## Schema `platform`

| Table | Columns | Keys and checks | Versioned |
|---|---|---|---|
| `account` | `id uuid`, `name text`, `email text`, `policy_version int`, `policy_accepted_at timestamptz`, `policy_accepted_ip inet`, `created_at`, `updated_at` | PK `id`; `email` = `lower(email)` | yes, `account_versions`, lock by `id` |
| `sign_in` | `id uuid`, `account_id uuid`, `provider text`, `provider_subject text`, `email text NULL`, `password_hash text NULL`, `password_changed_at timestamptz NULL`, `added_country char(2) NULL`, `added_ip inet`, `added_at`, `last_used_at NULL` | PK `id`; FK `account_id → account`; UNIQUE (`provider`, `provider_subject`); CHECK `provider IN (…six…)`; CHECK `password_hash IS NULL OR provider = 'email'` | yes, `sign_in_versions` without `password_hash` (only `password_changed_at`), lock by `account_id` |
| `sign_in_code` | `id uuid`, `purpose text`, `email text`, `code_hash text`, `password_hash text NULL`, `wrong_tries int`, `requested_country char(2) NULL`, `requested_ip inet`, `created_at`, `expires_at`, `used_at NULL` | PK `id`; CHECK `purpose IN ('confirm_email','reset_password')`; CHECK `wrong_tries BETWEEN 0 AND 5`; partial UNIQUE (`email`, `purpose`) WHERE `used_at IS NULL` | no |
| `sign_in_attempt` | `id uuid`, `email text`, `ip inet`, `at timestamptz` | PK `id`; index (`email`, `at`), (`ip`, `at`) | no |
| `migration` | `name text`, `applied_at timestamptz` | PK `name` | no |

Rows of `sign_in_code` stay one hour after use or expiry so the hourly limit can count them, then the writing action deletes them; rows of `sign_in_attempt` stay fifteen minutes.

## Schema `organization`

| Table | Columns | Keys and checks | Versioned |
|---|---|---|---|
| `organization` | `id uuid`, `name text`, `code text`, `created_by uuid`, `created_at`, `updated_at` | PK `id`; UNIQUE `code`; CHECK `code ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'` and length ≥ 2 | yes, `organization_versions`, the organization's lock |
| `user` | `organization_id uuid`, `id uuid`, `account_id uuid`, `name text`, `is_admin bool`, `status text`, `created_at`, `updated_at` | PK (`organization_id`, `id`); FK `organization_id → organization`; UNIQUE (`organization_id`, `account_id`); CHECK `status IN ('active','blocked','removed')` | yes, `user_versions` |
| `boundary` | `organization_id uuid`, `id uuid`, `name text`, `created_at`, `updated_at` | PK (`organization_id`, `id`); FK `organization_id → organization` | yes, `boundary_versions` |
| `boundary_user` | `organization_id uuid`, `boundary_id uuid`, `user_id uuid` | PK of all three; FKs to `boundary` and `user` | yes, `boundary_user_versions` |

`user.account_id` points into `platform.account`; the foreign key crosses schemas inside the core's own database and is created by the core's migration.

A version table repeats its table's columns — except `sign_in.password_hash`, which no history keeps, so an old password's hash disappears with the next change — and adds `valid_from_at`, `valid_to_at NULL`, `author_id`, `operation`; an `EXCLUDE USING gist` keeps one version in force at a time (`btree_gist` in `extensions`), as `packages/maxitor-plugin-template/docs/versioned-storage.md` lays out.

## Rules the actions keep

- An account exists only after `CreateAccountAction`; its first sign-in is created in the same change.
- An account keeps at least one sign-in: `UnlinkSignInAction` refuses the last.
- An account registers at most 10 organizations: `RegisterOrganizationAction` counts `organization.created_by`.
- An organization is created with exactly one user, `is_admin = true`, `status = 'active'`, in one change.
- The reserved address codes: `w`, `api`, `new`, `sign-in`, `sign-up`, `reset-password`, `privacy`, `data-deletion`, `p`, `static`, `_next`, `admin`, `maxitor`, `www`, `help`, `docs`.
- A `confirm_email` code carries the password's hash; on consent it moves to the new `email` sign-in and the code is marked used.
- A `reset_password` code is sent only to an address whose `email` sign-in has a password; the answer to the request is the same either way.

## States

`user.status` follows `UserLifecycle`: `active` (initial) ↔ `blocked`; either → `removed` (final). Only `active` is reached in this work.
