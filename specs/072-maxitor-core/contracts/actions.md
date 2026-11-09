# Contracts: the core's actions and their addresses

Every address is declared by the chain of `FastApiAdapter` in `maxitor/core/server.py`; every action belongs to the domain `platform` or `organization`. One `CoreAuthCoordinator` serves every address: it reads the cookie `__Host-maxitor_session` with AOA's `CookieCredentialExtractor` and `JwtAuthenticator`, gives a valid session the role `account`, and anything else a guest. "Open" means the action admits a guest (`GuestRole`); "session" means it needs `AccountRole`, and a guest is answered `401 {error: "unauthorized"}`. Bodies and answers are Pydantic models in the action's module; a password is a `SecretStr`. A refusal is `{error: <reason>, ...details}` with the status named in the table.

## Region and options

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `GET /api/v1/sign-in/options` | `SignInOptionsAction` | open | — → `{region: "russia"|"abroad", email: true, providers: [..]}` |
| — (child only) | `DetectRegionAction` | — | — → `{region, country}` |

## Email and password

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `POST /api/v1/sign-up` | `StartSignUpAction` | open | `{email, password}` → `{sent: true}` (always), `422 password_rule` naming the rule, `429 too_many_codes` with `until`, `503 mail_not_sent` |
| `POST /api/v1/sign-up/confirm` | `ConfirmEmailAction` | open | `{email, code}` → `{consent_token, name}` or `400 wrong` with `tries_left`, `400 used_up`, `400 expired` |
| `POST /api/v1/sign-in/password` | `SignInWithPasswordAction` | open | `{email, password}` → `{session_token, policy_current}` or `401 wrong` (alike for an unknown address), `429 too_many_passwords` with `until` |
| `POST /api/v1/password-reset` | `RequestPasswordResetAction` | open | `{email}` → `{sent: true}` (always) |
| `POST /api/v1/password-reset/confirm` | `ResetPasswordAction` | open | `{email, code, password}` → `{changed: true}` or a code refusal |

## Providers

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `POST /api/v1/sign-in/start` | `StartSignInAction` | open | `{provider}` → `{authorize_url, state, verifier}` or `403 region` |
| `POST /api/v1/sign-in/finish` | `FinishSignInAction` | open | `{provider, code, state, expected_state, verifier}` → `{session_token, policy_current}` for a known person, `{consent_token, name}` for a new one; or `403 region`, `401 state`, `401 provider`, `401 no_email` |

## Account and session

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `POST /api/v1/account` | `CreateAccountAction` | open | `{consent_token, name, accepted: true}` → `{session_token}`; `422 consent_required`, `401 expired`, `409 taken` |
| `POST /api/v1/session/renew` | `RenewSessionAction` | open | `{session_token}` → `{session_token}` or `401 expired`, `401 password_changed` |
| `POST /api/v1/session/accept-policy` | `AcceptPolicyAction` | session | `{accepted: true}` → `{policy_version}` |
| `POST /api/v1/sign-out` | `SignOutAction` | session | — → `{}` |
| `GET /api/v1/me` | `CurrentUserAction` | session | — → `{account_id, name, email, policy_current, organizations: [{code, name, is_admin}]}` |
| `GET /api/v1/sign-ins` | `ListSignInsAction` | session | — → `{sign_ins: [{id, provider, email, added_at, added_country}], offer: [providers]}` |
| `POST /api/v1/sign-ins/link` | `LinkSignInAction` | session | as `FinishSignInAction` → `{linked: true}` or `409 taken` |
| `POST /api/v1/sign-ins/email` | `LinkEmailAction` | session | `{email, password, code?}` → `{sent}` / `{linked}` / `409 taken` |
| `POST /api/v1/sign-ins/unlink` | `UnlinkSignInAction` | session | `{sign_in_id}` → `{linked: false}` or `409 last` |

## Organizations

| Method and address | Action | Auth | Body → answer |
|---|---|---|---|
| `GET /api/v1/organizations/code-check?code=&name=` | `CheckAddressCodeAction` | session | → `{state: free|taken|not_allowed, bad_chars, suggestions}`; two free codes made from `name` for a taken one |
| `POST /api/v1/organizations` | `RegisterOrganizationAction` | session | `{name, code}` → `{code}`; `422 not_allowed` with `bad_chars`, `409 taken` with `suggestions` (and `moment: true` when another registration took it at the same time), `409 limit` with `limit: 10` |
| `GET /api/v1/organizations/{code}` | `OpenOrganizationAction` | session | → `{code, name, user: {name, is_admin}}` or `404 not_found`, alike for no active user and no such code: the action's access decision refuses both |

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
