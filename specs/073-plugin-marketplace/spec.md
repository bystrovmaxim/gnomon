# Feature Specification: Maxitor core — the marketplace, and installing, disabling and enabling a plugin in an organization

**Feature Branch**: `feature/issue-82-plugin-marketplace`

**Created**: 2026-11-10

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#82, "Maxitor core: the marketplace, and installing, disabling and enabling a plugin in an organization". The issue's body is the source of truth; the screens are drawn, for a desktop and a phone, in [`mockup/index.html`](mockup/index.html). Removing a plugin from an organization is bystrovmaxim/gnomon#94.

## What this is

An organization's administrator opens the organization's settings, finds a plugin in Maxitor's marketplace or adds a private one of their own, and installs it; its sections appear in the organization's tree for everyone there. Later the administrator disables it — its sections leave the tree, its data stays — and enables it again.

Under that, the core gets a domain of its own for plugins. Every version of a plugin lives in a database schema of its own with a database user of its own that sees nothing but that schema. A plugin no longer carries SQL or migrations: it declares its tables, and the core builds them by the rules of versioned storage. Building schemas, users and rights is done by a separate database role that the rest of the core never uses.

Words used below:

- **Plugin** — a package that adds a part to Maxitor: its passport `maxitor-plugin.yaml`, its tables, its pages.
- **Marketplace** — the plugins Maxitor offers and their versions, whatever organization looks at them.
- **Version** — one release `x.y.z` of a plugin, with its wheel and its passport.
- **Private plugin** — a plugin that belongs to one organization, added by its administrator from a release on GitHub or GitLab or by uploading its wheel; no other organization sees it.
- **Package URL (purl)** — the name of a wheel's source that names its ecosystem: `pkg:pypi/…`, `pkg:github/…`, `pkg:gitlab/…`, and `pkg:generic/…` for an uploaded wheel.
- **Wheel store** — where Maxitor keeps every wheel it has checked, by its `sha256`; installing reads only from there.
- **`schema.yaml`** — the file in which a plugin declares its tables.
- **Deploying a version** — building in the database, once for all of Maxitor, the version's schema, its database user, its tables and their rights.
- **Installing** — taking a version into one organization.
- **Installer** — a process of its own, `maxitor-plugin-installer`, that checks versions and deploys them, working as the database role `maxitor_installer`; the only holder of that role's password.
- **Settings** — the organization's section for administrators; "Plugins" is its first item.

## Clarifications

### Session 2026-11-10

Decided with the maintainer while the issue and the mockup were written.

