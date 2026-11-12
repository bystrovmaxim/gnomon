# Maxitor plugins: passport, database, site, and how to write your own

What a Maxitor plugin is, what it is made of, how it is installed, where its data lies, how it becomes part of one site with the core, and the rules it is written by. This is about **Maxitor** plugins — independent applications on top of the Maxitor core — not about extensions of the AOA framework.

The document is a concept. The commands `maxitor plugin ...` and the packages `maxitor-plugin-sdk` and `@maxitor/panel` are described as they will work; they do not exist yet. Versioned storage, on which a plugin's data stands, is described in [versioned-storage](versioned-storage.md) and not repeated here.

In short: a plugin is a Python package (pip or a ready wheel) that carries a passport, its own AOA backend and the sources of its own Next.js frontend, which the core builds with its own `@maxitor/panel`. The core's installer installs it: reads the passport, checks the dependencies and that there is no cycle, and deploys each version once — a schema and a database user of its own, the tables the plugin declares in `schema.yaml` built by the core, the keys to the core from a declaration in a file — then the plugin joins the site. A plugin carries no SQL and no migrations. A person sees one site with one sign-in: the core's gateway accepts the session and passes each plugin a short signed token meant for it alone. The frame of the screen — the tree on the left, the row at the top and the right panel — belongs to the core: a plugin adds its nodes to the tree by a YAML declaration and gets the right panel when its node is open. Everything a person sees is written in the address, so Back, a link and a room work the same for every plugin.

## Vocabulary

| Word | Meaning |
|---|---|
| **core** | Maxitor without plugins: sign-in, users, organizations, the frame, rooms, the gateway, the installer, the plugin registry; its `id` is `maxitor`, its version is the version of the `maxitor` package; its data is the schemas `platform` and `organization` |
| **core passport** | the file `maxitor-core.yaml` in the `maxitor` package: the core's version and the formats of a plugin's files it reads |
| **core contract** | everything a plugin relies on in the core: tree nodes, the panel and room protocols, the shell and its controls, style tokens, the sign-in token, the core's functions for time, watermark and membership |
| **plugin** | a package that installs into the core and adds data, actions and pages |
| **passport** | the file `maxitor-plugin.yaml` in a plugin's package: who it is and what it needs |
| **installer** | the core's process `maxitor-plugin-installer`: it checks versions and deploys them; removing is bystrovmaxim/gnomon#94 |
| **installer role** | the database role `maxitor_installer`, whose password only the installer's process holds |
| **version user** | the database role `plg_<name>_<x>_<y>_<z>` of one deployed version, used by the plugin alone |
| **gateway** | the site's entrance: it takes every request and hands it to the core or a plugin |
| **frame** | what is always on screen: the navigation tree on the left, the core's row at the top, the right panel; only the core draws it |
| **tree** | the navigation tree on the left; built from the `navigation.yaml` files of the core and the plugins |
| **attachment node** | a node of the core's or a dependency's tree under which a plugin places its nodes |
| **list node** | a node that multiplies by records at run time: one instance per record of its source, such as one per item of the template `notes` |
| **tree builder** | the part of the installer that builds the tree and checks the attachments |
| **right panel** | the grey field with dots on the right; a plugin's page opens in it |
| **canvas** | `<MaxitorCanvas>`: one field for all of Maxitor with moving, zooming and a camera; a plugin puts only its content into it |
| **shell** | `PanelPage` of `@maxitor/panel`, the root of every page: it draws the page's controls from what the page gives it, in the same places for every plugin |
| **controls** | the filters, the layer pills, the bottom bar and the page's actions; a page gives them to the shell when it opens, and each is an address parameter |
| **reserved names** | the address parameters that belong to the core — `at`, `mode`, `from` and every name starting with `_`; a page may not change them |
| **organization** | the area inside which data lives and changes are ordered; a person may belong to several; it is the first segment of every panel address and is checked by membership on every request |
| **panel address** | the page's address in the browser's address bar: `/w/<organization>/<owner>/<path>?<parameters>`; the only source of the panel's state |
| **room** | looking together: several people see each other, one moment, and can follow each other |

## 1. What a plugin is

A plugin is an independent application with three parts:

- **backend** — an AOA service: actions and the resource of its database, guarded by the core's roles; runs in a Docker container of its own;
- **frontend** — a Next.js site with its own `basePath`, whose pages are shown in the frame's right panel; runs in a Docker container of its own;
- **database schema** — a PostgreSQL schema of its own per version in the core's shared database, built by the core from the plugin's `schema.yaml` by the rules of versioned storage; a plugin that keeps no state has none (section 5).

A plugin depends on the core and possibly on other plugins. The core and the plugins it depends on know nothing of it. A plugin does not import another plugin's code and never reads another schema: it calls the other plugin's actions through the gateway. So plugins are installed, upgraded and removed one by one.

Separate containers are not a convenience but a condition of isolation. If all plugins lived in one Python process — or as processes of one operating-system user — any of them would read the database passwords of all the others, from memory or from their files, and separate database roles would mean nothing. Each version runs in containers of its own, as an unprivileged user, with its own network and only its own environment file.

## 2. The passport

The passport is YAML, because a person reads it in review and the installer reads it before installing. The file `maxitor-plugin.yaml` lies at the root of the Python package and travels in the wheel. The installer finds it by the entry point `maxitor.plugins` in the wheel's `entry_points.txt` — without unpacking or installing the package.

```yaml
passport: 3                          # the format of the passport
id: io.github.acme.notes             # the global id, never changes
name: notes                          # the name in an installation: each version's schema and user, the path
title: Notes
description: >
  Notes on the plugin's own items: who wrote what, when, and what changed.
version: 1.2.0

requires:
  maxitor: ">=4.0,<5"                # the core versions it works with
  node: ">=22"

dependencies:
  - id: io.github.acme.tags
    version: ">=2.1,<3"
    source:
      pip: acme-maxitor-tags         # a package on PyPI or an inner index
  - id: io.github.acme.people
    version: ">=1.4,<2"
    source:
      wheel: https://github.com/acme/maxitor-people/releases/download/v1.4.0/acme_maxitor_people-1.4.0-py3-none-any.whl
      sha256: 3f5a0c...e91

backend:
  app: acme_notes.app:create_app     # the AOA application factory

frontend:
  source: acme_notes/web             # the frontend's sources with package.json and package-lock.json; the core builds them
  navigation: acme_notes/navigation.yaml   # the plugin's nodes in the tree (section 7)

database:
  schema: acme_notes/schema.yaml     # the plugin's tables; the core builds them
  foreign_keys: acme_notes/foreign-keys.yaml
```

| Field | Rule |
|---|---|
| `id` | reverse domain notation, `^[a-z0-9-]+(\.[a-z0-9-]+)+$`; the author's domain makes it unique; never changes in the plugin's life |
| `name` | `^[a-z][a-z0-9_]{1,30}$`, does not start with `pg_`, not on the reserved list (`core`, `public`, `information_schema`, `maxitor`, `api`, `p`, `w`, `auth`, `static`, `admin`, `root`); unique in an installation; it starts each version's schema `<name>_<x>_<y>_<z>` and user `plg_<name>_<x>_<y>_<z>` and is the path `/p/<name>`; does not change after the first release |
| `title`, `description` | for people: the page of plugins, the installation plan |
| `version` | strictly `x.y.z` (SemVer); equal to the version in the package's `pyproject.toml` |
| `requires.maxitor` | the range of core versions — an edge to the node `maxitor` of the dependency graph (section 3.1) |
| `dependencies` | the plugins this one cannot work without: `id`, a `version` range and a `source` — a pip package or a wheel at an address with a mandatory `sha256` |
| `frontend.source` | the folder of the frontend's sources in the wheel: `package.json`, `package-lock.json` and the pages, without `node_modules`, `.next` or a built site (section 4.1) |
| `frontend.navigation` | the file with the plugin's tree nodes, how each opens and their pages: the tree only (navigation format 4) |
| `history.compare` | optional: the comparisons its pages can draw beside one moment, out of `diff` and `side_by_side`; without it every page offers one moment only (section 7.9) |

Why both `id` and `name`. `id` is unique in the world and stands in other plugins' dependencies. `name` is short and fits a schema name; two authors may both call a plugin `notes`, and then only one of them gets into one installation — the installer refuses the second and names the conflict.

Version ranges are written as pip writes them (`>=2.1,<3`, `~=2.1`), and what "breaking" means is defined the same for the core and for plugins (section 3.4).

The passport is checked by a JSON schema (`plugin-passport-3.schema.json`; format 1, which carried `backend.migrate`, and format 2, which carried a built site in `frontend.build`, are refused by name): an unknown field is an error, YAML is read by a safe loader without tags, the size is limited.

## 3. The core, dependencies and compatibility

### 3.1. The core is a node of the graph too

The core is Maxitor without plugins. Its `id` is `maxitor`, its version is the version of the `maxitor` package. The core describes itself by the passport `maxitor-core.yaml` in its package:

```yaml
core: 1
id: maxitor
version: 4.0.0                       # equal to the version of the maxitor package
reads:                               # the formats of a plugin's files this core understands
  passport: [1]
  navigation: [1]
  foreign_keys: [1]
navigation: maxitor/web/navigation.yaml   # the core's tree (section 7.1)
```

For the compatibility check the core is **a node of the dependency graph** that is always installed and depends on nothing. `requires.maxitor` in a plugin's passport is an edge to that node, checked by the same code and by the same rules as an edge to another plugin. There is no separate "core check".

Today the Maxitor application is both the core and the graph viewer. When the graph viewer becomes a plugin, the core releases version 4.0.0: what people relied on leaves it, and that is a breaking change.

### 3.2. Dependencies live in the passport only

In `pyproject.toml` a plugin lists its Python libraries, never other plugins. Otherwise pip would install plugins itself, bypassing the installer's checks, and incompatible library versions of two plugins would break each other in one environment.

Every edge of the graph is **an identifier and a version range**, as a pip requirement is:

| Edge | Where it is written | Against which version |
|---|---|---|
| plugin → core | `requires.maxitor` | the core's version |
| plugin → plugin | `dependencies[].version` | the version of the installed or incoming plugin |
| plugin → Python SDK | `maxitor-plugin-sdk>=4.2,<5` in `pyproject.toml` | the SDK version in the plugin's environment |
| plugin → frontend SDK | `@maxitor/panel` in `package.json` | none: the core builds every frontend with its own copy, so the page reports the core's library in `panel.ready` whatever `package.json` names |
| plugin → Node | `requires.node` | the Node version on the server |

A range is read by the rules of PEP 440 by one library — `packaging.specifiers`, the one pip uses. Nothing parses ranges by hand.

