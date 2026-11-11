# Feature Specification: Maxitor core — running plugins: the gateway, the processes and one sign-in

**Feature Branch**: `feature/issue-75-plugin-hosting`

**Created**: 2026-11-11

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#75, "02 · Maxitor core: running plugins — gateway, processes and one sign-in". The issue's body is the source of truth; the plugin concept (`docs/plugins/concept.md`, sections 6.1–6.6) describes the routes, the sign-in and the calls this work builds. This work has no screen of its own.

## What this is

Bystrovmaxim/gnomon#82 installs a plugin: it checks its wheel, builds its schema and its database user, and writes the version's environment file. Nothing runs it yet. Here the core runs every installed plugin and puts it behind one site with one sign-in.

A plugin is code the core does not trust. It runs as processes of its own, on an inner address nobody outside reaches. Every request to it passes the core's gateway, which checks the person's session and membership and gives the plugin a short token the core signed. The plugin can check that token and cannot make one. It never sees the session.

A plugin has no roles of its own. The token carries the person's role in the core in the organization of the address — `member`, and `administrator` for its administrators — and the plugin guards its actions with those roles as they are.

Words used below:

- **Gateway** — the part of the core's site that takes every request and hands it on by its path.
- **Inner address** — `127.0.0.1:<port>`, where a plugin's process listens; only the gateway reaches it.
- **Plugin process** — a plugin version's backend or frontend, running in a Docker container of its own, started and watched by the core.
- **Runner** — the core's process that starts, watches and stops the plugin processes.
- **Plugin token** — a JWT the core signs with its private key (EdDSA) for one plugin: the person, the organization, the person's role in the core there, the plugin's id in `aud`, 60 seconds of life.
- **JWKS** — the core's public key, published so that a plugin checks a token.
- **Service key** — a secret the core gives a plugin version on deployment, with which the plugin asks for a token when no person is behind a call.
- **Direct dependency** — a plugin named in the caller's passport `dependencies`.

## Clarifications

### Session 2026-11-11

Decided with the maintainer while the epic bystrovmaxim/gnomon#72 was put in order.

- Q: How are plugin tokens signed? → A: With EdDSA by the core's private key; the core publishes the public key as a JWKS and a plugin checks tokens by it. The core's own session token stays HS256: only the core checks it. Rule 56 of the constitution, 1.7.0.
- Q: Which roles does a plugin get? → A: The person's role in the core in the organization of the address, as it is: `member` for every active user, `administrator` added for an administrator; `service` for a call with no person. A plugin declares no roles; the passport's `roles` section is refused. The role is read from the core's tables when the token is issued, never from the request.
- Q: What is the gateway? → A: The core's Next.js application, which already passes `/api/**` to the core's backend. It asks the core's backend, by an action, whether a request may pass and with which token; the decision and the signing are actions, the passing on is the application's.
- Q: Who starts the plugin processes? → A: A process of the core's own, `maxitor-plugin-runner`, beside `maxitor-plugin-installer`; it runs the actions of the domain `plugins` in itself, with no HTTP route, and records where each process listens.
- Q: Where does a plugin's Python environment come from? → A: From the version's wheel and its requirements, built once into the version's own Docker image; a requirement not on the package index yet is taken from a folder of wheels the operator names. The local stand fills that folder from the AOA submodule and the workspace.
- Q: Why containers rather than processes of the runner's user? → A: Processes of one operating-system user could read each other's environment files and the runner's own environment, the core's database password included. A container runs as an unprivileged user with only its own file, its limits and its version's own network.
- Q: Does the template's frontend run here? → A: No: it needs `@maxitor/panel`, which comes with the frame (bystrovmaxim/gnomon#74). The frontend process is proved on a test plugin whose wheel carries a small built page; the template's frontend runs from bystrovmaxim/gnomon#74 on.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A member reaches an enabled plugin through the core's site (Priority: P1)

A member of an organization, signed in to the core, calls the API of a plugin enabled in that organization at `/p/<name>/api/<organization>/...` and gets the plugin's answer, with no sign-in of the plugin's own.

**Why this priority**: Nothing a plugin does reaches a person without it; every later step of the epic stands on it.