- Q: Is the manager of plugins a plugin itself, installed in advance? → A: No. A plugin's user sees only its own schema, while the installer builds schemas, roles and rights; a plugin's version is a new schema with no migrations, while the marketplace and the installs must outlive every version; and the core reads which plugins are enabled to build the tree and route requests. Plugins are a domain of the core instead, `plugins`, with its own schema, its own package `maxitor.core.plugins` and its own storage.
- Q: Which database role builds schemas and users? → A: A role of its own, `maxitor_installer`, with `CREATEROLE` and `CREATE` on the database, used only by deploying a version (and, in bystrovmaxim/gnomon#94, by deleting an organization's rows). `maxitor_core` keeps `NOCREATEROLE` and no `CREATE` on the database.
- Q: Under what lock are the marketplace's tables versioned, since they belong to no organization and no account? → A: Under the plugin's lock: a plugin and all its versions change one at a time; different plugins never wait for each other.
- Q: Is removing a plugin part of this work? → A: No. Removing — in batches, in the background, resumed after a crash — is bystrovmaxim/gnomon#94. The states `removing` and `removed` are in the entity from the start; this work reaches `removed` only from a failed install, which wrote nothing of the organization.
- Q: Where is the page of plugins? → A: In the organization's section "Settings", reached by a quiet link at the foot of its tree; "Plugins" is its first item, at `/w/<code>/settings/plugins`. The header reads "<organization> / Settings" and the organization's name leads back.
- Q: Can plugins be searched? → A: Yes, by one field above both tabs, Installed and Marketplace, through the title, the name, the passport's `id` and the description; each tab counts its matches.
- Q: Who makes the password of a version's database user, and where does it go? → A: The installer generates it when it deploys the version and writes it only into the environment file of that version's process, readable by that process alone, as the plugin concept (section 5.1) says; it is never stored in a table, a log or an event. Starting the process with it is bystrovmaxim/gnomon#75.
- Q: Can a plugin be disabled while an enabled plugin depends on it? → A: No. The core refuses and names every enabled plugin that depends on it, as the plugin concept (section 10) says.
- Q: Where do checking a version and installing run, so that a crash half-way leaves nothing stuck? → A: In a process of its own, `maxitor-plugin-installer` — a package beside `repo-graph-port` under `packages/maxitor/tools/`. The core's web process only writes `draft` or `installing` and answers at once; the installer takes up every such row when it starts and every minute, and finishes it. It runs the `plugins` domain's actions in its own process, with no hand-written route, and it alone holds the password of `maxitor_installer`. Removing (bystrovmaxim/gnomon#94) runs in it too.
- Q: How is a private plugin added when its repository is closed? → A: Two ways in one dialog: the purl of a release that downloads without signing in (GitHub or GitLab), or uploading the `.whl` file — which serves a closed repository, a CI artifact or any other source. Maxitor needs the source only once: after the check it keeps the wheel in its wheel store by its `sha256`, so no access token is ever stored. An uploaded wheel gets the purl `pkg:generic/<name>@<version>?checksum=sha256:<hash>`, its hash computed by Maxitor and shown to the administrator.
- Q: How large may a plugin's wheel be, and how long may its download take? → A: At most 50 MB, downloaded within 60 seconds; both are settings of the server. A larger wheel is refused with the reason; a download that runs out of time leaves the version in `draft` with the reason, and the installer tries again later.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An administrator installs a plugin from the marketplace (Priority: P1)

An administrator opens Settings → Plugins, finds a plugin in the marketplace, sees that it fits, installs it, and everyone in the organization sees its sections in the tree.

**Why this priority**: Without installing, an organization stays empty; it is the reason the marketplace exists.

**Independent Test**: In an organization with Notes installed, the administrator installs Tasks 0.4.1, which needs Notes and is deployed nowhere yet: the version's schema, user and tables appear, the row goes `installing` → `enabled`, and the tree shows Tasks' sections; a second organization installing Tasks 0.4.1 deploys nothing again.

**Acceptance Scenarios** (mockup 1.1–1.3, 1.5, 2.1–2.5):

1. **Given** an administrator, **When** they open Settings → Plugins, **Then** the Installed tab lists every plugin of the organization not `removed`, with its version, state, source and who installed it when; the Marketplace tab lists the active versions of listed plugins the organization does not have.
2. **Given** a card of the marketplace, **Then** it says whether the version fits this core and whether each of its dependencies is installed in this organization; a version outside the core's range cannot be installed.
3. **Given** a plugin's details, **Then** they show its passport (`id`, `name`, core range, dependencies, owner), its wheel (purl and `sha256`), the tables of its `schema.yaml`, its schema and database user, and whether the version is already deployed — naming no other organization.
4. **Given** a version not yet deployed, **When** the administrator installs it, **Then** the installer builds its schema `<name>_<x>_<y>_<z>`, its user `plg_<name>_<x>_<y>_<z>`, its tables with their version tables, and its rights, in one transaction; the row goes `installing` → `enabled`.
5. **Given** a version already deployed for another organization, **When** it is installed, **Then** nothing is built in the database and only the organization's row is written.
6. **Given** an installed plugin, **Then** its sections are in the organization's tree for everyone in it.

---

### User Story 2 - An administrator is stopped by a missing dependency or a failed install (Priority: P1)

An administrator tries a plugin that needs another one first, or an install that fails half-way, and is told exactly what to do.

**Why this priority**: A wrong install must never leave an organization half-built; the core must say what is missing.

**Independent Test**: In an organization without Tasks, installing Timesheets is refused with Tasks named and an offer to install Tasks first; a deploy cut off by a database error leaves no schema, no user and no table, and the row in `failed` can be retried or dropped.

**Acceptance Scenarios** (mockup 2.3, 2.6):

1. **Given** a plugin whose dependency is not installed in the organization, **When** the administrator installs it, **Then** it is refused, the dependency is named, and the page offers to install the dependency first; nothing is installed in passing.
2. **Given** a deploy that fails, **Then** the database holds nothing of it, the row is `failed` with the reason, and nothing of the organization changed.
3. **Given** a row in `failed`, **When** the administrator retries, **Then** it goes back to `installing`; **When** they drop it, **Then** it becomes `removed` and stays in the history.

---

### User Story 3 - An administrator disables and enables a plugin (Priority: P1)

An administrator takes a plugin out of the organization's tree for a while without losing anything, and brings it back.

**Why this priority**: Turning a part off without destroying its data is the safe everyday choice.

**Independent Test**: Disabling Tasks removes its sections from the tree and keeps every row; enabling it brings them back as they were; disabling Notes while Tasks is enabled is refused with Tasks named.

**Acceptance Scenarios** (mockup 3.1–3.4):

1. **Given** an enabled plugin no enabled plugin depends on, **When** the administrator disables it after the dialog, **Then** it is `disabled`, its sections leave the tree for everyone, and its data stays.
2. **Given** an enabled plugin that an enabled plugin depends on, **When** the administrator disables it, **Then** it is refused and every such plugin is named.
3. **Given** a disabled plugin, **When** the administrator enables it, **Then** it is `enabled` and its sections come back with all their data.

---

### User Story 4 - An administrator adds a private plugin (Priority: P2)

An administrator gives the address of their own wheel on GitHub or GitLab and its hash; Maxitor checks it, and once it passes it can be installed like any other — by this organization only.

**Why this priority**: An organization's own parts must be installable without publishing them; the marketplace's checks must still hold.

**Independent Test**: A purl `pkg:github/…?file=….whl` with the right `sha256` creates a plugin owned by the organization and its version in `draft`, which the check turns `active`; an uploaded `.whl` does the same with its hash computed by Maxitor; another organization sees nothing of it; a wrong hash or a taken `id` turns it `rejected` with the reason.

**Acceptance Scenarios** (mockup 5.1–5.8):

1. **Given** the dialog, **When** the purl is `pkg:pypi/…`, **Then** it is refused: PyPI is the public marketplace's source.
2. **Given** a GitHub or GitLab purl without `?file=`, **Then** it is refused: the wheel must be named.
3. **Given** a `sha256` that is not 64 hexadecimal characters, **Then** it is refused and the field says what it got.
4. **Given** a valid purl and hash, **When** the administrator adds it, **Then** a plugin owned by the organization and its version in `draft` appear, and the check starts.
4a. **Given** the dialog's file choice, **When** the administrator uploads a `.whl`, **Then** Maxitor computes its `sha256`, shows it, keeps the file in the wheel store, and the version goes `draft` with the purl `pkg:generic/<name>@<version>?checksum=sha256:<hash>`; a file that is not a wheel is refused at once.
4b. **Given** a release purl whose download needs signing in, **Then** the version is `rejected` with the reason and the page suggests uploading the wheel.
5. **Given** the check, **When** the wheel's hash, passport, `schema.yaml` and core range all hold, **Then** the version is `active`; **When** one fails, **Then** it is `rejected` with the reason, naming the hash it got or the `id` that is taken.
6. **Given** a private plugin, **Then** no other organization sees it in the marketplace, in the details or in the search.

---

### User Story 5 - An administrator searches plugins (Priority: P2)

An administrator types part of a name or a word of the description and sees only what matches, on both tabs.

**Why this priority**: A marketplace grows; finding a plugin by a word is the first thing an administrator does.

**Independent Test**: "note" on the Installed tab shows Notes and Tasks (whose description says "notes"), and the Marketplace tab counts 0; "crm" shows "No plugin matches" with a way to clear.

**Acceptance Scenarios** (mockup 1.6–1.8):

1. **Given** a query, **Then** each tab shows only the plugins whose title, `name`, `id` or description contains it, case aside, and marks what matched.
2. **Given** a query, **Then** both tabs count their matches, so a match on the other tab is seen without switching.
3. **Given** no match, **Then** the page says so, names the query and offers to clear it.

---

### User Story 6 - A plugin's database user sees only its own schema (Priority: P1)

Whatever a plugin does in the database, it reaches only its own version's schema, and what it needs of the core it gets through the core's functions.

**Why this priority**: Isolation is the promise that lets an organization install other people's code.

**Independent Test**: Connected as `plg_notes_1_2_0`, a query to another schema, to `public` or to a table of the core is refused, and `CREATE TABLE` is refused; calling the core's functions for the change time, the watermark and membership works. Connected as `maxitor_core`, `CREATE SCHEMA` and `CREATE ROLE` are refused.

**Acceptance Scenarios**:

1. **Given** a version's user, **Then** it has `USAGE` on its schema, `SELECT`, `INSERT`, `UPDATE`, `DELETE` on its tables and `EXECUTE` on the core's functions, and nothing else.
2. **Given** a plugin, **When** it needs the change time under the organization's lock, the watermark or a membership check, **Then** it calls a `SECURITY DEFINER` function of the schema `organization` and sees none of the core's tables.
3. **Given** `maxitor_core`, **Then** it can create no schema and no role.

---

### User Story 7 - A plugin author declares tables instead of writing SQL (Priority: P2)

The author of a plugin writes `schema.yaml`; the core builds the tables with their version tables, and the plugin template shows how.

**Why this priority**: Versioned storage holds by construction only if no plugin writes its own DDL.

**Independent Test**: The plugin template, with `migrations/0001_note.sql` replaced by `schema.yaml`, deploys as `notes_<version>` with the user `plg_notes_<version>`; its tables pass the versioned-storage check; a `schema.yaml` with an unsafe name or an unknown type is refused before any SQL is built.

**Acceptance Scenarios**:

1. **Given** a `schema.yaml`, **Then** it declares tables, columns with a type from the closed list, null or not and a description each, the primary key, unique keys, indexes, keys inside the plugin and tables of mechanics.
2. **Given** a declared table, **Then** the installer adds its version table, the service fields, the overlap constraint, the reading indexes and an index that starts with the organization; a table of mechanics gets none of the version machinery.
3. **Given** a name that breaks the pattern or a type outside the list, **Then** the file is refused and no SQL is built.

### Edge Cases

- Two administrators of one organization install the same plugin at once: the database lets one row through; the other is told the plugin is already being installed.
- Two organizations install the same version, not yet deployed, at once: the version is deployed once; the second install waits for it and then skips deploying.
- A plugin is withdrawn from the marketplace while installed: it keeps working; the row says so; no organization can install it anew.
- A version is withdrawn while an organization runs it: it keeps working there; the marketplace no longer offers it.
- An organization opens the details of a private plugin of another organization by its address: the answer is the same as for a plugin that does not exist.
- A user who is not an administrator sees no "Settings" link, and `/w/<code>/settings/plugins` answers 404, the same as a page that does not exist.
- A plugin's `name` collides with a name already in the marketplace, or its `id` does: the version is `rejected`, because the schema's name is built from the `name` and the `id` is unique across Maxitor.
- The wheel cannot be downloaded (the release is gone, the network fails, 60 seconds pass): the version stays `draft` with the reason and is checked again later.
- The wheel is larger than 50 MB: the download stops at the limit, the upload is refused at once, and the version is `rejected` with the reason.
- The installer or the database stops in the middle of a deploy: the transaction is rolled back, the row stays `installing`, and the installer deploys it again when it is back; the page shows the row as installing meanwhile.
- The installer is not running: rows wait in `draft` or `installing`; nothing is lost, and they are finished once it starts.
- A dependency is disabled, not removed: it still counts as installed for installing a plugin that needs it.

## Requirements *(mandatory)*

### Functional Requirements

**The `plugins` domain**

- **FR-001**: The core MUST keep plugins in a domain of its own, `plugins`, with a database schema of the same name beside `platform` and `organization`, a package of its own `maxitor.core.plugins`, its own storage and its own actions; the rest of the core MUST reach it only through those actions, and the project's package-boundary check MUST hold it.
- **FR-002**: The domain MUST keep three entities: a plugin of the marketplace (`id` from its passport, `name`, title, description, owner — none for a public plugin, an organization for a private one); a version of a plugin (`x.y.z`, its purl, the wheel's `sha256`, the core range and the dependencies from its passport, and its schema and database user once deployed); and a plugin in one organization (which version, its state, who installed it).
- **FR-003**: All three MUST be versioned: the plugin and its versions under the plugin's lock, a plugin in an organization under the organization's lock.
- **FR-004**: The marketplace MUST be filled straight in the database in this work; no screen edits it.
- **FR-005**: Every line the `plugins` domain writes — in the core's web process and in the installer alike — MUST be a typed event of the domain's closed list, declared by the method that writes it; any other line, free text included, MUST be refused when written, as for the core's other domains.
- **FR-005a**: The list MUST cover at least:
  - info — a version added to the marketplace, a private plugin added (by purl or by upload), a version checked `active`, a version deployed, a deploy skipped as already done, a plugin installed, disabled, enabled, a failed install dropped, the installer started, a row taken up after a stop;
  - warning — a version `rejected` (with the reason: hash, passport, `schema.yaml`, core range, `id` or `name` taken, closed repository, too large), a download out of time, an install refused (core range, a missing dependency), a disable refused (the dependents), a purl or a hash refused by the dialog;
  - critical — a deploy failed, the database refused the installer's connection.
- **FR-005b**: Each event MUST carry what identifies its subject — the plugin's `id`, the version, the organization and the account when there is one, the purl and `sha256` — and MUST NOT carry a password, a database connection string or the content of a wheel.

**Lifecycles**

- **FR-006**: A plugin of the marketplace MUST be `listed` or `withdrawn`; a withdrawn plugin MUST NOT be installed anew, and installed ones MUST keep working.
- **FR-007**: A version MUST go `draft` → `active` or `rejected`, and `active` ⇄ `withdrawn`; only an `active` version of a `listed` plugin MUST be installed.
- **FR-008**: A plugin in an organization MUST go `installing` → `enabled` ⇄ `disabled`, `installing` → `failed` → `installing` (retry) or `removed` (dropped); the states `removing` and `removed` MUST exist for bystrovmaxim/gnomon#94.
- **FR-009**: An organization MUST have at most one row not `removed` per plugin, kept by the database.

**Checking a version**

- **FR-009a**: Checking a version and installing MUST run in the process `maxitor-plugin-installer`, not in the request: the core's action MUST only write `draft` or `installing` and answer at once; the installer MUST take up every `draft` and `installing` row when it starts and every minute, and MUST finish it, so that a crash of either process leaves no row stuck; two installer processes MUST never work on the same row.
- **FR-010**: Checking a version MUST download its wheel, compare its `sha256`, read and check its passport and `schema.yaml`, and check it against the core's range; all holding makes it `active`, any failing makes it `rejected` with the reason; a wheel that cannot be downloaded leaves it `draft` with the reason.
- **FR-010a**: A wheel MUST be at most 50 MB and its download MUST finish within 60 seconds, both settings of the server; a larger wheel — downloaded or uploaded — MUST be refused with the reason, and a download out of time MUST leave the version in `draft` with the reason, to be tried again.
- **FR-011**: A plugin's `id` MUST be unique across the marketplace, private plugins included, and so MUST its `name`.

**Sources**

- **FR-012**: A version's source MUST be a Package URL; the public marketplace MUST install from `pkg:pypi` only; a private plugin MUST come from `pkg:github` or `pkg:gitlab` with `?file=` naming the wheel, or from an uploaded wheel named `pkg:generic/<name>@<version>?checksum=sha256:<hash>`.
- **FR-013**: An administrator MUST be able to add a private plugin by a release's purl and `sha256`, or by uploading its `.whl` file, whose `sha256` Maxitor computes and shows; it MUST belong to their organization, and no other organization MUST see it anywhere.
- **FR-013a**: Maxitor MUST keep every wheel that passed or awaits its check in a wheel store, by its `sha256`, and MUST install only from there; it MUST NOT store an access token to any source.

**Installing, disabling, enabling**

- **FR-014**: Installing MUST check that the version fits the core's range and that every dependency is installed (enabled or disabled) in the organization; otherwise it MUST be refused, naming what is missing.
- **FR-015**: Installing a version not yet deployed MUST deploy it once for all of Maxitor — its schema `<name>_<x>_<y>_<z>`, its user `plg_<name>_<x>_<y>_<z>`, its tables and their rights — in one transaction; a version already deployed MUST NOT be deployed again.
- **FR-016**: A failed deploy MUST leave nothing in the database and nothing of the organization changed; the row MUST be `failed` with the reason.
- **FR-017**: Disabling MUST keep the data and take the plugin's sections out of the organization's tree; it MUST be refused while an enabled plugin depends on it, naming every such plugin.
- **FR-018**: Enabling MUST bring the plugin's sections back with all their data.

**`schema.yaml` and the tables**

- **FR-019**: A plugin MUST carry no SQL and no migrations; it MUST declare its tables in `schema.yaml`: tables; columns with a type from the closed list `uuid`, `text`, `integer`, `bigint`, `numeric`, `boolean`, `date`, `timestamptz`, `jsonb`, null or not, a description each; the primary key, unique keys, indexes, keys inside the plugin; tables of mechanics.
- **FR-020**: The installer MUST build the tables from `schema.yaml` and add, by the rules of versioned storage, each table's version table, the service fields, the overlap constraint, the reading indexes, and in every table, version tables included, an index that starts with the organization.
- **FR-021**: Every name MUST pass a pattern and enter SQL only as a quoted identifier; a name that breaks the pattern or a type outside the list MUST refuse the file before any SQL is built.
- **FR-022**: Keys to other plugins MUST stay in `foreign-keys.yaml` and MUST be built by the installer.

**Database roles and isolation**

- **FR-023**: Building schemas, users, tables and rights MUST be done only by the role `maxitor_installer`, whose password only the process `maxitor-plugin-installer` holds; the core's web process MUST NOT know it, and `maxitor_core` MUST be able to create neither a schema nor a role.
- **FR-024**: `maxitor_installer` MUST own every version's schema and tables; a version's user MUST get `USAGE` on its schema, `SELECT`, `INSERT`, `UPDATE`, `DELETE` on its tables and `EXECUTE` on the core's functions, and nothing else — no DDL, no other schema, nothing in `public`.
- **FR-025**: The core MUST give a plugin the change time under the organization's lock, the watermark and the membership check through `SECURITY DEFINER` functions of the schema `organization`; a plugin MUST see none of the core's tables.
- **FR-026**: The password of a version's user MUST be generated by the installer and written only into the environment file of that version's process, readable by it alone; it MUST NOT reach a table, a log, an event or an error.

**Security of the installer and the wheels**

- **FR-026a**: The schema `plugins` MUST be owned by `maxitor_core`; `maxitor_installer` MUST get only `USAGE` on it and `SELECT`, `INSERT`, `UPDATE` on its tables, to move rows through their states.
- **FR-026b**: The three functions MUST run as their owner with a fixed `search_path`; `EXECUTE` on them MUST be granted only to the group of versions' users. `is_member` MUST answer false for a blocked or removed user and for an organization that does not exist; `change_time` and `watermark` MUST refuse an organization that does not exist.
- **FR-026c**: The plain password of a version's user MUST NOT reach the database server: the installer MUST send only its SCRAM verifier.
- **FR-026d**: A release purl MUST resolve only to `https://` addresses of `pypi.org`, `files.pythonhosted.org`, `github.com`, `objects.githubusercontent.com` and `gitlab.com`; a redirect to any other host MUST stop the download with the reason.
- **FR-026e**: The check MUST only read a wheel as a zip archive — its passport, `schema.yaml`, `navigation.yaml` and `.dist-info` — and MUST NOT import or run anything in it; an archive that is not a wheel, holds a path outside its root, or would expand beyond 200 MB MUST be `rejected` with the reason.
- **FR-026f**: A wheel in the store MUST be written once under its `sha256` and never replaced.
- **FR-026g**: A private plugin's `name` and passport `id` MUST be unique across the whole marketplace like any other's; another organization whose plugin collides MUST be told only that the `name` or `id` is taken, not by whom.
- **FR-026h**: Every action of the page MUST let through only an active user of the organization with the administrator flag, and MUST answer anyone else 404 over the API as on the page.

**The page**

- **FR-027**: The organization MUST have a section "Settings", reached by a link at the foot of its tree and shown only to its administrators; "Plugins" MUST be its first item, at `/w/<code>/settings/plugins`; for anyone else that address MUST answer 404, the same as a page that does not exist.
- **FR-028**: In Settings the tree MUST give way to the settings' own column, drawn like the tree; the header MUST read "<organization> / Settings", and the organization's name MUST lead back to it.
- **FR-029**: The page MUST have two tabs — Installed (every row not `removed`, then the removed ones under "Removed") and Marketplace (active versions of listed plugins the organization does not have, its private plugins first) — and the details of a plugin as a side panel, a whole screen on a phone.
- **FR-030**: One search field MUST serve both tabs, matching title, `name`, `id` and description case aside, marking the match, and counting matches on each tab; the marketplace MUST be searched by the core's action, not in the browser.
- **FR-031**: Every screen of the mockup's 1.1–3.4 and 5.1–7.2 MUST work on a screen 375 px wide and wider with no horizontal scrolling: rows as cards, dialogs as sheets from the bottom, the tree and the settings' column as a drawer.

**The plugin template**

- **FR-032**: The plugin template MUST replace `migrations/0001_note.sql` by `schema.yaml`, take the change time, the watermark and membership from the core's functions, have its `foreign-keys.yaml` built by the installer, and deploy as `notes_<version>` with the user `plg_notes_<version>`.

**Documentation**

- **FR-033**: The plugin concept (`docs/plugins.md`), the storage document and the template's documentation MUST describe what this work builds: the `plugins` domain, the role `maxitor_installer`, a schema and a user per version, `schema.yaml` instead of migrations, a version's user that reads only its own schema, the page in Settings.

### Key Entities *(include if feature involves data)*

- **Plugin** (`PluginCoreEntity`, domain `plugins`): a plugin of the marketplace — its passport's reverse-domain `id`, kept as `passport_id`, `name`, title, description, owner (none or an organization), state `listed` or `withdrawn`. Has one or more versions, each with its dependencies (`PluginDependencyCoreEntity`) and the top level of its navigation (`PluginSectionCoreEntity`).
- **Plugin version** (`PluginVersionCoreEntity`, domain `plugins`): one release — `x.y.z`, purl, `sha256`, core range, dependencies, state `draft`, `active`, `rejected` or `withdrawn`, the reason of a rejection, and once deployed its schema and database user. Belongs to one plugin.
- **Plugin in an organization** (`OrganizationPluginCoreEntity`, domain `plugins`): which version an organization runs, its state, the reason of a failure, who installed it and when. At most one not `removed` per organization and plugin.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator installs a plugin from the marketplace, from opening Settings to seeing its sections in the tree, in under 1 minute on the stand.
- **SC-002**: A version is deployed exactly once however many organizations install it, checked by a test that installs it in two organizations and counts the schemas and users.
- **SC-003**: 0 schemas, users or tables remain after a deploy cut off on purpose, checked by a test that breaks the deploy at each of its steps; and a row left in `installing` by a stopped installer reaches `enabled` within 1 minute of the installer starting again, checked by a test that stops it in the middle.
- **SC-004**: A version's user reaches 0 objects outside its schema and the core's functions, and `maxitor_core` creates 0 schemas or roles, checked by tests that try each and are refused.
- **SC-005**: 100% of the tables built from a `schema.yaml` pass the versioned-storage check and carry the index by organization, checked by a test over the template and over a file with every type.
- **SC-006**: 0 unsafe names or unknown types reach SQL, checked by tests with a quote, a dot, a space, a semicolon and an unknown type.
- **SC-007**: A private plugin of one organization appears 0 times in another organization's marketplace, details or search, checked by a test.
- **SC-008**: No password of a version's user appears in any table, log line, event or response, checked by a test that deploys a version and searches every output for it.
- **SC-008a**: 100% of the lines the `plugins` domain writes, in the web process and in the installer, are typed events of its list; a line written outside the list fails, checked by a test that breaks one on purpose.
- **SC-009**: The page's screens match the mockup's 1.1–3.4 and 5.1–7.2 and show no horizontal scrollbar at 375 × 812, checked screen by screen in the browser.
- **SC-010**: On the stand a plugin installed in two organizations and disabled in one keeps working in the other, checked by hand on the stand.

## Assumptions

- Removing a plugin from an organization is bystrovmaxim/gnomon#94; the mockup's screens 4.1–4.5 belong to it.
- Starting a plugin's processes, passing the environment file to them and routing requests through the gateway are bystrovmaxim/gnomon#75; this work writes the environment file and the tree of an organization reads which plugins are enabled.
- Moving an organization to another version of a plugin it runs is not decided here.
- Versions do not come from PyPI by themselves in this work; the marketplace's rows are entered straight in the database.
- Inside its own schema a plugin sees every organization on the same version; a plugin installed from the marketplace is trusted, as the plugin concept says.
- Every screen is in English, like the core's other screens.
- PostgreSQL 16 or newer, as the core of bystrovmaxim/gnomon#73.
