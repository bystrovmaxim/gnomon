# Tasks: Maxitor core — signing in, registering an organization, the empty frame and one compatibility check

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/actions.md](contracts/actions.md), [quickstart.md](quickstart.md)

The phases follow issue bystrovmaxim/gnomon#73: one phase is one commit, and after each commit the phase's own tests run (adversarial: break what the new test must catch, see it fail, restore). The story labels map to the spec: US1 email and password, US1a reset, US2 providers, US3 registering and the empty frame, US4 organizations and isolation, US5 sign-in methods, US6 cookies and public pages, US7 typed events, US8 plugin compatibility, US9 the concept model, US10 the ERD paint switch.

Paths: `core` = `packages/maxitor/maxitor-core`, `py` = `core/maxitor/core`, `web` = `core/web`, `sdk` = `packages/maxitor-plugin-sdk`, `template` = `packages/maxitor-plugin-template`, `viewer` = `packages/maxitor/maxitor-web`.

## Phase 1: The mockup (issue phase 1)

- [ ] T001 Commit `specs/072-maxitor-core/` — `mockup/index.html`, `spec.md`, `checklists/requirements.md`, `model/`, `plan.md`, `research.md`, `data-model.md`, `contracts/actions.md`, `quickstart.md`, `tasks.md` — and the constitution 1.6.0 in `.specify/memory/constitution.md`

## Phase 2: The concept model follows (issue phase 2)

- [ ] T002 [US9] Cherry-pick the commit 8fab8140 of the local branch `feature/spec-059-domains-as-plugins` onto this branch
- [ ] T003 [US9] Rename `EnterpriseCoreEntity` to `BoundaryCoreEntity` with every field and link (`enterprise` → `boundary`, `enterprises` → `boundaries`, `granted_enterprises` → `granted_boundaries`, `owned_enterprises` → `owned_boundaries`) in `specs/059-maxitor-concept/model/enterprise_model.py`
- [ ] T004 [US9] Bring the model to the current AOA: a storage names its entities with `@entities`, no data source; remove `sso_domain` and every word of single sign-on in `specs/059-maxitor-concept/model/enterprise_model.py`
- [ ] T005 [P] [US9] Rename enterprise → boundary and remove single sign-on from `specs/059-maxitor-concept/data-model.md`, `terms.md`, `ux.md`, `epics.md`, `catalog-filling.md`, and describe signing in by email and password or a provider where signing in is spoken of
- [ ] T006 [P] [US9] Remove single sign-on from `specs/059-maxitor-concept/mockup/index.html` (screen 1.1, screen 7.9, `viaShort`, `viaLong`, the "Via SSO" filter) and rename enterprise → boundary in its words
- [ ] T007 [US9] Rebuild `specs/059-maxitor-concept/model/graph.json` with `build_graph.py`; check that `grep -ri "enterprise\|sso\|single sign-on"` over `specs/059-maxitor-concept` finds only historical notes

## Phase 3: Typed events in the existing domains (issue phase 3)

- [ ] T008 [US7] Write a repository test `packages/maxitor/maxitor-web/tests/test_domains_typed.py` that imports every Maxitor domain and fails if one has no `events`
- [ ] T009 [P] [US7] Declare events and `@emits` for every `box.info/warning/critical` of `packages/maxitor/tools/repo-graph-port/maxitor/repo_graph_port/` (10 lines) with event classes in `repo_graph_port/events.py` and `events = (...)` on `RepoGraphDomain`
- [ ] T010 [P] [US7] Declare events and `@emits` for every line of `packages/maxitor/maxitor-web/maxitor/web/model/core/` with classes in `model/core/events.py` and `events` on `CoreDomain`
- [ ] T011 [P] [US7] Declare events and `@emits` for every line of `packages/maxitor/maxitor-web/maxitor/web/model/diagrams/` with classes in `model/diagrams/events.py` and `events` on `DiagramsDomain`
- [ ] T012 [P] [US7] Declare events and `@emits` for every line of `packages/maxitor/maxitor-web/maxitor/web/model/rooms/` with classes in `model/rooms/events.py` and `events` on `RoomsDomain`
- [ ] T013 [P] [US7] Declare `events` (and `@emits` where a method writes) on `NotesDomain` in `template/src/maxitor_notes/notes_domain.py`
- [ ] T014 [US7] State the rule "every domain lists its events; every method that writes declares them" in `template/docs/plugins.md` and `template/README.md`
- [ ] T015 [US7] Run the tests of repo-graph-port, maxitor-web and the template; break one `@emits` on purpose and see the domain's test fail

