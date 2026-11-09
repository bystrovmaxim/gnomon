# Research: Maxitor core — signing in, registering an organization, the empty frame and one compatibility check

Each section is one decision: what was chosen, why, and what else was weighed.

## R1. Where the core's code lives

**Decision**: a new part of the `maxitor` package, `packages/maxitor/maxitor-core/`, with its Python code in `maxitor/core/` (the namespace `maxitor.core`) and its Next.js application in `maxitor-core/web/`. The part is installed by a new extra `maxitor[core]`; the command `maxitor-core` runs its backend.

**Rationale**: the issue says the core's identity is the `maxitor` package and its version is that package's version (FR-039). The package already gathers its parts as folders `maxitor-web/`, `tools/<name>/`, `core/<name>/` under one namespace; a new folder follows the same rule, and `scripts/package_boundaries.toml` gets its entry. The existing folder `core/` holds shared code under other module names (`maxitor.graph_compare`, `maxitor.graph_map`), so `maxitor.core` does not collide with it.

**Alternatives**: a separate package `maxitor-core` (rejected: the core's version would no longer be the `maxitor` package's); code inside `maxitor-web/` (rejected: that part is the graph viewer that becomes a plugin in #77).

## R2. Who sets the session cookie

**Decision**: the core's Next.js server. A sign-in form posts to a Next.js server action; the server action calls the backend's sign-in action over the inner address, receives the signed JWT in the action's result, and sets `__Host-maxitor_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`) with `cookies().set(...)`. Signing out calls the backend's sign-out action and deletes the cookie. Every other call from the browser goes to `/api/...` on the same origin; Next.js rewrites it to the backend, which reads the cookie with AOA's `CookieCredentialExtractor("__Host-maxitor_session")` and `JwtAuthenticator` in the core's `CoreAuthCoordinator`; a request without a valid session is a guest.

**Rationale**: AOA's HTTP adapter returns only an action's result model and has no way to set a header; AOA is a submodule this repository never edits. AOA already reads a JWT from a cookie (`CookieCredentialExtractor`). Constitution 1.6.0, rule 55, allows the cookie and says the authentication action's response sets it: the action issues the token, the frontend's server only carries it into the cookie, and no page script ever sees it. No route, middleware or authentication server of Maxitor's own appears in the backend.

**Alternatives**: a FastAPI middleware that turns a result field into `Set-Cookie` (rejected: a hand-written middleware, forbidden by the issue); a change to AOA's adapter (rejected for this work: AOA moves only by `update-aoa.sh`; noted as a later improvement); keeping the token in `localStorage` and sending it as `Bearer` (rejected: a script could steal it).

## R3. The session token and its renewal

**Decision**: HS256, secret `MAXITOR_SESSION_SECRET` from the environment; claims `sub` (account id), `sid` (new at each sign-in), `iat`, `exp` = `iat` + 8 h, `auth_at` (the time of signing in), `roles` = `[]`. `RenewSessionAction` (called by the Next.js server when less than half of the token's life is left) issues a new token with the same `sid` and `auth_at` if `auth_at` is less than 30 days ago and the account's `password_changed_at` is not later than the token's `iat`.

**Rationale**: rule 55 forbids a sessions table and a database lookup in the check; the renewal is an action, so it may read the account. An 8-hour token bounds how long a session outlives a password reset (FR-016a).

**Alternatives**: one 30-day token (rejected by the maintainer); a server-side session table (rejected by rule 55).

## R4. The client's IP and the region

**Decision**: the backend runs under `uvicorn --proxy-headers --forwarded-allow-ips <the frontend's and the stand proxy's addresses>`, so `request.client.host`, which AOA puts into `Ctx.Request.client_ip`, is the real client. The Next.js server forwards `X-Forwarded-For` from its own request on every call it makes to the backend. `DetectRegionAction` asks `GeoIpGateway.country_of(ip)`; the gateway reads `GeoLite2-Country.mmdb` from `MAXITOR_GEOIP_DATABASE` with the `geoip2` library; with no database, or an address it does not know, it answers `None`, which the action counts as Russia.

**Rationale**: AOA's context assembler already takes `request.client.host`; uvicorn's proxy headers are configuration, not code. Unknown → Russia is the issue's rule.

**Alternatives**: reading `X-Forwarded-For` in a custom context assembler (rejected: duplicates uvicorn and is easy to spoof without an allow-list).

## R5. Passwords

**Decision**: `argon2-cffi` with its default Argon2id parameters; the password reaches the backend only in a request model field of type `SecretStr` and never leaves the action that hashes or verifies it. A list of the 10 000 most common passwords ships as package data; a password in it, shorter than 10 characters or equal to the email is refused.

**Rationale**: Argon2id is the current recommendation (OWASP); `SecretStr` keeps it out of `repr` and logs (rule 58).

## R6. Limits on codes and passwords

**Decision**: codes are counted from `sign_in_code` rows (kept for an hour after use for counting, then deleted); wrong passwords from a new entity `SignInAttemptCoreEntity` (`sign_in_attempt`: email, ip, at), kept fifteen minutes. Both live in the schema `platform`, are not versioned, and are pruned by the action that writes them.

**Rationale**: limits must hold across processes; the database is the one shared place, and the counts are small.

**Alternatives**: an in-memory counter (rejected: several processes, restarts).

## R7. The pending sign-up and the consent token

**Decision**: an email sign-up keeps the password's hash in its `confirm_email` code row (`sign_in_code.password_hash`). A proven sign-in waiting for consent is a JWT (HS256, the same secret, `aud` = `maxitor-consent`, 15 minutes) that names only references: for email the code's id, for a provider the provider, its subject, the email and the name it gave. `CreateAccountAction` checks the token, re-reads the code row, creates the account and its sign-in, deletes the code and signs the session.

**Rationale**: a password hash never travels to the browser; nothing but the code row exists until consent (FR-019).

## R8. The mail

**Decision**: `MailGateway` (abstract) with `send_email_confirmation`, `send_password_reset`, `send_password_changed`. `YandexCloudPostboxGateway` builds the letters (plain text and HTML from templates in the package) and calls Postbox's SES-compatible `SendEmail` over `httpx`, signing the request with `botocore`'s SigV4 (`AWSRequest` + `SigV4Auth`, region `ru-central1`, service `ses`). For a machine without Postbox keys, `OutboxMailGateway` writes each letter as an `.eml` file into `MAXITOR_MAIL_OUTBOX`; the local stand and the browser checks read the code from there.

**Rationale**: `httpx` is already the project's HTTP client; `botocore` is used only for its proven signing. An outbox lets the local stand and tests run without sending real mail.

**Alternatives**: `boto3` (rejected: synchronous client for the whole call); a hand-written SigV4 (rejected: easy to get subtly wrong).

## R9. The providers

**Decision**: one gateway per provider over `httpx`, each with `authorize_url(state, challenge, redirect_uri)` and `person(code, verifier, redirect_uri) -> ProviderPerson(subject, email, name)`. `state` and the PKCE verifier live in a short `HttpOnly` cookie `__Host-maxitor_oauth` set by the Next.js server around the redirect. PKCE (`S256`) is sent to every provider; one that ignores it is still protected by `state`. Endpoints:

| Provider | Authorize | Token | Person |
|---|---|---|---|
| Google | `accounts.google.com/o/oauth2/v2/auth` | `oauth2.googleapis.com/token` | `openidconnect.googleapis.com/v1/userinfo` |
| GitHub | `github.com/login/oauth/authorize` | `github.com/login/oauth/access_token` | `api.github.com/user` + `/user/emails` |
| Facebook | `www.facebook.com/v21.0/dialog/oauth` | `graph.facebook.com/v21.0/oauth/access_token` | `graph.facebook.com/me?fields=id,name,email` |
| Yandex ID | `oauth.yandex.ru/authorize` | `oauth.yandex.ru/token` | `login.yandex.ru/info?format=json` |
| Mail.ru ID | `oauth.mail.ru/login` | `oauth.mail.ru/token` | `oauth.mail.ru/userinfo` |

The redirect address is `<MAXITOR_PUBLIC_URL>/api/v1/sign-in/<provider>/callback`; the callback is a Next.js route that calls `FinishSignInAction` and sets the session or the consent step.

## R10. The database

**Decision**: PostgreSQL 16; the schemas `platform` and `organization` owned by `maxitor_core`, `search_path = organization, platform`, `public` revoked, `btree_gist` in `extensions`. Migrations are numbered SQL files in `maxitor/core/migrations/`, applied by `maxitor-core migrate` in one transaction each and recorded in `platform.migration`. `account`, `sign_in`, `organization`, `user`, `boundary` have `<table>_versions` written by versioned storage: organization tables under the organization's lock, platform tables under the account's lock (`pg_advisory_xact_lock(hashtext(account_id))`). `sign_in_code` and `sign_in_attempt` are not versioned. The table `user` is quoted only in the migration that creates it; queries name it through `psycopg.sql.Identifier` like every other name. Tests run on the plugin template's recording connection; the live check runs on a local PostgreSQL in Docker.

**Rationale**: the issue's 1.2; versioned storage as `versioned-storage.md` lays it out.

## R11. The two frontends side by side

**Decision**: the core's Next.js application serves `/`, `/sign-up`, `/reset-password`, `/sign-in/**`, `/privacy`, `/data-deletion`, `/w`, `/w/<code>`, and rewrites `/api/v1/core/**` and `/api/v1/sign-in/**` to the core's backend. The graph viewer (Vite) keeps its own origin and port until it becomes a plugin (#77). On the local stand the core runs at `http://localhost:3000`, the core's backend at `127.0.0.1:8020`, the viewer as today at `5173`/`8000`.

**Rationale**: the core's pages are new; the viewer stays as it is. One origin for the core keeps the cookie `__Host-` and same-site.

## R12. Typed events in the existing domains

**Decision**: each existing domain (`core`, `diagrams`, `rooms`, `repo_graph`, `notes`) gets an `events` tuple; each of today's 46 `box.info/warning/critical` calls is rewritten as an event class in its domain's package with the line's variables as typed fields, and the method gets `@emits`. AOA's emission rules then refuse any other line. A repository test walks every domain of Maxitor and fails if one has no `events`.

## R13. The SDK and the compatibility check

**Decision**: a new package `packages/maxitor-plugin-sdk` (`maxitor_plugin_sdk`), with `compat.py` (pure functions over passports, `packaging.specifiers`) and the schemas and checks moved from `maxitor-plugin-template/checks`; `maxitor plugin check <path> --core <version>` is a command of the `maxitor` package that imports the SDK. The core passport `maxitor-core.yaml` ships in `maxitor/core/`, read by `CorePassportAction`.

## R14. The ERD paint switch

**Decision**: the page setting `erdPaint` keeps `null` until the reader chooses; `paintSource` picks `resources` in the physical view and `domains` in the logical one only when the setting is `null`; a chosen section is honoured in both views.

**Rationale**: the defect comes from telling "the default" from "Domains" by comparing with `"domains"` (`ErdGraphvizCanvas.tsx`).

## R15. The local stand

**Decision**: `scripts/core-stand.sh` starts PostgreSQL 16 in Docker (`maxitor-core-pg`, port 55432), creates the role and schemas as the administrator once, runs the migrations as `maxitor_core`, starts the core's backend and the Next.js dev server, with `OutboxMailGateway` and no GeoIP database unless one is given. The browser checks of this work run against it.
