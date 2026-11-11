# Feature Specification: Maxitor core — the frame: the left tree, the top row, the right panel, the canvas and the controls

**Feature Branch**: `feature/issue-74-core-frame`

**Created**: 2026-11-11

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#74, "05 · Maxitor core: the frame on Next.js — the left tree, the top row, the right panel, the canvas and the controls". The issue's body is the source of truth; the plugin concept (`docs/plugins/concept.md`, section 7) describes the frame this work builds. The look comes from what is already drawn: the mockups `specs/059-maxitor-concept/mockup/index.html` and `specs/074-notes-history/mockup/index.html`, and today's components of maxitor-web — its canvases, the zoom bar, the events explorer's mode pill, the ERD's filter panel, the domain legend and the client's styles. No new mockup is drawn.

## What this is

Every Maxitor plugin shows its pages in one screen, and only the core draws that screen: the **left tree**, the **top row** and the **right panel**, a grey field with dots on which a plugin's page opens. Today the core's Next.js application (bystrovmaxim/gnomon#73) shows an organization's screen at `/w/<code>` with a short tree of the enabled plugins' top sections and the user's icon; a plugin's page cannot open in it yet. This work makes that screen the frame plugins live in: the tree built from the core's and the plugins' `navigation.yaml`, a page of a plugin opened in the right panel at one address, one canvas and one set of controls for every plugin, and one set of style tokens they all draw with.

The first plugin to live in it is the plugin template `notes`: its notes page opens in the core's right panel, with its view switch and writer filter drawn by the core.

Words used below:

- **Core** — Maxitor without plugins: sign-in, organizations, the frame, the gateway, the installer.
- **Plugin** — a package installed into the core that adds data, actions and pages; **owner** — the core or the plugin a node or a page belongs to.
- **Member** — a person with the core's role `member` in the organization of the address; **administrator** — with the role `administrator`.
- **Frame** — the left tree, the top row and the right panel; only the core draws it.
- **Tree** — the left navigation; **node** — one row of it; **attachment node** — a node another owner's nodes may stand under; **list node** — a node that multiplies by records at run time, one instance per record its owner's reading action, its **source**, gives.
- **Tree builder** — the part of the installer that joins the core's and the enabled plugins' `navigation.yaml` into one tree and refuses one that does not hold.
- **Panel address** — `/w/<organization>/<owner>/<path>?<parameters>&at=<moment>`, the address in the browser's address bar while a page is open; the only source of what the panel shows.
- **Moment** — a point in time, to the microsecond, at which data is read; **watermark** — "now", the latest moment whose answer can no longer change.
- **Panel protocol** — the messages the core and a plugin's page exchange: `panel.ready`, `panel.navigate`, `panel.title`, `panel.open` from the page, `panel.location` and `panel.watermark` from the core.
- **`@maxitor/panel`** — the package a plugin's frontend draws its page with: the page document, the router, the address parameters, the canvas and the common pieces of content.
- **`@maxitor/tokens`** — the package of colours, palette, radii, shadows, blur, type sizes and spacing.
- **Canvas** — `<MaxitorCanvas>`, the one field for all of Maxitor that moves and zooms.
- **Controls** — the mode pill, the view switch, the filters and the legend over the right panel; a plugin declares them, the core draws them.

## Clarifications

### Session 2026-11-11

Decided while this specification was written, from the issue, the plugin concept and the order of the plugins epic (bystrovmaxim/gnomon#72).

- Q: Does the frame show presence, following or other people's pointers? → A: No. The places for the time scale (bystrovmaxim/gnomon#98) and for who is on the page (bystrovmaxim/gnomon#76) stand in the top row and stay empty; the canvas gives the camera those steps use, and draws no pointer of another person.
- Q: Does the top row choose a moment? → A: No: the scale is bystrovmaxim/gnomon#98. The frame carries `at` from the address to the page and to the list nodes as it is, and with no `at` everything reads at the watermark and `panel.watermark` reaches the page when the watermark moves.
- Q: Which pages of the template open in the right panel here? → A: Its root and its notes page, with the view switch and the writer filter from its `controls`. The pages Published notes and Draft open as pages that say what will come there; their content is bystrovmaxim/gnomon#102.
- Q: How do the template and the core get `@maxitor/panel` and `@maxitor/tokens`? → A: Both packages live in this repository, each a level with its own version, and the core's application and the template's frontend are built with them as they are released from it. Publishing them to the npm registry is a release step by the maintainer's tag, outside this work.
- Q: Does the graph viewer (maxitor-web) move onto the frame, the canvas or the tokens here? → A: No; it moves as a plugin in bystrovmaxim/gnomon#77. Here its components are the source the canvas, the controls and the tokens are made from, and maxitor-web itself is not changed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A member opens a plugin's page in the frame (Priority: P1)

A member opens their organization. On the left they see the tree: the sections of the enabled plugins and, for an administrator, Settings at its foot. They open the template's section, then an item, then its Notes: the item's notes appear in the right panel, over the grey field with dots, while the tree, the top row and the path to the node stay as they are.

**Why this priority**: This is what the frame is for; every later step of the plugins epic opens its pages here.

**Independent Test**: On the local stand, with `notes` enabled in an organization that has two items, open `/w/<code>`, open Notes → the first item → Notes in the tree: the notes page shows in the right panel, the path in the top row reads Notes › <item> › Notes, and the address is `/w/<code>/notes/items/<item_id>`.

**Acceptance Scenarios**:

1. **Given** an organization with `notes` enabled, **When** a member opens `/w/<code>`, **Then** the tree shows the node Notes, and Settings only if they are an administrator.
2. **Given** the node Notes, **When** the member opens it, **Then** its instances load — one per item of the organization, titled by the item — and the root page of `notes` opens in the right panel.
3. **Given** an item under Notes, **When** the member opens it and chooses Notes under it, **Then** the item's notes page opens in the right panel at `/w/<code>/notes/items/<item_id>`, the node is highlighted and the top row shows the path to it.
4. **Given** a page of `notes` open, **When** the member chooses another node of `notes`, **Then** the page changes without the frame reloading: the tree keeps its open nodes and its scroll.
5. **Given** a page of `notes` open, **When** the member chooses Settings → Plugins, **Then** the core's own page opens in the panel, drawn by the core itself.
6. **Given** a page title sent by the page, **When** the page is open, **Then** the top row's path and the browser tab show it.

---

### User Story 2 - An address gives back exactly what was on screen (Priority: P1)

A member copies the address of an open page — with its item, its view, its filter and, if one was chosen, its moment — and opens it again, sends it to a colleague, reloads, or goes Back and Forward. Each time they see exactly what was there.

**Why this priority**: The address is the only source of the panel's state; links, reloads and history depend on it, and so do the time scale and following later.

**Independent Test**: Open the notes page of an item, switch to the table and filter by one writer; reload, open the address in a new tab, go Back twice and Forward twice: every time the screen matches the address.

**Acceptance Scenarios**:

1. **Given** `/w/<code>/notes/items/<item_id>?view=table&author=<id>`, **When** it is opened in a new tab, **Then** the tree opens the path to the node, highlights it, the notes page shows the table filtered by that writer, and the controls show the table and the filter switched on.
2. **Given** a member who switched the view and then the filter, **When** they press Back once, **Then** only the filter is undone; **When** they press Back again, **Then** the view is undone; Forward restores them in turn.
3. **Given** a change made inside a plugin's page, **When** the page asks to change its state, **Then** exactly one history entry is added, in the window's address, never inside the panel's frame.
4. **Given** a continuous change, such as typing in a search field, **When** it goes on, **Then** the address is replaced as it goes and one history entry stands at its end.
5. **Given** an address with `at=<moment>`, **When** it is opened, **Then** the page and the list nodes read at that moment, and the moment's string reaches them unchanged, to the microsecond.
6. **Given** an address with no `at`, **When** the watermark moves, **Then** the page is told so and the address stays without `at`.
7. **Given** a plugin page's own address `/p/notes/<code>/items/<item_id>` opened directly in the browser, **When** it loads, **Then** the browser is sent to `/w/<code>/notes/items/<item_id>`.

---

### User Story 3 - The tree is built once, from every enabled plugin, and refuses what does not hold (Priority: P1)

When a plugin is installed, enabled, disabled or upgraded, or the core is upgraded, the installer builds the organization's tree from the core's `navigation.yaml` and the enabled plugins' files. If the tree does not hold, the operation that asked for it is cancelled and says why; the tree the members see is never half built.

**Why this priority**: A plugin attaching to a node that is not there, or two pages under one address, would break every member's screen; the check has to happen before anyone sees it.

**Independent Test**: Build the tree from the core's file and the template's: it holds. Build it from files with each of the faults below: each is refused with its reason, and the tree in force does not change.

**Acceptance Scenarios**:

1. **Given** the core's `navigation.yaml` and the template's, **When** the tree is built, **Then** it holds: the core's Settings with Plugins under it, and the template's Notes with its list node and three pages, each with its full name, owner, scope of parameters, page template, roles and controls.
2. **Given** a plugin whose node is attached to a node that does not exist, or to a node of a plugin that is not its direct dependency, **When** the tree is built, **Then** the build is refused and the operation is cancelled.
3. **Given** a node whose `page` or list parameters use a name the scope above it does not define, **When** the tree is built, **Then** it is refused.
4. **Given** two nodes of one owner with the same page template, or two list nodes with the same key one under the other, or an `id` repeated within one owner, **When** the tree is built, **Then** it is refused.
5. **Given** a control whose parameter is reserved (`at`, or starts with `_`), equals a parameter of the path or is taken by another control of the page, or whose `default` is not one of its options, or a filter with both `options` and `source` or with neither, **When** the tree is built, **Then** it is refused.
6. **Given** a list's or a control's `source`, or a pill's `counts`, that names no action the owner's wheel carries, **When** the version is checked, **Then** it is refused before any organization can install it.
7. **Given** `notes` disabled in an organization, **When** a member of it opens the frame, **Then** the tree holds no node of `notes`, and its pages' addresses open the panel's "no such page".

---

### User Story 4 - List nodes load their records at the panel's moment (Priority: P2)

A list node shows one row per record of its owner, loaded when its parent opens, at the panel's moment, in parts. If the plugin does not answer, only its branch shows the error.

**Why this priority**: Without list nodes the template's items do not appear; but the frame and the address work without it on ordinary nodes.

**Independent Test**: With 120 items, open Notes: the first 50 items show with "More…" at the end; choose it twice: every item shows exactly once. Stop the template's backend and open Notes again: the branch shows an error, Settings still opens.

**Acceptance Scenarios**:

1. **Given** a list node's parent, **When** it opens, **Then** the core asks the owner's source through the gateway with the person's token, the organization, the scope's parameters and the moment, and shows the answers' titles as plain text.
2. **Given** more records than one part, **When** the parent opens, **Then** the first part shows and its last row is "More…", which loads the next part.
3. **Given** an address at a past moment, **When** the tree opens, **Then** the list holds the records that existed at that moment.
4. **Given** a plugin whose source fails or does not answer, **When** its list node's parent opens, **Then** that branch alone shows the error and a way to try again; the rest of the tree works.
5. **Given** an address deep under a list node, **When** it is opened, **Then** the tree loads the instances on the way to the node and shows their titles.
6. **Given** a parent with no visible children and no page, **When** the tree is drawn, **Then** it is hidden.

---

### User Story 5 - A page talks to the frame only through the panel protocol (Priority: P1)

A plugin's page opens in a transparent frame over the core's field and draws only its content, with `@maxitor/panel`. It learns its address from the core, asks the core to change it, sends its title and asks to open a page of the core or of a direct dependency. A message from a window or an origin other than the expected one is dropped.

**Why this priority**: The protocol is the contract every plugin's frontend is written against; the template's page and every later plugin depend on it.

**Independent Test**: On the core's test page in the panel, send each message of the protocol and check its effect; send a message from another origin, from another window and one of an unknown shape: none has an effect.

**Acceptance Scenarios**:

1. **Given** a page that has loaded, **When** it sends `panel.ready`, **Then** the core records the plugin's build and the page's surface and starts sending it `panel.location` and `panel.watermark`.
2. **Given** a page that asks `panel.navigate` with `push`, **When** the core receives it, **Then** one history entry is added to the window's address and the panel's frame address is replaced, not pushed.
3. **Given** a change of address the page did not ask for — Back, Forward, a tree node of the same plugin, a control — **When** it happens, **Then** the page receives `panel.location` with the new path, query and moment, rebuilds its view from it, and sends no `panel.navigate` in answer.
4. **Given** a page that asks `panel.open` for a page of the core or of a direct dependency, **When** the core receives it, **Then** that page opens at its panel address; a page of a plugin that is not a direct dependency is not opened.
5. **Given** a message from another origin, from a window other than the panel's frame, or of an unknown shape, **When** the core receives it, **Then** it is dropped; the same holds for the page receiving from the core.
6. **Given** a page of `@maxitor/panel`, **When** it is drawn, **Then** its document background is transparent and the core's field with dots shows through it.

---

### User Story 6 - One canvas for every plugin (Priority: P2)

A page that draws a picture puts its content into the core's canvas, which moves and zooms the same way on every page: drag, the wheel or a two-finger swipe to move, Ctrl/⌘ with the wheel or a pinch to zoom, keys, limits, fit, the zoom bar, and the field of dots moving with it.

**Why this priority**: Every diagram page of Maxitor lives on the canvas; but the template's notes page works without it here (its cards are #102).

**Independent Test**: On the core's test page with a scene in the canvas, move and zoom by every gesture and key, press fit, reach both zoom limits: the picture and the dots move together and the zoom stops at its limits.

**Acceptance Scenarios**:

1. **Given** a scene in the canvas, **When** the person drags, scrolls the wheel or swipes with two fingers, **Then** the picture and the field of dots move together.
2. **Given** a scene, **When** the person pinches or uses Ctrl/⌘ with the wheel, **Then** the picture zooms around the pointer, within the canvas's limits.
3. **Given** a scene, **When** the person presses fit on the zoom bar or its key, **Then** the whole scene shows; a page may ask the canvas to show a place of the scene.
4. **Given** the camera, **When** a page converts a point of the screen to the canvas and back, **Then** it gets the same point.
5. **Given** a moved and zoomed canvas, **When** the address is copied and opened elsewhere, **Then** the viewport is not carried: everyone has their own.

---

### User Story 7 - The core draws every page's controls (Priority: P1)

A plugin declares its page's controls in `navigation.yaml` — the mode pill, the view switch, filters and the legend — and the core draws them over the panel, in the same places for every plugin, with the same look. Each control is an address parameter.

**Why this priority**: The template's view switch and writer filter come from here, and every later plugin's pages rely on one set of controls.

**Independent Test**: Open the template's notes page: the view switch stands at the top right, the writer filter on the left with the item's writers; switch each and see the address change and the page rebuild. Open the core's test page with a mode pill and a legend declared: they stand at the top centre and the bottom left.

**Acceptance Scenarios**:

1. **Given** a page that declares `views`, **When** it opens, **Then** the view switch stands at the top right, its default chosen and not written into the address; choosing another adds `?<param>=<value>` and the page gets `panel.location`.
2. **Given** a page that declares a filter with fixed `options`, **When** the person switches options off, **Then** the address lists the options still on; with every option on, the parameter is not in the address.
3. **Given** a filter with a `source`, **When** the page opens, **Then** its options are read from the owner's action at the panel's moment, by the same contract as a list node.
4. **Given** a page that declares a mode pill with `counts`, **When** it opens, **Then** the pill stands at the top centre with a number per option from the owner's `counts` action.
5. **Given** a page that declares a legend, **When** it opens, **Then** the legend stands at the bottom left; the zoom bar of a canvas stands at the bottom right.
6. **Given** a colour named in a control (`colour: green`), **When** it is drawn, **Then** it is the palette's colour of `@maxitor/tokens`.
7. **Given** a phone screen, **When** a page with controls opens, **Then** the filters fold into a button and the view into a menu, the same for every plugin.

---

### User Story 8 - Everything draws with one set of tokens (Priority: P2)

The frame, the controls and `@maxitor/panel` take every colour, radius, shadow, blur, type size and spacing from `@maxitor/tokens`; no colour or size number is written in their code.

**Why this priority**: One look across plugins, and the dark theme later, rest on it; but nothing a member sees breaks without it.

**Independent Test**: Search the frame's, the controls' and `@maxitor/panel`'s styles and components for colour codes and size numbers outside `@maxitor/tokens`: none is found.

**Acceptance Scenarios**:

1. **Given** `@maxitor/tokens`, **When** a reader opens it, **Then** it holds the colours, the named palette the controls use, radii, shadows, blur, type sizes and spacing, taken from today's client styles.
2. **Given** the frame, the controls and `@maxitor/panel`, **When** their styles are checked, **Then** every colour and size comes from a token.

---

### User Story 9 - The template lives in the frame (Priority: P1)

The plugin template `notes` is built with `@maxitor/panel` and `@maxitor/tokens` into its wheel and run by the plugin processes of the core; its pages open in the core's right panel, and nothing of a frame is left in its own frontend.

**Why this priority**: The template is the example every plugin is copied from; it proves the frame on a real plugin.

**Independent Test**: Build the template's wheel, install and enable it on the local stand, open its notes page in the frame: it shows the item's notes as a list or a table, follows the core's view switch and writer filter, and its frontend draws no tree, header or background.

**Acceptance Scenarios**:

1. **Given** the template's wheel built, **When** it is installed and enabled on the local stand, **Then** its frontend runs in the plugin processes and its notes page opens in the right panel.
2. **Given** the notes page, **When** the person switches the view or the writer filter, **Then** the page shows the list or the table of the notes of the chosen writers.
3. **Given** the template's `web/`, **When** it is read, **Then** it holds no tree, header, background or control of its own; its look comes from `@maxitor/panel` and `@maxitor/tokens`.
4. **Given** the nodes Published notes and Draft, **When** they are opened, **Then** each opens a page in the panel that says what it will show.

---

### User Story 10 - The documentation describes the frame as built (Priority: P2)

A person writing a plugin reads the tutorial's chapter "A place in the tree" and the plugin concept's section on the frame, and the core's README and its local run guide, and learns how their nodes stand in the tree and how their page lives in the panel.

**Why this priority**: The documentation ships with the change it describes; the tutorial's chapter 7 is this step's.

**Independent Test**: Follow chapter 7 of the tutorial on a copy of the template: every quote equals the template's files, and the chapter ends with the plugin's page opened in the frame.

**Acceptance Scenarios**:

1. **Given** the tutorial's index, **When** a reader opens it, **Then** chapter 7 "A place in the tree" is a link, and chapter 13 "Tests" lists the tests of the tree, the panel and the controls a plugin keeps.
2. **Given** the plugin concept's section 7, **When** a reader reads it, **Then** it describes the frame, the tree, the address, the panel protocol, the canvas, the controls and the tokens as they are built.
3. **Given** the core's README and `docs/how-to/run-the-core-locally.md`, **When** a reader follows them, **Then** they open a plugin's page in the frame on their machine.
4. **Given** `@maxitor/panel` and `@maxitor/tokens`, **When** a reader opens their READMEs, **Then** each says what it gives and how a plugin's frontend uses it.

### Edge Cases

- An address of a node that does not exist in the organization's tree, or of a disabled plugin: the panel shows "no such page" with a way to the organization's root; the tree stays.
- An address of a node the person's role does not see: the same "no such page", never the page.
- An address of an organization the person does not belong to: refused as today, without saying whether it exists.
- A plugin's page that does not answer or answers with an error: the panel shows that the page could not be opened, with a way to try again; the tree and the top row work.
- A plugin's page that never sends `panel.ready`: after a time the panel says the page does not answer.
- A moment in the address that is not a moment, or later than the watermark: the panel says so and offers "now".
- A list node's record whose title is empty or holds markup: the title shows as plain text; an empty one shows the record's key.
- Two list nodes open at once whose sources answer out of order: each branch shows its own answer.
- A filter's option in the address that the source no longer gives: it is ignored and dropped from the address at the next change.
- An address with a parameter no control and no page declares: it reaches the page unchanged; the core does not drop it.
- A very long path in the top row: it shortens in the middle and keeps the first and the last nodes.
- A phone: the tree is a drawer the top row's button opens, as today; the panel takes the screen.
- The core's own pages (Settings → Plugins) follow the same address rules, drawn without a frame of a plugin.

## Requirements *(mandatory)*

### Functional Requirements

#### The tokens

- **FR-001**: `@maxitor/tokens` MUST hold colours, the named palette, radii, shadows, blur, type sizes and spacing, taken from today's client styles of maxitor-web; it MUST be a level of the repository with its own version.
- **FR-002**: The frame, the controls and `@maxitor/panel` MUST take every colour and size from `@maxitor/tokens`; a check MUST find no colour code or size number in their styles and components outside it.

#### The frame

- **FR-003**: The core's application MUST draw the frame on every address `/w/<code>/...` of an organization the person belongs to: the left tree, the top row and the right panel with its grey field with dots.
- **FR-004**: The top row MUST hold the organization and its switch, the path to the open node, the user's icon with sign-out, and the places of the time scale (bystrovmaxim/gnomon#98) and of who is on the page (bystrovmaxim/gnomon#76), empty here.
- **FR-005**: The organization's switch MUST open the same page in another organization of the person, or that organization's root when the page is not there.
- **FR-006**: On a phone the tree MUST be a drawer the top row's button opens, and the panel MUST take the screen.

#### The tree

- **FR-007**: The core MUST have its own `navigation.yaml` with the node `settings` (Settings, for administrators, at the foot of the tree) and `settings.plugins` under it; their full names are the core's contract with plugins.
- **FR-008**: The tree builder MUST join the core's `navigation.yaml` and those of the plugins enabled in an organization, in dependency order, into one tree, and keep it with every node's full name, owner, scope of parameters, page template, roles, controls and behaviour in a room; at run time no YAML is read.
- **FR-009**: The tree builder MUST run when a version is checked (on its own file), in the same operation as installing, upgrading and enabling a plugin (on the organization's enabled set), and at the core's start (on the core's file); a failed build MUST cancel that operation with its reason and leave the tree in force unchanged. Disabling and removing only take nodes away, and a dependent plugin already blocks them.
- **FR-010**: The tree builder MUST refuse every case the plugin concept lists in section 7.3: a file that fails its schema; `attach` to a node that does not exist or to a plugin that is not a direct dependency; an `id` repeated within one owner; a parameter not defined in the scope; two list nodes with one key one under the other; two nodes of one owner with one page template; a reserved or taken control parameter; a control's `default` outside its options; a filter with both or neither of `options` and `source`; a `source` or `counts` that names no action the owner's wheel carries, checked when the version is checked, before any organization installs it.
- **FR-011**: Order among the children of one parent MUST follow `order`; on a tie the core comes first, then plugins in dependency order, then by `id`.
- **FR-012**: The ordinary nodes MUST reach the browser in one action of the core, filtered by the person's roles in the organization.
- **FR-013**: A list node's instances MUST load when its parent opens, from the owner's source called through the gateway with the person's token, the organization, the scope's parameters, the panel's moment and a part's limit; they MUST come in parts with "More…" for the next; their titles MUST be plain text.
- **FR-014**: A source that fails or does not answer MUST show an error and a way to try again in its branch only.
- **FR-015**: A parent with no visible children and no page MUST be hidden.

#### The address and the panel

- **FR-016**: Every page in the panel MUST have one address `/w/<organization>/<owner>/<path>?<parameters>&at=<moment>`; the path MUST be the node's page template with the scope's parameters put in, each encoded as a path segment.
- **FR-017**: From an address the core MUST find the node by matching the templates, open the path to it in the tree, load the list instances on the way, highlight it and show the path in the top row.
- **FR-018**: The address MUST be the only source of the panel's state: a reload, a link, Back and Forward MUST give exactly what was there.
- **FR-019**: A discrete change MUST add one history entry; a continuous one MUST replace the entry as it goes and leave one entry at its end; no history entry MUST be created inside the panel's frame.
- **FR-020**: The moment MUST pass from the address to the page and to the list nodes as an opaque string, unchanged; with no `at`, the core MUST send `panel.watermark` to the page when the watermark moves.
- **FR-021**: A plugin's page MUST open in a transparent frame over the core's field at `/p/<name>/<organization>/<path>?<parameters>&at=…`; moving between nodes of one plugin MUST not reload the frame or the page's frame; moving to another owner's node MUST change the frame's address only.
- **FR-022**: The core's own pages MUST open in the panel drawn by the core, by the same rules of the address.
- **FR-023**: An address of a node that is not in the person's tree MUST open "no such page"; a page that does not answer, answers with an error or never sends `panel.ready` MUST be shown as not opened, with a way to try again.

#### The panel protocol and `@maxitor/panel`

- **FR-024**: The core and a page MUST exchange the messages `panel.ready {build, surface}`, `panel.navigate {path, query, mode}`, `panel.title {text}`, `panel.open {owner, path, query}` from the page and `panel.location {path, query, at}`, `panel.watermark {at}` from the core, with the meanings of the plugin concept, section 7.6.
- **FR-025**: Each side MUST accept a message only from its own origin and the expected window, and MUST drop a message of an unknown shape.
- **FR-026**: `panel.open` MUST open only a page of the core or of a direct dependency of the page's plugin.
- **FR-027**: `@maxitor/panel` MUST give a plugin's frontend: the page document with a transparent background; the router, which changes the frame's address only by replacing and asks the core for history entries; the address parameters and the moment as the page's address holds them; and it MUST rebuild the page's view from `panel.location` without sending `panel.navigate`.
- **FR-028**: `@maxitor/panel` MUST be a level of the repository with its own version; a plugin's frontend and the core's application MUST be built with it as it is released from the repository.
- **FR-029**: The core MUST have a test page that opens in the panel through `@maxitor/panel`, used to check the protocol, the canvas and the controls without a plugin.

#### The canvas

- **FR-030**: `<MaxitorCanvas>` in `@maxitor/panel` MUST give moving and zooming by drag, the wheel, a two-finger swipe, a pinch, Ctrl/⌘ with the wheel and keys, within limits; fit; the zoom bar; the field of dots moving with it; and the camera converting between the screen and the canvas. It MUST be made from today's canvases of maxitor-web.
- **FR-031**: A page MUST be able to put its content into the canvas in canvas coordinates and ask it to show a place; it MUST not change the canvas's gestures.
- **FR-032**: The viewport MUST not be written into the address.

#### The controls

- **FR-033**: The core MUST draw the controls a node declares in `controls` — `mode` at the top centre, `views` at the top right, `filters` on the left, `legend` at the bottom left — the same for every plugin, made from today's mode pill of the events explorer, the ERD's filter panel and the domain legend.
- **FR-034**: Each control MUST be an address parameter: a default value MUST not be written; a filter MUST list the options switched on and be absent when all are on.
- **FR-035**: A control's options MUST come from its `options` or from its owner's `source` at the panel's moment, by the contract of the list nodes; the pill's numbers MUST come from `counts`.
- **FR-036**: A control's colour MUST be a name of the palette of `@maxitor/tokens`.
- **FR-037**: On a phone the filters MUST fold into a button and the view into a menu, the same for every plugin.

#### The template in step

- **FR-038**: The template's frontend MUST be built with `@maxitor/panel` and `@maxitor/tokens` into its wheel and run by the core's plugin processes (bystrovmaxim/gnomon#75).
- **FR-039**: The template's root page and its notes page MUST open in the right panel through `@maxitor/panel`; the notes page MUST show the item's notes as a list or a table by the view switch and of the writers chosen in the writer filter, both drawn by the core from its `controls`.
- **FR-040**: The template's pages Published notes and Draft MUST open in the panel and say what they will show.
- **FR-041**: The template's `web/` MUST hold no tree, header, background or control of its own.

#### Documentation, changelog, versions

- **FR-042**: The tutorial's chapter 7 "A place in the tree" MUST be written and linked from the index: `navigation.yaml`, the template's own items, list nodes and the tree builder's refusals, ending with the plugin's page opened in the frame; its quotes MUST equal the template's files under the tutorial's check.
- **FR-043**: The tutorial's chapter 13 "Tests" MUST list the tests of this step a plugin keeps.
- **FR-044**: The plugin concept's section 7 MUST describe the frame, the tree, the address, the panel protocol, the canvas, the controls and the tokens as built.
- **FR-045**: The core's README and `docs/how-to/run-the-core-locally.md` MUST say how the frame opens a plugin's page; `@maxitor/panel` and `@maxitor/tokens` MUST each have a README.
- **FR-046**: Every level this work changes MUST raise its version, the graph files MUST be rebuilt, and the changelogs MUST have one entry about what the work created.

### Key Entities

- **Built tree**: the tree of one organization after a build: every node with its full name (`<owner>:<id>`), owner, parent, order, scope of parameters, page template, roles, controls and behaviour in a room; replaced whole by each successful build.
- **Node declaration**: a node as a `navigation.yaml` writes it — `id`, `attach`, `title`, `icon`, `order`, `page`, `each`, `roles`, `controls`, `room`, `children`.
- **List instance**: one record of a list node's source at a moment: its key, title and icon.
- **Panel address**: organization, owner, path, parameters and moment; the only state of the panel.
- **Panel message**: one message of the panel protocol, with its direction and fields.
- **Control**: a mode pill, view switch, filter or legend of a node, with its parameter, default, options or source.
- **Token**: one named value of `@maxitor/tokens`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the local stand, a member reaches the template's notes page from the organization's root in 3 choices in the tree, and its address opened in a new tab shows the same screen in 100% of tries.
- **SC-002**: Back and Forward undo and redo exactly one change per press across 10 changes of view, filter and node in a row.
- **SC-003**: Every refusal of FR-010 has a test that builds a faulty tree and sees it refused, and the tree in force unchanged; every such test fails when its check is removed.
- **SC-004**: A list of 120 records loads in parts of 50, every record once; a failing source leaves the rest of the tree working.
- **SC-005**: A message from another origin, another window or of an unknown shape has no effect in 100% of tests, on both sides.
- **SC-006**: Moving between two pages of one plugin never reloads the frame: the tree's open nodes and scroll stay.
- **SC-007**: A search of the frame's, the controls' and `@maxitor/panel`'s styles finds 0 colour codes or size numbers outside `@maxitor/tokens`.
- **SC-008**: The canvas moves and zooms by every gesture and key on a desktop and a phone screen, stops at both limits and fits the scene.
- **SC-009**: A moment sent through the address reaches the page and the list nodes with all six digits of its microseconds.
- **SC-010**: The template's `web/` contains 0 components of a tree, header, background or control.

## Assumptions

- The core's identity, sessions, organizations and membership (bystrovmaxim/gnomon#73), the gateway, the plugin processes and one sign-in (bystrovmaxim/gnomon#75), and the template's own items and nodes (bystrovmaxim/gnomon#103) are in place and are used as they are.
- The local stand (`scripts/core-stand.sh up`) runs the core, the gateway and the template's processes; the browser checks of the frame run on it, locally, as CI cannot run them.
- The core's test page exists in every build of the core and is reached only by an administrator; it shows nothing of an organization's data.
- The icon names of the tree and the controls are those of the core's icon set, which the navigation schema already lists.
- maxitor-web and its graph viewer are not changed by this work; their pages move onto the frame in bystrovmaxim/gnomon#77.
- Publishing `@maxitor/panel` and `@maxitor/tokens` to the npm registry is a release step by the maintainer's tag, outside this work.
- The time scale (bystrovmaxim/gnomon#98), presence and following (bystrovmaxim/gnomon#76) and the template's full pages (bystrovmaxim/gnomon#102) come after this work.