## Phase 4: The core's database (issue phase 4)

- [ ] T016 Create the part `core/` — `core/maxitor/core/__init__.py`, the extra `core` and the command `maxitor-core` in `packages/maxitor/pyproject.toml` with `aoa-action-machine[postgres,jwt]`, `argon2-cffi`, `geoip2`, `botocore`, `packaging`, `PyYAML`, `uvicorn`; its entry in `scripts/package_boundaries.toml`; `uv lock`
- [ ] T017 Copy the model into the code: `py/domains.py` (`PlatformDomain`, `OrganizationDomain` with their events), `py/events/platform.py`, `py/events/organization.py`, `py/entities/*.py` from `specs/072-maxitor-core/model/core_model.py`
- [ ] T018 Write `py/migrations/0001_core.sql`: the tables of data-model — `account`, `sign_in` (UNIQUE `provider`, `provider_subject`; CHECK `password_hash IS NULL OR provider = 'email'`), `sign_in_code` (CHECK `purpose IN ('confirm_email','reset_password')`, CHECK `wrong_tries BETWEEN 0 AND 5`, partial UNIQUE `email`, `purpose` WHERE `used_at IS NULL`), `sign_in_attempt`, `organization` (UNIQUE `code`, the code CHECK), `"user"` (UNIQUE `organization_id`, `account_id`; CHECK `status IN ('active','blocked','removed')`), `boundary`, `boundary_user`, every `<table>_versions` with its `EXCLUDE USING gist` (`sign_in_versions` without `password_hash`); a `COMMENT` on every column; no `DEFAULT` on an identifier; no cascade
- [ ] T019 Write `py/bootstrap.sql` for the administrator: role `maxitor_core` (LOGIN, no superuser, no CREATEDB, no CREATEROLE), schemas `platform` and `organization` owned by it, `REVOKE ALL ON SCHEMA public FROM PUBLIC`, schema `extensions` with `btree_gist`, `search_path = organization, platform, extensions`
- [ ] T020 Write `py/migrate.py` (`maxitor-core migrate`): applies `migrations/*.sql` in order as `maxitor_core`, one transaction each, recorded in `platform.migration`
- [ ] T021 Write `py/storage/core_storage.py` — `CoreStorage(PostgresStorage)` with `@entities` of every core entity, the versioning helpers (account lock for `platform`, organization lock for `organization`, the change time, write a row and its version, read at a moment) and no schema named in SQL
- [ ] T022 Update `template/docs/versioned-storage.md`, `template/docs/plugins.md` and `template/src/maxitor_notes/storage/notes_storage.py`: the core's schema is `organization`, its tables `organization` and `"user"`, every other schema's name from the environment through `psycopg.sql.Identifier`, a plugin's schema named with its version (`notes_0_3_0`)
- [ ] T023 Tests in `core/tests/`: copy `recording_database.py` from the template; `test_migration.py` (every column commented, no identifier `DEFAULT`, no `CASCADE`, `public` revoked), `test_core_storage.py` (no schema-qualified name in any SQL, `organization_id` in every organization query, the version row written with its row)

## Phase 5: Signing in on the server (issue phase 5)