**The SDKs move with the core.** `maxitor-plugin-sdk`, `@maxitor/panel` and `@maxitor/tokens` are released with the core's major version: SDK 4.x works with core 4.x. A plugin built with SDK 4.2 requires the core `>=4.2,<5`.

### 3.3. One compatibility check

The compatibility check is one function in `maxitor-plugin-sdk` (`maxitor_plugin_sdk.compat`). Everyone who needs to know "will it work here" calls it:

- `maxitor plugin check` — when a plugin is built, against the core version the developer names, and in the plugin's CI against the lowest and the highest bound of `requires.maxitor`;
- the installer — on installing, upgrading, enabling and removing a plugin;
- the core's upgrade — against every installed plugin;
- the page of plugins in administration — to show what is compatible with what.

The check runs in one order, and the first refusal stops it:

1. **formats** — the plugin's `passport`, `navigation`, `foreign_keys` are in the `reads` of the core passport;
2. **the core** — the core's version is in every plugin's `requires.maxitor` range;
3. **dependencies** — for each plugin in the installation there is a version that falls into every range pointing at it; there is one of each plugin;
4. **cycles** — the graph has none (section 3.5);
5. **SDK** — the major version of the SDK in a plugin's environment equals the core's;
6. **dependents** — on an upgrade or a removal no remaining plugin loses compatibility.

A refusal names every side of the conflict, not only the first:

```text
Cannot install reports 0.4.0:
  tags: notes 1.2.0 needs >=2.1,<3, reports 0.4.0 needs <2 — no version satisfies both
```

If everything holds, the check returns the plan: which versions are installed, in what order, what is upgraded.

### 3.4. What "breaking" means

The major version grows when anything others rely on changes incompatibly. For the core that is its **contract**:

| Part of the contract | Breaking (major) | Compatible (minor) |
|---|---|---|
| the core's tree nodes | a node removed or renamed, a list node's `key` changed | a new node |
| the panel and room protocols | a message removed, a field removed or its meaning changed | a new message, a new optional field |
| the shell | a part or a field of its input removed, a place moved | a new part, a new optional field, a new icon |
| style tokens and palette | a token or colour removed | a new token or colour |
| the sign-in token | a claim removed or its meaning changed | a new claim |
| the core's tables | a table or column removed, renamed, its type changed | a new table, a new column |
| formats of a plugin's files | a format gone from `reads` | a new format in `reads` |

For a plugin the same holds for its parts: the tables of its schema (other plugins read them all), the inputs and outputs of its actions, its roles, the tree nodes its dependents attach to.

Tables are in the contract because reading every schema is a rule (section 5.1): a removed column breaks someone else's query just as a removed message does. Readers read version tables, and a current table and its versions have the same columns, so one rule covers both.

### 3.5. Installation order and cycles

**Without its dependencies a plugin is not installed.** The installer builds the full closure: the plugin's dependencies, their dependencies and so on, together with the plugins already installed. If some dependency cannot be fetched, a `sha256` does not match or the check of 3.3 refuses — nothing is installed. If everything resolves, the installer shows the plan and installs the whole closure in dependency order as one operation.

**One version of each plugin in an installation.** For a pip source the highest version that falls into every range is taken — of the new plugins and of the installed ones that depend on it. For a wheel source the version is fixed by the file, and it must fall into the range.

**A dependency cycle is forbidden.** The graph "plugin → dependency" is checked on the union of the installed and the planned plugins; a cycle is named round: `a → b → c → a`. Depending on oneself is a cycle too.

The ban on cycles also gives the order in the database: a foreign key between schemas is allowed only towards a dependency (section 5), so the graph of keys is part of the dependency graph and has no cycles either.

## 4. Delivery

A plugin is published as a pip package (PyPI or an index of one's own) or as a ready wheel, for example attached to a release on GitHub. Inside the wheel:

```text
acme_notes/
    __init__.py
    maxitor-plugin.yaml
    app.py               # the AOA application factory
    schema.yaml          # the plugin's tables, built by the core
    foreign-keys.yaml    # cross-plugin foreign keys
    navigation.yaml      # tree nodes and their pages
    actions/ ...
    resources/ ...
    web/                 # the frontend's sources: package.json, package-lock.json, app/ — no node_modules, no .next
acme_maxitor_notes-1.2.0.dist-info/
    entry_points.txt     # [maxitor.plugins] notes = acme_notes
```

The wheel carries the frontend's sources, never a built site: the core builds them (section 4.1), so every page on the site is drawn by one `@maxitor/panel`, the core's.

### 4.1. The core builds every frontend

The installer builds a version's frontend before it deploys the version, outside any lock, in the builder image of the running core, `maxitor-plugin-builder:<core version>`. That image is built on the host from the `maxitor` package the first time it is needed: Node 22 pinned by digest and the core's own `@maxitor/panel` and `@maxitor/tokens` under `/maxitor/lib`. The steps, the first failure ending the build:

1. the lock exists and asks for exactly what `package.json` asks for;
2. every `@maxitor/*` entry of both is pointed at the core's copy; a name the core does not carry is refused;
3. every other package of the lock is on the core's npm list (`maxitor/core/plugins/builder/npm-packages.txt`, made from the template's lock by `scripts/make_npm_list.py`) and resolved from `https://registry.npmjs.org/`; another name or host is refused by name;
4. a container fetches the packages with `npm ci --ignore-scripts`: npm downloads only the lock's checked URLs, and no code of the plugin runs;
5. a container with no network, as user 65534, runs `npm ci --offline` and `next build` with only the core's variables;
6. the standalone server becomes the image `maxitor-plugin/<schema>-frontend:<sha12>-<core version>`.

A build is recorded in `plugins.plugin_build`, one per version and core version: `building`, then `built` with its image or `failed` with the first error of the failing step — TypeScript's `app/page.tsx(12,7): error TS2322: …`, npm's `npm error …`. A version without a built build is not deployed: the install fails with `the frontend could not be built for the core <version>: <error>`, and `FrontendBuildFailedEvent` names the plugin, its version and the error.

**Upgrading the core.** `plugins.frontend_generation` keeps the core version whose builds the site serves. After an upgrade the installer builds every enabled version for the new core, one at a time, while the old builds keep serving; once every one is built, the serving version moves to the new core in one transaction (`FrontendGenerationMovedEvent`) and the runner restarts each frontend on its new image. A failed build holds the move and is tried again an hour later; a version disabled everywhere stops holding it.

**The author builds the same way.** `maxitor plugin build <path> --core <version>` runs the installer's own step in the same image and prints the image or the same first error. `--core` must be the installed `maxitor`. The template's CI builds it with the checkout's core and with the newest release of the lowest minor its `requires.maxitor` allows.

Each plugin is installed into **its own virtual environment** — `<maxitor data>/plugins/<name>/<version>/venv`. Two versions of one library in two plugins do not get in each other's way. There is one Node on the server — the one the core declared; a plugin's `requires.node` must match it.

## 5. The database

**A plugin without a database.** The passport may have no `database` section: then the plugin has neither a schema nor a role, and the installer creates none. Such a plugin keeps its state where its resources go — an outside service, the process's memory — or keeps none. The graph viewer works this way: it reads graphs from their sources and their history, not from Maxitor's database.

### 5.1. Schemas and roles

All data is in one PostgreSQL database (16 or newer). The core is in three schemas named after its domains: `platform` (accounts and their ways in), `organization` (organizations, their users and boundaries) and `plugins` (the marketplace and the plugins of each organization). Each deployed version of a plugin is in a schema of its own, `<name>_<x>_<y>_<z>` — `notes_0_3_0` beside `notes_0_4_0` — so versions live side by side and a plugin has no migrations between them. `public` stays empty and closed to everyone. No SQL names a schema: a role's `search_path` finds what it may use.

| Role | Who uses it | What it can do |
|---|---|---|
| `maxitor_core` | the core's web process and its migrations | owns `platform`, `organization` and `plugins`, writes to them; cannot create a role or a schema |
| `maxitor_installer` | the installer's process only | `CREATEROLE` and `CREATE` on the database: creates each version's user and schema, owns the version's tables, moves the rows of `plugins` through their states |
| `maxitor_plugin` | nobody directly — a group | `EXECUTE` on the core's five functions (section 5.4); every version's user is its member |
| `plg_<name>_<x>_<y>_<z>` | the version's processes | `USAGE` on its schema, `SELECT, INSERT, UPDATE, DELETE` on its tables, membership of `maxitor_plugin` — nothing else: no DDL, no other schema, nothing in `public` |

A version is deployed once for all of Maxitor, in one transaction: the user (with a SCRAM verifier computed by the installer, so the plain password never reaches the database), the schema, the tables, the keys to the core, the rights. The plain password goes only into `<plugins runtime>/<schema>/plugin.env`, readable by its owner only; the version's process starts with it (bystrovmaxim/gnomon#75). The next organization on the same version builds nothing.

The core installs the database extensions (`btree_gist` for `EXCLUDE`) once; a plugin installs none.

### 5.2. A plugin declares its tables; the core builds them

A plugin carries no SQL. Its `schema.yaml` (`plugin-schema-1.schema.json`) declares tables and tables of mechanics: columns with a type from a closed list (`uuid`, `text`, `integer`, `bigint`, `numeric`, `boolean`, `date`, `timestamptz`, `jsonb`), `nullable` and a description each, the primary key, unique keys, indexes and keys inside the plugin:

```yaml
schema: 1
tables:
  item:
    description: What notes are written on, like a folder.
    columns:
      title: {type: text, nullable: false, description: The item's title, unique among the organization's items now.}
    unique:
      - [title]
  note:
    description: A note on an item.
    columns:
      item_id: {type: uuid, nullable: false, description: The item the note is about.}
      body: {type: text, nullable: false, description: The text of the note.}
    indexes:
      - [item_id]
    keys:
      - {columns: [item_id], table: item, references: [id]}   # a key inside the plugin
```

A unique key and a key inside the plugin are built with `organization_id` in front: `UNIQUE (organization_id, title)` and `FOREIGN KEY (organization_id, item_id) REFERENCES item (organization_id, id)`, so a note can point only at an item of its own organization. The key only guards: an action checks that the item exists before it writes.

The columns `id`, `organization_id`, `created_at` and `updated_at` are always added and never declared. Every table gets a primary key that begins with `organization_id` and, unless it is a table of mechanics, its `<table>_versions` with the service fields, the constraint that no two versions of a row overlap and the index of the versions in force — versioned storage holds by construction. A table's name matches `^[a-z][a-z0-9_]{0,39}$`, a column's `^[a-z][a-z0-9_]{0,47}$`; a name that does not, or a type outside the list, refuses the file before any SQL exists, and every name enters SQL only quoted as an identifier.

