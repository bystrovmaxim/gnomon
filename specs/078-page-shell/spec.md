# Feature Specification: Maxitor core — the page shell: filters, layer pills, the bottom bar and the page's actions, set by the page and drawn by `@maxitor/panel`

**Feature Branch**: `feature/issue-109-page-shell`

**Created**: 2026-11-11

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#109, "06 · Maxitor core: the page shell — filters, layer pills, the bottom bar and the page's actions, set by the page and drawn by @maxitor/panel". The issue's body is the source of truth. The look comes from what is already drawn: the mockup `specs/074-notes-history/mockup/index.html` and today's components of maxitor-web — `ErdFilterPanel`, the events explorer's `ModePill`, `ZoomToolbar` with its sections and the map's `ChangeStepper`. No new mockup is drawn.

## What this is

Every page of every plugin shows its controls in the same places and with the same look, and still every page sets its own. A drawing of events has three layers with counts read from its graph, a filter section that appears only in a comparison, and a layout switch and "Close every port" in its bottom bar; the template's notes have their authors and two views. What a page offers depends on its data, so no file written beforehand can describe it.

Today (bystrovmaxim/gnomon#74) a page declares its controls in the `controls` block of `navigation.yaml`, and the core draws them over the right panel, outside the page's frame. That cannot follow the page's data, and it splits one toolbar in two: the zoom bar of the canvas lives inside the page, the view switch outside it. This work moves the controls into the page: the page sets them when it opens, from its own data, and the **shell** of `@maxitor/panel` draws them, in fixed places and with one look for every plugin. The core draws nothing over the panel any more, and `navigation.yaml` says nothing of controls: the page's code is the one place they are written.

The first page to live in the shell is the template's notes page.

Words used below:

- **Core** — Maxitor without plugins: sign-in, organizations, the frame, the gateway, the installer.
- **Plugin** — a package installed into the core that adds data, actions and pages.
- **Frame** — the left tree, the top row and the right panel; only the core draws it.
- **Page** — what a plugin shows in the right panel, inside its own frame of the browser.
- **Shell** — `PanelPage` of `@maxitor/panel`, the root of every page, which lays the page out and draws its controls from what the page gives it.
- **Controls** — the filters, the layer pills, the bottom bar and the page's actions; each control is an address parameter.
- **Bottom bar** — the bar at the bottom left with zoom in, zoom out, fit and the percentage, followed by the page's own sections, each behind a hairline.
- **Section** — a group of items in the bottom bar: a choice of one (a view, a layout), a button, or a switch.
- **Page actions** — buttons of the page at the top right, such as "New note".
- **Change stepper** — `ChangeStepper`, which bystrovmaxim/gnomon#98 places in a comparison; this work keeps its place.
- **Reserved names** — address parameters that belong to the core: `at`, `mode`, `from` and every name starting with `_`.
- **Navigation format** — the version of the `navigation.yaml` format: 1 is today's, with `controls`; 2 is this work's, the same without `controls`.
- **Panel router** — the part of `@maxitor/panel` through which a page writes its address.

## Clarifications

### Session 2026-11-11

Decided with the maintainer before this specification was written, and recorded in bystrovmaxim/gnomon#109 and the plugins epic (bystrovmaxim/gnomon#72).

- Q: Who draws a page's controls — the core from a declaration, or the page? → A: The page, through the shell of `@maxitor/panel`. The core cannot know what a page's data offers, and a toolbar split by the page's frame cannot hold the zoom and the page's own sections together. One look for every plugin comes from one shell, not from the core drawing.
- Q: What is the address parameter of the layer pills? → A: `layer`. The name `mode` belongs to the time scale of bystrovmaxim/gnomon#98 (`mode=diff`), with `from` and `at`.
- Q: Is there a legend? → A: No. The filters already say what each colour means — a colour disk and a label per row, and the paint switch says which section paints; no page has a legend today. The legend of bystrovmaxim/gnomon#74 leaves with the core's controls and the shell does not take it; one comes back with the first drawing that needs it.
- Q: Where do the page actions and the change stepper stand, both wanting the top right? → A: In one place. The actions show only at "now", because in the past and in a comparison everything is read only; the change stepper shows only in a comparison. The two never stand together, as in the mockup.
- Q: Does this work draw a new mockup? → A: No. Every part is either in the mockup of `specs/074-notes-history/` or a working component of maxitor-web; the shell moves them into `@maxitor/panel` as they are. The pills' narrow look on a phone, drawn nowhere yet, is the icon and the count only.
- Q: Where do the head of the tree's buttons go? → A: Into this work. Only the core draws the tree, so its buttons are the core's, whatever page is open.
- Q: Does this work change who builds a plugin's frontend? → A: No; that is bystrovmaxim/gnomon#110. Here the template is built as today.
- Q: What does `maxitor-plugin-check` refuse, given that drawings place their nodes absolutely and the graph viewer is written with MUI and its own colours? → A: Only the shell's boundary: a page whose root is not the shell, an element placed `fixed`, and a `z-index` above the shell's layer. The content field belongs to the plugin: positioning inside it, another component kit and its own colours are allowed there, so the graph viewer moves in bystrovmaxim/gnomon#77 as it is, with no change of behaviour.
- Q: Is navigation format 1 still read beside format 2 for a while? → A: No. No plugin outside this repository uses format 1 and the stand of bystrovmaxim/gnomon#92 is still ahead, so the core reads format 2 only and the code of format 1 leaves whole. The core raises a minor version, as when bystrovmaxim/gnomon#82 stopped reading passport 1: the 4.x series is not published, and 5.0.0 stays the graph viewer's move in bystrovmaxim/gnomon#77.
- Q: Does a node name its page's parameters in `navigation.yaml`? → A: No. Following and links carry the address whole and need no list, and a list beside the page's code would have to be kept equal to it. The one rule left — a plugin may not take the core's names — is kept by the panel router, which refuses to write a reserved name or a name of the path's parameters, and fails loudly in development and in the plugin's tests.
- Q: What do the head of the tree's buttons do? → A: Two buttons. Collapse folds the tree to its head, as maxitor-web's `LeftSidebar` does: not remembered between visits, and on a phone the tree is a drawer. Up opens the nearest node above the open one that has a page — from Draft of an item, the item's page or, when it has none, Notes — keeping the moment `at` and dropping the page's own parameters; it is unavailable at a node with no such node above. Up does not repeat the browser's Back, which already steps through the panel's address.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A page sets its controls when it opens, and the shell draws them (Priority: P1)

A page gives the shell what it offers now — its filter sections and rows, its layer options with their counts, the sections of its bottom bar and its actions — and the shell draws them in their places, with one look. When the page's data changes, the page gives the shell the new values, and the controls follow without a reload.

**Why this priority**: This is the work itself; every page of every plugin draws its controls through it from now on.

**Independent Test**: Open the core's test page as a drawing: three layer pills with counts at the top centre, filters at the top left with a section that appears only when the page is in a comparison, and two sections of its own in the bottom bar after the zoom. Switch a layer: the counts and the filter sections change with the page's data, and the address carries `?layer=`.

**Acceptance Scenarios**:

1. **Given** a page that gives filter sections, **When** it opens, **Then** the filters stand at the top left, 148 px wide, as an accordion with one section open; each row shows a colour disk and a label, and a row absent from the data shows as absent.
2. **Given** a page that gives more than one section able to paint, **When** it opens, **Then** the paint switch stands at the foot of the filters and chooses which section paints the drawing.
3. **Given** a page that gives layer options with counts, **When** it opens, **Then** the pills stand at the top centre, one option chosen, each with its icon and count; choosing another writes `?layer=<value>`, and the default is not written.
4. **Given** a page that gives sections of its bottom bar, **When** it opens, **Then** zoom in, zoom out, fit and the percentage come first, and each section of the page follows behind a hairline: a choice of one, a button or a switch, each item an icon of the shell's set with a title, a state and what it does.
5. **Given** a page that gives actions, **When** it opens at "now", **Then** the actions stand at the top right; **When** it opens in the past or in a comparison, **Then** they are not shown.
6. **Given** a page whose data changes the offered sections or counts, **When** the page gives the shell the new values, **Then** the controls change in place, with no reload and with the address unchanged unless a chosen value disappeared.
7. **Given** a page that gives nothing for a part, **When** it opens, **Then** that part is not drawn; the bottom bar's zoom is drawn only on a canvas.

---

### User Story 2 - Every control is an address parameter of the page's own name (Priority: P1)

A page's controls write their values into the panel address, under names the page chooses, so Back, a link and following carry them. A plugin cannot take a name that belongs to the core.

**Why this priority**: The address is the panel's only state; a control outside it would break Back, links and following.

**Independent Test**: On the notes page, switch the author filter and the view, copy the address, open it in a new tab: the same filter and view. On the core's test page, ask the router to write `mode` and `item_id`: both are refused by name in development, and the address is unchanged.

**Acceptance Scenarios**:

1. **Given** a control with a default, **When** the default is chosen, **Then** the parameter is not in the address; **When** another value is chosen, **Then** the address carries it and the page gets `panel.location`.
2. **Given** a filter, **When** options are switched off, **Then** the address lists the options still on; with every option on, the parameter is absent.
3. **Given** a page, **When** it asks the panel router to write a reserved name (`at`, `mode`, `from`, a name starting with `_`) or a name of its path's parameters, **Then** the router refuses it and the address is unchanged; in development and in the plugin's tests the refusal is an error naming the parameter, elsewhere a line in the browser's console.
4. **Given** a page that writes any other name, **When** it asks the router, **Then** the name is written, with no declaration anywhere.

---

### User Story 3 - The core draws nothing over the panel, and the tree has its head (Priority: P1)

The right panel holds only the page. The core's drawing of controls, their styles, the legend and the `controls` block of `navigation.yaml` are gone, in navigation format 2. The head of the tree gets its two buttons.

**Why this priority**: Two places drawing controls would show two looks and two toolbars; the old format left in place would keep both alive.

**Independent Test**: Open the notes page and inspect the frame: no element of the core stands over the panel. Install a plugin whose `navigation.yaml` is format 1: the check refuses it and says format 1 is not read. Collapse the sidebar and expand it; from Draft of an item press up and reach the nearest page above it.

**Acceptance Scenarios**:

1. **Given** any page open in the panel, **When** the frame is drawn, **Then** the core draws nothing over the panel: no filters, pills, view switch or legend.
2. **Given** a `navigation.yaml` of format 1, **When** a version is checked, installed or enabled, **Then** it is refused with the words "navigation format 1 is not read; write format 2, without controls", and nothing is installed.
3. **Given** the core's passport, **When** it is read, **Then** it reads navigation format 2 only.
4. **Given** the head of the tree, **When** the person presses collapse, **Then** the tree folds to its head and the panel widens; pressing again expands it; a new visit opens it expanded, and on a phone the tree is a drawer.
5. **Given** Draft of an item open, with `at` and the page's own parameters in the address, **When** the person presses up in the head of the tree, **Then** the panel opens the nearest node above with a page — the item's page or, when it has none, Notes — at the same `at` and without the page's own parameters.
6. **Given** a node with no node above that has a page, **When** the head of the tree is drawn, **Then** up is unavailable.

---

### User Story 4 - A page outside the shell is caught (Priority: P2)

A plugin whose page steps out of the shell — a root other than the shell, an element fixed over the frame, a layer above the shell's — is refused when it is checked; a page that still reaches the panel without the shell is marked.

**Why this priority**: The shell holds the look only if pages use it; the checks keep the rare exception from passing unseen.

**Independent Test**: Run `maxitor-plugin-check` on a copy of the template whose notes page has a root other than the shell, an element placed fixed, and a `z-index` above the shell's layer: each is refused by name; the same copy with nodes placed absolutely inside its content field, another component kit and its own colours there passes. Open the core's test page without the shell on the local stand: a red strip "This page has no Maxitor frame" stands over it.

**Acceptance Scenarios**:

1. **Given** a plugin's frontend, **When** `maxitor-plugin-check` reads it, **Then** it refuses a page whose root is not the shell, an element placed `fixed`, and a `z-index` above the shell's layer, naming the file and the line.
2. **Given** a page whose content field places its nodes absolutely, draws with another component kit or uses its own colours, **When** `maxitor-plugin-check` reads it, **Then** it passes: the content field belongs to the plugin.
3. **Given** a page, **When** it is ready, **Then** `panel.ready` carries `shell: true` and the shell's version.
4. **Given** a page whose `panel.ready` has no `shell: true`, **When** it opens on the local stand or in development, **Then** a red strip "This page has no Maxitor frame" stands over it; **When** it opens elsewhere, **Then** it opens as it is and the frame writes the plugin, the page and the shell's absence to the browser's console.

---

### User Story 5 - The template's notes page lives in the shell (Priority: P1)

The template's notes page sets its authors in the filters and the list and the table as a choice in the bottom bar. Nothing else of its pages changes here.

**Why this priority**: The template is what every plugin author copies; it must show the shell in use.

**Independent Test**: On the local stand open Notes → an item → Notes: the authors stand in the filters at the top left, the choice of list or table in the bottom bar after its hairline, and nothing of the core over the panel. Switch both: the address changes and the page rebuilds.

**Acceptance Scenarios**:

1. **Given** the notes page, **When** it opens, **Then** it reads its authors itself and gives them to the shell's filters; no reading action is named in `navigation.yaml` for them.
2. **Given** the notes page, **When** the person chooses table in the bottom bar, **Then** the notes show as a table and the address carries `?view=table`.
3. **Given** the template's `navigation.yaml`, **When** it is read, **Then** it is format 2 and says nothing of the notes page's controls.
4. **Given** a phone screen, **When** the notes page opens, **Then** the filters, the bottom bar and the actions fold as the shell folds them for every plugin.

---

### User Story 6 - The documentation describes the shell as built (Priority: P2)

A plugin's author reads in the concept and the tutorial how a page sets its controls, which names it may take, and what the checks refuse.

**Why this priority**: The tutorial and the concept still describe the core drawing controls from YAML; left so, they teach what no longer runs.

**Independent Test**: Read the concept's canvas and controls and the tutorial's chapter 7: every example is the shell, and none declares controls in `navigation.yaml`; the tutorial's check keeps its quotes equal to the template's files.

**Acceptance Scenarios**:

1. **Given** the plugin concept, **When** it is read, **Then** it describes the shell, navigation format 2 and the reserved names the panel router refuses, and nowhere says the core draws controls or a legend.
2. **Given** the tutorial's chapter 7, **When** it is read, **Then** its part on controls quotes the template's shell, and its row in the index names this step.
3. **Given** the tutorial's chapter 13, **When** it is read, **Then** it lists the tests of this step a plugin keeps.

---

### Edge Cases

- A page gives a filter section with no rows: the section is drawn with "Nothing to filter by", as today.
- A chosen layer or view disappears from the page's new data: the shell chooses the default and writes the address once, by replace, so Back does not return to the gone value.
- A page gives more sections than the bottom bar holds on a phone: the sections after the zoom fold into one "⋯" menu, in order.
- A page gives an icon the shell's set does not have: the shell draws the set's neutral icon and, in development, writes an error naming the icon.
- A page in a comparison of bystrovmaxim/gnomon#98 gives actions: they are not shown; the change stepper stands in their place.
- A page sets its controls before its data arrives: the shell draws the parts with what is given and shows the counts as empty, never as zero.
- A page asks the router for `Mode` or `AT`: names are compared case ignored, and it is refused like `mode` and `at`.
- A node's `room.shared` names a reserved name: the tree builder refuses it, as it does today; any other name passes, the page's code being where it is written.
- A document page (no canvas) gives bottom-bar sections: the bar is drawn with its sections and without the zoom.

## Requirements *(mandatory)*

### Functional Requirements

#### The shell

- **FR-001**: `PanelPage` of `@maxitor/panel` MUST be the root of every page; it MUST lay the page out on a grid in which the page's content has a field of its own and no control covers it.
- **FR-002**: The page MUST give the shell data, never markup: filter sections and rows, layer options, bottom-bar sections and their items, and page actions; the shell MUST draw each part in its fixed place.
- **FR-003**: The filters MUST stand at the top left, 148 px wide, as an accordion with one section open; each row MUST show a colour disk of the palette and a label, and a row absent from the data MUST show as absent; the paint switch MUST stand at their foot when more than one section can paint.
- **FR-004**: The layer pills MUST stand at the top centre, one option chosen, each with its icon and count, and MUST write the address parameter `layer`; on a phone they MUST show only the icon and the count.
- **FR-005**: The bottom bar MUST stand at the bottom left and MUST start with zoom in, zoom out, fit and the percentage on a canvas; the page's sections MUST follow, each behind a hairline, each item an icon of the shell's set with a title, a state and what it does; a section MUST be a choice of one, a button or a switch.
- **FR-006**: The zoom bar of `<MaxitorCanvas>` MUST become the bottom bar of the shell; a canvas MUST NOT draw a zoom bar of its own.
- **FR-007**: The page actions MUST stand at the top right, bottom right on a phone, and MUST show only at "now"; the change stepper of bystrovmaxim/gnomon#98 MUST take the same place in a comparison.
- **FR-008**: When the page gives new values, the shell MUST redraw the controls in place, without a reload; a chosen value that disappears MUST give way to the default, written once by replace.
- **FR-009**: On a phone the shell MUST fold every part the same way for every plugin: the filters into a button, the bottom bar's sections after the zoom into one menu when they do not fit, the actions behind "⋯".
- **FR-010**: Every part MUST look as in the mockup `specs/074-notes-history/mockup/index.html` and as maxitor-web's `ErdFilterPanel`, `ModePill`, `ZoomToolbar` and `ChangeStepper` do today, on a desktop and on a phone, and MUST draw with `@maxitor/tokens` only.

#### Parameters

- **FR-011**: Every control MUST be an address parameter: a default MUST NOT be written; a filter MUST list the options switched on and be absent when all are on.
- **FR-012**: The panel router MUST refuse to write a reserved name (`at`, `mode`, `from`, a name starting with `_`), case ignored, and MUST leave the address unchanged; in development and in tests the refusal MUST be an error naming the parameter, elsewhere a line in the browser's console. The core MUST refuse the same, and a name of the open node's path parameters, when a page asks for it, and MUST leave the window's address unchanged.
- **FR-013**: A page's parameters MUST NOT be declared anywhere but in its code: `navigation.yaml` names none.
- **FR-014**: Following and the panel address MUST carry every parameter of the page as they carry `at`.

#### The core

- **FR-015**: The core MUST draw nothing over the right panel.
- **FR-016**: Navigation format 2 MUST replace format 1: the same format without `controls`; `room` and `history` stay as they are. The core MUST read format 2 only and MUST refuse format 1 with "navigation format 1 is not read; write format 2, without controls".
- **FR-017**: What leaves with `controls` MUST be removed: the core's drawing of controls and its styles, the legend among them; the part of the navigation schema that describes controls; the checks of controls and of their sources in `maxitor-plugin-sdk`; the stored controls of a node in the core's tables; and their tests.
- **FR-018**: The head of the tree MUST have two 32 px ghost buttons: collapse, which folds the tree to its head as maxitor-web's `LeftSidebar` does, is not remembered between visits, and on a phone leaves the tree a drawer; and up, which opens the nearest node above the open one that has a page, at the same `at` and without the page's own parameters, and is unavailable when there is none.

  Amended by bystrovmaxim/gnomon#122 (spec 085, FR-008 – FR-010): the two buttons stay, and the arrow among them is Back — it returns the panel to the level it showed before the last entering, keeps what was expanded there, opens no page, and is off at the root of the tree. The up it used to be, which opened the nearest node above the open one that has a page, is gone.

#### Keeping every page in the shell

- **FR-019**: `maxitor-plugin-check` MUST refuse a frontend whose page's root is not the shell, which places an element `fixed`, or which sets a `z-index` above the shell's layer, naming the file and the line. It MUST NOT refuse what stays inside the content field: positioning there, another component kit, or the plugin's own colours.
- **FR-020**: `panel.ready` MUST carry `shell: true` and the shell's version.
- **FR-021**: A page whose `panel.ready` has no `shell: true` MUST open on the local stand and in development under a red strip "This page has no Maxitor frame"; elsewhere it MUST open as it is, and the frame MUST write the plugin, the page and the shell's absence to the browser's console.

#### The template and the test page

- **FR-022**: The template's notes page MUST give its authors to the shell's filters, read by the page itself, and list or table as a choice in the bottom bar; its `navigation.yaml` MUST be format 2, with nothing of the page's controls.
- **FR-023**: The template's other pages MUST open in the shell as they are; their content stays bystrovmaxim/gnomon#102.
- **FR-024**: The core's test page MUST show a drawing with three layers and counts, a filter section given only in a comparison and two sections of its own in the bottom bar, and a page without the shell.

#### Documentation, changelog, versions

- **FR-025**: The plugin concept MUST describe the shell, navigation format 2 and the reserved names the panel router refuses wherever it describes the canvas and the controls, and MUST NOT say the core draws controls or a legend.
- **FR-026**: The tutorial's chapter 7 "A place in the tree" MUST describe the controls as built, its quotes equal to the template's files under the tutorial's check, and its row in the index MUST name this step; chapter 13 "Tests" MUST list this step's tests.
- **FR-027**: The README of `@maxitor/panel`, the core's README and `docs/how-to/run-the-core-locally.md` MUST describe the shell and the head of the tree.
- **FR-028**: Every level this work changes MUST raise its version — the core a minor one, as for passport 1 in bystrovmaxim/gnomon#82, since the 4.x series is not published — the graph files MUST be rebuilt, and the changelogs MUST have one entry about what the work created.

### Key Entities

- **Shell input**: what a page gives the shell — filter sections with their rows and paint, layer options with icons and counts, bottom-bar sections with their items, page actions.
- **Filter section**: its title, its parameter, its rows (key, label, colour, absent) and whether it can paint.
- **Bottom-bar section**: its kind (a choice of one, a button, a switch) and its items (icon, title, state, action; for a choice, its parameter and default).
- **Page action**: its title, its icon and what it does.
- **Shell mark**: `shell` and the shell's version in `panel.ready`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the local stand, the notes page and the core's test drawing show their filters, pills, bottom bar and actions in the same places on a desktop and on a phone, and an inspection of the frame finds 0 elements of the core over the panel.
- **SC-002**: A change of a page's data changes its offered sections and counts in place, with 0 reloads of the page, across 10 changes in a row.
- **SC-003**: An address copied with a layer, a filter and a view opens in a new tab with the same controls chosen in 100% of tries.
- **SC-004**: Every refusal of FR-012, FR-016 and FR-019 has a test that builds the fault and sees it refused by name; every such test fails when its check is removed.
- **SC-005**: A search of the repository finds 0 places outside the changelogs where the core draws controls or a legend, and 0 `navigation.yaml` of format 1.
- **SC-006**: A search of `@maxitor/panel`'s styles finds 0 colour codes or size numbers outside `@maxitor/tokens`.
- **SC-007**: A page without the shell is marked by the red strip on the local stand in 100% of opens.

## Assumptions

- The frame, the tree builder, the panel protocol, `<MaxitorCanvas>`, `@maxitor/panel` and `@maxitor/tokens` of bystrovmaxim/gnomon#74 are in place and are changed here only as the requirements say.
- The local stand (`scripts/core-stand.sh up`) runs the core, the gateway and the template's processes; the browser checks of the shell run on it, locally, as CI cannot run them.
- The core's test page exists in every build of the core and is reached only by an administrator.
- No plugin outside this repository has been released with navigation format 1, and the stand of bystrovmaxim/gnomon#92 is still ahead, so format 1 is refused without a period of both.
- The template's frontend is built as today; the core's build of a plugin's frontend is bystrovmaxim/gnomon#110.
- maxitor-web and its graph viewer are not changed; their pages move onto the shell in bystrovmaxim/gnomon#77.
- `room.shared` stays until bystrovmaxim/gnomon#76 removes it.
