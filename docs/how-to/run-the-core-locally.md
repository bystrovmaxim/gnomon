# Run Maxitor core locally

Maxitor's core ([its README](../../packages/maxitor/maxitor-core/README.md)) on your machine: its database, its backend and its application, with letters written to a folder instead of being sent. You need Docker, Node.js 22 or later, `uv` and this repository's checkout.

## Start it

```bash
./scripts/core-stand.sh up
```

The first time it starts PostgreSQL 16 in Docker on `127.0.0.1:55432`, creates the role `maxitor_core` and its schemas as the administrator, and runs the migrations as `maxitor_core`. Then it starts the backend on `127.0.0.1:8020` and the application on `http://localhost:3000`, both in the foreground; Ctrl+C stops them, and the database keeps running.

Open `http://localhost:3000`. A letter with a code is a file in `.core-stand/outbox/`; its subject begins with the code.

To send the letters for real, through Yandex Cloud Postbox from `no-reply@maxitor.aoa.run`, put the Postbox key at `.private/postbox/postbox-key.json` of the main checkout and start with `MAXITOR_STAND_MAIL=postbox ./scripts/core-stand.sh up`.

## What you can try

- **Create an account**: "Create one", an email and a password of at least 10 characters, the code from the newest letter, the consent box, then register an organization. You land in its empty frame at `/w/<code>`.
- **Sign out and in** from the icon's menu, with a wrong password and with the right one.
- **Reset the password** with "Forgot password?": the old password stops working, and a letter says it changed.
- **Someone else's organization**: `/w/orbita` answers "No such organization", like any address that does not exist.

Without a country database every address counts as Russia, so only email and password, Yandex ID and Mail.ru ID are offered. To see all six from a foreign address, give it a country database (DB-IP's IP to Country Lite or GeoLite2 Country, `.mmdb`): put it at `.private/geoip/country.mmdb` of the main checkout, which git never takes, or name it in `MAXITOR_GEOIP_DATABASE`. The providers' buttons sign in only with their applications' keys in `MAXITOR_<PROVIDER>_CLIENT_ID` and `MAXITOR_<PROVIDER>_CLIENT_SECRET`, and with `http://localhost:3000/api/v1/sign-in/<provider>/callback` allowed in each application.

## Check it in a browser

With the stand running:

```bash
node packages/maxitor/maxitor-core/web/scripts/check-core.mjs
```

It walks the scenarios above in Chromium and prints `OK` or `FAIL` for each.

## Stop it

```bash
./scripts/core-stand.sh down
```

`./scripts/core-stand.sh reset` removes the database and its letters; the next `up` starts from nothing.
