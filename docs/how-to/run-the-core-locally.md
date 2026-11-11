# Run Maxitor core locally

Maxitor's core ([its README](../../packages/maxitor/maxitor-core/README.md)) on your machine: its database, its backend, its plugin installer, its plugin runner and its application with the gateway, with letters written to a folder instead of being sent. You need Docker, Node.js 22 or later, `uv` and this repository's checkout.

## Start it

```bash
./scripts/core-stand.sh up
```

The first time it starts PostgreSQL 16 in Docker on `127.0.0.1:55432`, creates the roles `maxitor_core` and `maxitor_installer` and the core's schemas as the administrator, runs the migrations as `maxitor_core`, builds the plugin template's frontend with npm and fills the marketplace with the template's wheel, which carries it. The gateway's Ed25519 key is made once in `.core-stand/gateway-key.pem`, and the wheels a plugin needs that PyPI does not have yet — AOA's and `maxitor-plugin-sdk` — are built once into `.core-stand/find-links/`. Then it starts the backend on `127.0.0.1:8020`, the plugin installer, the plugin runner and the application on `http://localhost:3000`, in the foreground; Ctrl+C stops them, and the database keeps running. Plugin wheels are kept in `.core-stand/wheels/`, each deployed version's environment file in `.core-stand/plugins/`. Each enabled plugin version runs in Docker containers of its own (`docker ps --filter label=maxitor.plugin.version`); they reach the database as `maxitor-db` on their version's network and the gateway as `host.docker.internal`.

Only one `next dev` runs in one folder: a second stand needs the first one's application stopped.

A second stand beside a first one: `MAXITOR_STAND_CONTAINER=maxitor-plugins-pg MAXITOR_STAND_DB_PORT=55433 MAXITOR_STAND_API_PORT=8021 MAXITOR_STAND_WEB_PORT=3001 ./scripts/core-stand.sh up`. Its plugin runner takes the container's name (`MAXITOR_RUNNER_NAME`): its containers are named `maxitor-<name>-<schema>-<kind>` and carry the label `maxitor.plugin.runner=<name>`, and each runner starts and removes only its own, so the two stands never stop each other's plugins. `reset` removes only its own stand's containers too.

Open `http://localhost:3000`. A letter with a code is a file in `.core-stand/outbox/`; its subject begins with the code.

To send the letters for real, through Yandex Cloud Postbox from `no-reply@maxitor.aoa.run`, put the Postbox key at `.private/postbox/postbox-key.json` of the main checkout and start with `MAXITOR_STAND_MAIL=postbox ./scripts/core-stand.sh up`.

## What you can try

- **Create an account**: "Create one", an email and a password of at least 10 characters, the code from the newest letter, the consent box, then register an organization. You land in its empty frame at `/w/<code>`.
- **Sign out and in** from the icon's menu, with a wrong password and with the right one.
- **Reset the password** with "Forgot password?": the old password stops working, and a letter says it changed.
- **Someone else's organization**: `/w/orbita` answers "No such organization", like any address that does not exist.
- **Install a plugin**: Settings at the foot of the tree → Plugins → Marketplace → Notes → Install. Within seconds it is enabled and Notes is in the tree; in `psql` the schema `notes_0_9_0` and the user `plg_notes_0_9_0` exist once, however many organizations install it. The first time the runner builds its images, which takes a few minutes; then `docker ps` shows `maxitor-notes_0_9_0-backend` and `maxitor-notes_0_9_0-frontend`.
- **Open its page in the frame**: add an item (`POST /p/notes/api/<code>/items` with `{"title": "Payments"}`), open Notes in the tree, the item, and Notes under it. The template's page opens in the right panel at `/w/<code>/notes/items/<item_id>`, with the writer filter at the top left and the choice of a list or a table in the bottom bar, both drawn by the page's shell. Switch them and press Back: one change per press. In the tree's head, up opens Notes; collapse folds the tree. Open `/p/notes/<code>/items/<item_id>` by itself: you are sent to its panel address.
- **The panel's test page**: as an administrator, `/w/<code>/core/panel-test` lays the core's own test page in the panel as a plugin's page is laid, a canvas at `/w/<code>/core/panel-test/canvas`, a drawing in the shell — layers with counts, filters, a layout choice and a button after the zoom, an action — at `/w/<code>/core/panel-test/drawing`, and a page without the shell under its red strip at `/w/<code>/core/panel-test/unframed`.
- **Call it through the gateway**: signed in, open `http://localhost:3000/p/notes/api/<code>/items/00000000-0000-4000-8000-000000000001/notes` — the template answers `{"notes":[],"bars":[]}`. Signed out the answer is `401`, with another organization's code `404`. `docker kill maxitor-notes_0_9_0-backend` — within a round the runner starts it again; disable Notes — its container goes, and the address answers `404`.
- **Disable and enable** it, and **add a private plugin** by a release's Package URL or by uploading a wheel.

Without a country database every address counts as Russia, so only email and password, Yandex ID and Mail.ru ID are offered. To see all six from a foreign address, give it a country database (DB-IP's IP to Country Lite or GeoLite2 Country, `.mmdb`): put it at `.private/geoip/country.mmdb` of the main checkout, which git never takes, or name it in `MAXITOR_GEOIP_DATABASE`. The providers' buttons sign in only with their applications' keys in `MAXITOR_<PROVIDER>_CLIENT_ID` and `MAXITOR_<PROVIDER>_CLIENT_SECRET`, and with `http://localhost:3000/api/v1/sign-in/<provider>/callback` allowed in each application.

## Check it in a browser

With the stand running:

```bash
node packages/maxitor/maxitor-core/web/scripts/check-core.mjs
```

It walks the scenarios above in Chromium and prints `OK` or `FAIL` for each. `MAXITOR_STAND_URL` points it at a second stand. With a version deployed, the isolation of its database user is checked by

```bash
MAXITOR_STAND_DSN=postgresql://maxitor_core:core-local@127.0.0.1:55432/maxitor MAXITOR_STAND_PLUGIN_ENV=.core-stand/plugins/notes_0_4_0/plugin.env uv run --extra dev pytest packages/maxitor/tools/plugin-installer/tests/test_stand.py
```

## Stop it

```bash
./scripts/core-stand.sh down
```

`./scripts/core-stand.sh reset` removes the database, its letters, its wheels and its environment files; the next `up` starts from nothing.
