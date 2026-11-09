# Contracts: the core's actions and their addresses

Every address is declared by the chain of `FastApiAdapter` in `maxitor/core/server.py`; every action belongs to the domain `platform` or `organization`. "Open" means `NoAuthCoordinator`; "session" means the cookie `__Host-maxitor_session` read by `JwtAuthCoordinator`. Bodies and answers are Pydantic models in the action's module; a password is a `SecretStr`.

## Region and options

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `GET /api/v1/sign-in/options` | `SignInOptionsAction` | open | — → `{region: "russia"|"abroad", providers: [..]}` |
| — (child only) | `DetectRegionAction` | — | — → `{region, country}` |

## Email and password

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `POST /api/v1/sign-up` | `StartSignUpAction` | open | `{email, password}` → `{sent: true}` (always), or `422` naming the broken password rule |
| `POST /api/v1/sign-up/confirm` | `ConfirmEmailAction` | open | `{email, code}` → `{consent_token}` or `{error: wrong|used_up|expired, tries_left}` |
| `POST /api/v1/sign-in/password` | `SignInWithPasswordAction` | open | `{email, password}` → `{session_token}` or `{error: "wrong", until?}` |
| `POST /api/v1/password-reset` | `RequestPasswordResetAction` | open | `{email}` → `{sent: true}` (always) |
| `POST /api/v1/password-reset/confirm` | `ResetPasswordAction` | open | `{email, code, password}` → `{changed: true}` or a code error |

## Providers

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `POST /api/v1/sign-in/{provider}/start` | `StartSignInAction` | open | `{redirect_uri}` → `{authorize_url, state, verifier}` or `403 region` |
| `POST /api/v1/sign-in/{provider}/finish` | `FinishSignInAction` | open | `{code, state, expected_state, verifier, redirect_uri}` → `{session_token}` or `{consent_token}` or `403 region` |

## Account and session

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `POST /api/v1/account` | `CreateAccountAction` | open | `{consent_token, name, accepted: true}` → `{session_token}` |
| `POST /api/v1/session/renew` | `RenewSessionAction` | session | — → `{session_token}` or `401` |
| `POST /api/v1/session/accept-policy` | `AcceptPolicyAction` | session | `{accepted: true}` → `{session_token}` |
| `POST /api/v1/sign-out` | `SignOutAction` | session | — → `{}` |
| `GET /api/v1/me` | `CurrentUserAction` | session | — → `{account: {id, name, email}, organizations: [{code, name, is_admin}], policy_current: bool}` |
| `GET /api/v1/sign-ins` | `ListSignInsAction` | session | — → `[{id, provider, email, added_at, added_country}]` + `offer: [providers]` |
| `POST /api/v1/sign-ins/{provider}/link/finish` | `LinkSignInAction` | session | as `FinishSignInAction` → `{linked}` or `409 taken` |
| `POST /api/v1/sign-ins/email` | `LinkEmailAction` | session | `{email, password, code?}` → `{sent}` / `{linked}` / `409 taken` |
| `DELETE /api/v1/sign-ins/{id}` | `UnlinkSignInAction` | session | — → `{}` or `409 last` |

## Organizations

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `GET /api/v1/organizations/code-check?code=` | `CheckAddressCodeAction` | session | → `{state: free|taken|not_allowed, bad_chars?, suggestions?}` |
| `POST /api/v1/organizations` | `RegisterOrganizationAction` | session | `{name, code}` → `{code}` or `409 taken` or `409 limit` |
| `GET /api/v1/organizations/{code}` | `OpenOrganizationAction` | session | → `{code, name, user: {name, is_admin}}` or `404` (no active user, or no such code) |

## The core's identity

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `GET /api/v1/core/passport` | `CorePassportAction` | open | → the passport `maxitor-core.yaml` as JSON |

## Gateways (connections, per call)

| Key | Gateway | Methods |
|---|---|---|
| `core` | `CoreStorage` | storage of the schemas `platform` and `organization` |
| `geoip` | `GeoIpGateway` | `country_of(ip) -> str | None` |
| `mail` | `MailGateway` → `YandexCloudPostboxGateway` / `OutboxMailGateway` | `send_email_confirmation`, `send_password_reset`, `send_password_changed` |
| `google`, `github`, `facebook`, `yandex`, `mailru` | `<Provider>SignInGateway` | `authorize_url(state, challenge, redirect_uri)`, `person(code, verifier, redirect_uri)` |