**Independent Test**: On the local stand, sign in, enable `notes` in an organization, call the template's list of notes through the core's site and get an answer; call it with another organization, signed out, or with the plugin disabled, and get a refusal.

**Acceptance Scenarios**:

1. **Given** a signed-in active member of `acme` and `notes` enabled in `acme`, **When** they call `/p/notes/api/acme/...`, **Then** the plugin answers, and the plugin received a plugin token for itself and no cookie of the core.
2. **Given** a person who is not an active member of `beta`, **When** they call `/p/notes/api/beta/...`, **Then** the answer is `404`, the same as for an organization that does not exist, and the plugin is not reached.
3. **Given** `notes` installed but disabled in `acme`, **When** a member calls it, **Then** the answer is `404` and the plugin is not reached.
4. **Given** no session, **When** someone calls `/p/notes/api/acme/...`, **Then** the answer is `401` and the plugin is not reached.
5. **Given** a request carrying its own `Authorization` header, **When** it passes the gateway, **Then** the plugin receives only the token the gateway put there.
6. **Given** a changing request whose `Origin` is not the site's own, **When** it reaches the gateway, **Then** it is refused.

---

### User Story 2 - A plugin trusts only the core's token, made for it (Priority: P1)

A plugin's backend accepts a request only with a token the core signed for this plugin, unexpired, and reads the person, the organization and the role from it.

**Why this priority**: A plugin is untrusted code beside other untrusted code; one plugin must never act as another or as a person it was not given.

**Independent Test**: Give the template a token signed for it, one signed for another plugin, one signed with another key, and an expired one; only the first passes.

**Acceptance Scenarios**:

1. **Given** a token the core signed for `notes`, **When** the template checks it by the core's JWKS, **Then** it passes with the person, the organization and the role `member`.
2. **Given** a token the core signed for another plugin, **When** the template checks it, **Then** it is refused.
3. **Given** a token signed with any key but the core's, or one older than 60 seconds, **When** the template checks it, **Then** it is refused.
4. **Given** an administrator of the organization, **When** a token is issued for them, **Then** it carries `member` and `administrator`; for any other active user it carries `member` only.
5. **Given** a plugin's process, **When** its environment is read, **Then** it holds the JWKS address and no signing key.

---

### User Story 3 - The core runs the plugins that are enabled somewhere (Priority: P1)

The core starts a backend and a frontend for every deployed version that is enabled in at least one organization, keeps them running, and stops them when no organization has the version enabled.

**Why this priority**: Without processes there is nothing behind the gateway.

**Independent Test**: Enable a version in one organization and see its processes start on inner addresses; kill one and see it started again; disable the version everywhere and see both stop.

**Acceptance Scenarios**:

1. **Given** a deployed version enabled in one organization, **When** the runner takes its round, **Then** the version's backend and frontend run on inner addresses, each recorded for the gateway.
2. **Given** a running backend that exits, **When** the runner takes its next round, **Then** it is started again, with a pause that grows after repeated failures, and its failure is written as an event.
3. **Given** a version disabled in its last organization, **When** the runner takes its round, **Then** its processes stop and their addresses are removed.
4. **Given** a version's backend, **When** it starts, **Then** it runs in its own Python environment, installed from the version's wheel, with only its own environment file, the JWKS address and its inner address in its environment.
5. **Given** a version whose wheel carries no frontend build, **When** it runs, **Then** only its backend runs, and a request for its pages is answered `404`.

---

### User Story 4 - A plugin calls a direct dependency, and works with no person (Priority: P2)

A plugin's backend calls a plugin it depends on through the gateway, on behalf of the same person, and calls with its service key when no person is behind the work.

