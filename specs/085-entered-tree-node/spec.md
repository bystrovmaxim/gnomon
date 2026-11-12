# Feature Specification: Maxitor core — a tree node that is entered: the panel shows only its children, Back steps back, the crumbs follow the entered levels

**Feature Branch**: `feature/issue-122-entered-tree-node`

**Created**: 2026-11-12

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#122, "08.2 · Maxitor core: a tree node that is entered — the panel shows only its children, Back steps back, the crumbs follow the entered levels". The issue's body is the source of truth. The frame it changes is the one of bystrovmaxim/gnomon#74 (the tree, the top row, the right panel), its head is the one of bystrovmaxim/gnomon#109, and the page's history is the one of bystrovmaxim/gnomon#116. The issue's phase 1 — the mockup `specs/085-entered-tree-node/mockup/index.html` — is accepted by the maintainer before any code.

## What this is

The left tree of Maxitor opens every node in place: a click shows the node's children under it, one level deeper each time. With many levels the tree grows deep and hard to read.

This step gives a node a second way to open. A node either **expands** — as now: its children appear under it, in the same tree — or is **entered**: as one enters a folder on a computer, the left panel then holds only the children of that node, and the node itself stands at the top of the panel across its whole width. The node's author chooses the way in `navigation.yaml`.

Words used below:

- **Expand** — the way a node opens today: a click shows its children under it and the tree grows one level deeper. Its mark is the arrow.
- **Enter** — the second way: a click makes the left panel hold only that node's children, and the node stands at the head of the panel. Its mark is "›" on the right, in place of the arrow.
- **Level** — what the left panel shows at one moment: the children of one node, or the root of the tree for the first level.
- **Head** — the entered node drawn at the top of the panel, its icon and title across the whole width. The root has none.
- **Back** — the head's step out: the panel returns to the level it showed before the last entering.
- **Crumbs** — the path in the top row, built from the entered levels only and the open page, never from every node a person clicked.
- **Opens** — the field `opens` of a node: `expand` or `enter`.

## Clarifications

### Session 2026-11-12

The issue fixes what a person sees; these are the points it leaves open, resolved here as the reading this specification is held to, and settled on the mockup of phase 1 before any code.

- Q: Does the address name the entered level? → A: No. The address names the page as it does now, `/w/<organization>/<owner>/<path>` with its query and `at`; the panel works out the entered levels from the line of the open node in the tree. The level is never a part of the address, so a link, a reload and a colleague all land at the same level (issue, 1.6).
- Q: What is Back when the page was opened by its address? → A: The entered nodes above the page are already levels of the panel, so a page opened by its address arrives with its levels standing and Back steps out of them at once: a reload inside Notes leaves Back able to return to the tree's root.
- Q: Is Back a new button at the head, or the head's arrow of bystrovmaxim/gnomon#109 in another meaning? → A: The head's arrow itself, as issue 1.4 says of "**the** Back button at the head of the tree". The head keeps its two buttons — collapse and the arrow — and no third: the arrow becomes Back. It steps the panel out to the level before the last entering, keeping the nodes that were expanded there, leaving the right panel's page alone, and it is off at the root. The up of #109 — open the nearest node above the one open that has a page — leaves, and FR-018 of bystrovmaxim/gnomon#109 leaves with it.
- Q: Does a level keep what was expanded in it? → A: Yes, in the page's memory. A level is remembered with the nodes that were expanded in it, so Back gives the level as it was left, not a fresh one.
- Q: What survives a reload? → A: The entered levels, rebuilt from the address as issue 1.6 says; the nodes expanded within them do not — they live in the page's memory, as the tree's open nodes do today. Back after a reload steps out of the levels the address gave, each drawn as a level is drawn before anything is expanded in it.
- Q: May a node that reads a list (`each`) be entered? → A: Yes: `opens` is about opening, never about a node's kind, and the template's `item` node expands as every other node does today.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A node is entered, and the panel holds only its children (Priority: P1)

