# Quickstart: checking Maxitor core end to end

## The local stand

```bash
./scripts/core-stand.sh up
```

It starts PostgreSQL 16 in Docker on port 55432, creates the role `maxitor_core` and its schemas once as the administrator, runs the core's migrations as `maxitor_core`, then the core's backend on `127.0.0.1:8020` and the Next.js application on `http://localhost:3000`. Letters go to `.core-stand/outbox/` as `.eml` files. `./scripts/core-stand.sh down` stops it; `reset` also drops the database.

## Scenarios

1. **Sign up by email** — open `http://localhost:3000`, accept the cookie banner, "Create one", an email and a 10-character password; open the newest file in `.core-stand/outbox/`, enter its code, tick the consent box, "Create account"; register "Severny Veter". Expect `/w/severny-veter`, the empty frame, your initials in the icon.
2. **Sign in and out** — sign out from the icon's menu; sign in with the same email and password; a wrong password says "Wrong email or password".
3. **Reset the password** — "Forgot password?", the code from the outbox and a new password; the old password is refused, the new one works, and the outbox has the "password changed" letter.
4. **Someone else's organization** — open `/w/orbita`: "No such organization", no organization in the header.
5. **Without a session** — in a private window open `/w/severny-veter`: the sign-in page names the address; after signing in you land there.
6. **Region** — the stand counts `127.0.0.1` as unknown, so as Russia: only email and password, Yandex ID and Mail.ru ID are offered. With `MAXITOR_GEOIP_DATABASE` set and `X-Forwarded-For: 84.141.7.213` sent through the frontend, all six are offered.
7. **Limits** — eleven wrong passwords in a row: the eleventh is refused until the time named; an eleventh organization is refused with the limit named.

## Checks of the code

```bash
uv run --extra dev pytest packages/maxitor/maxitor-core
uv run --extra dev pytest packages/maxitor-plugin-sdk
npm --prefix packages/maxitor/maxitor-core/web run build
```

The browser checks of the core run against the local stand: `node packages/maxitor/maxitor-core/web/scripts/check-core.mjs`.
