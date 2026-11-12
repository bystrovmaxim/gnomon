# Feature Specification: Maxitor core — the core builds every plugin's frontend with its own `@maxitor/panel`

**Feature Branch**: `feature/issue-110-core-builds-frontends`

**Created**: 2026-11-12

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#110, "07 · Maxitor core: the core builds every plugin's frontend with its own @maxitor/panel". The issue's body is the source of truth. This step has no screens of its own: what a person sees of it are the core's messages when a build fails and the template's page drawn by the core's library.

## What this is

Every page of every plugin is drawn by one version of `@maxitor/panel` and `@maxitor/tokens`: the core's. If every plugin brought the library inside its own build, ten plugins would show ten versions of the frame — ten looks of the filters, the bottom bar and the canvas. Loading the library from the core while the page runs does not work either: its components must run on the same React that the page's Next.js build carries. So the core builds every plugin's frontend itself, with its own library: a plugin's wheel carries the frontend's sources, and the installer builds them when it deploys the version. The server's rendering and the browser get one build, with one library and one React.

Today (bystrovmaxim/gnomon#75) a plugin's wheel carries a built site, `frontend.build` in passport format 2, and the runner packs it into an image on `node:22-slim`. Whatever library the author built with is what the page shows.

Words used below:

- **Core** — Maxitor without plugins: sign-in, organizations, the frame, the gateway, the installer and the runner.
- **Plugin version** — one release of a plugin: a wheel with its passport, its backend, its frontend's sources and its lock file.
- **Frontend** — a plugin's pages: a Next.js application drawn with `@maxitor/panel`.
- **The library** — `@maxitor/panel` and `@maxitor/tokens`, released with the core.
- **Builder image** — `maxitor-plugin-builder:<core version>`, the one image a core version builds every frontend in.
- **Build** — the installed and built frontend of one plugin version for one core version.
- **Registry proxy** — the core's door to npm, which lets through only the packages on its list.
- **Installer** — `maxitor-plugin-installer`, which checks and deploys plugin versions.
- **Runner** — `maxitor-plugin-runner`, which keeps every enabled version running in containers.
- **Upgrade** — the core starting at a version whose library differs from the one the running builds were made with.

## Clarifications

### Session 2026-11-12

Decided with the maintainer before this specification was written, and recorded in bystrovmaxim/gnomon#110 and the plugins epic (bystrovmaxim/gnomon#72).

- Q: Why does the core build a plugin's frontend instead of taking a built site? → A: One library and one React for every page. A plugin that ships a built site ships its own copy of the frame, and the frame would differ from plugin to plugin.
- Q: Is passport format 2 still read beside format 3? → A: No. No plugin outside this repository ships a built frontend, so the core reads format 3 only, as it stopped reading earlier formats before.
- Q: What is the registry proxy, and where does its list come from? → A: Not a copy of npm: a small door every build goes through to the real npm, letting through only the package names on the core's list and answering every other name with a refusal; the plugin's lock file fixes the versions and their checksums. The list is one file in the core's package, kept in git and released with the core; it holds every name the template's frontend and the library need, nested dependencies included, and a script makes it from their lock files at every core release, CI checking that the template builds through the proxy with it. An author who needs another package asks for it; it is added in the core's repository and released with the core's next minor version, and until then a plugin with it is refused by the package's name.
- Q: Where does the builder image come from? → A: It is built on the host from the core's package the first time a build needs it, and kept there; nothing more is published with a core release.
- Q: Who walks the stand of this step? → A: The walk of 1.6 is made during this step, its result recorded on the pull request; the maintainer walks the steps 07–10 together after bystrovmaxim/gnomon#100.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A plugin version's frontend is built by the core when it is deployed (Priority: P1)

An administrator installs a plugin from its wheel. The installer finds the frontend's sources and lock file in the wheel, builds them in the core's builder image with the core's library in place of whatever version the plugin names, and only then deploys the version. The page the person opens is drawn by the core's library.

**Why this priority**: This is the work itself; without it every plugin shows its own frame.

**Independent Test**: Install the template from its wheel on the local stand, with its own `package.json` naming an older `@maxitor/panel`; open its notes page and read the library's version the page reports: it is the core's.

**Acceptance Scenarios**:

1. **Given** a plugin version whose wheel carries `frontend.source` and a lock file, **When** the installer deploys it, **Then** the frontend is built in the builder image of the running core version before the version is deployed.
2. **Given** a plugin whose `package.json` names `@maxitor/panel` 0.1.0 while the core carries 0.3.0, **When** the build runs, **Then** every `@maxitor/*` package resolves to the core's version and the page draws with it.
3. **Given** the build, **When** it installs the plugin's packages, **Then** it installs strictly by the plugin's lock file, as an unprivileged user, in a network of its own, and every package comes through the registry proxy.
4. **Given** the build, **When** it runs, **Then** only the core sets the build's variables; nothing of the plugin's environment or the core's secrets reaches it.
5. **Given** a built version, **When** the runner starts it, **Then** it runs that build — not a site taken from the wheel.

---

### User Story 2 - A build that fails refuses the deployment by name (Priority: P1)

A plugin whose frontend does not build — a type error, a missing package, a package outside the registry proxy's list — is not deployed, and the administrator and the log say which plugin, which version and why.

**Why this priority**: A half-deployed plugin with a missing page is worse than a refused one; the author needs the reason to fix it.

**Independent Test**: Install a copy of the template whose page has a type error: the deployment is refused, the plugin's line in Settings → Plugins says it, and the core's log names the plugin, its version and the build's first error.

**Acceptance Scenarios**:

1. **Given** a frontend that fails to build, **When** the installer deploys the version, **Then** the deployment is refused with a message naming the plugin, its version and the first error of the failing step, and nothing of the version runs.
2. **Given** a lock file naming a package the registry proxy does not let through, **When** the build installs it, **Then** the build fails naming that package.
3. **Given** a wheel of passport format 2 carrying `frontend.build`, **When** the installer checks it, **Then** it is refused by name: the core reads passport format 3 only.

---

### User Story 3 - Upgrading the core rebuilds every enabled version, and the site moves only when all are built (Priority: P1)

The core is upgraded to a version with a new library. Every enabled plugin version is rebuilt with it in the background while the old builds keep serving; when every build is ready the site moves to the new builds at once. If one of them fails, the site stays on the old builds and the message names the plugin.

**Why this priority**: Without it, an upgrade either leaves plugins on the old library or breaks them one by one in front of the users.

**Independent Test**: On the local stand, start the core at a version whose library differs: the template keeps answering while its frontend rebuilds, then answers with the new build. Repeat with a second plugin that fails to build: the site stays on the old builds, and the message names that plugin.

**Acceptance Scenarios**:

1. **Given** a core started at a version whose library differs from the running builds', **When** the installer sees it, **Then** it rebuilds the frontend of every enabled version in the background while the old builds keep serving.
2. **Given** every rebuild ready, **When** the last one finishes, **Then** the site moves to all the new builds together; never some on the new library and some on the old.
3. **Given** one rebuild that fails, **When** it fails, **Then** the move is cancelled, the old builds keep serving, and a critical message names the plugin, its version and the build's first error.

---

### User Story 4 - A plugin's author builds exactly what the core will build (Priority: P2)

The author of a plugin runs one command and gets the build the core will make, in the same image, by the same step; the local stand runs that production build behind the gateway, and the plugin's CI builds and checks it at both bounds of its `requires.maxitor`.

**Why this priority**: An author who checks a different build than the core makes finds failures only after release.

**Independent Test**: Run `maxitor plugin build --core <version>` on the template and on a copy with a type error: the first builds, the second fails with the same message the installer gives.

**Acceptance Scenarios**:

1. **Given** a plugin's folder, **When** the author runs `maxitor plugin build --core <version>`, **Then** the installer's own step runs in the builder image of that core version, and the result or the error is the one the installer would give.
2. **Given** the local stand, **When** it starts the template, **Then** it runs the production build behind the gateway; `next dev` stays for writing a page, not for checking it.
3. **Given** a plugin's CI, **When** it runs, **Then** it builds and runs its browser check at the lower and at the upper bound of `requires.maxitor`.

---

### User Story 5 - The library keeps its promise across minor versions (Priority: P2)

A minor version of `@maxitor/panel` only adds; whatever removes something or changes its meaning is a major version, released with the core's major. The core's CI proves it by running the template's browser check against every release of the library.

**Why this priority**: The core rebuilds every plugin with its library on every upgrade; that is safe only if a minor release breaks nothing a plugin relies on.

**Independent Test**: In the core's CI, the template's browser check runs once per release of the library and passes on each.

**Acceptance Scenarios**:

1. **Given** a new minor release of the library, **When** the core's CI runs, **Then** the template's browser check runs against it and against every earlier release of the same major.
2. **Given** a change that removes or changes the meaning of anything in the library, **When** it is released, **Then** it is a major version, released with the core's major.

---

### User Story 6 - The documentation describes delivery as built (Priority: P2)

The plugin concept, the tutorial and the READMEs say what a wheel carries, how the core builds a frontend, how the author builds the same way, and what passport format 3 holds.

**Why this priority**: The tutorial is what every author follows; it must not tell them to ship a built site.

**Independent Test**: Read the concept's delivery, building and passport, the tutorial's chapters 1, 2 and 13 and the READMEs of the installer, the runner and the template: every statement matches what the code does.

**Acceptance Scenarios**:

1. **Given** the concept, **When** it is read, **Then** it describes `frontend.source`, the builder image, the registry proxy, the upgrade and the library's versions as built.
2. **Given** the tutorial's chapters 1 and 2, **When** they are read, **Then** they speak of the frontend as sources the core builds, and their rows in the index name this step; chapter 13 holds the tests of this step.

---

### Edge Cases

- A plugin's lock file is missing or does not match its `package.json`: the build fails by name — a build never resolves versions anew.
- A plugin names an `@maxitor/*` package the core does not carry: the build fails naming the package.
- Two versions of one plugin are enabled in different organizations: each is built and runs on its own.
- The builder image of the running core version is missing on the host: the installer builds it before it builds any frontend, and says so in the log.
- The registry proxy cannot reach npm: the build fails naming the proxy, and the next deployment round tries again.
- An upgrade starts while a deployment is building: the deployment's build is made with the new core's library.
- A rebuild during an upgrade fails and the plugin is then fixed and redeployed: the move happens once every enabled version has a build of the new library.
- A plugin is disabled during an upgrade: its rebuild is no longer waited for.

## Requirements *(mandatory)*

### Functional Requirements

#### What a wheel carries

- **FR-001**: A plugin's wheel MUST carry its frontend's sources and its lock file; the passport's `frontend.source` MUST name them, in passport format 3.
- **FR-002**: The core MUST refuse by name a passport of format 2 and a `frontend.build`.

#### Building

- **FR-003**: Each core version MUST have one builder image, `maxitor-plugin-builder:<core version>`: Linux, the core's Node, the time zone UTC and one fixed locale; it MUST be built on the host from the core's package the first time a build needs it, and kept.
- **FR-004**: The installer MUST build a version's frontend when it deploys the version, in a container of the builder image, as an unprivileged user, in a network of its own.
- **FR-005**: The build MUST install packages strictly by the plugin's lock file, replace every `@maxitor/*` package with the core's, and then build the application for production.
- **FR-006**: Only the core MUST set the build's variables; the build MUST receive none of the plugin's or the core's secrets.
- **FR-007**: Packages MUST come from npm through the core's registry proxy, which MUST let through only the package names on the core's list and refuse every other name; the list MUST be one file in the core's package, made at every core release from the lock files of the template's frontend and the library, nested dependencies included, and CI MUST check that the template builds through the proxy with it.
- **FR-008**: A failed build MUST refuse the deployment and MUST name the plugin, its version and the first error of the failing step, in the administrator's view of the plugin and in the core's log.
- **FR-009**: The runner MUST run the build the installer made, never a site from the wheel.

#### Upgrading the core

- **FR-010**: When the core starts at a version whose library differs from the running builds', the frontend of every enabled version MUST be rebuilt in the background while the old builds keep serving.
- **FR-011**: The site MUST move to the new builds only when all of them are built, all together.
- **FR-012**: One failed rebuild MUST cancel the move, keep the old builds serving, and raise a critical message naming the plugin, its version and the error.

#### The author

- **FR-013**: `maxitor plugin build --core <version>` MUST run the installer's own build step in the builder image of that core version and give the same result or error.
- **FR-014**: The local stand MUST run the template's production build behind the gateway.
- **FR-015**: The template's CI MUST build it and run its browser check at the lower and the upper bound of its `requires.maxitor`.

#### The library

- **FR-016**: A minor version of `@maxitor/panel` MUST only add; a removal or a change of meaning MUST be a major version, released with the core's major.
- **FR-017**: The core's CI MUST run the template's browser check against every release of the library within the core's major.

#### The template, documentation, changelog, versions

- **FR-018**: The template's wheel MUST carry its frontend's sources and lock file under passport format 3.
- **FR-019**: The plugin concept (delivery, building, passport format 3, the library's versions), the tutorial's chapters 1, 2 and 13 with their rows in the index, and the READMEs of the installer, the runner and the template MUST describe what this work builds.
- **FR-020**: Every changed package MUST raise its version, and the changelog MUST describe the work.

### Key Entities

- **Plugin version**: a wheel with its passport (format 3), its backend, its frontend's sources and its lock file.
- **Builder image**: one per core version; Linux, the core's Node, UTC, one locale.
- **Build**: the built frontend of one plugin version for one core version; the runner serves it.
- **Registry proxy and its list**: the packages a build may install.
- **Upgrade**: the rebuild of every enabled version for a new core version, moved to as one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the local stand, the template's page reports the core's library version in 100% of opens, whatever version its own `package.json` names.
- **SC-002**: A frontend that fails to build is refused by name in 100% of tries, and nothing of that version answers through the gateway.
- **SC-003**: During an upgrade the template keeps answering with 0 failed requests, and after it every enabled plugin answers with the new build; no moment shows two libraries at once.
- **SC-004**: A rebuild that fails during an upgrade leaves 100% of plugins on the old builds and names the failing plugin.
- **SC-005**: The author's command and the installer give the same result for the same plugin and core version in 100% of tries — the same success, or the same first error.
- **SC-006**: Every refusal of FR-002, FR-007 and FR-008 has a test that builds the fault and sees it refused by name; every such test fails when its check is removed.

## Assumptions

- The running plugins of bystrovmaxim/gnomon#75 — the installer, the runner, the gateway, one sign-in — are in place and are changed here only as the requirements say.
- Docker is on the host of the installer and the runner, as it is for the runner today.
- The template is the only plugin with a frontend; no plugin outside this repository ships a built site, so passport format 2 is refused without a period of both.
- A package an author needs is added to the list in the core's repository and reaches plugins with the core's next minor version.
- The browser checks run locally on the stand, as CI cannot run them; the plugin's CI runs its own browser check.
