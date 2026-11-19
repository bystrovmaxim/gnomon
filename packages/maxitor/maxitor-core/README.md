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

A new person ticks the consent box before the account exists. A session lasts eight hours and is renewed while the person is active, up to 30 days after signing in; changing the password stops older sessions from renewing. An account registers at most ten organizations. After signing in, Maxitor opens where the person stopped — the organization and the page the account had open last, at Now — unless an invitation waits for them.

The addresses and their answers are in [contracts/actions.md](../../../specs/072-maxitor-core/contracts/actions.md).

## Users and invitations

An organization is entered by an invitation only ([spec 086](../../../specs/086-sign-in-and-invitation/spec.md)):

- **An invitation** is an entity of its own in the schema `organization`, versioned under the organization's lock: the email, who sent it, whether it makes an administrator, and its state — Sent, then Accepted, Declined, Withdrawn or Expired. Its letter names the inviter and the organization and holds no link. One email gets at most one letter a minute and ten an hour; one inviter sends at most thirty invitations an hour, one organization a hundred a day; an invitation waits `MAXITOR_INVITATION_DAYS` days, 14 by default. An email that is an active or blocked user's, or has an invitation still sent, is refused.
- **Accepting.** The invited person signs in with the invited email — or creates an account with it — and sees the invitation on the screen of choosing an organization (`/w`), above the organizations; only an account whose confirmed email is the invitation's sees it. Accepting makes an active user named as the account, an administrator when the invitation says so. An organization and an account give one user, and a user is never removed.
- **Who may invite** is the organization's setting in Settings → Organization: **any user**, as at registration, or **administrators only**. An administrator invites from Settings → Users, with the mark "Organization administrator"; an ordinary user from the menu under their icon, without it. The server checks the setting and the mark on every invitation. Switching to administrators only withdraws, at that moment, every invitation still sent by an ordinary user.
- **Settings → Users** (`/w/<code>/core/settings/users`) lists the users and the invitations for the organization's administrators: a user is blocked, unblocked or made an administrator from their card, by the user's lifecycle — Active, Blocked —, and an invitation's letter is sent again or the invitation withdrawn. The organization always keeps at least one active administrator; two administrators acting at once are ordered by the organization's lock. A blocked user is a stranger from their next request: the organization's addresses and the gateway read the user's state every time, and the gateway's next token for a plugin carries the role as it is.

The declared lifecycle also contains the terminal `removed` state, with an edge from `blocked`, because AOA validates that a final state is reachable. No application action takes that edge, no removal route exists, and the user's card offers only blocking and unblocking. One organization and one account keep the same user and history for good.

The addresses are in [spec 086's contracts](../../../specs/086-sign-in-and-invitation/contracts/actions.md).

## Plugins

An organization's administrator finds them in Settings at the foot of the organization's tree → Plugins (`/w/<code>/core/settings/plugins`): the installed plugins and the marketplace, one search over both, the details of a plugin, installing, disabling and enabling, and adding a private plugin by a release's Package URL and `sha256` or by uploading its wheel. The page only asks; the installer checks versions and deploys them every minute. Nobody else sees Settings: its address answers 404.

A plugin carries no SQL: it declares its tables in `schema.yaml`, and the installer builds each version once — the schema `<name>_<x>_<y>_<z>`, the user `plg_<name>_<x>_<y>_<z>`, the tables with their version tables, the rights. The user sees nothing but its schema and reaches the core through five functions of the schema `organization`. Every line the domain writes is a typed event. The concept is in [plugins](../../../docs/plugins/concept.md); the addresses in [contracts/actions.md](../../../specs/073-plugin-marketplace/contracts/actions.md).

## The frame

Every page of an organization lives in one frame at `/w/<code>/...`, and only the core draws it ([the plugin concept, section 7](../../../docs/plugins/concept.md)):

- **The tree** on the left is the core's `maxitor/core/navigation.yaml` and the nodes of every plugin enabled in the organization. A version's nodes are read when the version is checked and kept in `plugins.plugin_node`; installing or enabling a plugin builds the organization's tree with it and refuses it with `navigation` when it would not hold. A list node's records load when its parent opens, from the plugin's own action through the gateway, at the panel's moment, in parts of 50.
- **The top row** holds the organization and its switch, the crumbs of the sections entered, the time scale's pill, the place of who is on the page, and the person's icon in their colour.
- **The time scale** is the pill on the right of the top row and the card hanging from it: one moment for the whole screen, written to the address as `at`, kept to the minute — to the second when the scale is zoomed below a minute —, never later than "now". The open page sets the scale up through its history — bars of its changes, points of its milestones with their cards, its legend —, and the card's switch offers what the page offers: One, Diff, Side by side. In a comparison the core lays out the panels, tells each page its context, relays Track between them and shows the page's counts on the pill ([the plugin concept, section 7.9](../../../docs/plugins/concept.md); [using it](../../../docs/how-to/use-the-time-scale.md)).
- **The right panel** is a grey field of dots. The core's own pages are drawn on it (`/w/<code>/core/...`); a plugin's page opens over it in a transparent frame at `/p/<name>/<code>/...` and talks to the core by the panel protocol of [`@maxitor/panel`](../../maxitor-panel/README.md). The window's address is the panel's only state: a reload, a link, Back and Forward give what was on screen.
- **The tree's head** has collapse, which folds the tree to one button for this visit, and Back, which steps out of the deepest section entered through the address and is gone at the root.

At the root, entry icons such as Notes and Settings align with the right edge of the collapse icon. Empty branch gutters are omitted only in root rows; actual expansion controls and the indentation inside entered sections keep their space. The phone drawer uses the same icon column. The standalone root states in specs 072 and 085 follow this alignment. Entering the first root section keeps its icon and title at the same coordinates as they become the level heading; Back restores the same row. The tree controls reserve their height even when the phone root has no Back button, and the entered heading keeps the phone row's font size.
- **Nothing over the panel.** A page's controls are its own: it gives them to the shell of [`@maxitor/panel`](../../maxitor-panel/README.md), which draws them in the same places for every plugin. The frame refuses a page's change of the core's names (`at`, `mode`, `from`, `_…`) and of a path parameter, and marks a page that does not render the shell with a red strip on the local stand.
- **"Now"**: the frame asks `GET /api/v1/organizations/{code}/watermark` every 5 seconds, draws it on the scale, and tells a page without a moment when it moved. A plugin's change moves it too.

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
| `MAXITOR_INVITATION_DAYS` | How many days an invitation waits to be accepted before it expires; 14 by default. |
| `MAXITOR_WHEEL_STORE` | The directory of plugin wheels, kept by `sha256`; shared with the installer. |
| `MAXITOR_WHEEL_MAX_BYTES` | The largest wheel an administrator may upload, 50 MB by default. |
| `MAXITOR_SCHEMA_PLATFORM`, `MAXITOR_SCHEMA_ORGANIZATION`, `MAXITOR_SCHEMA_PLUGINS` | The schemas' names when they are not the logical ones. |
| `MAXITOR_CORE_API` | For the application: the backend's inner address, `http://127.0.0.1:8020` by default. |