- [ ] T024 [US2] `py/gateways/geoip.py` — `GeoIpGateway.country_of(ip) -> str | None` over `MAXITOR_GEOIP_DATABASE` with `geoip2`; none when no database or unknown
- [ ] T025 [P] [US1] `py/gateways/mail.py` — abstract `MailGateway` (`send_email_confirmation`, `send_password_reset`, `send_password_changed`), `YandexCloudPostboxGateway` (SES `SendEmail` over `httpx`, SigV4 by `botocore`, sender `no-reply@maxitor.aoa.run`), `OutboxMailGateway` (`.eml` into `MAXITOR_MAIL_OUTBOX`); the letters' text and HTML in `py/letters/` as the mockup draws them (code at the start of the subject, no link, the "did not ask" note)
- [ ] T026 [P] [US2] `py/gateways/providers.py` — `GoogleSignInGateway`, `GitHubSignInGateway`, `FacebookSignInGateway`, `YandexSignInGateway`, `MailRuSignInGateway` with `authorize_url` and `person`, endpoints of research R9, keys from `MAXITOR_<PROVIDER>_CLIENT_ID/SECRET`
- [ ] T027 [US1] `py/passwords.py` — Argon2id hash and verify, the rules (≥ 10 characters, not the email, not in `py/common-passwords.txt`)
- [ ] T028 [US1] `py/session.py` — issue and read the session token (HS256, `MAXITOR_SESSION_SECRET`, 8 h, `sid`, `auth_at`) and the consent token (`aud` `maxitor-consent`, 15 min, references only)
- [ ] T029 [US2] Actions `DetectRegionAction`, `SignInOptionsAction` in `py/actions/region.py`
- [ ] T030 [US1] Actions `StartSignUpAction`, `ConfirmEmailAction`, `SignInWithPasswordAction` in `py/actions/email_sign_in.py` — code limits (one a minute, ten an hour per address, thirty an hour per IP), five tries, ten wrong passwords per fifteen minutes per address and thirty per IP, the same answer for known and unknown addresses
- [ ] T031 [US1] Actions `RequestPasswordResetAction`, `ResetPasswordAction` in `py/actions/password_reset.py` — `password_changed_at` set, the "password changed" letter
- [ ] T032 [US2] Actions `StartSignInAction`, `FinishSignInAction` in `py/actions/provider_sign_in.py` — the region rule at start and finish, `state` checked
- [ ] T033 [US1] Actions `CreateAccountAction`, `AcceptPolicyAction`, `RenewSessionAction`, `SignOutAction`, `CurrentUserAction` in `py/actions/account.py`
- [ ] T034 [US5] Actions `ListSignInsAction`, `LinkSignInAction`, `LinkEmailAction`, `UnlinkSignInAction` in `py/actions/sign_ins.py` — the last sign-in kept, a taken sign-in refused
- [ ] T035 `py/server.py` — `FastApiAdapter` chain of contracts/actions.md, `JwtAuthCoordinator` with `CookieCredentialExtractor("__Host-maxitor_session")` for session routes, `NoAuthCoordinator` for open ones, every gateway a `PerCallConnection`; `py/launch.py` runs uvicorn with proxy headers
- [ ] T036 Tests `core/tests/test_sign_in_*.py` with fake gateways on the recording connection: region (unknown → Russia, foreign refused from Russia at start and finish even for a known sign-in), codes (limits, tries, expiry), passwords (rules, limits, one message), identical answers for known and unknown addresses, consent token, renewal refused after a password change, unlink of the last refused, a taken link refused, and SC-005a — a known password found in no event, log line, error or answer

## Phase 6: Registering an organization on the server (issue phase 6)

- [ ] T037 [US3] Actions `CheckAddressCodeAction`, `RegisterOrganizationAction`, `OpenOrganizationAction` in `py/actions/organizations.py` — reserved codes of data-model, two free suggestions, one change for the organization and its admin user, the race answered, at most 10 per account, 404 alike for no active user and no code
- [ ] T038 [US3] Tests `core/tests/test_organizations.py` — free, taken, not allowed with characters named, suggestions, race, limit, 404 alike

## Phase 7: The core's Next.js application (issue phase 7)

- [ ] T039 [US1] Scaffold `web/` (Next.js 16, React 19, `package.json`, `next.config.ts` with rewrites of `/api/**` to `MAXITOR_CORE_API`, the tokens of the mockup in `app/globals.css`)
- [ ] T040 [US6] `web/app/layout.tsx` with the cookie banner (`maxitor_cookie_consent` + the policy version), `web/app/privacy/page.tsx`, `web/app/data-deletion/page.tsx` as mockup 6.1, 6.2
- [ ] T041 [US1] `web/app/page.tsx` (sign-in, 1.1, 1.2, 1.10, 1.15, 1.16), `web/app/sign-up/page.tsx` (1.13, 1.14), `web/app/sign-up/confirm/page.tsx` (1.3–1.7), `web/app/sign-in/new-account/page.tsx` (1.11), server actions in `web/app/actions.ts` that set and clear `__Host-maxitor_session`
- [ ] T042 [US1] `web/app/reset-password/page.tsx` (7.1–7.3)
- [ ] T043 [US2] `web/app/api/v1/sign-in/[provider]/callback/route.ts` and the start redirect; the refusal page `web/app/sign-in/refused/page.tsx` (1.8)
- [ ] T044 [US3] `web/app/new/page.tsx` (2.1–2.4), `web/app/w/page.tsx` (3), `web/app/w/[code]/page.tsx` (4.1–4.5) with the header, the icon's menu and the organizations switch
- [ ] T045 [US5] `web/components/SignInMethods.tsx` (5.1–5.5)
- [ ] T046 `npm run build` of `web/` passes

