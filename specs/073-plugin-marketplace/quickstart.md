# Quickstart: checking the marketplace end to end

## The local stand

```bash
./scripts/core-stand.sh up
```

It starts PostgreSQL 16 in Docker, runs the extended `bootstrap.sql` (roles `maxitor_core`, `maxitor_installer`, group `maxitor_plugin`, schemas `platform`, `organization`, `plugins`), the core's migrations, the core's backend, the installer `maxitor-plugin-installer run`, and the Next.js application on `http://localhost:3000`. It fills the marketplace with the plugin template's wheel, built by `uv build packages/maxitor-plugin-template`, as a `listed` plugin with an `active`-to-be version in `draft`.

## Scenarios

1. **Install** — sign up, register "Severny Veter", open Settings at the foot of the tree → Plugins → Marketplace; Notes says it fits; Install. The row shows `installing`, then `enabled` within a minute; the tree shows Notes' sections. In `psql` as the administrator: the schema `notes_0_4_0` and the role `plg_notes_0_4_0` exist.
2. **Deployed once** — register a second organization, install Notes there: no new schema or role; the installer's events say the deploy was skipped.
3. **Isolation** — `psql` as `plg_notes_0_4_0` with the password from its `plugin.env`: `SELECT 1 FROM organization.organization` and `CREATE TABLE x (a int)` are refused; `SELECT organization.watermark('<org id>')` answers. As `maxitor_core`: `CREATE SCHEMA x` and `CREATE ROLE x` are refused.
4. **Disable and enable** — disable Notes: its sections leave the tree; enable it: they come back.
5. **A private plugin** — Add a private plugin → Upload a wheel → the template's wheel renamed by its `name` to collide: `rejected`, the `name` taken. A purl `pkg:pypi/…`: refused in the dialog.
6. **A crash** — install in a third organization and stop the installer while the row is `installing`; start it again: the row reaches `enabled` within a minute.
7. **A non-administrator** — no Settings link; `/w/severny-veter/settings/plugins` answers 404.
8. **Phone** — the browser at 375 × 812: every screen of the page without a horizontal scrollbar.

## Checks of the code

```bash
uv run --extra dev pytest packages/maxitor/maxitor-core packages/maxitor/tools/plugin-installer packages/maxitor-plugin-sdk packages/maxitor-plugin-template
uv run python scripts/check_package_boundaries.py
npm --prefix packages/maxitor/maxitor-core/web run build
node packages/maxitor/maxitor-core/web/scripts/check-core.mjs
```