### 5.3. Keys to the core

A plugin **does not create** a key into the core's tables itself: it would need rights on them. The keys are declared in `foreign-keys.yaml`, and the installer creates them when it deploys the version:

```yaml
# acme_notes/foreign-keys.yaml
foreign_keys:
  - from: { table: note, columns: [organization_id, writer_id] }
    to:   { schema: core, table: user, columns: [organization_id, account_id] }
```

The file has no constraint name, no delete rule, no SQL — identifiers only, checked by a JSON schema; the source schema is always the plugin's own. A key may point at what the core offers to refer to: an organization's user (`core.user (organization_id, id)` or `(organization_id, account_id)`) and an organization (`core.organization (id)`). It is built `ON DELETE RESTRICT`, named `xfk_` and the first 16 characters of the declaration's hash. The database checks an existing key as the owner of the target table, so the version's user needs no right on it.

A key into a dependency's tables would tie one version's schema to another's, and how an organization moves between versions is not decided yet: such a key is refused for now.

### 5.4. What a plugin needs of the core

A plugin's backend works with the database through **its own resource**, connected as its version's user: one connection per call, writing and reading only its own schema. What it needs of the core it gets from five `SECURITY DEFINER` functions of the schema `organization`, each with a fixed `search_path`; `maxitor-plugin-sdk` builds the SQL that calls them (`maxitor_plugin_sdk.core_functions`):

| Function | Answer |
|---|---|
| `change_time(organization)` | takes the organization's lock — the same every writer of the organization takes — and answers the core's change time; the plugin takes the greatest of it and one microsecond after its own last change |
| `watermark(organization)` | the organization's last change in the core's tables; the plugin takes the greatest of it and its own |
| `is_member(organization, account)` | whether the account has an active user there now |
| `member_organization(code, account)` | the organization of an address when the account is active there; NULL otherwise |
| `member_name(organization, account, at)` | the account's user's name in the organization at a moment |

**A transaction does not cross schemas of different owners.** An action that needs to change both the core's data and the plugin's makes two changes with two times: its own through its resource, the core's through the core's action over HTTP. A dependency's data comes the same way, through its actions. The organization's lock is still one: advisory locks are shared by every role of one database.

### 5.5. The plugin registry

The core's domain `plugins` keeps the marketplace and the plugins of each organization: a plugin (`id` from its passport, `name`, title, owner — none for a public plugin, an organization for a private one), its versions (purl, `sha256`, core range, state, and once deployed its schema and user), their dependencies and navigation sections, and a plugin in an organization (its version, its state, who installed it). Every table is versioned: the marketplace's under the plugin's lock, an organization's rows under its lock. The installer's process is the only one that checks and deploys; the page Settings → Plugins of an organization's administrator only asks.

## 6. One site

### 6.1. Routes

The site is one origin. The core's gateway takes every request and hands it on by prefix:

| Path | Where |
|---|---|
| `/api/**` | the core's backend |
| `/p/<name>/api/<organization>/**` | a plugin's backend |
| `/p/<name>/<organization>/**` | a plugin's frontend (Next.js) — only inside the right panel |
| `/p/<name>/_next/**` | the scripts and styles of a plugin's page, for the organization of the page that asks for them (its `Referer`) |
| `/**`, including `/w/<organization>/**` | the core's frontend (Next.js): the frame and the core's pages |

The core's processes listen on `127.0.0.1`; each plugin version's backend and frontend run in Docker containers of their own, whose ports are published on `127.0.0.1` of the host only. From outside only the gateway is reachable.

**Running.** The core's process `maxitor-plugin-runner` keeps every deployed version that is enabled in at least one organization running. For each it builds the backend's image once, on `python:<x.y>-slim` with the wheel and its requirements, takes the frontend's image the installer built for the serving core version (section 4.1), and runs a container of each: as user 65534, with no capabilities, no new privileges, a read-only file system, limits of memory, CPU and processes, and a network of its own version. A container reaches the database at `MAXITOR_PLUGIN_DB_ADDRESS` and the gateway at `MAXITOR_PLUGIN_GATEWAY_URL`, as the containers see them; it gets nothing of the core's settings. A runner has a name, `MAXITOR_RUNNER_NAME` (`maxitor` by default): its containers carry the label `maxitor.plugin.runner=<name>`, and it starts, watches and removes only those, so two stands on one host never stop each other's plugins. The runner records each container's address in `plugins.plugin_process` for the gateway, starts again a container that exited after a pause that doubles up to five minutes, removes the containers of a version no organization runs, and on its own start removes every container of its name a stopped runner left.

Each plugin has its own Next.js application with its own `basePath`, its own Next.js version and its own build. The browser's address bar always holds a core address `/w/<organization>/...`; a plugin's page lives in the right panel (section 7). Today the core's frontend is built with Vite; moving it to Next.js is separate work that comes before the first plugin.

```ts
// web/next.config.ts of the plugin notes
export default {
  basePath: "/p/notes",
  output: "standalone",
};
```

### 6.2. One sign-in