## Phase 8: The core's identity (issue phase 8)

- [ ] T047 [US8] `py/maxitor-core.yaml`, its schema `py/schemas/core-passport-1.schema.json`, `CorePassportAction` in `py/actions/passport.py` (version from `importlib.metadata.version("maxitor")`), its route; test `core/tests/test_passport.py`

## Phase 9: The SDK (issue phase 9)

- [ ] T048 [US8] Create `sdk/` (`pyproject.toml`, `version.toml`, `src/maxitor_plugin_sdk/`) and move `template/checks/` schemas and checks into `sdk/src/maxitor_plugin_sdk/`; the template imports them
- [ ] T049 [US8] `sdk/src/maxitor_plugin_sdk/compat.py` — one function deciding a set of plugins against a core version: formats read, the core's range, one version per plugin, cycles, the SDK major, dependents on upgrade and removal; every refusal names every side
- [ ] T050 [US8] Tests `sdk/tests/test_compat.py` — one per refusal and one that passes

## Phase 10: The plugin check (issue phase 10)

- [ ] T051 [US8] `maxitor plugin check <path> --core <version>` in `packages/maxitor/maxitor-web/maxitor/web/launch.py` (or a new entry) using `compat`, refusing a plugin domain with no `events`; tests: the template passes, each refusal

## Phase 11: The local stand (issue phase 11)

- [ ] T052 `scripts/core-stand.sh` (`up`, `down`, `reset`) — PostgreSQL 16 in Docker on 55432, bootstrap as administrator, migrate as `maxitor_core`, the backend on 8020 with the outbox, the Next.js dev server on 3000
- [ ] T053 `web/scripts/check-core.mjs` — the scenarios of quickstart.md in Chromium against the stand; run it

## Phase 12: The ERD paints by domains in the physical view (issue phase 12)

- [ ] T054 [US10] `viewer/client/src/lib/erdPaint.ts` and `ErdGraphvizCanvas.tsx` — the paint setting `null` until chosen; physical default resources, a chosen section honoured
- [ ] T055 [US10] Vitest `viewer/client/src/lib/erdPaint.test.ts` — physical + chosen domains → domains; physical + none → resources; logical + none → domains; break the fix, see it fail

## Phase 13: Documentation, changelog, versions (issue phase 13)

- [ ] T056 `core/README.md`, `docs/how-to/run-the-core-locally.md`, the plugin concept's core section
- [ ] T057 Versions raised for every level changed (`packages/maxitor`, `packages/maxitor-plugin-template`, `packages/maxitor-plugin-sdk`, the viewer's client), graphs rebuilt (`graph-builder.toml` entries), the closing check run to zero
- [ ] T058 The changelog: one article in `docs/CHANGELOG.md` and the packages' changelogs

## Phase 14: Publishing the providers' apps (issue phase 14)

- [ ] T059 By the maintainer after the stand serves `/privacy` and `/data-deletion`: Google's app published, Facebook's switched to Live

## Dependencies

Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13. Phases 2, 3 and 12 touch nothing of the core and could run in any order; phases 5–7 need the database of phase 4; phase 11 needs 5–7; phase 10 needs 9.

## Parallel examples

- Phase 3: T009–T013 touch different domains.
- Phase 5: T024, T025, T026 are independent gateways.

## Implementation strategy

MVP: phases 4–7 with US1 and US3 — a person signs up by email and lands in the empty frame of their organization. The providers (US2), sign-in methods (US5) and the public pages (US6) complete the issue in the same pull request.