**Why this priority**: Plugins that build on others and background work (the delivery of events, bystrovmaxim/gnomon#95) need it; a single plugin works without it.

**Independent Test**: A test plugin that depends on another calls it through the gateway with its incoming token and gets an answer; it calls a plugin that is not its dependency and is refused; with its service key it gets a token with `sub: "plugin:<id>"` and the role `service`.

**Acceptance Scenarios**:

1. **Given** plugin A depending on B and a token issued for A, **When** A calls `/p/B/api/<organization>/...` through the gateway with that token, **Then** B receives a token issued for B with the same person, organization and role.
2. **Given** plugin A not depending on C, **When** A calls C through the gateway, **Then** the call is refused and C is not reached.
3. **Given** a version's service key, **When** the plugin asks the core for a service token for an organization where it is enabled, **Then** it gets a token for itself with `sub: "plugin:<id>"` and the role `service`; for an organization where it is not enabled, it is refused.
4. **Given** a service key of another version or a made-up one, **When** a plugin asks for a service token, **Then** it is refused.

---

### User Story 5 - The template works with the core's roles (Priority: P2)

The plugin template guards its actions with the core's role `member`, declares no roles of its own, and runs on the local stand behind the gateway.

**Why this priority**: The template is the pattern every plugin is copied from; it must show the rules of this work.

**Independent Test**: `maxitor-plugin-check` accepts the template and refuses a passport with `roles`; on the local stand the template's actions answer through the gateway.

**Acceptance Scenarios**:

1. **Given** the template's passport, **When** it is checked, **Then** it has no `roles` section and is accepted; a passport with `roles` is refused, naming the rule.
2. **Given** the template's actions, **When** a token with `member` calls them, **Then** they answer; a token with no `member` is refused.
3. **Given** the local stand (`scripts/core-stand.sh up`), **When** it starts, **Then** the gateway, the runner and the template's backend run, and the template's API is reached as `/p/notes/api/<organization>/...`.

### Edge Cases

- A plugin's backend does not answer: the gateway answers `502` for that plugin only; the rest of the site works.
- Two runners start at once: each version's processes are owned by one runner, by a database lock; the other leaves them alone.
- The core's private key is missing at start: the core's backend refuses to start, naming the setting; it never makes up a key.
- A version is upgraded: the old version's processes stop once no organization has it enabled; the new one's start; requests of an organization go to the version that organization has.
- A port: Docker chooses a free one on `127.0.0.1`, and the runner records it.
- A token is used after the session ended: it lives at most 60 seconds; the next request gets no new token.
- A plugin's frontend asks its own backend: a server component goes to its inner address from `MAXITOR_PLUGIN_API` with the incoming `authorization`, never through the browser.

## Requirements *(mandatory)*

### Functional Requirements

**The gateway**

- **FR-001**: The core's site MUST hand a request on by its path: `/api/**` to the core's backend, `/p/<name>/api/**` to the backend and `/p/<name>/**` to the frontend of the plugin `<name>`, everything else to the core's pages.
- **FR-002**: Before handing a request to a plugin, the gateway MUST ask the core's backend, by an action, for a pass: the action checks the session, the person's active membership in the organization of the address, that the plugin is enabled there and running, and answers the plugin token and the inner address, or a refusal.
- **FR-003**: A refusal for an organization the person does not belong to, a plugin not enabled there, or a plugin that does not exist MUST be the same `404`; a request with no session MUST be `401`.
- **FR-004**: The gateway MUST remove the core's cookies and any incoming `Authorization` header from a request to a plugin and add `Authorization: Bearer <plugin token>`.
- **FR-005**: The gateway MUST refuse a changing request (not `GET`, `HEAD` or `OPTIONS`) to a plugin whose `Origin` is not the site's own.
- **FR-006**: A plugin that does not answer MUST give `502` for its own requests only.

**The tokens**

- **FR-007**: A plugin token MUST be a JWT signed with EdDSA by the core's private key, with `iss: "maxitor"`, `aud` the plugin's passport id, `sub` the person's account (`plugin:<id>` for a service token), `sid`, `org` the organization's code, `roles`, `iat` and `exp` 60 seconds later.
- **FR-008**: `roles` MUST be `["member"]` for an active user of the organization, `["member", "administrator"]` for its administrator and `["service"]` for a service token, read from the core's tables when the token is issued.
- **FR-009**: The core MUST publish its public key as a JWKS by an action at `/api/v1/jwks`; the private key MUST come from a file named by the environment and never appear in a log, an error or a `repr`.
- **FR-010**: The core's session token MUST stay as it is (HS256, the cookie `__Host-maxitor_session`).

**Calls between plugins and with no person**

- **FR-011**: A plugin's backend MUST be able to call a direct dependency through the gateway's inner address with its incoming token; the gateway MUST exchange it, by an action, for a token issued for the callee with the same person, organization and roles, and refuse a callee that is not a direct dependency of the caller's version enabled in that organization. A plugin's calls to the core's own actions come with the first core action a plugin needs (bystrovmaxim/gnomon#95).
- **FR-012**: On deployment, each version MUST get a service key: written into its environment file only, its hash kept by the core.
- **FR-013**: A plugin presenting its service key and an organization where it is enabled MUST get a service token for itself; any other key or organization MUST be refused.

**The processes**

- **FR-014**: The runner MUST, on start and every round, run one backend and, when its wheel carries a frontend build, one frontend for every deployed version enabled in at least one organization, each listening on an inner address it records for the gateway.
- **FR-015**: Each version's backend and frontend MUST run in Docker containers of their own from images built from its wheel — as user 65534, with no capabilities, no new privileges, a read-only file system, limits of memory, CPU and processes, a network of the version's own, the port published on `127.0.0.1` only; requirements not on the package index MUST be taken from a folder of wheels named by the environment.
- **FR-016**: A container's environment MUST hold only its version's environment file (the frontend not even that), the database and the gateway as the containers reach them, the JWKS through the gateway and its backend's address — no setting or secret of the core.
- **FR-017**: A process that exits MUST be started again on a later round, with a growing pause after repeated failures; every start, exit and stop MUST be a typed event of the domain `plugins`.
- **FR-018**: A version enabled in no organization MUST have its processes stopped and their addresses removed.
- **FR-019**: One runner MUST work at a time, by a database lock; on its start it MUST remove every plugin container a stopped runner left.

**Roles and the template**

- **FR-020**: `maxitor-plugin-sdk` MUST give the role classes `MemberRole`, `AdministratorRole` and `ServiceRole` for a plugin's `@check_roles`.
- **FR-021**: `maxitor-plugin-check` and the core's check of a version MUST refuse a passport that declares `roles`, and a node of `navigation.yaml` whose `roles` names anything but `member` or `administrator`.
- **FR-022**: The template MUST declare no roles, guard its actions with `MemberRole`, check tokens by the core's JWKS, and its nodes MUST name `member`.
- **FR-023**: The local stand MUST start the gateway, the runner and the template's backend with the core, and fill the folder of wheels from the AOA submodule and the workspace.

### Key Entities

- **Plugin process**: one running backend or frontend of a deployed version — its kind, inner address, the runner that owns it, when it started, how many times it failed in a row. Mechanics of work, not the state of data: kept without versions.
- **Service key**: a version's secret for calls with no person; the core keeps only its hash, beside the version.
- **Core signing key**: the core's Ed25519 key pair; the private part in a file outside the database, the public part answered as a JWKS.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in member reaches an enabled plugin's API through the core's site with no second sign-in, in every scenario of User Story 1.
- **SC-002**: 0 requests reach a plugin from a person who is not an active member of the organization of the address, from a disabled plugin, or with a token not made for that plugin — proved by a test for each.
- **SC-003**: A plugin process killed by hand runs again within two rounds of the runner.
- **SC-004**: A plugin token is accepted for at most 60 seconds after it is issued.
- **SC-005**: No plugin process's environment holds a value of the core's settings — proved by reading a started process's environment in a test.
- **SC-006**: On the local stand, one command starts the core, the gateway, the runner and the template, and the template's API answers through the gateway.

## Assumptions

- Installing, disabling, enabling and the version's schema and database user are bystrovmaxim/gnomon#82's; the environment file it writes is where the version's database address lives.
- The stand (`maxitor.aoa.run`) is set up in bystrovmaxim/gnomon#73 and walked in bystrovmaxim/gnomon#92; this work runs on the local stand. Publishing AOA and `maxitor-plugin-sdk` to PyPI for the real stand is the maintainer's, by tag.
- The frame, the panel and `@maxitor/panel` are bystrovmaxim/gnomon#74; this work gives the panel nothing to show but passes `/p/<name>/**` to a frontend when one runs.
- A request in the browser opening `/p/<name>/...` as a document, outside the panel, is redirected by the frame (bystrovmaxim/gnomon#74), not here.
- Events delivered to plugins are bystrovmaxim/gnomon#95; it uses the service tokens of this work.