A person clicks Settings: instead of growing the tree, the left panel comes to hold Plugins only, and Settings stands at the head of the panel across its width. A click on Notes of the template does the same with the items. A node that expands still expands where it stands, inside the entered level.

**Why this priority**: It is the whole point of the step: a deep tree becomes a panel of one level.

**Independent Test**: On the local stand, click Settings: the panel shows Plugins only and Settings stands at the head; click Notes: the panel shows the items; expand an item: its pages appear under it, inside the level.

**Acceptance Scenarios**:

1. **Given** a node that expands, **When** it is drawn in the tree, **Then** it has the arrow it has today, and a click shows its children under it and reads them.
2. **Given** a node that is entered, **When** it is drawn in the tree, **Then** it has "›" on its right in place of the arrow, its children are not shown and not read.
3. **Given** a node that is entered, **When** the person clicks it, **Then** the left panel holds only its children, the node stands at the head of the panel with its icon and title across the whole width, and its page, if it has one, opens in the right panel.
4. **Given** an entered level, **When** its children are drawn, **Then** each of them opens in its own way: one that expands expands, one that is entered is entered.
5. **Given** the root of the tree, **When** it is drawn, **Then** it has no head.

---

### User Story 2 - Back and the crumbs follow the entered levels, not the clicks (Priority: P1)

A person enters Settings, then Back: the panel returns to the root with the nodes that were expanded there still expanded, and the page in the right panel stays. The crumbs of the top row name the organization, the entered nodes down to the head, and the open page — nothing else — and a click on a crumb steps the panel out to that level.

**Why this priority**: Without a true step back the entered panel is a trap: the tree the person came from is gone.

**Independent Test**: Expand two nodes at the root, enter Settings, press Back: the root is back with both nodes still expanded and the page unchanged; enter Notes, expand an item, press Back: the root with the earlier expansions; click a crumb: the panel steps to that level.

**Acceptance Scenarios**:

1. **Given** a level, **When** a node in it is entered, **Then** the level before it is kept with the nodes that were expanded in it.
2. **Given** a level with one or more enterings behind it, **When** Back is pressed, **Then** the panel shows the level before the last entering, with its expanded nodes still expanded, the right panel's page unchanged.
3. **Given** Back, **When** it is pressed, **Then** it neither jumps to the root nor opens another page.
4. **Given** the head of the tree, **When** it is drawn, **Then** it holds two buttons, collapse and the arrow, and no third; at the root the arrow is off.
5. **Given** a level, **When** the crumbs are drawn, **Then** they name the organization, each entered node down to the head, and the open page — and no node that was only passed through by expanding.
6. **Given** a crumb, **When** it is clicked, **Then** the panel steps out to the level that crumb names.

---

### User Story 3 - An address lands at the level it was left at (Priority: P1)

A person reloads a page inside Notes, or opens a link to it: the panel enters every entered node above that page, so they land at the same level as before, with Back working from it.

**Why this priority**: An address that loses the level makes every reload and every shared link a fall back to the root.

**Independent Test**: Open an item's page inside Notes, copy the address, reload: the panel shows Notes entered with the item expanded; open the address in a new tab: the same.

**Acceptance Scenarios**:

1. **Given** a page opened by its address, **When** the panel draws, **Then** it enters every entered node on the line of that page, the deepest last.
2. **Given** a page opened by its address inside an entered node, **When** it has arrived, **Then** Back is available and returns to the level before the deepest entering.
3. **Given** an address whose page is not under any entered node, **When** it opens, **Then** the panel shows the root as it does today.

---

### User Story 4 - The same on a phone (Priority: P2)

In the drawer on a phone, entering, the head, Back and the crumbs behave as they do on a desktop.

**Why this priority**: The tree is a drawer on a phone and must not behave as a second, poorer product.

