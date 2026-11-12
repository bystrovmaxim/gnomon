# Feature Specification: Maxitor plugin template — its pages now: the notes on the canvas, writing, editing, deleting, the published notes and the draft

**Feature Branch**: `feature/issue-102-template-pages-now`

**Created**: 2026-11-12

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#102, "08 · Maxitor plugin template: its pages now — the notes on the canvas, writing, editing, deleting, the published notes and the draft". The issue's body is the source of truth. The screens are in the mockup `specs/074-notes-history/mockup/index.html`, groups "Now", "Editing and deleting", "Published revisions" and "Phone only"; the shell, the filters and the lists on the canvas are those of bystrovmaxim/gnomon#109 and bystrovmaxim/gnomon#115.

## What this is

The plugin template `notes` is what every plugin is written from. Its server keeps notes at any moment (bystrovmaxim/gnomon#97), its items have three pages in the tree (bystrovmaxim/gnomon#103), and its notes page stands in the shell (bystrovmaxim/gnomon#109) — but the page is a column of cards pinned to the screen, and Published notes and Draft say "will be here". This work gives the template its pages **now**: notes on the canvas, writing, editing with its conflicts, deleting, the published revision and the draft with publishing, on a desktop and on a phone, so the template can be opened on the local stand and worked with on real notes. The past, comparing and the time scale are bystrovmaxim/gnomon#100.

Words used below:

- **Item** — a thing of the template its notes are written about; it has three nodes in the tree.
- **Note** — a short text about an item, written, edited and deleted by the organization's members.
- **Revision** — the notes of an item as published at once, with a number, a title, a comment and an optional release.
- **Draft** — what was added, changed or removed since the last revision.
- **Watermark** — the latest moment whose answer cannot change; "now" reads at it.
- **Conflict** — an edit refused because the note changed (`changed_since`) or was deleted (`deleted`) since the person opened it.

## Clarifications

### Session 2026-11-12

Decided with the maintainer before this specification was written, and recorded in bystrovmaxim/gnomon#102 and the plugins epic.

- Q: Are the notes a column pinned to the screen? → A: No. Every page's content lies on the canvas and moves and zooms with it: cards, the table and the Published notes and Draft pages alike.
- Q: How is the table drawn? → A: As `@maxitor/panel`'s `DataTable` lying whole on the canvas with its head sticking (bystrovmaxim/gnomon#115), never a list that scrolls by itself.
- Q: Where is a note written? → A: Not among the notes: "New note" is the page's action at the top right and opens a dialog, a sheet on a phone.
- Q: Who walks the stand of this step? → A: The walk of 1.3 is made during this step, its result on the pull request; the maintainer walks the steps 07–10 together after bystrovmaxim/gnomon#100.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The notes of an item lie on the canvas, now (Priority: P1)

A member opens an item's Notes: its notes are cards on the canvas, read at the watermark; they move and zoom it, filter by author in the shell, switch to a table in the bottom bar. When someone else writes a note, it appears without a reload, marked new.

**Why this priority**: It is the page every plugin author copies.

**Independent Test**: On the local stand open an item's Notes in two browsers as two people; write a note in one: it appears in the other, marked new; switch to the table and back; move and zoom the canvas.

**Acceptance Scenarios**:

1. **Given** an item's Notes with no `at`, **When** it opens, **Then** it reads the notes at the watermark and lays them as cards on the canvas, the newest first; a long word wraps inside its card.
2. **Given** the core sends `panel.watermark`, **When** the page is at "now", **Then** it reads again and a note written by someone else appears without a reload, marked new.
3. **Given** the page, **When** it opens, **Then** it gives the shell its Authors section, rows without counts, and in the bottom bar after the zoom the choice of cards or a table; the page has no layer pills.
4. **Given** the table chosen, **When** it is drawn, **Then** it is the `DataTable` lying whole on the canvas, its head sticking.
5. **Given** an item with no notes, **When** Notes opens, **Then** the canvas says there are no notes yet and "New note" stands at the top right.

---

### User Story 2 - Writing, editing with its conflicts, and deleting (Priority: P1)

A member writes a note from the page's action, edits one inside its card, meets a conflict when someone changed or deleted it meanwhile, and deletes one after one question.

**Why this priority**: A page of notes that cannot be written is not a template.

**Independent Test**: Write a note; edit one note in two browsers at once and save in both: the second gets the conflict with their text and the person's own kept; delete a note in one browser while it is edited in the other: the other is told and may add its text as a new note.

**Acceptance Scenarios**:

1. **Given** the page at "now", **When** the member presses "New note", **Then** a dialog opens — a sheet on a phone — and the note written appears first among the cards for everyone.
2. **Given** a card, **When** the member edits it and saves, **Then** the template's edit action is called with the moment the member saw, and the card shows the new text.
3. **Given** the note changed since the member opened it, **When** they save, **Then** the card shows the conflict: their text kept, the other's shown, the difference marked.
4. **Given** the note deleted since, **When** they save, **Then** the card says it is gone and offers to add their text as a new note.
5. **Given** a card, **When** the member deletes it, **Then** one question is asked and the note is gone from now on for everyone.
6. **Given** any refusal of the template's actions, **When** it happens, **Then** the page says it in words.

---

### User Story 3 - Published notes and the draft, and publishing a revision (Priority: P1)

A member opens Published notes and sees the notes of the last revision with its number, title, comment and release; opens Draft and sees what was added, changed or removed since, with who and when; publishes a revision from a dialog, and is told in words when there is nothing to publish.

**Why this priority**: Revisions are the template's second kind of history and the base of bystrovmaxim/gnomon#100.

**Independent Test**: Change notes, open Draft: the changes are there; publish with a title and a comment: Published notes shows the new revision; publish again: "Nothing to publish".

**Acceptance Scenarios**:

1. **Given** Published notes, **When** it opens, **Then** it lays the notes of the last revision on the canvas as cards or a table, with the revision's number, title, comment and release; with no revision yet it says so.
2. **Given** Draft, **When** it opens, **Then** it lays a card per change since the last revision — added, changed or removed — with who and when.
3. **Given** Draft with changes, **When** the member publishes from its dialog with a title, a comment and an optional release, **Then** a new revision is published and the draft is empty.
4. **Given** Draft with no change, **When** the member publishes, **Then** "Nothing to publish" is said in words.

---

### User Story 4 - The same on a phone (Priority: P2)

**Why this priority**: The template's pages are opened on phones too.

**Independent Test**: At 375 px: the canvas takes the screen, the tree is a drawer, a note's actions are a sheet behind "⋯", the dialogs are sheets.

**Acceptance Scenarios**:

1. **Given** a phone, **When** a page opens, **Then** the canvas takes the screen, the tree is a drawer, the filters fold behind their button, a note's Edit and Delete are a sheet behind "⋯", and "New note" and publishing open sheets.

---

### User Story 5 - The tutorial and the template describe the pages as built (Priority: P2)

**Why this priority**: The tutorial's chapter 8 is where an author learns to write a page.

**Independent Test**: Read the tutorial's chapter 8 "The page" and the "now" of chapter 9, the template's README and chapter 13: every example matches the template's code.

**Acceptance Scenarios**:

1. **Given** the documentation, **When** it is read, **Then** it shows the canvas, writing in a dialog, a conflict in the card, a page without `at` and `panel.watermark`, and the tests of this step; the rows in the index name this step.

---

### Edge Cases

- A note written and deleted by someone else between two watermarks: it never appears.
- The member's own note arrives with the watermark it was written at: it is not marked new for its writer.
- A note's edit saved twice quickly: the second is a conflict against the first only if the first changed the note.
- An item renamed while its pages are open: the tree's row changes; the pages stay.
- Publishing while someone else publishes: one revision gets the next number, the other is told the draft changed and reads again.
- A very long note: it wraps inside its card; the card grows, the canvas holds it.
- The Draft page offers one moment only: it is a comparison already.

## Requirements *(mandatory)*

### Functional Requirements

#### Now

- **FR-001**: A page with no `at` MUST read at the watermark; on `panel.watermark` a page at "now" MUST read again, and a note written by someone else MUST appear without a reload, marked new.

#### The pages on the canvas

- **FR-002**: Every item MUST have three nodes: Notes, Published notes and Draft.
- **FR-003**: The template's pages MUST lie on the canvas inside the shell — cards and tables alike — with no title bar; nothing of a page MUST be pinned to the screen.
- **FR-004**: The notes page MUST give the shell its Authors section, rows without counts, and in the bottom bar the choice of cards or a table; it MUST have no layer pills.
- **FR-005**: The table MUST be `@maxitor/panel`'s `DataTable` lying whole on the canvas with its head sticking.
- **FR-006**: Every note on every page MUST carry its anchor by identity, `note:<id>`.

#### Writing, editing, deleting

- **FR-007**: "New note" MUST be the page's action at the top right, shown only at "now", opening a dialog — a sheet on a phone; the note written MUST appear first among the cards.
- **FR-008**: An edit and its conflicts (`changed_since`, `deleted`) MUST happen inside the note's card, keeping the person's text; deleting MUST ask once.
- **FR-009**: Every refusal of the template's actions MUST be said in words.

#### Published notes and Draft

- **FR-010**: Published notes MUST show the notes of the last revision with its number, title, comment and release, on the canvas, as cards or a table.
- **FR-011**: Draft MUST show a card per change since the last revision, with who and when, and MUST publish a revision from a dialog with a title, a comment and an optional release; `nothing_to_publish` MUST be said in words.

#### The phone

- **FR-012**: On a phone the canvas MUST take the screen, the tree MUST be a drawer, a note's actions MUST be a sheet behind "⋯", and the dialogs MUST be sheets.

#### Tests, documentation, versions

- **FR-013**: The tests MUST prove the reading again on `panel.watermark` with a new note marked new, and writing, editing with both conflicts, deleting and publishing calling the template's actions and showing their refusals in words; a browser check MUST walk 1.3 on a desktop and on a phone.
- **FR-014**: The tutorial's chapter 8 "The page" and the "now" of chapter 9, linked from the index, chapter 13 grown by this step's tests, the template's README and the plugin concept wherever the pages change it MUST describe what this work builds.
- **FR-015**: The template MUST raise its version, and the changelog MUST describe the work.

### Key Entities

- **Item**, **Note**, **Revision**, **Draft** — as defined above, all kept by the template's server at any moment (bystrovmaxim/gnomon#97).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A note written in one browser appears in the other within one watermark, with 0 reloads, in 100% of tries on the stand.
- **SC-002**: Editing one note in two browsers at once gives the conflict in the second in 100% of tries, and the second person's text is never lost.
- **SC-003**: The walk of 1.3 completes on a desktop and at 375 px with every step as the issue states.
- **SC-004**: A search of the template's pages finds 0 content outside the canvas and 0 lists that scroll by themselves.

## Assumptions

- The template's server of bystrovmaxim/gnomon#97, its items and nodes of bystrovmaxim/gnomon#103, the shell of bystrovmaxim/gnomon#109, the core's build of the frontend of bystrovmaxim/gnomon#110, the lists on the canvas and the filters of bystrovmaxim/gnomon#115 and the page's history and room of bystrovmaxim/gnomon#116 are in place.
- A note stays marked new until the page is read again by the person's own action.
- The browser checks run locally on the stand, as CI cannot run them.
