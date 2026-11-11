# Feature Specification: Maxitor core — a page gives the core its history; `navigation.yaml` holds the tree only

**Feature Branch**: `feature/issue-116-page-gives-history`

**Created**: 2026-11-12

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#116, "07.2 · Maxitor core: a page gives the core its history — navigation.yaml holds the tree only, and every page lies on the canvas". The issue's body is the source of truth. This step has no screens of its own; what a person sees of it is the red strip of a page that names something it may not.

## What this is

A page's data belong to the page: what it offers depends on what it holds, so no file written beforehand can describe it. bystrovmaxim/gnomon#109 took a page's controls out of `navigation.yaml` on that ground. Two blocks of a page's own data still stand there: `history` — the actions the time scale reads the page's bars, milestones and cards from, and the comparisons the page offers (bystrovmaxim/gnomon#97) — and `room` — what the people on the page share and on what surface their pointers travel (bystrovmaxim/gnomon#74). This work moves the history into the page and removes the room's block, so `navigation.yaml` holds the tree and nothing else. And since content in Maxitor is never pinned to the screen, the document surface goes: every page's content lies on the canvas, drawings, cards and lists alike (bystrovmaxim/gnomon#115).

Words used below:

- **Page** — what a plugin shows in the right panel, built on `PanelPage` of `@maxitor/panel`.
- **History** — how a page answers the core's time scale: its reading action, its bars, its milestones and their card, the comparisons it offers, its legend's words.
- **Room** — the people on one page and what they share of its address.
- **Surface** — what a page's content lies on and pointers travel in; after this work, always the canvas.
- **Navigation format** — the version of the `navigation.yaml` format: 2 is today's, 3 is this work's, the tree only.
- **Passport** — `maxitor-plugin.yaml`, the plugin's identity and needs; its `history.compare` declares the comparisons the plugin's pages may offer.

## Clarifications

### Session 2026-11-12

Decided with the maintainer before this specification was written, and recorded in bystrovmaxim/gnomon#116 and the plugins epic.

- Q: Why does the page give its history instead of `navigation.yaml`? → A: The same reason as for controls: a page's history depends on the page's data and code, and a declaration beside the code has to be kept equal to it by hand.
- Q: What stays in `navigation.yaml`? → A: The tree: a node's id, attachment, list source and key, title, icon, order, page and roles.
- Q: Is there still a document surface? → A: No. Content is never pinned to the screen; every page lies on the canvas, and lists lie on it whole (bystrovmaxim/gnomon#115).
- Q: Does the passport keep `history.compare`? → A: Yes. The passport declares what the plugin as a whole may offer; a page narrows it when it gives its history, never widens it.
- Q: What becomes of the room's shared parameters (`room.shared`)? → A: They go now, with the whole `room` block. Until bystrovmaxim/gnomon#76 replaces rooms with presence and following, everyone in a room keeps their own view of the page; the address shared by a link stays the way to show the same. Nothing is moved onto the page for one step.
- Q: Who walks the stand of this step? → A: It is walked during this step, its result on the pull request; the maintainer walks the steps 07–10 together after bystrovmaxim/gnomon#100.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A page gives the core its history from its own code (Priority: P1)

A plugin's page names, in its own code, the actions the time scale reads it with, the comparisons it offers and its legend's words; it gives them to the core when it opens and again whenever its data change them. The core keeps them for that open page.

**Why this priority**: The time scale of bystrovmaxim/gnomon#98 reads a page's history; it must come from the page.

**Independent Test**: Open the template's notes page: the core holds its history — `list_item_notes`, `list_note_history`, `note_milestone_card`, Diff and Side by side — although `navigation.yaml` names none of it; open the Draft page: it offers one moment only.

**Acceptance Scenarios**:

1. **Given** a page that gives its history through `PanelPage`, **When** it opens, **Then** the core receives the reading action, the bars, the milestones, the card, the comparisons and the legend's words, and keeps them for that open page.
2. **Given** a page whose data change what it offers, **When** it gives its history again, **Then** the core takes the new one without a reload.
3. **Given** a page that gives no history, **When** it opens, **Then** the scale offers it one moment only, with no bars and no milestones.
4. **Given** a page that gives `compare` narrower than the passport's, **When** it opens, **Then** the core offers only the page's; a page cannot offer a comparison the passport does not declare.

---

### User Story 2 - A wrong name is refused by name (Priority: P1)

A page that names an action its plugin version does not hold, or a comparison the passport does not declare, is caught by name: an error in development and in the plugin's tests, a line in the core's log elsewhere, while the scale offers what is valid.

**Why this priority**: The core can no longer check a page's history when the version is installed; it must check it when the page gives it.

**Independent Test**: In a copy of the template whose notes page names `list_notes_hstory`, open the page in development: a red strip names the page and the action; run the plugin's tests: they fail with the same name.

**Acceptance Scenarios**:

1. **Given** a page naming an action its version does not hold, **When** it gives its history, **Then** the core refuses that name: in development and in tests an error naming the page and the action; elsewhere a line in the core's log, the rest of the history kept.
2. **Given** a page offering a comparison the passport does not declare, **When** it gives its history, **Then** that comparison is refused the same way.

---

### User Story 3 - `navigation.yaml` holds the tree only (Priority: P1)

A plugin's `navigation.yaml` is format 3: nodes and their places in the tree, nothing of a page's data. A node with `history`, `room` or `controls`, or a file of format 2, is refused by name.

**Why this priority**: Two places for a page's data would keep the old way alive.

**Independent Test**: Run `maxitor-plugin-check` on a copy of the template whose `navigation.yaml` keeps a `history` block: it is refused, naming the node and saying the page gives its history; the same file in format 2 is refused as format 2.

**Acceptance Scenarios**:

1. **Given** a navigation file of format 3, **When** a version is checked, **Then** a node holds its id, attachment, list source and key, title, icon, order, page and roles, and nothing else.
2. **Given** a node with `history`, `room` or `controls`, **When** `maxitor-plugin-check`, the core's check of a version or the tree builder reads it, **Then** it is refused naming the node and saying the page gives it.
3. **Given** a navigation file of format 2, **When** it is read, **Then** it is refused: the core reads format 3 only.

---

### User Story 4 - No shared parameters and no document surface (Priority: P1)

The room's block leaves `navigation.yaml` whole: nothing of a page's address is shared by the room any more, and the people's pointers always travel on the canvas — the document surface is gone from the core, the panel protocol and the concept.

**Why this priority**: Every page now lies on the canvas; a second kind of surface would keep pinned pages possible.

**Independent Test**: Open the template's notes page in two browsers in one room: switching cards to table in one leaves the other as it was; the pointers travel as anchors on the canvas; a search of the code finds no `room.shared` and no document surface.

**Acceptance Scenarios**:

1. **Given** a room on a page, **When** one person switches a parameter of the page's address, **Then** the others' pages stay as they were; the room shares no parameter.
2. **Given** any page, **When** pointers travel, **Then** they travel as an anchor and a place inside it on the canvas; `surface` exists nowhere.

---

### User Story 5 - The template gives its history from its pages (Priority: P1)

**Why this priority**: The template is what every plugin is written from.

**Independent Test**: Read the template's pages and its `navigation.yaml`: the pages give their history; the file is format 3; the template passes `maxitor-plugin-check` and its browser check.

**Acceptance Scenarios**:

1. **Given** the template's Notes page, **When** it opens, **Then** it gives `read: list_item_notes`, `milestones: list_note_history`, `card: note_milestone_card`; Published notes gives `milestones` and `card`; Draft gives `compare: []`.
2. **Given** the template's `navigation.yaml`, **When** it is read, **Then** it is format 3.

---

### User Story 6 - The documentation describes it as built (Priority: P2)

**Why this priority**: Authors copy what the concept, the tutorial and the READMEs show.

**Independent Test**: Read the plugin concept, the READMEs of `maxitor-plugin-sdk`, `@maxitor/panel` and the template, and every chapter of the tutorial that put `history` or `room` in `navigation.yaml`: every example gives them from the page.

**Acceptance Scenarios**:

1. **Given** the documentation, **When** it is read, **Then** a page's history is given by the page, the room shares nothing, navigation is format 3, every page lies on the canvas, and the tutorial's rows in the index name this step.

---

### Edge Cases

- A page gives its history twice in a row, the second narrower: the core keeps the second.
- A page gives a history while the core still checks the first: the last one given wins.
- A page names a reading action that exists but is not a reading action (it writes): refused by name as for an unknown action.
- A page gives `compare: []`: one moment only, as for a page with no history.
- A page of a plugin whose passport declares no `history.compare`: any comparison the page gives is refused; one moment is always offered.
- A version installed before this work with navigation format 2: refused when checked again; the plugin is redeployed with format 3.

## Requirements *(mandatory)*

### Functional Requirements

#### The page's history

- **FR-001**: `PanelPage` of `@maxitor/panel` MUST take a page's history — its reading action, bars, milestones, card, comparisons and legend's words — and give it to the core when the page opens and whenever the page gives a new one.
- **FR-002**: The panel protocol MUST carry a page's history; the core MUST keep it for the open page and use only the last one given.
- **FR-003**: A page that gives no history MUST be offered one moment only, with no bars and no milestones.
- **FR-004**: A page's comparisons MUST narrow the passport's `history.compare` and MUST NOT widen it.
- **FR-005**: The core MUST check every name a page gives against the plugin version's actions and the passport; a name that does not hold MUST be refused by name — an error in development and in the plugin's tests, a line in the core's log elsewhere — and the rest of the history kept.

#### Navigation

- **FR-006**: Navigation format 3 MUST hold, per node, its id, attachment, list source and key, title, icon, order, page and roles only.
- **FR-007**: `maxitor-plugin-check`, the core's check of a version and the tree builder MUST refuse a node with `history`, `room` or `controls`, naming the node and saying the page gives its history and controls and the room shares nothing, and MUST refuse navigation format 2.

#### The room and the surface

- **FR-008**: The room's shared parameters (`room.shared`) MUST be removed from navigation, the core, the panel protocol, the template and the plugin concept; a room MUST share no parameter of a page's address.
- **FR-009**: `surface` and the document surface MUST be removed from the core, the panel protocol, `@maxitor/panel` and the plugin concept; pointers MUST travel on the canvas only.

#### The template, documentation, versions

- **FR-010**: The template's pages MUST give their history from their code; its `navigation.yaml` MUST be format 3.
- **FR-011**: The plugin concept, the READMEs of `maxitor-plugin-sdk`, `@maxitor/panel` and the template, and every chapter of the tutorial that put `history` or `room` in `navigation.yaml` — with chapter 13 grown by this step's tests and the rows in the index naming this step — MUST describe what this work builds.
- **FR-012**: Every changed package MUST raise its version, and the changelog MUST describe the work.

### Key Entities

- **Page history**: the reading action, bars, milestones, card, comparisons and legend's words a page gives.
- **Navigation node (format 3)**: id, attachment, list source and key, title, icon, order, page, roles.
- **Passport's `history.compare`**: the comparisons a plugin's pages may offer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A search of the repository finds 0 `history`, `room` or `controls` blocks in any `navigation.yaml`, 0 navigation files of format 2 and 0 mentions of a document surface outside the changelogs.
- **SC-002**: The template's three pages give their history, and the core holds it for each open page in 100% of opens.
- **SC-003**: Every refusal of FR-005 and FR-007 has a test that builds the fault and sees it refused by name; every such test fails when its check is removed.
- **SC-004**: A page that changes what it offers is followed by the core with 0 reloads across 10 changes in a row.

## Assumptions

- The page shell of bystrovmaxim/gnomon#109 and the lists on the canvas of bystrovmaxim/gnomon#115 are in place.
- The actions of a page's history live in the plugin's folder `history/` as bystrovmaxim/gnomon#97 built them; only where they are named moves.
- No plugin outside this repository uses navigation format 2, so it is refused without a period of both.
- The time scale that reads a page's history is bystrovmaxim/gnomon#98; this work gives it the history to read.
- Rooms, presence and following change in bystrovmaxim/gnomon#76.