**Independent Test**: At 375 px open the drawer, enter Settings, press Back, step with a crumb: every step matches the desktop.

**Acceptance Scenarios**:

1. **Given** a phone, **When** a node is entered in the drawer, **Then** the drawer shows only its children with the head, and a click on a node closes the drawer as it does today.
2. **Given** a phone, **When** Back or a crumb is used, **Then** the drawer and the panel show the same levels as on a desktop.

---

### User Story 5 - The format says how a node opens, and is checked (Priority: P1)

An author writes `opens` on every node with children, or the plugin is refused with the node named. The core's tree and the template move to format 4 and say `opens` on each of their nodes; format 3 is still read, every node of it expanding.

**Why this priority**: The way a node opens belongs to its author, and a tree with a guessed default is a tree nobody can predict.

**Independent Test**: Run the plugin checks on a file with a node with children and no `opens`: refused, the node named; on a node without children that says `opens`: refused, the node named; install a format 3 plugin: every node expands.

**Acceptance Scenarios**:

1. **Given** a node with children, **When** its file is checked or the plugin installed, **Then** a missing `opens` is refused with the node named, and so is an `opens` that is neither `expand` nor `enter`.
2. **Given** a node without children, **When** its file is checked, **Then** an `opens` on it is refused with the node named.
3. **Given** a file with `navigation: 4`, **When** it is checked, **Then** `opens` is required on every node with children and read as written.
4. **Given** a file with `navigation: 3`, **When** it is checked and installed, **Then** every node expands, as it does today.
5. **Given** the core's tree and the template, **When** they are read, **Then** both are format 4, Settings and Notes say `enter`, and every other node with children says `expand`.

---

### Edge Cases

- A node is entered, then the same node is clicked in the crumbs of its own level: the panel stays where it is, the level is not duplicated.
- Back is pressed past the deepest level: Back is off at the root and never undoes a page change of the right panel.
- A page inside an entered node is opened, then the entered node is entered again from the tree: Back returns to the level that was shown, not to the page's level.
- A node's roles hide it: it is not drawn, and its `opens` is still required by the format.
- A list node (`each`) that is entered: its instances are read when it is entered, as a list's children are read today when it expands.
- An address whose owner's page no longer exists: the panel shows what it shows today for such an address; the levels are not invented.
- The tree's collapse of bystrovmaxim/gnomon#109 and the entered head together: collapse folds everything to the head, which then shows the entered node's icon and title.
- A person enters a level, opens another organization with the switch, and comes back: the level is read from the address, as issue 3 says, and is not remembered across organizations.

## Requirements *(mandatory)*

### Functional Requirements

#### Two ways to open

- **FR-001**: A node with children MUST open either by expanding — its children appear under it in the same tree — or by being entered — the left panel then holds only its children.
- **FR-002**: A node that expands MUST carry the arrow it carries today; a node that is entered MUST carry "›" on its right in place of the arrow.
- **FR-003**: The children of a node that is entered MUST NOT be shown and MUST NOT be read before it is entered.
- **FR-004**: A click on a node MUST open it in its own way, at any depth, including inside an entered level.

#### The panel of one level

- **FR-005**: An entered level MUST hold only the entered node's children, each drawn with its own mark.
- **FR-006**: The entered node MUST stand at the head of the panel with its icon and title across the whole width; the root of the tree MUST have no head.
- **FR-007**: A click on a node that has a page MUST open that page in the right panel as it does today, whether the node expands or is entered.

#### Back and the crumbs

