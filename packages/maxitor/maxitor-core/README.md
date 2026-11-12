# Maxitor core

Maxitor's own core: people sign in, register organizations and land in an organization's frame, an organization's administrator installs plugins into it, and every plugin's pages open in that frame. It has its own PostgreSQL database, a backend of AOA actions, a plugin installer and a Next.js application.

| Part | Where | What it does |
|---|---|---|
| The database | `maxitor/core/bootstrap.sql`, `maxitor/core/migrations/` | Three schemas owned by the role `maxitor_core`: `platform` (accounts, their ways in, one-time codes), `organization` (organizations, their users, boundaries) and `plugins` (the marketplace and the plugins of each organization). Every table except the codes and the attempts keeps its history in a `*_versions` table; a password's hash never enters it. Each deployed plugin version has a schema and a database user of its own. |
| The backend | `maxitor/core/` | Every address is an AOA action declared by the `FastApiAdapter` chain. Mail, the country of an IP and each sign-in provider are typed gateways, passed to each call. Every step writes a typed event. |
| The plugins | `maxitor/core/plugins/` | The domain `plugins`: its actions, storage and typed events. The installer [`maxitor-plugin-installer`](../tools/plugin-installer/README.md) runs its checking and deploying actions in a process of its own; the runner [`maxitor-plugin-runner`](../tools/plugin-runner/README.md) keeps every enabled version running in Docker containers of its own. The gateway's decision (`POST /api/v1/gateway/pass`), the exchange for a dependency, the service token and the JWKS (`GET /api/v1/jwks`) are actions too; plugin tokens are signed with the Ed25519 key `MAXITOR_GATEWAY_KEY_FILE`. |
| The application | `web/` | The pages of the mockups [072](../../../specs/072-maxitor-core/mockup/index.html) and [073](../../../specs/073-plugin-marketplace/mockup/index.html), for desktop and phone. Its server keeps the session in the HttpOnly cookie `__Host-maxitor_session`; the page's scripts never see a token. Its `proxy.ts` is the gateway: `/p/<name>/**` goes to a plugin's container once the core's action lets it pass, with a plugin token in place of the core's cookies. |

## Signing in

- **By email and password.** The email is the login, confirmed by a six-digit code. A code lives ten minutes and five wrong tries, and one address gets one letter a minute and ten an hour. After ten wrong passwords in fifteen minutes the address is locked for the rest of the window. A wrong password and an unknown address get the same answer.
- **With Yandex ID or Mail.ru ID** — from anywhere.
- **With Google, GitHub or Facebook** — only from outside Russia. The country comes from the request's IP; an unknown IP counts as Russia. The rule is checked when signing in starts and again when the provider sends the person back, also for an account that already has the provider.

A new person ticks the consent box before the account exists. A session lasts eight hours and is renewed while the person is active, up to 30 days after signing in; changing the password stops older sessions from renewing. An account registers at most ten organizations.

The addresses and their answers are in [contracts/actions.md](../../../specs/072-maxitor-core/contracts/actions.md).

## Plugins

An organization's administrator finds them in Settings at the foot of the organization's tree → Plugins (`/w/<code>/core/settings/plugins`): the installed plugins and the marketplace, one search over both, the details of a plugin, installing, disabling and enabling, and adding a private plugin by a release's Package URL and `sha256` or by uploading its wheel. The page only asks; the installer checks versions and deploys them every minute. Nobody else sees Settings: its address answers 404.

A plugin carries no SQL: it declares its tables in `schema.yaml`, and the installer builds each version once — the schema `<name>_<x>_<y>_<z>`, the user `plg_<name>_<x>_<y>_<z>`, the tables with their version tables, the rights. The user sees nothing but its schema and reaches the core through five functions of the schema `organization`. Every line the domain writes is a typed event. The concept is in [plugins](../../../docs/plugins/concept.md); the addresses in [contracts/actions.md](../../../specs/073-plugin-marketplace/contracts/actions.md).

## The frame

Every page of an organization lives in one frame at `/w/<code>/...`, and only the core draws it ([the plugin concept, section 7](../../../docs/plugins/concept.md)):

- **The tree** on the left is the core's `maxitor/core/navigation.yaml` and the nodes of every plugin enabled in the organization. A version's nodes are read when the version is checked and kept in `plugins.plugin_node`; installing or enabling a plugin builds the organization's tree with it and refuses it with `navigation` when it would not hold. A list node's records load when its parent opens, from the plugin's own action through the gateway, at the panel's moment, in parts of 50.
- **The top row** holds the organization and its switch, the path to the open node, and the person's icon; the places of the time scale and of who is on the page stand there empty until those steps come.
- **The right panel** is a grey field of dots. The core's own pages are drawn on it (`/w/<code>/core/...`); a plugin's page opens over it in a transparent frame at `/p/<name>/<code>/...` and talks to the core by the panel protocol of [`@maxitor/panel`](../../maxitor-panel/README.md). The window's address is the panel's only state: a reload, a link, Back and Forward give what was on screen.
- **The tree's head** has collapse, which folds the tree to its head for this visit, and up, which opens the nearest node above the open one that has a page, at the same moment.
- **Nothing over the panel.** A page's controls are its own: it gives them to the shell of [`@maxitor/panel`](../../maxitor-panel/README.md), which draws them in the same places for every plugin. The frame refuses a page's change of the core's names (`at`, `mode`, `from`, `_…`) and of a path parameter, and marks a page that does not render the shell with a red strip on the local stand.
- **"Now"**: the frame asks `GET /api/v1/organizations/{code}/watermark` every 5 seconds while a page without a moment is open, and tells the page when it moved. A plugin's change moves it too.

Everything the frame draws takes its colours and sizes from [`@maxitor/tokens`](../../maxitor-tokens/README.md); `web/scripts/check-tokens.mjs` refuses a colour code or a size number in the frame and `@maxitor/panel`.

## The core's passport

`maxitor/core/maxitor-core.yaml` names the formats of a plugin's files the core reads (passport 3, `schema.yaml` 1, navigation 2, foreign keys 1) and the major version of `maxitor-plugin-sdk` it is built with. `GET /api/v1/core/passport` answers it with the version of the `maxitor` package. `maxitor plugin check <path> --core <version>` (`pip install "maxitor[plugins]"`) checks a plugin against it.

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
| `MAXITOR_WHEEL_STORE` | The directory of plugin wheels, kept by `sha256`; shared with the installer. |
| `MAXITOR_WHEEL_MAX_BYTES` | The largest wheel an administrator may upload, 50 MB by default. |
| `MAXITOR_SCHEMA_PLATFORM`, `MAXITOR_SCHEMA_ORGANIZATION`, `MAXITOR_SCHEMA_PLUGINS` | The schemas' names when they are not the logical ones. |
| `MAXITOR_CORE_API` | For the application: the backend's inner address, `http://127.0.0.1:8020` by default. |
