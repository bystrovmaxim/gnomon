# Maxitor core

Maxitor's own core: people sign in, register organizations and land in an organization's frame. It has its own PostgreSQL database, a backend of AOA actions and a Next.js application.

| Part | Where | What it does |
|---|---|---|
| The database | `maxitor/core/bootstrap.sql`, `maxitor/core/migrations/` | Two schemas owned by the role `maxitor_core`: `platform` (accounts, their ways in, one-time codes) and `organization` (organizations, their users, boundaries). Every table except the codes and the attempts keeps its history in a `*_versions` table; a password's hash never enters it. |
| The backend | `maxitor/core/` | Every address is an AOA action declared by the `FastApiAdapter` chain. Mail, the country of an IP and each sign-in provider are typed gateways, passed to each call. Every step writes a typed event. |
| The application | `web/` | The pages of the [mockup](../../../specs/072-maxitor-core/mockup/index.html), for desktop and phone. Its server keeps the session in the HttpOnly cookie `__Host-maxitor_session`; the page's scripts never see a token. |

## Signing in

- **By email and password.** The email is the login, confirmed by a six-digit code. A code lives ten minutes and five wrong tries, and one address gets one letter a minute and ten an hour. After ten wrong passwords in fifteen minutes the address is locked for the rest of the window. A wrong password and an unknown address get the same answer.
- **With Yandex ID or Mail.ru ID** — from anywhere.
- **With Google, GitHub or Facebook** — only from outside Russia. The country comes from the request's IP; an unknown IP counts as Russia. The rule is checked when signing in starts and again when the provider sends the person back, also for an account that already has the provider.

A new person ticks the consent box before the account exists. A session lasts eight hours and is renewed while the person is active, up to 30 days after signing in; changing the password stops older sessions from renewing. An account registers at most ten organizations.

The addresses and their answers are in [contracts/actions.md](../../../specs/072-maxitor-core/contracts/actions.md).

## The core's passport

`maxitor/core/maxitor-core.yaml` names the formats of a plugin's files the core reads and the major version of `maxitor-plugin-sdk` it is built with. `GET /api/v1/core/passport` answers it with the version of the `maxitor` package. `maxitor plugin check <path> --core <version>` (`pip install "maxitor[plugins]"`) checks a plugin against it.

## Running it

`pip install "maxitor[core]"` brings the backend: `maxitor-core migrate` brings the database up to date as `maxitor_core`, `maxitor-core serve` runs the backend. On this repository's checkout `./scripts/core-stand.sh up` runs everything at once: [Run Maxitor core locally](../../../docs/how-to/run-the-core-locally.md).

| Variable | What it is |
|---|---|
| `MAXITOR_SESSION_SECRET` | The key the sessions are signed with. Required. |
| `MAXITOR_CORE_DSN` | The database, connected to as `maxitor_core`. |
| `MAXITOR_PUBLIC_URL` | The address people open; providers send them back to `<it>/api/v1/sign-in/<provider>/callback`. |
| `MAXITOR_GEOIP_DATABASE` | A country database in the MaxMind format (`.mmdb`): GeoLite2 Country or DB-IP Lite. Without it every address counts as Russia. |
| `MAXITOR_POSTBOX_KEY_FILE` or `MAXITOR_POSTBOX_KEY_ID` and `MAXITOR_POSTBOX_SECRET` | The Yandex Cloud Postbox key the letters are sent with. |
| `MAXITOR_MAIL_OUTBOX` | A folder the letters are written to as `.eml` files instead of being sent. |
| `MAXITOR_MAIL_FROM` | The sender, `Maxitor <no-reply@maxitor.aoa.run>` by default. |
| `MAXITOR_<PROVIDER>_CLIENT_ID`, `MAXITOR_<PROVIDER>_CLIENT_SECRET` | Each provider's application: `GOOGLE`, `GITHUB`, `FACEBOOK`, `YANDEX`, `MAILRU`. A provider without them is not offered. |
| `MAXITOR_POLICY_VERSION` | The version of the privacy policy a person accepts; raising it asks everyone again. |
| `MAXITOR_CORE_API` | For the application: the backend's inner address, `http://127.0.0.1:8020` by default. |
