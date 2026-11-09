# Implementation Plan: Maxitor core — signing in, registering an organization, the empty frame and one compatibility check

**Branch**: `feature/issue-73-maxitor-core` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

`core` = `packages/maxitor/maxitor-core`, `py` = `core/maxitor/core`, `web` = `core/web`, `viewer` = `packages/maxitor/maxitor-web`, `sdk` = `packages/maxitor-plugin-sdk`, `template` = `packages/maxitor-plugin-template`.

## Summary

Maxitor gets a core of its own: a PostgreSQL database with the schemas `platform` and `organization`, a backend of AOA actions behind `FastApiAdapter`, and a Next.js application with the screens of the mockup — sign-in by email and password or a provider allowed in the region, confirming the email, resetting the password, consent and cookies, registering an organization, the empty frame, sign-in methods and the two public pages. Every outside service is a typed gateway received per call. Every domain of Maxitor writes only typed events. The core gets a passport, the SDK decides plugin compatibility, and the ERD's physical view paints by domains on request. The research is in [research.md](research.md), the tables in [data-model.md](data-model.md), the addresses in [contracts/actions.md](contracts/actions.md).

## Technical Context

**Language/Version**: Python 3.12 / 3.14 (backend, SDK); TypeScript, Next.js 16, React 19 (the core's application); TypeScript, React + Vite (the viewer, phase 12 only)
**Primary Dependencies**: `aoa-action-machine[postgres,jwt]`, `aoa-fastapi-adapter`, `uvicorn`, `psycopg`, `argon2-cffi`, `geoip2`, `httpx`, `botocore` (SigV4 only), `packaging`, `PyYAML`
**Storage**: PostgreSQL 16 — one database, schemas `platform` and `organization`, role `maxitor_core`
**Testing**: pytest on the recording connection; Vitest for the viewer; the browser checks of the core against the local stand (Playwright)
**Target Platform**: Linux server (the stand), the browsers of the browser checks
**Project Type**: web service + web application
**Performance Goals**: SC-009 — the sign-in form within 2 s; SC-001 — sign-up to empty frame under 3 min by hand
**Constraints**: every endpoint an AOA action declared by the adapter's chain; every outside service a typed gateway per call; no hand-written route, middleware or authentication server; a password never in a log, event, error or response; no log coordinator switched on
**Scale/Scope**: 37 screens of the mockup; 6 ways in; 10 organizations per account

## Constitution Check

- **I. One term, one name**: the entity names of `model/core_model.py` are the table names of [data-model.md](data-model.md) (`account`, `sign_in`, `sign_in_code`, `sign_in_attempt`, `organization`, `user`, `boundary`).
- **II. Spec ahead of code**: spec 072, clarified twice; issue #73 says the same; the model is the plan of the schema.
- **III. The database does not decide**: identifiers assigned by the writer, no `DEFAULT` on them, no cascades, every column described and its nullability explicit (data-model).
- **IV. Decision apart from idea**: the open items of AOA (a response that sets a cookie) are written as a later improvement in R2, not built.
- **V. Measurement**: SC-001 – SC-011 name the metric and the way; the browser checks and tests measure them.
- **Rules 55–58 (authentication)**: the cookie per 1.6.0 (R2); the token issued by the action that proves a sign-in, HS256, secret from the environment (R3); roles as classes; the password a secret type (R5).
- **Actions, adapters, connections in routes**: every step an action; addresses by the chain; gateways per call through `PerCallConnection` (contracts).
- **Environment and context**: secrets and the GeoIP path from the environment; the client IP from the context (R4).

Post-design: no violation. Tracked: the cookie is set by the frontend's server (R2) because AOA's adapter cannot set a header; this is within rule 55 as amended.

## Project Structure

```text
specs/072-maxitor-core/      spec.md plan.md research.md data-model.md quickstart.md contracts/actions.md mockup/ model/ tasks.md
core/                        pyproject entry in packages/maxitor/pyproject.toml (extra "core", command "maxitor-core")
py/                          domains.py events/ entities/ storage/ gateways/ actions/ roles.py server.py launch.py migrate.py
                             migrations/*.sql maxitor-core.yaml letters/ common-passwords.txt
core/tests/                  recording_database.py test_*.py
web/                         app/ (page per screen) lib/ components/ scripts/check-core.mjs next.config.ts package.json
sdk/                         src/maxitor_plugin_sdk/{compat.py,schemas/,checks/} tests/
viewer/client/src/           components/diagrams/ErdViewer/parts/ErdGraphvizCanvas/ErdGraphvizCanvas.tsx lib/erdPaint.ts
scripts/                     core-stand.sh package_boundaries.toml
specs/059-maxitor-concept/   model/enterprise_model.py model/graph.json *.md mockup/
```

## Design — one phase per phase of the issue

### Phase 1 — the mockup
Commit `specs/072-maxitor-core/` as it stands: the mockup, the spec, the model and this plan's documents.

### Phase 2 — spec 059 on the current AOA
Cherry-pick `feature/spec-059-domains-as-plugins` (8fab8140); rename `EnterpriseCoreEntity` → `BoundaryCoreEntity` with every field and link (#64); a storage names its entities, no data source; remove single sign-on from the model, `data-model.md`, `terms.md`, `ux.md`, `epics.md` and the mockup; describe signing in by providers and passwords where signing in is spoken of; rebuild `graph.json`. Check: the model builds; no `Enterprise` or `SSO` remains (grep).

### Phase 3 — typed events in the existing domains
`events` on `CoreDomain`, `DiagramsDomain`, `RoomsDomain`, `RepoGraphDomain`, `NotesDomain`; each of the 46 lines an event class with `@emits` on its method; a repository test that every Maxitor domain has `events`; the plugin concept and the template's docs state the rule. Check: the existing tests of those domains, plus one that writes an undeclared event and must fail.

### Phase 4 — the core's database
The part `core/` with `CoreStorage` (`PostgresStorage`), the migrations of data-model, `maxitor-core migrate`, the administrator's bootstrap SQL (role, schemas, `public` revoked, `extensions`); the versioning functions; the plugin template's docs and storage name the core's schema `organization` and take schema names from the environment, a plugin's schema with its version. Tests on the recording connection: every SQL names no schema, `organization_id` in every condition, the migration's text keeps rules III.

### Phase 5 — signing in on the server
Domains `platform` and `organization` with their events; gateways `GeoIpGateway`, `MailGateway` + `YandexCloudPostboxGateway` + `OutboxMailGateway`, five provider gateways; actions of contracts (email, password, providers, account, session, sign-ins); `server.py` with the chain and per-call connections; `JwtAuthCoordinator` with `CookieCredentialExtractor`. Tests: each action on the recording connection with fake gateways — the region rule, the code's limits, the password's rules and limits, identical answers for known and unknown addresses, the consent token, renewal refused after a password change, no password in any output (SC-005a).

### Phase 6 — registering an organization on the server
`CheckAddressCodeAction`, `RegisterOrganizationAction` (one change, the race, the limit of 10), `OpenOrganizationAction` (404 for no active user). Tests: free/taken/not allowed, suggestions, the race on the recording connection, the limit.

### Phase 7 — the core's Next.js application
`web/` with every screen of the mockup 1.1–7.4: server actions for sign-in, sign-up, reset and consent that set or clear the cookie; the provider redirect and callback; the cookie banner; `/privacy`, `/data-deletion`; `/w`, `/w/<code>` with the icon's menu and sign-in methods; rewrites of `/api/**` to the backend; `X-Forwarded-For` passed on. Check: `next build`; the browser checks against the local stand (phase 11).

### Phase 8 — the core's identity
`maxitor-core.yaml` (version from the package, the formats of plugin files read), its JSON schema, `CorePassportAction`. Test: the answer matches the package version.

### Phase 9 — `maxitor-plugin-sdk`
The template's schemas and checks moved into `sdk`; `compat` with one test per refusal (format, core range, two versions, cycle, SDK major, dependents on upgrade and removal), each naming every side.

### Phase 10 — `maxitor plugin check`
The command checks a plugin against `--core <version>` with `compat`, and refuses a plugin domain with no `events`. Tests: the template passes; each refusal.

### Phase 11 — the local stand
`scripts/core-stand.sh` (R15); the scenarios of [quickstart.md](quickstart.md) run by `web/scripts/check-core.mjs` in the browser against it. The stand server (`up2y-prod`) and the providers' live sign-in are done by the maintainer after the merge.

### Phase 12 — the ERD's physical view paints by domains
`erdPaint` setting `null` until chosen (R14). Vitest: Domains chosen in the physical view paints by domain and survives a reload; untouched, by resource.

### Phase 13 — documentation, changelog, versions
The core's README and a how-to for the local stand; the plugin concept; the changelog of `maxitor`, of the template and of the SDK; versions raised for every level changed; graphs rebuilt.

### Phase 14 — publishing the providers' apps
By the maintainer after the stand serves `/privacy` and `/data-deletion` (issue #73).