1. A person signs in at the core. The core sets the session cookie `__Host-maxitor_session` — `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
2. A request to `/p/notes/<organization>/**` or `/p/notes/api/<organization>/**` comes to the gateway with that cookie. The gateway checks the session and the person's membership in the organization of the address (6.5), **removes** the core's cookie from the request and adds `Authorization: Bearer <token>`.
3. The token is a JWT signed with **the core's private key** (Ed25519, `EdDSA`) and lives 60 seconds:

```json
{
  "iss": "maxitor",
  "aud": "io.github.acme.notes",
  "sub": "user:7f3c…",
  "sid": "…",
  "org": "acme",
  "roles": ["member"],
  "iat": 1794211200,
  "exp": 1794211260
}
```

4. The plugin's backend checks the token with the standard `JwtAuthCoordinator` by the core's JWKS (`MAXITOR_CORE_JWKS_URL`, `/api/v1/jwks` through the gateway), with `EdDSA` as the algorithm and its own `id` in `aud`. It does not go to the database for the session. The core's own session token stays `HS256`: only the core checks it (constitution 1.7.0, rule 56).

The decision is the core's action `PassRequestAction` (`POST /api/v1/gateway/pass`); the gateway — the core's Next.js application, `proxy.ts` — asks it at the backend's inner address and refuses that address from outside the site.

What this gives:

- **a plugin cannot forge a token** — it has only the public key; that is why the signature is asymmetric and not a shared `HS256` secret;
- **a plugin cannot use someone else's token** — a token for `notes` does not pass `aud` in `tags`;
- **a plugin does not see the session** — the cookie never reaches it, and a person's sign-in cannot be stolen from a request;
- **the organization is the address's, checked** — `org` is the organization of the address the gateway has checked membership in;
- **the roles are the core's** — a plugin has no roles of its own: the token carries the person's role in the core in that organization, read from the core's tables when it is issued — `member` for every active user, `administrator` added for its administrators, `service` for a plugin's own call with no person. A plugin guards its actions with `MemberRole`, `AdministratorRole` and `ServiceRole` of `maxitor-plugin-sdk`; its passport declares no roles;
- **sign-out** — the core deletes the session; issued tokens expire within a minute.

The gateway lets changing requests through only with its own site's `Origin` header — protection against request forgery together with `SameSite=Lax`.

### 6.3. A plugin's frontend and its backend

- A Next.js **server component** takes the `authorization` header of the incoming request and goes with it to its own backend at the inner address from the environment (`MAXITOR_PLUGIN_API`), under the same route prefix as the gateway's: `${MAXITOR_PLUGIN_API}/p/<name>/api/<organization>/...`. The token is issued for this plugin; the backend accepts it.
- A **client component** calls `/p/notes/api/<organization>/...` by a relative path: the page in the panel is opened from the same origin, the browser sends the cookie, and the gateway replaces it with a token.

A plugin's frontend keeps and receives no secrets.

### 6.4. A plugin calls another plugin or the core

On a person's behalf: a plugin's backend calls `/p/<dependency>/api/<organization>/...` through the gateway (`MAXITOR_GATEWAY_URL`) and passes on its incoming token. The gateway exchanges it by `ExchangeTokenAction`: the caller is the token's `aud`, the callee must be a direct dependency of the caller's version enabled in that organization, and the new token keeps the person, session, organization and roles. Without a person (background work) a plugin presents its service key — `MAXITOR_PLUGIN_SERVICE_KEY`, written on deployment into its environment file only — to `POST /api/v1/gateway/service-token` and gets a token with `sub: "plugin:<id>"` and the role `service`. A plugin's calls to the core's own actions come with the first core action a plugin needs (bystrovmaxim/gnomon#95).

### 6.5. The organization in the address

A person may belong to several organizations, and a link to a colleague must open the same organization. So the organization is not a setting of the session but **the first segment of every address**: the panel's (`/w/acme/notes/items/4f1c`), a plugin's page in the panel (`/p/notes/acme/items/4f1c`) and a plugin's backend (`/p/notes/api/acme/items/4f1c/notes`). Its value is the organization's `code` — a short ASCII name, as rule 61 of the constitution requires of identifiers in addresses.

An address comes from the client, so it is checked, never trusted:

1. **The gateway checks membership.** The session gives the person's `id`; the core's membership table says which organizations that person belongs to. A request whose organization the person does not belong to is refused with `404` by the gateway and reaches neither the core's actions nor a plugin — it does not even reveal whether the organization exists.
2. **The token names it.** The token the gateway issues for the plugin carries `org` — the organization it has checked — and the person's roles in that organization only.
3. **The plugin checks again.** An action that reads or writes an organization's data takes the organization as a parameter of its path and checks membership in its `@access_decide` (6.6): it reads the core's membership table by the person's `id` from the token. The gateway is the guard, the action's decision a second lock — a call from another plugin, a bug in the gateway or a test without it never yields another organization's data.
4. **Every query is bound to it.** `organization_id` stands in every condition of every query, as versioned storage requires; its value is the checked organization, never a field of the request body.

The core's row has an organization switch: it goes to the same page of another organization, or to its root when that page does not exist there. The tree, the moment and the room belong to one organization: a room is a room of one organization, and its page key starts with it.

### 6.6. Who may call an action

An action of a plugin answers three questions in three places, in this order:

| Question | Where | What it answers with |
|---|---|---|
| Does the person hold a role that may do this? | `@check_roles` on the class | a refusal naming `check_roles` |
| May the person touch this organization and this object? | one `@access_decide` method | `Allowed()`, `Refused("REASON")` or `FORBIDDEN_OBJECT` |
| What does the action do? | aspects | the result |

`@access_decide` is AOA's step for the object a call is about. An action has at most one, it is never inherited, and the graph shows it beside the role check. It runs after `@check_roles` and before every aspect, so no aspect runs for a person who may not touch the object.

The step checks the organization first: the organization of the address must be one the person of the token belongs to. Then it checks the object's own rule, where there is one — "only the writer may edit the note", "a closed note is not changed". A stranger to the organization and a stranger to the object get `FORBIDDEN_OBJECT`: one answer for "there is no such thing" and "it is not yours", so the refusal does not tell whether someone else's organization or object exists. `Refused("REASON")` is for a rule whose reason the person may know, such as `NOTE_CLOSED`.

AOA turns a refusal into `AccessDenied`, which carries the verdict: the step that refused and the reason, when there is one. HTTP answers it with `403`. The same decision answers a question without a call: `check_access_decide` tells the page whether to show a button, and runs no aspect.

The step gets no state of the action, so an aspect that needs the organization's `id` looks it up again — one light query. If the membership ended between the decision and the aspect, the aspect refuses with the same `FORBIDDEN_OBJECT` and touches nothing.

### 6.7. What an action writes to the log

Every domain of Maxitor — the core's and every plugin's — lists the events its actions may write: `events = (...)` on its `BaseDomain`. That makes the domain a typed zone of AOA. A method that writes declares its events with `@emits(...)`, and writes only those, each as an instance of a `BaseEvent` subclass whose typed fields are the line's variables:

```python
class NoteAddedEvent(BaseEvent):
    note_id: str = Field(description="The note added")

@summary_aspect("Add the note")
@emits(NoteAddedEvent)
async def add_summary(self, params, state, box, connections):
    ...
    await box.info(Channel.business, "Note {%var.note_id} added", NoteAddedEvent(note_id=note_id))
```

A line with no event, with loose variables, or with an event the method does not declare is refused when it is written; an `@emits` outside the domain's list fails the build. A domain that writes nothing declares `events = ()`. `maxitor plugin check` refuses a plugin whose domain lists no events. No event carries a password, a code, a token or a secret, and an email only masked.

## 7. The frame: the tree and the right panel

The Maxitor screen is always one: on the left the navigation tree, at the top the core's row (organization, moment, the path to the open node, room, user), on the right the right panel, a grey field with dots. The frame belongs wholly to the core. A plugin is given one thing — the content of the right panel while its node is open. A plugin does not draw and cannot change the tree, the row or the panel's look. Into the tree it only **adds its nodes** by a YAML declaration, and the core builds the tree.

```text
┌────────────────┬──────────────────────────────────────────────┐
│ tree           │ core row: organization · moment · path · …   │
│  Notes         ├──────────────────────────────────────────────┤
│   ▾ Payments   │ ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  │
│      Notes   ◀ │ ·  ·   a plugin's page in the right panel ·  │
│      Draft     │ ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  │
│  Settings      │ ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  │
└────────────────┴──────────────────────────────────────────────┘
```

A node opens in one of two ways, and its author picks which in `navigation.yaml`. It either **expands** — its children appear under it in the same tree, as they always have — or it is **entered**, as one enters a folder: the left panel then holds only the children of that node, and the node itself stands at the top of the panel, across its whole width. An entered node carries "›" instead of the arrow and reads nothing of its children before the click.

The panel therefore shows one **level** at a time. The head of the tree has two buttons, collapse and the arrow; the arrow is **Back** — it returns the panel to the level it showed before the last entering, with what was expanded there still expanded, opens no page, and is off at the root. The row's **crumbs** are built from the entered levels and the open page only: the organization, each entered node down to the head of the panel, then the page — never a node that was merely passed by expanding. A click on a crumb steps the panel out to its level. An address names the page alone, so a reload or a shared link enters every entered node above it and lands where the person was; what was expanded in those levels lives in the page's memory and does not come back with the address.

### 7.1. The core's tree

The core's file `navigation.yaml` describes the structure of the core's tree. Every node with an `id` is an attachment node: plugins' nodes may stand under it. The core keeps no data of its own beyond organizations, people and plugins, so its tree is short: the organization's settings at the foot of the tree. Everything else in the tree comes from plugins, each in a section of its own or under a node of a plugin it depends on.

```yaml
navigation: 4
nodes:
  - id: settings
    title: Settings
    icon: settings
    order: 10000                       # at the foot of the tree
    roles: [administrator]
    opens: enter                       # entered: the panel holds Plugins only, Settings at its head
    children:
      - id: settings.plugins
        title: Plugins
        order: 100
        page: /settings/plugins
```

| Field | Rule |
|---|---|
| `id` | `^[a-z][a-z0-9_.-]{0,62}$`, unique within its owner at any depth; a node's full name is `<owner>:<id>`: `core:settings`, `notes:item` |
| `title` | text for an ordinary node; a list node's instances get their titles from `source` |
| `icon` | a name from the core's icon set; there are no pictures of one's own in the tree — the tree looks the same everywhere |
| `order` | the order among the children of one parent; the core steps by 100 so plugins have room to stand |
| `page` | the template of the page's path inside the owner; `{name}` is a parameter of the scope; a node without `page` only groups |
| `each` | makes the node a list: `source` is a reading action of the owner, `key` the name of the instance's parameter |
| `roles` | the owner's roles needed to see the node |
| `opens` | `expand` or `enter`, required on every node with children and refused on a node without: it says how the node opens (7) |
| `children` | children |

**The scope of parameters.** Each instance of a list node adds its key to the scope (`item_id`). Every descendant sees the parameters of all list nodes above it and puts them into `page` and into the parameters of its own lists. That is how contextual items come about: "Draft" under every item of the template knows its `item_id`.

The full names of the core's nodes are its contract with plugins: renaming or removing a node is a change of the core's major version, and the plugins' `requires.maxitor` catches it.

### 7.2. A plugin's nodes

A plugin describes its nodes in its own `navigation.yaml` and attaches each of its top nodes: to a node of the core, to a node of a direct dependency, or to the root of the tree.

```yaml
# acme_notes/navigation.yaml
navigation: 4
nodes:
  - id: notes
    attach: root                       # a section of its own in the root of the tree
    title: Notes
    icon: note
    order: 500
    page: /
    roles: [member]
    opens: enter                       # entered: the panel holds the items only, Notes at its head
    children:
      - id: item                       # a list node: one instance per item of the organization
        each:
          source: list_items           # a reading action of the node's owner
          key: item_id                 # the parameter each instance adds to the scope
        roles: [member]
        opens: expand                  # expands where it stands, inside the level of Notes
        children:
          - id: item-draft                 # the person's own changes over the published notes
            title: Draft
            icon: note
            order: 100
            page: /items/{item_id}
            roles: [member]
          - id: item-published             # everyone's notes of the revision in force, read only
            title: Published
            icon: note
            order: 110
            page: /items/{item_id}/published
            roles: [member]
```

A plugin may have several top nodes, each attached on its own: a section in the root, a page under the core's settings, pages under a dependency's nodes. A plugin `reviews` that depends on `notes` puts a page under every item of it: `attach: notes:item`, `page: /items/{item_id}/reviews`, and gets `item_id` from the list node it stands under. It may attach to any node of `notes` that has an `id`, at any depth — it knows them from its dependency's package — and those full names are part of `notes`' contract (section 3).

The rules of attachment:

- `attach` is `root` or a full node name `core:<id>` or `<name of a direct dependency>:<id>`. Attaching to a node of a plugin that is not a dependency is impossible: it may not be there.
- **A plugin only adds.** Hiding, renaming, moving or removing someone else's node, or putting anything into the core's row, is impossible — the file has no such fields.
- `order` works among the children of one parent; on a tie the core comes first, then plugins in dependency order, then by `id`.
- A plugin node's `page` is a path inside the plugin itself; the core builds the address (7.5).
- A list's `source` is a reading action of **the node's owner**: a plugin lists records only with its own actions.

### 7.3. The tree builder

The tree is built neither in the browser nor from YAML on every request. Every node of a version's `navigation.yaml` is read once, when the version is checked for the marketplace, into the table `plugins.plugin_node`: its full name, the node it stands under, its order, title, icon, page template, list source and key, roles, controls and behaviour in a room. An organization's tree is the core's nodes and the nodes of the versions enabled in it, joined in dependency order; each node gets the scope of parameters the list nodes above it define. At run time nobody reads YAML.

The builder runs three times, and a refusal cancels the operation that asked for it:

- **when a version is checked**, on its file alone: the rules one file shows (1–4, 6–9 below) and an attachment to the core;
- **when a plugin is installed or enabled** in an organization, on the organization's enabled plugins with it added: the attachments to a dependency (2) and the parameters an attachment gives (4); the refusal is `navigation` with the reason in words;
- **when the core starts**, on the core's own file: a core whose tree does not hold does not start.

Disabling and removing only take nodes away, and an enabled plugin that needs another already keeps it from being disabled.

The builder refuses when:

1. a file is navigation format 1 or 2 ("navigation format 2 is not read; write format 4: the page gives its history and controls, and a room shares nothing"), a node with children says no `opens` or a node without children says it (named: "'item' has children and no opens; write opens: expand or enter"), a node declares `history`, `room` or `controls` (named: "'item-draft' declares history; …"), or the file fails the JSON schema (`navigation-4.schema.json`): an unknown field, a wrong `id`, an unknown icon, an `opens` that is neither `expand` nor `enter`;
2. `attach` points at a node that does not exist, or at a plugin that is not a direct dependency;
3. an `id` repeats within one owner;
4. a `{name}` in `page` or in a list's parameters is not defined in the scope at the node's place;
5. two list nodes with the same `key` stand one under the other;
6. two nodes of one owner have the same `page` template — an address must point at one node;
7. a list's `source` names no action of the owner: no file `actions/<name>_action.py` or `history/<name>_action.py` in its package; this is checked from the wheel, before any organization can install it.

### 7.4. List nodes at run time

Ordinary nodes come to the browser from the built tree, filtered by roles, in one action of the core. A list node's instances load when its parent opens: the core calls the owner's `source` through the gateway with the person's token, the organization, the scope's parameters and the moment.

```json
// the input of a list action: the list node `item` of the template stands under its root, so its scope is empty
{ "organization": "acme", "params": {}, "at": "2026-11-08T10:15:00.123456Z", "limit": 50, "after": null }
// the output
{ "entries": [ { "key": "4f1c…", "title": "Payments", "icon": "folder" } ], "next": "4f1c…" }
```

- The core calls a list at `GET /p/<name>/api/<organization>/lists/<source>?<scope parameters>&at=…&limit=…&after=…`; a page may read the same actions for the options of its own controls.
- Titles are plain text; the tree has no markup.
- A list is read **at the panel's moment**: at a past moment the tree holds the records that existed then.
- A long list comes in parts of 50; its last row is "More…", which reads the next part with `after`.
- A parent with no visible children and no `page` is hidden.
- If a plugin's list does not answer, only its branch shows the error; the rest of the tree works.

### 7.5. The panel address

Every page in the right panel has one address in the browser's address bar:

```text
/w/<organization>/<owner>/<page path>?<page parameters>&at=<moment>

/w/acme/core/items/4f1c/overview
/w/acme/notes/items/4f1c?author=me&view=table&at=2026-11-08T10:15:00.123456Z
/w/acme/containers/products/42/containers?state=running&view=grid
```

- **The organization** comes first; a plugin's `page` templates never mention it — the core puts it in front of every path (6.5).
- **The path** is `page` with the scope's parameters put in; each value is encoded as a path segment.
- **Page parameters** are filters, the view mode, sorting, the open record, the tab. The rule: **if a person opening the address again must see the same thing, it is in the address.** Outside the address there is only the fleeting: hover, scrolling, an open drop-down, unsaved input.
- **Reserved** are `at` (the moment) and every name starting with `_`; the rest belong to the page.
- No `at` means "now": the page reads at the watermark and rereads itself when it moves ([versioned-storage, section 4](versioned-storage.md)). The moment's string is opaque and never passes through `Date`.
- From the address the core finds the node by matching the templates backwards, opens the path to it in the tree, highlights it and loads the titles of the instances on the way.
- The address is **the only source of the panel's state**: a reload, a link to a colleague, Back and Forward give exactly what was there.
- The core's own pages live under the owner `core`: Settings → Plugins is `/w/<organization>/core/settings/plugins`.

**History entries.** A discrete change is a new entry (`push`): the mode changed, a filter was applied, a record opened, a tab chosen. A continuous one replaces the entry as it goes (`replace`) and adds one new entry at the end: typing a search, zooming, dragging.

### 7.6. How a plugin gets the panel

The core draws the grey field with dots and lays a transparent `iframe` over it with the address `/p/<name>/<organization>/<path>?<parameters>&at=…`. The plugin's page draws only its content on the field — with the components of `@maxitor/panel`, so that cards, tables and toolbars look as everywhere else in Maxitor. `@maxitor/panel` makes the document's background transparent; a plugin sets no background of its own.

Why an `iframe`, and not shared components in one application, nor separate sites with a header of their own:

- the frame does not depend on a plugin's code: the styles and scripts of a plugin's page do not reach the tree and the row by layout (this is not a security boundary, see section 9);
- a plugin stays a full Next.js application with its own version and build;
- moving between nodes of different plugins does not reload the frame: the tree keeps its open nodes, its scroll and the room's connection.

The core and the plugin's page exchange `postMessage` messages. Each side accepts a message only if `event.origin` is its own origin and `event.source` the expected window; a message of an unknown shape is dropped.

| Message | Direction | Meaning |
|---|---|---|
| `panel.ready {build, shell, shellVersion}` | plugin → core | the page is ready; `build` is the plugin's version, `shell` whether it renders the shell of `@maxitor/panel`, and its version |
| `panel.history {history}` | plugin → core | how the page answers the time scale (7.9), when it opens and whenever it gives a new one; the core keeps the last |
| `panel.hidden {anchors}` | plugin → core | what the page holds but its filters leave out now |
| `panel.navigate {path, query, mode}` | plugin → core | a person changed the page's state; `mode` is `push` or `replace` |
| `panel.title {text}` | plugin → core | the page's title for the path in the core's row and the browser tab |
| `panel.open {owner, path, query}` | plugin → core | go to a page of the core or of a direct dependency |
| `panel.location {path, query, at}` | core → plugin | the address changed not by this page's action: Back, a tree node of the same plugin, a change of moment, following in a room |
| `panel.watermark {at}` | core → plugin | the watermark moved; a page without `at` rereads its data |

**"Now" moves for a plugin's changes too.** Every change a plugin writes takes its time from the core's `change_time(organization)`, which keeps that time in the core's table `organization_clock` within the same transaction; `watermark(organization)` reads it beside the core's own tables. The frame asks for the watermark every 5 seconds while a page without `at` is open and sends `panel.watermark` when it moved, so a note a colleague wrote reaches the page once it is committed.

Rules:

- **Inside the `iframe` a plugin creates no history entries.** The router of `@maxitor/panel` (`usePanelRouter`) changes the `iframe`'s address only by replacing, and the core creates the history entry in the window's address. Otherwise each action would give two entries, and Back would have to be pressed twice.
- **A page does not answer `panel.location` with `panel.navigate`.** It rebuilds its view from the new address silently; `panel.navigate` is sent only on a person's action.
- A tree node of the same plugin — `panel.location` without a reload; a node of another owner — a new `iframe` address.
- A page builds its view **from its address only**: on the server from `searchParams`, after `panel.location` from the new address.
- `/p/<name>/<organization>/...` opened outside the panel (the gateway sees `Sec-Fetch-Dest: document`) is redirected to `/w/<organization>/<name>/...`. Responses of `/p/**` carry `Content-Security-Policy: frame-ancestors 'self'`.
- A page that has not said `panel.ready` within 15 seconds is shown as not answering, with Try again; the tree and the top row keep working.
- `panel.open` opens a page of the core or of a direct dependency of the page's plugin, and nothing else.
- The core draws its own pages in the panel itself, without an `iframe`, by the same rules of the address.

```tsx
"use client";
import { usePanelRouter, usePanelQuery } from "@maxitor/panel";

export function NoteRow({ note }) {
  const router = usePanelRouter();
  const { open } = usePanelQuery();
  // one history entry per opened note; the core changes the window's address
  return <li aria-selected={open === note.id} onClick={() => router.push({ query: { open: note.id } })}>{note.body}</li>;
}
```

### 7.7. The canvas

A plugin has no canvas of its own. There is one canvas for all of Maxitor — the component `<MaxitorCanvas>` of `@maxitor/panel`, released by the core. Its first user is the graph viewer: the ERD, the map, the events explorer and the lifecycle, which today each draw their own field, move onto it when they become a plugin. So all plugins behave alike not by agreement but because it is one piece of code.

The core's canvas gives everything that belongs to the canvas itself:

- **moving and zooming** — dragging, the wheel, pinching, keys, zoom limits, inertia; a plugin writes no gestures of its own and cannot change them;
- **fit** and the zoom, which stands first in the shell's bottom bar (7.8); the keys `+` and `-` zoom, `0` fits, the arrows move; the zoom stays between 10% and 400%;
- **the field of dots**, moving with the canvas;
- **the camera**: converting screen coordinates into canvas coordinates and back;
- **the room**: others' pointers, clicks, selections and the viewport for a follower (section 8) — with no code in the plugin.

A plugin puts only its **content** into the canvas, in canvas coordinates — nodes, lines, labels — and may ask the canvas to show a place:

```tsx
<MaxitorCanvas bounds={scene.bounds}>
  {scene.nodes.map((node) => <ServiceNode key={node.id} node={node} />)}
</MaxitorCanvas>

const canvas = useCanvas();
canvas.fit(scene.boundsOf(selected));   // show the selection; the gestures stay shared
```

The viewport — position and zoom — **is not written into the address**: everyone has their own screen. In a room, following carries it.

**The way out.** A plugin with its own rendering engine (WebGL, its own graph library) draws inside `<MaxitorCanvas engine={adapter}>`: the adapter gets the camera from the canvas and draws by it. The gestures, the field, the zoom and the room stay shared.

A document page — lists, cards, forms — takes no canvas: it lies on the still field the core draws.

### 7.8. Controls: the shell of every page

Every page of every plugin shows its controls in the same places and with the same look, and every page sets its own. What a page offers depends on its data — a drawing of events has three layers with counts read from its graph and a filter section only in a comparison — so no file written beforehand describes it. **The page gives, the shell draws.** `PanelPage` of `@maxitor/panel` is the root of every page; the page gives it data when it opens, and it draws each part in its place and writes each value into the address. The core draws nothing over the panel, and `navigation.yaml` says nothing of controls.

| Part | Place | What the page gives | What the shell decides |
|---|---|---|---|
| filters | top left | sections of three kinds — a choice of values (a colour disk of the palette, a label, absent from the data), a text, a range of numbers or dates — and which choices paint | 148 px, an accordion with one section open; a long choice's search and "N more"; the paint switch when two sections paint; one button and a sheet from below on a phone |
| layer pills | top centre | options with an icon and a count | one chosen, the parameter `layer`; on a phone the icon and the count |
| bottom bar | bottom left | sections after the zoom, each behind a hairline: a choice of one, buttons, a switch; each item an icon of the shell's set | zoom out, the percentage, zoom in and fit first on a canvas; sections that do not fit fold into "⋯" on a phone |
| page actions | top right, bottom right on a phone | buttons such as "New note" | shown only now: in the past and in a comparison everything is read only |
| change stepper | the page actions' place | nothing: the time scale puts it there in a comparison (7.9) | the actions and the stepper never stand together |

```tsx
<PanelPage
  title="Containers"
  layers={{ default: "services", options: [
    { value: "services", label: "Services", icon: "domain", count: counts.services },
    { value: "jobs", label: "Jobs", icon: "action", count: counts.jobs },
  ] }}
  filters={[{ title: "State", param: "state", rows: [
    { key: "running", label: "Running", colour: "green" },
    { key: "stopped", label: "Stopped", colour: "grey" },
  ] }]}
  bar={[{ kind: "choice", param: "view", default: "graph", options: [
    { value: "graph", title: "Graph", icon: "cards" },
    { value: "table", title: "Table", icon: "table" },
  ] }]}
>
  <MaxitorCanvas bounds={scene.bounds}>{nodes}</MaxitorCanvas>
</PanelPage>
```

The rules of controls:

- **Each control is an address parameter.** The layer is `?layer=jobs`, a choice `?view=table`, a filter `?state=running` (the options switched on are listed; no parameter — everything is on), the paint switch `?paint=<section>`. The default is not written. So Back, a link and following work for controls by themselves (7.5, section 8).
- **What a server page gives is data.** Filters, layers and choices are plain values the shell turns into writes of the address; only a button, a switch and an action carry a function, and come from a client component.
- **A value that is gone gives way.** A layer or a choice the page no longer offers falls back to its default, written once in place, so Back does not return to it.
- **The core's names are the core's.** `at`, `mode`, `from` and every `_…` are written by the core; a page carries them as the address holds them and may not change them. The panel router refuses such a write — an error in development and in tests, a line in the console in production — and the core refuses it too, and a parameter named like one of the node's path parameters.
- **Colours come from the palette** (`colour: green`), icons from the shell's set: a plugin's buttons look like every other plugin's.
- **The content field is the plugin's.** On a document page the shell pads it clear of the controls; on a canvas the fitted scene stays clear of them. Inside it a plugin lays out what it likes.

**Three kinds of filter.** A section is a choice of values, a text or a range, and that is all; a filter that is on or off is a choice of one value.

| Kind | What the page gives | How it shows | Address |
|---|---|---|---|
| choice | `{title, param, rows, paints?, search?}`, rows in the order of how many records each holds | a colour disk — a person's disk with initials — and a label per row, no counts; more than eight rows: a search at the top, the first eight and "N more" | the rows switched on, absent when all are: `?status=active,trial` |
| text | `{kind: "text", title, param, placeholder}` | a row with a magnifier and a field, in the page's words ("Account or email") | what is typed: `?q=anna` |
| range | `{kind: "range", title, param, unit, min?, max?, presets?}` | two rows, From and To; a number typed in the row; a date chosen in the date range picker, the date first and how a moving bound is set under it | the bounds as written, either side open: `?balance=100..250`, `?created=now-90d..now` |

A range of dates is named by its column ("Created"), never "Time", and never takes the time scale's look. A bound that moves with today — `now`, `now-90d`, `now/M`, `now-1y/y` — is counted from the real today whatever moment the page is read at. The page filters its own data by its address; it tells the core what its filters hide with `usePanelHidden(anchors)` (`panel.hidden`), so a pointer at a hidden row shows as hidden. Moving the paint switch repaints the content and opens the section it paints by.

**The date pickers.** `openDateRangePicker({anchor, unit, min, max, value, presets})` answers `{from, to}` as the address writes them, or `null` when closed without a choice; `openDatePicker` with the same arguments answers one date. Both follow Apple's layout in Maxitor's colours and sizes: the core's ready stretches (today, the last 7, 30 and 90 days, this month, quarter and year, last year) with the page's own under a hairline, fields that take typing (`5 Mar 2026`, `2026-03-05`, `today`, `30 days ago`, `30d`) with an arrow that makes a date move with today or fixes it, two months (one for a date and on a phone) with wheels behind a month's title, and the foot with the choice in words. Nothing changes before Apply; Cancel, Escape and a press outside leave everything as it was. On a phone both are sheets from below with the ready stretches as chips.

**A list lies whole on the canvas.** `DataTable` is a card at its full length in canvas units, moved and zoomed by the camera like everything else: no scroll of its own, no pages. Only the rows inside the view are drawn, and the canvas knows every row's place by its anchor (`useCanvas().locate`). Its head — the list's name, how many rows pass of how many, the column names — sticks to the top of the view while the rows go up under it. A column has a title and a kind of cell: text, mono, number, date, person, status. Several lists, a scheme and a picture lie on one canvas, each list with its own head.

**The shell's boundary.** `maxitor-plugin-check` refuses a frontend whose page does not render `<PanelPage>`, which places an element `fixed`, or which raises a layer to the shell's (`--mx-layer-shell`, 30) or above, naming the file and the line; positioning, another component kit and the plugin's own colours inside the content field pass. `panel.ready` carries `shell` and the shell's version; a page without the shell opens under a red strip "This page has no Maxitor frame" on the local stand and in development, and is written to the console elsewhere.

**Styles come from one place.** The package `@maxitor/tokens` holds colours, the palette (`grey`, `blue`, `green`, `amber`, `red`, `violet`, `teal`, `pink`), radii, shadows, blur, type sizes and spacing as CSS custom properties `--mx-*`; the core's frame and the shell and components of `@maxitor/panel`, with which a plugin draws its controls and its content (cards, tables, nodes on the canvas), draw with them. The core's check `check-tokens.mjs` holds the frame and `@maxitor/panel` to them.

### 7.9. History: what a page gives the time scale

Every page reads any past moment: that is versioned storage, and needs no declaration. The core's time scale (bystrovmaxim/gnomon#98) draws the history of the open page from data the plugin gives. **The page gives its history, in its code**, to `PanelPage` — when it opens and whenever it gives a new one — and the plugin keeps the actions that answer it in its folder `history/`, one per file (`history/<name>_action.py`). Nothing of a page's history is declared in `navigation.yaml`; the passport says which comparisons the plugin's pages may draw.

```yaml
# maxitor-plugin.yaml
history:
  compare: [diff, side_by_side]     # the comparisons the pages can draw; none: one moment only
```

```tsx
<PanelPage
  title="Notes"
  history={{
    read: "list_item_notes",        // the page's reading action: over a stretch it gives the page's own bars
    milestones: "list_note_history", // an action of history/: the milestones in a stretch
    card: "note_milestone_card",    // an action of history/: one milestone's card
    // compare: [] narrows the passport's list; never widens it. legend: the legend's words.
  }}
>
```

A page that gives no history is offered one moment only, with no bars and no milestones. The core checks every name a page gives against the version's actions and its passport's comparisons, kept when the version was checked; a name that does not hold is refused by name — an error in development, a line in the console elsewhere — and the rest of the history kept.

- **Bars** count the page's changes in each stretch — added, changed, removed. A page that names no `bars` of its own gets them from its reading action run over the stretch: the same query and filters with the SDK's stretch condition, grouped by `maxitor_plugin_sdk.history.bars_of`. So the bars count exactly what the page shows, the author filter included.
- **Milestones** are the events that matter on their own — a pull request, a release, a published revision — and the draft as a `proposal` whose `link` is its page. A milestone carries its `kind` (its look, from the core's fixed set), `minor` (a small point), and an optional `release` (a flag over it); the plugin gives each its meaning.
- **A card** is data: author, what the milestone changed, short counts, and its `comment`, shown under the scale when the milestone is chosen. The core draws it; no control of the plugin runs in the core's frame.
- **The context** of every question is the address — the organization, the node, the page's parameters, the stretch and the bar's width — never what is on the screen, so an answer below the watermark never changes and can be kept.

The shapes are `maxitor-plugin-sdk`'s `history-1.schema.json` and `PageHistory` of `@maxitor/panel`.

## 8. The room

A room is looking at Maxitor together: participants see each other as circles, one moment for all, can follow each other, see each other's pointers and selections. **A room works on every page of every plugin** — a plugin can neither turn it off nor "not support" it. This comes not from room code in the plugin but from rules the plugin keeps anyway: the state in the address and the view from the address only.

### 8.1. Who does what

**The core** keeps everything that belongs to the room:

- one room connection per tab — in the frame's window; a plugin has no connection and no room server of its own;
- participants, circles, invitations, names, colours, the participant card;
- the room's common moment and its change;
- following: who follows whom, the ban on circles, the frame in the leader's colour around the right panel and the "Following …" pill;
- relaying pointers, clicks, the viewport and selections between participants on one page, with limits of rate and size;
- the version check: a participant with an old build of a plugin is offered a reload.

**The plugin** answers only for what one of its pages knows: how it is built from its address and how a point on the screen becomes a point of the content.

### 8.2. Level 1: always and with no code

Works on every page that keeps the rules of section 7:

| Room feature | Why it works by itself |
|---|---|
| **controls** | the layer, the choices and the filters are address parameters (7.8); a follower gets them with the leader's address |
| **who is where** | the core knows each participant's panel address; the page key is the organization, the owner and the path |
| **the common moment** | the moment is the address parameter `at`; changing the room's moment sends `panel.location` to all |
| **following** | the follower gets the leader's panel address; the core replaces the window's address (piling up no history entries) and sends `panel.location` or opens a new `iframe` |
| **the version check** | `panel.ready {build}` gives the core each participant's plugin version |

What a page must do:

1. keep everything visible in the address (7.5);
2. rebuild on `panel.location` without a reload and **without** `panel.navigate` in answer — otherwise the follower would "take over" and following would break;
3. send `panel.navigate` only on a person's action; a follower's own action ends following — the core decides that, the plugin need not think about it.

### 8.3. Level 2: pointers, viewport, selection

Seeing another person's pointer makes sense only if both sides understand alike where it is: screens differ, zoom and scroll differ. Every page's content lies on the canvas (7.7), so a pointer travels in **canvas units**, `{x, y}`, the same for every participant, and a follower's viewport is `{cx, cy, w, h}` in the same units. A room shares no parameter of a page's address: what a participant filters or chooses stays theirs, and a follower gets the leader's whole address. A plugin declares nothing for it: `<MaxitorCanvas>` knows its camera, converts the coordinates and draws the room's layer itself; an own engine gives a camera adapter. Elements carry stable keys in `data-room-anchor` — a record's `id`, not a row number — so a pointer can be brought to an element: a list's every row is known to the canvas by its anchor, drawn or not (`useCanvas().locate`).

**A selection** is a shared pointer at an element: `room.focus {x, y, w, h}` in canvas units. Participants see a frame in the colour of whoever selected.

Level 2 messages between a page and the core:

| Message | Direction | Rate |
|---|---|---|
| `room.state {you, participants, following}` | core → plugin | on every change of the participants or of following |
| `room.pointer {kind, at}` | plugin → core → plugin | at most 20 a second, only when moved |
| `room.click {at}` | plugin → core → plugin | on a click |
| `room.viewport {view}` | plugin → core → plugin | on a change, at most 10 a second |
| `room.focus {target}` | plugin → core → plugin | on a selection; the last value wins |

Here `at` is a point in canvas units, `view` the viewport in the same units. The core adds the participant to a relayed message itself: a page cannot pose as another person. The core relays level 2 messages only to participants on the same page (the same page key and the same shared parameters), drops a message over 4 KB and thins out ones that come too often — just as Maxitor's rooms work today.

### 8.4. What the core checks

- A page that answered `panel.location` with `panel.navigate` breaks following — a test of `@maxitor/panel` and the plugin check in `maxitor dev` catch it (a warning in the developer's console).
- A page that declared `document` and marked no anchor, or declared `canvas` and put up no `<MaxitorCanvas>`, works at level 1 five seconds after `panel.ready`, and the core writes a warning.
- A participant with another version of a plugin sees pointers only from participants with the same version: coordinates of different builds may not match.

## 9. The trust model

What isolation gives:

- a plugin with a bug, or broken into on the server, **reads and writes only its own version's schema** and does not touch, or even see, the data of the core or of other plugins;
- it has no passwords of other roles, no token signing key and no sessions of people: its container holds only its own environment file, and it cannot read another version's file or the core's processes;
- its Python dependencies do not break anyone else's;
- removing it from an organization (bystrovmaxim/gnomon#94) deletes only that organization's rows in its schema.

What isolation does not give — and this must be known when installing a plugin:

- **A plugin sees every organization on its version.** Inside its own schema organizations are separated by a condition in the query, not by the database: a plugin broken into reads the data it keeps for every organization that runs the same version. If that becomes unacceptable, the next step is row-level security (RLS) by `organization_id`.
- **A plugin's frontend acts on the person's behalf on the whole site.** One origin means a plugin's script in the browser can call any action of the core and of any plugin with the person's rights. That is the price of one sign-in without redirects. The right panel's `iframe` is from the same origin too and does not change this: it separates the frame's layout from the plugin, not rights.
- **A plugin can load the database.** Its role's connection limit restrains this but does not rule it out.

The conclusion: **a plugin is installed only if its author is trusted.** Isolation protects against bugs and limits writing, not against bad intent. That is why the details of a plugin on the page Settings → Plugins show its source and `sha256`, its tables, its schema and user, and its keys to the core.

## 10. The lifecycle

An organization's administrator manages its plugins on the page Settings → Plugins (`/w/<code>/settings/plugins`); the page only asks, and the installer's process does the work on its next round, every minute, so a crash of either leaves nothing stuck.

### The marketplace

A plugin of the marketplace is `listed` or `withdrawn`: withdrawn, it keeps working where it is installed, and nobody installs it anew. A version is `draft` until the installer checks it: it downloads the wheel (PyPI, a release on GitHub or GitLab, at most 50 MB within 60 seconds, only from those hosts), compares its `sha256`, keeps it in the wheel store by its hash, reads — never runs — its passport, `schema.yaml`, `navigation.yaml` and `foreign-keys.yaml`, and checks the core's range and that its `id` and `name` are free. Then it is `active`, or `rejected` with the reason. The operator adds a public version with `maxitor-plugin-installer add-version <purl> <sha256>`, or a wheel at hand with `add-wheel <file.whl>`.

A **private plugin** belongs to one organization and no other sees it. Its administrator adds it by the Package URL of a release that downloads without signing in, with its `sha256`, or by uploading the wheel — for a closed repository or any other source. Maxitor needs the source once and keeps no access token.

### Installing

```text
installing ──▶ enabled ⇄ disabled
     └──▶ failed ──retry──▶ installing
              └────────────▶ removed
```

Installing is refused unless the version fits the core and every plugin it needs is installed — enabled or disabled — in the organization; the refusal names what is missing. Otherwise the row waits in `installing`; the installer deploys the version if no organization has (section 5.1) and enables it, or leaves it `failed` with the reason, with nothing built and nothing of the organization changed. An organization has at most one row not `removed` per plugin.

### Disabling and enabling

Disabling takes the plugin's sections out of the organization's tree; its data stays. It is refused while an enabled plugin depends on it, and enabling is refused while a plugin it needs is disabled; both name the plugins in the way.

### Removing

Removing a plugin from an organization — in batches, in the background, resumed after a crash — is bystrovmaxim/gnomon#94. The schema and its user stay: other organizations run the version.

The core's upgrade passes the same compatibility check (section 3.3) against every installed plugin and refuses if one of them is incompatible with the new version. How an organization moves to another version of a plugin it runs is not decided yet.

## 11. The layout of a plugin's repository

```text
acme-maxitor-notes/
    pyproject.toml              # package name, version, Python libraries, the entry point maxitor.plugins
    src/acme_notes/
        maxitor-plugin.yaml
        app.py
        schema.yaml
        foreign-keys.yaml
        navigation.yaml
        notes_domain.py
        organization_member.py
        organization_auth_coordinator.py
        membership.py
        entities/note_entity.py
        entities/note_change_entity.py        # one note in one person's draft, with its state and base
        entities/note_conflict_entity.py      # a change that meets someone else's publication
        entities/note_author_entity.py
        draft_rules.py                        # a change applies, drops or is a conflict: by value
        storage/notes_storage.py
        actions/add_note_action.py
        actions/list_item_notes_action.py
        actions/list_note_authors_action.py
        actions/edit_note_action.py
        actions/delete_note_action.py
        actions/revert_note_change_action.py
        actions/publish_notes_action.py
        actions/list_published_notes_action.py
        actions/list_note_draft_action.py
        history/list_note_history_action.py     # the milestones the time scale draws
        history/note_milestone_card_action.py   # one milestone's card
        build_graph.py
        _web/                   # the build of web/, not in git
    web/                        # the Next.js sources
        package.json            # depends on @maxitor/panel
        next.config.ts
        app/
            layout.tsx
            page.tsx
            [org]/items/[item_id]/page.tsx
    tests/
    CHANGELOG.md
```

## 12. Example: the plugin "Notes"

The plugin keeps its own items, like folders, and notes on them; it needs nothing but the core. The plugin template in this package is this example.

**1. The skeleton.**

```bash
maxitor plugin new notes --id io.github.acme.notes --package acme-maxitor-notes
```

Creates the tree of files of section 11, a passport with no dependencies, a `navigation.yaml` with one node, and `web/` with `@maxitor/panel` wired in.

**2. The passport.** Fill in `title`, `description`, `frontend.navigation`. There are no dependencies — only `requires.maxitor` — and no roles: the actions check the core's.

**3. The schema.** The tables, declared — the core builds each with its version table, the service fields and the indexes:

```yaml
# schema.yaml
schema: 1
tables:
  item:
    description: 'What notes are written on, like a folder: a title in one organization.'
    columns:
      title: {type: text, nullable: false, description: The item's title, unique among the organization's items now.}
    unique:
      - [title]
  note:
    description: A note on an item.
    columns:
      item_id: {type: uuid, nullable: false, description: The item the note is about.}
      writer_id: {type: uuid, nullable: false, description: The account of the member who wrote the note.}
      body: {type: text, nullable: false, description: The text of the note.}
    indexes:
      - [item_id]
    keys:
      - {columns: [item_id], table: item, references: [id]}
```

The key from a note to its item is a key inside the plugin, so it is in `schema.yaml`; the key to the core is not in `schema.yaml` — it is in `foreign-keys.yaml` (section 5.3):

```yaml
foreign_keys:
  - from: { table: note, columns: [organization_id, writer_id] }
    to:   { schema: core, table: user, columns: [organization_id, account_id] }
```

**4. The resource and the actions.** The resource takes its change time and watermark from the core's functions through `maxitor_plugin_sdk.core_functions` (section 5.4) and writes a row and its version; the actions call the resource. A sketch:

```python
@meta("Items and their notes, in the plugin's own schema.")
@entities(Note)
class NotesStorage(PostgresStorage):
    async def add(self, change: Change, note: Note) -> None:
        await versioning.insert_row(self, change, "note", note)

    async def list_for_item(self, organization: str, item_id: str, moment: str) -> list[Note]:
        return await versioning.select_at(
            self, Note, "note_versions", organization=organization, moment=moment, where={"item_id": item_id}
        )
```

```python
@meta("Adds a note to an item.", domain=NotesDomain)
@check_roles(MemberRole)
class AddNoteAction(BaseAction[AddNoteParams, ChangeResult]):
    @access_decide("Refuse a person who is not a member of the organization of the address, and an item that is not one of it.")
    @context_requires("user.user_id", "user.organization")
    async def item_access_decide(self, params, box, connections, ctx) -> Verdict:
        return await membership.item_access(connections.notes, ctx.get("user.organization"), ctx.get("user.user_id"), params.item_id)

    @summary_aspect("Writes the note and returns the change time.")
    @context_requires("user.user_id", "user.organization")
    async def write_summary(self, params, state, box, connections, ctx):
        organization_id = await membership.member_organization_id(connections.notes, ctx.get("user.organization"), ctx.get("user.user_id"))
        async with versioning.change(connections.notes, organization_id, ctx.get("user.user_id")) as change:
            await change.resource.add(change, Note.new(params.item_id, params.body))
        return ChangeResult(changed_at=change.changed_at)
```

`user.organization` is the organization of the address (`/p/notes/api/<organization>/notes`): the plugin's auth coordinator takes it from the path the gateway has already checked and puts it into the context beside the token's person, so a write and a read are bound to it alike. `item_access_decide` checks it again, and that the item is one of the organization's now, and answers `Allowed()` or `FORBIDDEN_OBJECT` (6.6): one answer for an item that does not exist and one of another organization. The role is already checked by `@check_roles`, so the step decides only about the organization and the item. The summary looks the organization's `id` up again, because the decision passes no state on. `versioning.change` takes the organization's lock, issues the time, hands out the resource inside the transaction and, after the commit, returns `changed_at` — all by section 3 of versioned storage.

**5. Tree nodes.** In `navigation.yaml` — the section "Notes" in the root of the tree, under it the list node `item` whose instances come from the action `list_items`, and under every item its two pages: "Draft" (`page: /items/{item_id}`) and "Published" (`page: /items/{item_id}/published`), as in section 7.2 — the tree only. The page's controls and its history are its own (sections 7.8, 7.9): Draft gives the State filter and its changes, Published gives the Authors filter and reads its writers from the action `list_note_authors`. `maxitor plugin check` checks every `{item_id}` against the list node above it.

**The draft and its revisions.** An item's published notes change only when a revision is published: every edit, deletion and new note waits in the person's own draft, one versioned row per (person, note) in `note_change`, with its state and the published version it was made over. Publishing takes the whole draft as the item's next revision in one transaction and finds its conflicts by value — the published note no longer reads as the change's base, or is deleted — which the person overwrites or gives up for each note. Draft and Published are read at any moment from the version tables. The common data environment of bystrovmaxim/gnomon#106 grows this model: four states and a lifecycle of every record.

**6. The page.** It opens in the right panel at `/w/<organization>/notes/items/<id>?view=…&author=…&at=…`; everything that changes the view is in the address. The plugin's routes start with the organization: `app/[org]/items/[item_id]/page.tsx`.

```tsx
// web/app/[org]/items/[item_id]/page.tsx — a server component
import { momentFrom } from "@maxitor/panel";
import { read } from "../../notes/server";
import { DraftView } from "./DraftView";

export default async function ItemNotesPage({ params, searchParams }) {
  const { org, item_id } = await params;
  const query = await searchParams;                       // view, author, at
  const auth = (await headers()).get("authorization") ?? "";
  const url = new URL(`${process.env.MAXITOR_PLUGIN_API}/p/notes/api/${org}/items/${item_id}/notes`);
  url.searchParams.set("at", momentFrom(query));
  if (query.author) url.searchParams.set("author", query.author);
  const notes = await fetch(url, { headers: { authorization: auth } }).then((r) => r.json());

  const authors = await fetch(`${process.env.MAXITOR_PLUGIN_API}/p/notes/api/${org}/lists/list_note_authors?item_id=${item_id}`,
    { headers: { authorization: auth } }).then((r) => r.json());

  const filters = [{ title: "Authors", param: "author", rows: authors.entries.map((a) => ({ key: a.key, label: a.title })) }];
  const bar = [{ kind: "choice", param: "view", default: "cards", options: [
    { value: "cards", title: "Cards", icon: "cards" }, { value: "table", title: "Table", icon: "table" },
  ] }];
  return <NotesView org={org} itemId={item_id} notes={notes} filters={filters} bar={bar} />;
}
```

```tsx
// web/app/[org]/items/[item_id]/NotesView.tsx — a client component: the shell, the canvas, writing and now
"use client";
import { DataTable, Dialog, MaxitorCanvas, PanelPage, usePanelQuery } from "@maxitor/panel";

export function NotesView({ org, itemId, notes, filters, bar }) {
  const { view = "cards", at } = usePanelQuery();          // the shell writes ?view=; the page only reads it
  const fresh = useFresh(notes.map((n) => n.id), !at);     // panel.watermark: read again, mark a colleague's note new
  return (
    <PanelPage title="Notes" filters={filters} bar={bar} actions={[{ title: "New note", icon: "plus", onClick: openDialog }]}>
      {view === "table"
        ? <DataTable name="Notes" rows={notes} anchor={(n) => `note:${n.id}`} columns={columns} />   // whole on the canvas
        : <MaxitorCanvas bounds={grid}>{notes.map((n) => <NoteCard key={n.id} note={n} fresh={fresh.has(n.id)} />)}</MaxitorCanvas>}
      {writing ? <Dialog title="New note">…</Dialog> : null}
    </PanelPage>
  );
}
```

The shell draws the State filter on Draft and the Authors filter on Published, and writes `?state=`, `?author=` and `?view=` into the address; the page rebuilds from it. Every note lies on the canvas with its anchor `note:<id>`, so a pointer lands on it on every screen. "New note" opens the shell's `Dialog` — a sheet on a phone — and a card edits its change in place; Revert asks once. Publishing is a dialog with a title, a comment, an optional release and, when someone published over the draft's base, the conflict list: two marked sides for each note and the choice to overwrite or give up. Published is read only and marks what waits in the person's draft.

**7. Running it locally.**

```bash
maxitor dev --plugin .
```

Starts the core with an empty database, installs the plugin from its sources by the same steps as the installer (user, schema, tables from `schema.yaml`, keys, rights), runs the backend and `next dev` behind the gateway inside the core's frame. Sign in as the core's test user; a second tab with another user checks the room.

**8. Checking and building.**

```bash
npm --prefix web run build
uv build
maxitor plugin check dist/acme_maxitor_notes-1.0.0-py3-none-any.whl
```

`check` does everything the installer does before installing: the passport, the version, compatibility, cycles, the shape of `navigation.yaml` and `foreign-keys.yaml`, the presence of `_web`, the absence of binary modules.

**9. Releasing.** To PyPI (`uv publish`) or attached to a GitHub release; in the second case the file's `sha256` goes into the dependency declarations of those who depend on the plugin.

**10. Installing** — `maxitor plugin install acme-maxitor-notes`, as in section 10.

## 13. Rules

1. A plugin is a Python package with the passport `maxitor-plugin.yaml` and the entry point `maxitor.plugins`.
2. `id` is unique in the world and never changes; `name` is unique in an installation, fits a schema name and does not change after the first release.
3. The version is `x.y.z` and equals the package's; the major version grows on a breaking change of tables, actions, roles or tree nodes.
4. Dependencies on plugins live in the passport only, with a version range and a source; a wheel needs a `sha256`; ranges follow PEP 440.
5. The core is a node of the dependency graph with the `id` `maxitor`; an edge to it is checked the same way as an edge to a plugin.
6. One function, `maxitor_plugin_sdk.compat`, checks compatibility — on building, installing, upgrading, removing a plugin and on upgrading the core.
7. The SDKs move with the core: their major version equals the core's.
8. Tables, tree nodes, actions and roles are a contract: a breaking change of them raises the major version.
9. Without all its dependencies a plugin is not installed; the whole closure is installed whole or not at all.
10. A dependency cycle is forbidden and is checked on building and on installing.
11. A plugin does not import another plugin's code and does not read its tables: it calls its actions through the gateway.
12. A plugin's backend and frontend run in unprivileged Docker containers of their own version, with limits and a network of their own; Python runs in the version's own image.
13. A plugin's data is in its version's schema `<name>_<x>_<y>_<z>` of the shared database, under its version's user `plg_<name>_<x>_<y>_<z>`, which reads and writes only that schema; a plugin without a `database` section gets neither a schema nor a user.
14. A plugin carries no SQL and no migrations: it declares its tables in `schema.yaml`, and the core builds every table except the mechanics with its version table.
15. A plugin reaches the core only through its five functions: change time, watermark, membership, the organization of an address, a member's name.
16. Only the installer's process holds the password of `maxitor_installer`; the core's web process never does.
17. A key to the core is only `RESTRICT`, only by a declaration in `foreign-keys.yaml`, only to what the core offers; the installer creates it. A key to a dependency waits for moving organizations between versions.
18. A transaction does not cross schemas of different owners; a change in two schemas is two changes glued by an action.
19. A plugin works with the database through its own resource and with the outside world through AOA actions.
20. A plugin's frontend is a Next.js application with `basePath: /p/<name>` on `@maxitor/panel`; its pages are shown only in the right panel.
21. A plugin accepts only the core's token with `EdDSA`, checked by the core's JWKS, with its own `id` in `aud`; it does not see the person's session, and it declares no roles of its own: it works with `member`, `administrator` and `service`.
22. Only the core draws the frame — the tree, the row, the panel's look; a plugin only adds nodes to the tree by a declaration in `navigation.yaml`.
23. A plugin's node attaches to the root, to a node of the core or to a node of a direct dependency; the installer builds the tree, and a build error cancels the operation.
24. Everything a person sees on a page is in the panel address; a page builds its view from its address only.
25. Inside the panel a plugin creates no history entries and does not answer `panel.location` with `panel.navigate`.
26. The moment is the address parameter `at`; it never passes through `Date`.
27. The organization is the first segment of every address; the gateway checks the person's membership in it, an organization-scoped action checks it again in its `@access_decide`, and every query is bound to it.
28. Access is split three ways: the role in `@check_roles`, the organization and the object in one `@access_decide`, the work in aspects.
29. A room works on every page; pointers travel in canvas units; a room shares no parameter of a page's address; a plugin has no room connection of its own.
30. A plugin has no canvas of its own: moving, zooming, the field and the camera come from the core's `<MaxitorCanvas>`, one for every plugin.
31. A page's controls — filters, layer pills, the bottom bar's sections, its actions — are given by the page to the shell of `@maxitor/panel`, which draws them in the same places for every plugin; each is an address parameter; the core's names are refused; `maxitor-plugin-check` keeps the shell's boundary.
32. Colours and sizes come from `@maxitor/tokens` and the core's palette; no code has numbers of its own.

## 14. What the tests check

Code breaks — a test catches it, each of these:

1. a passport with an unknown field, a wrong `name` or a version other than the package's fails the check;
2. a closure with an unavailable dependency or a version conflict installs no plugin at all;
3. a cycle `a → b → a` and depending on oneself are refused, and the cycle is named;
4. a version's user cannot read, write or create anything outside its schema, and `maxitor_core` cannot create a schema or a role;
5. the plain password of a version's user reaches no statement of the database, only its environment file;
6. a `schema.yaml` with an unsafe name or an unknown type is refused before any SQL, and a deploy cut off at any step leaves nothing;
7. a `foreign-keys.yaml` with a quote, a dot or a `;` in a name, with a schema that is not a dependency, with a `_versions` table or with mismatched types is refused before any SQL;
8. a key to the core needs no right of the version's user, and a key to a dependency is refused;
9. the plugin's backend refuses a token with someone else's `aud`, with `HS256`, or expired;
10. the session cookie does not reach the plugin's process;
11. a call through the gateway into a plugin that is not a direct dependency is refused;
12. removing a plugin is refused while plugins depend on it, and otherwise changes not a single row of the core;
13. a `navigation.yaml` with `attach` to a plugin that is not a dependency, an undefined `{parameter}`, a repeated `key` in a scope or equal `page` templates fails the tree build, and the operation is undone;
14. a plugin's node cannot hide, rename or move a node of the core: the schema lets no such field through;
15. a list that does not answer in one plugin does not break the rest of the tree;
16. a `/w/...` address opened again gives the same organization, view, node in the tree and moment;
17. ten switches of the mode give exactly ten history entries, and Back returns them one by one;
18. `/p/<name>/<organization>/...` opened outside the panel is redirected to `/w/<organization>/<name>/...`;
19. a follower in a room gets the leader's address and does not end following by itself; a page that answers `panel.location` with `panel.navigate` is caught by a test of `@maxitor/panel`;
20. a change of a page's parameter by one participant reaches no other, except a follower, who gets the leader's whole address;
21. the core relays a pointer from a plugin's page with the participant it assigned itself, and only to participants on the same page;
22. a `postMessage` from another origin or of an unknown shape is dropped;
23. a write of the panel router that changes `at`, `mode`, `from` or a `_…` name is refused, and so is a page that steps out of the shell (`maxitor-plugin-check`);
24. a change of a control writes its parameter into the address and one history entry, and the default value does not get into the address;
25. a gesture on the canvas of two different plugins moves and zooms them alike: the handler is one;
26. a plugin whose `navigation` format is not in the core's `reads`, or whose `requires.maxitor` does not include the core's version, is not installed, and the refusal names both versions;
27. two plugins that need incompatible ranges of a third are not installed together, and the refusal names both requirements;
28. an upgrade of the core or of a plugin after which a dependent plugin falls out of its range is refused; removing a plugin others depend on is refused;
29. a plugin with an SDK of another major version than the core's is not enabled;
30. the installer, `maxitor plugin check` and the core's upgrade give the same answer on the same set: the function is one;
31. a request to an organization the person does not belong to is answered `404` by the gateway and reaches no action; the same call made straight to a plugin's backend is refused by its `@access_decide` with `FORBIDDEN_OBJECT`, and no aspect runs;
32. an organization in a request body never replaces the organization of the address.

## 15. What changes in the constitution

Rule 56 already says it (1.7.0): the session token stays `HS256`, a token one service issues for another is signed with `EdDSA` and checked by the issuer's JWKS. Proposals to the maintainer, not edits:

- a new section "Maxitor plugins" — the rules of section 13 of this document, including the core's contract and the rule of the major version (section 3.4);
- rule 24 does not change but gains an example: a plugin's schema is a resource of its own, and a transaction between resources is impossible by the way roles are set up.

## Open questions

- The extension point "may this be deleted" and the other points through which the core asks plugins.
- Row-level security (RLS) by `organization_id`, if reading every schema by every plugin turns out to be too much.
- A plugin catalog: where to find plugins and who signs their releases.