- **FR-008**: The head of the tree MUST keep its two buttons — collapse and one arrow — and MUST have no third: the arrow is Back, and it MUST return the panel to the level it showed before the last entering, with the nodes that were expanded there still expanded, and MUST leave the right panel's page as it is.
- **FR-009**: Back MUST NOT jump to the root and MUST NOT open a page; at the root it MUST be off.
- **FR-010**: The meaning of the head's arrow of bystrovmaxim/gnomon#109 — open the nearest node above the one open that has a page — MUST leave; FR-018 of bystrovmaxim/gnomon#109 MUST be amended in the same pull request, in `specs/078-page-shell/spec.md`, and the core's documentation of the tree's head MUST describe the arrow as Back.
- **FR-011**: The crumbs of the top row MUST be built from the entered levels only — the organization, each entered node down to the head, then the open page — and MUST NOT include nodes that were passed through by expanding.
- **FR-012**: A click on a crumb MUST step the panel out to the level it names.

#### Address

- **FR-013**: A page opened by its address MUST make the panel enter every entered node on the line of that page, the deepest last, so the person lands at the level they were at.
- **FR-014**: The address MUST remain the page's address as it is today: the entered level MUST NOT be written into it.

#### The phone

- **FR-015**: In the drawer on a phone, entering, the head, Back and the crumbs MUST behave as they do on a desktop, and a click on a node MUST close the drawer as it does today.

#### The format

- **FR-016**: `navigation.yaml` MUST carry `opens` — `expand` or `enter` — on every node with children, with no default.
- **FR-017**: The check of a plugin and its installation MUST refuse a node with children and no `opens`, and a node without children that says `opens` at all, each refusal naming the node.
- **FR-018**: The format MUST rise to `navigation: 4`; the core MUST read format 3 as it is — every node expands — and MUST read format 4.
- **FR-019**: The core's tree and the template MUST move to format 4 and say `opens` on each of their nodes with children: `core:settings` and the template's `notes` are `enter`, every other node `expand`.

#### Tests, documentation, versions

- **FR-020**: The tests MUST prove entering and expanding in the tree, the head, Back with the expansions kept, the crumbs from the entered levels, entering from an address, and the two refusals of the format with the node named; a browser check MUST walk the issue's check 4.1–4.4 on a desktop and at 375 px.
- **FR-021**: The plugin concept, wherever it describes how a node opens, and the tutorial's chapter on the tree MUST describe `opens` and the two ways to open as built.
- **FR-022**: The core and the template MUST raise their versions, the navigation format's version with them, and the changelog MUST describe the work.

### Key Entities

- **Node** — a place in the organization's tree: its full name, its owner, its parent, its title, its icon, its page and, from format 4, the way it opens.
- **Level** — what the left panel holds at one moment: the entered node at its head (or the root), its children, and the nodes expanded within it.
- **Crumb** — one step of the top row's path: the organization, an entered node, or the open page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a tree 6 levels deep, the panel never shows more than one entered level at a time, and the walk of the issue's checks 4.1–4.4 completes on a desktop and at 375 px with every step as the issue states.
- **SC-002**: Back returns to the level before the last entering in 100% of tries, with 0 pages opened and 0 expanded nodes lost.
- **SC-003**: A reload on a page inside an entered node lands inside it in 100% of tries, with Back available at once.
- **SC-004**: The crumbs name 0 nodes that were only passed through by expanding.
- **SC-005**: `maxitor plugin check` refuses both malformed files with the node named in 100% of tries, and accepts format 3 and format 4 files.

## Assumptions

- The frame of bystrovmaxim/gnomon#74, its head of bystrovmaxim/gnomon#109 and the page's history and room of bystrovmaxim/gnomon#116 are in place; the core's `navigation.yaml` and the template's are the two files that move to format 4.
- The tree's nodes keep being given by the core's tree action; the way a node opens arrives with the node and is not a matter of the browser alone.
- The state of a level lives as long as the frame is mounted, as the tree's open nodes do today; a reload rebuilds the levels from the address and leaves their nodes unexpanded, since what was expanded lives in the page's memory alone.
- The mockup of phase 1 is the place where the maintainer accepts the head and its two buttons with the arrow as Back, the "›" mark and the crumbs, before any code is written.
- The browser checks run locally on the stand, as CI cannot run them.
