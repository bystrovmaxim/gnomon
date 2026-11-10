# Feature Specification: Maxitor plugin template — history on the server: any moment, editing, deleting, revisions and the data of the time scale

**Feature Branch**: `feature/issue-97-notes-history`

**Created**: 2026-11-10

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#97, "01 · Maxitor plugin template: history on the server — any moment, editing, deleting, revisions and the data of the time scale". The issue's body is the source of truth. The screens that will use what this work builds — the template's pages (bystrovmaxim/gnomon#100) and the core's time scale (bystrovmaxim/gnomon#98) — are drawn, for a desktop and a phone, in [`mockup/index.html`](mockup/index.html); this work has no screen of its own.

## What this is

The plugin template `notes` (`packages/maxitor-plugin-template`) is the pattern every Maxitor plugin is written from. Today it adds a note on a catalog item and reads an item's notes at a moment. That shows notes appearing and nothing else. Here the template learns, on the server, everything a plugin's history needs: a note is edited and deleted without losing a change made by someone else in between; every past moment reads exactly as it was and never changes later; an item's notes are published as numbered revisions with a draft in between; and the plugin answers the core's time scale with its changes and its milestones.

The way a plugin answers the time scale is a contract every plugin will follow, so it is defined here, in `maxitor-plugin-sdk`, with its first user, and checked by the same tool that checks a plugin today. Nothing here needs the core to run: the template's actions and their tests run without a database, as they do today.

Words used below:

- **Note** — a text written by a member of an organization about one catalog item.
- **Moment** — a point in time, to the microsecond, at which something is read; written in an address as `at`.
- **Watermark** — the latest moment whose answer can no longer change: "now".
- **Version of a note** — the note's state from one change to the next; a moment reads the version in force at it.
- **`base_moment`** — the moment a person saw when they started editing a note.
- **Revision** — an item's notes published under a number (`v1`, `v2`, …), a title, a comment, an optional release label, the author and the moment; in force until the next revision.
- **Draft** — what has changed in an item's notes since its last revision.
- **Time scale** — the core's control of time (bystrovmaxim/gnomon#98); it draws what a plugin answers.
- **Bars** — how many changes of what a page shows happened in each stretch of time: added, changed, removed.
- **Milestone** — an event that matters on its own and stands on the time scale as a point: here a published revision, and the draft as a proposal.
- **Milestone card** — what the scale shows about one milestone: who, what, what it changed, and its comment.
- **History contract** — what a plugin declares and answers so that the scale can draw its pages' history.

## Clarifications

### Session 2026-11-10

Decided with the maintainer while the issue, the mockup and the core's scale (bystrovmaxim/gnomon#98) were written.

- Q: Can a past text be restored? → A: No. History is only looked at: no action restores or rewrites the past, and no page at a past moment or in a comparison writes anything.
- Q: Which comparisons does a plugin offer, and where is that said? → A: Every plugin reads any past moment, and that needs no declaration. The comparisons its pages can draw — `diff`, `side_by_side` — it declares in its passport, as it declares its roles and dependencies; a page may narrow the list in `navigation.yaml`, never widen it. The template's Draft page declares none: the draft is a comparison already.
- Q: Who counts the changes for the scale's bars, given that every plugin has its own tables? → A: The page's own reading action, run over a stretch of time instead of at a moment: the same tables, joins and filters, so the bars count exactly what the page shows. The SDK does this for any plugin; a plugin writes its own bars only when it wants to count otherwise or keeps its history outside Maxitor's database.
- Q: What does the scale tell the plugin when it asks? → A: The organization, the open node of the tree, the page's address parameters, the stretch of time and the width of a bar — never what is visible on the screen, which changes with every move of the canvas and could not be cached.
- Q: Where does a milestone's card come from? → A: From the plugin, as data in a fixed shape; the core draws it. The plugin never returns a control of its own.
- Q: What are the template's milestones, and what do their look and size mean? → A: Its published revisions, and its draft as a proposal. A revision that only edited notes, adding and removing none, is a small point; a revision published with a release label carries a flag. A revision's comment is what the scale shows under itself when the revision is chosen.
- Q: Where does the plugins' documentation live? → A: In the common folder `docs/plugins/`, beside the rest of the repository's documentation. The step-by-step tutorial is bystrovmaxim/gnomon#99; the pages on integrating with history and on compatibility come with the template's pages, bystrovmaxim/gnomon#100.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A member reads an item's notes now and at any moment of the past (Priority: P1)

A member of an organization reads an item's notes as they are now, or as they were at any past moment, and the same question always gets the same answer.

**Why this priority**: Every other part of this work — editing, revisions, the scale — stands on reading right at a moment. Without it the past is not trustworthy.

**Independent Test**: Write a note, edit it, delete it; read at a moment between each pair of changes and get the note as it was then; write more notes and read the same moments again: the answers are unchanged.

**Acceptance Scenarios**:

1. **Given** an item with notes, **When** a member reads with no moment, **Then** the answer is the notes at the watermark.
2. **Given** a note edited at T1 and deleted at T2, **When** a member reads at a moment between T1 and T2, **Then** the answer holds the edited text; at a moment before T1, the original text; at a moment after T2, no note.
3. **Given** an answer read at a past moment, **When** more notes are written later and the same moment is read again, **Then** the answer is the same.
4. **Given** the watermark W, **When** a member asks for a moment later than W, **Then** the request is refused and says why.
5. **Given** a member of organization A, **When** they read with organization B in the address, **Then** they are refused, and no reading ever returns another organization's notes.

---

### User Story 2 - An editor edits and deletes a note without losing someone else's change (Priority: P1)

An editor changes a note's text or deletes it. If someone else changed or deleted the note after the editor saw it, the editor is told who did it and when, and nothing is overwritten.

**Why this priority**: Two people editing at once is the common case of a shared plugin; losing a change silently breaks trust in every plugin written from the template.

**Independent Test**: Two editors open the same note; the first saves; the second saves with the moment they saw and gets a conflict naming the first editor and the time; a delete followed by an edit of the same note is refused.

**Acceptance Scenarios**:

1. **Given** a note whose open version began before the editor's `base_moment`, **When** the editor saves a new text, **Then** a new version opens, the old one closes, and the old text stays readable at every earlier moment.
2. **Given** a note changed by someone else after the editor's `base_moment`, **When** the editor saves, **Then** nothing is written and the answer is a conflict naming who changed the note and when.
3. **Given** a note, **When** an editor deletes it, **Then** its last version closes with who deleted it and by which action; at every earlier moment the note is still there.
4. **Given** a note deleted while an editor was editing it, **When** the editor saves, **Then** the save is refused, naming who deleted it and when.
5. **Given** an editor saving the same text the note already has, **When** they save, **Then** nothing is written and no change appears in the history.

---

### User Story 3 - An editor publishes an item's notes as a revision, and a reader sees the draft (Priority: P2)

An editor publishes an item's notes as the next numbered revision with a title, a comment and, optionally, a release label. A reader sees the notes as the revision in force at any moment holds them, and sees what has changed since the last revision.

**Why this priority**: Revisions are the template's second kind of history — numbered milestones — which the core's scale must also be worked out on; they come after the continuous history they build on.

**Independent Test**: Publish v1, edit a note, publish v2; read the published notes at a moment between v1 and v2 and get v1's notes, whatever was edited between; read the draft and get the changes since v2.

**Acceptance Scenarios**:

1. **Given** an item with notes and no revision, **When** an editor publishes with a title and a comment, **Then** revision `v1` is written with its number, title, comment, author and moment.
2. **Given** revisions v1 and v2, **When** a reader reads the published notes at any moment between them, **Then** the answer is v1's notes, and it does not change when notes are edited between v1 and v2.
3. **Given** notes changed since the last revision, **When** a reader reads the draft, **Then** each change is listed: added, changed or deleted, with who and when.
4. **Given** no change since the last revision, **When** an editor publishes, **Then** the publication is refused: there is nothing to publish.
5. **Given** a revision published with the release label "handbook 2026.11", **When** it is read back, **Then** the label is part of it; a revision published without one has none.

---

### User Story 4 - A plugin author declares the history of their pages and is checked (Priority: P1)

A plugin author declares in the passport which comparisons the plugin's pages can draw, and in `navigation.yaml` how each page answers the time scale. The plugin check refuses a declaration that does not hold.

**Why this priority**: This is the contract every later plugin follows; it must exist and be checkable before the core's scale (bystrovmaxim/gnomon#98) is built on it.

**Independent Test**: Run the plugin check on the template and get no refusal; widen a page's comparisons beyond the passport's, or name an action that is not in the plugin's history folder, and get a refusal naming the fault.

**Acceptance Scenarios**:

1. **Given** a passport declaring the comparisons `diff` and `side_by_side`, **When** a page declares only `diff`, **Then** the check accepts it.
2. **Given** a passport declaring only `diff`, **When** a page declares `side_by_side`, **Then** the check refuses, naming the page and the comparison.
3. **Given** a page's history naming an action, **When** that action is not in the plugin's history folder, **Then** the check refuses, naming the page and the action.
4. **Given** a page that declares its reading action and no bars of its own, **When** the scale asks for bars over a stretch of time, **Then** the SDK answers them by running that reading action over the stretch.
5. **Given** a passport with no history block, **When** it is checked, **Then** it is accepted, and its pages offer one moment only.

---

### User Story 5 - The template answers the core's time scale (Priority: P2)

When the core's scale asks the template about an item's notes, the template answers bars of changes, its revisions as milestones with the draft last, and the card of any milestone.

**Why this priority**: The scale cannot be worked out without a plugin that answers it; the template is that plugin.

**Independent Test**: Over a stretch with known changes, the bars count them exactly, by kind; with an author filter in the address, only that author's changes are counted; the milestones are the revisions in order with the draft last; a revision's card holds its counts, its comment, its size and its release label.

**Acceptance Scenarios**:

1. **Given** three notes added, one changed and one deleted in a stretch, **When** the scale asks for bars over it, **Then** the bars count 3 added, 1 changed, 1 removed, each in the bar of its time.
2. **Given** an author filter in the address, **When** the scale asks for bars, **Then** only that author's changes are counted, as the page shows only that author's notes.
3. **Given** revisions v1–v3 and changes since v3, **When** the scale asks for milestones, **Then** it gets v1, v2, v3 in order and the draft last as a proposal leading to the draft's page.
4. **Given** a revision that only edited notes, **When** its card is asked for, **Then** it is marked small, and its summary counts 0 added, N changed, 0 removed.
5. **Given** a stretch with no revision, **When** milestones are asked for, **Then** the answer is empty, except for the draft if there are changes.

---

### User Story 6 - The plugins' documentation is found in one place (Priority: P3)

A person looking for how plugins work finds the plugin concept and versioned storage in the repository's common documentation folder, and versioned storage shows its pattern on the notes example.

**Why this priority**: It changes no behaviour, but every later plugin and the tutorial (bystrovmaxim/gnomon#99) point there.

**Independent Test**: Open the documentation index and reach the plugin concept and versioned storage in `docs/plugins/`; no link in the repository leads to their old place.

**Acceptance Scenarios**:

1. **Given** the documentation index, **When** a reader follows its plugin links, **Then** they open `docs/plugins/concept.md` and `docs/plugins/versioned-storage.md`.
2. **Given** the repository after the move, **When** every link to the old place is searched for, **Then** none is left outside the history of specs and changelogs.
3. **Given** `versioned-storage.md`, **When** it is read, **Then** it shows now, the past, editing, deleting and publishing revisions on the notes example.

---

### Edge Cases

- A moment travels in one form only, UTC to the microsecond (`2026-11-08T10:15:00.123456Z`); any other form — a date, seconds, milliseconds, another zone, a word — is refused before anything is read.
- A note edited twice in one transaction leaves one version for that change, with the final text.
- A note created and deleted in one transaction leaves no version at all.
- An editor's `base_moment` later than the watermark is refused like any future moment.
- Publishing while another editor publishes at the same time gives two consecutive numbers, never the same number twice.
- A revision whose notes include one deleted later keeps that note: the revision reads its notes at its own moment.
- Bars over a stretch that crosses the watermark count only up to the watermark.
- A stretch of time with nothing in it answers empty bars, not an error.
- A milestone card asked for an unknown revision, or one of another organization, is refused like a note of another organization.
- A page whose author filter hides every note answers empty bars and the same milestones: revisions are not filtered by author.

## Requirements *(mandatory)*

### Functional Requirements

**Reading at a moment**

- **FR-001**: Every reading action of the template MUST answer at one moment: the watermark when no moment is given, the given moment otherwise.
- **FR-002**: An answer for the same organization, moment and parameters MUST be the same whenever it is read, whatever is written later.
- **FR-003**: A moment later than the watermark MUST be refused with a reason.
- **FR-004**: Every reading query MUST write its moment condition through one function of the SDK, at every version table it reads, with the organization in every condition; a test MUST parse the SQL of every reading action and refuse one that does not.
- **FR-005**: No action MUST restore or rewrite the past.

**Changing a note**

- **FR-006**: Editing a note MUST take `base_moment`; if the note's open version began after it, the action MUST write nothing and answer a conflict naming who changed the note and when.
- **FR-007**: Deleting a note MUST close its last version with who deleted it and by which action; the note MUST stay readable at every earlier moment.
- **FR-008**: Editing a deleted note MUST be refused, naming who deleted it and when.
- **FR-009**: Saving a text equal to the note's current text MUST write nothing.
- **FR-010**: Changing actions MUST read only the current tables, inside their transaction, after the organization's lock; only an editor MAY change notes.

**Revisions**

- **FR-011**: Publishing MUST write the item's next revision with its number, title, comment, optional release label, author and moment; numbers of one item MUST be consecutive and never repeat.
- **FR-012**: Publishing with no change since the last revision MUST be refused.
- **FR-013**: The published notes at a moment MUST be the notes of the revision in force at that moment, as they were at the revision's own moment.
- **FR-014**: The draft at a moment MUST list each note added, changed or deleted between the revision in force and that moment, with who and when.
- **FR-015**: A revision MUST NOT change once published.

**The history contract**

- **FR-016**: The passport MUST be able to declare the comparisons its pages can draw, out of `diff` and `side_by_side`; a passport without them MUST mean one moment only.
- **FR-017**: A page in `navigation.yaml` MUST be able to declare its reading action, its own bars, its milestones, its milestone card and a narrower list of comparisons.
- **FR-018**: A plugin's history actions MUST live in its folder `history/`, one per file, the file named after the action (`history/<name>_action.py`) and the declaration naming it without `_action`.
- **FR-019**: The SDK MUST describe what passes between the scale and a plugin — the context, the bars, the milestones and the card — so that both sides are checked against one description.
- **FR-020**: When a page declares no bars of its own, the SDK MUST answer them by running the page's reading action over the stretch of time asked for, with the page's filters, and grouping the changes it finds into bars of the width asked for.
- **FR-021**: The plugin check MUST refuse a page whose comparisons are wider than the passport's and a page whose history names an action outside `history/`, naming the page and the fault.

**The template's data of the scale**

- **FR-022**: The template's Notes page MUST declare its reading action and its milestones; its Published notes page its milestones only; its Draft page no comparison.
- **FR-023**: The template's milestones MUST be its revisions in order, each with its time, look, short reference, title, author and counts, and the draft last as a proposal leading to the draft's page when there are changes.
- **FR-024**: A revision's card MUST hold its author, its counts of notes added, changed and removed, its number of notes, whether it is small (it only edited notes), its release label when it has one, and its comment.
- **FR-025**: Milestones and cards MUST be read at a moment like any other answer and MUST be refused for another organization.

**Documentation**

- **FR-026**: The plugin concept and versioned storage, each with its Russian draft, MUST move to `docs/plugins/`, and every link to them MUST lead to the new place.
- **FR-027**: Versioned storage MUST show its pattern on the notes example: now, the past, editing, deleting, publishing revisions.

### Key Entities

- **Note**: a text about one catalog item, written by a member; it has versions, and each version knows who opened it, by which action, and who closed it.
- **Revision**: an item's published notes under a number; it knows its title, comment, optional release label, author and moment; it has versions like every table, and is never changed once written.
- **History declaration**: what the passport and each page declare about history — the comparisons, the reading action, bars, milestones and card.
- **Context of a history question**: the organization, the open node, the page's address parameters, the stretch of time and the bar's width.
- **Bar**: a stretch of time and its counts of changes — added, changed, removed.
- **Milestone**: a point on the scale — its time, look, short reference, title — with a card holding its author, counts, size, release label and comment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a note written, edited and deleted, a read at a moment between each pair of changes returns the note as it was then in 100% of cases, and the same reads repeated after further writes return identical answers.
- **SC-002**: Every reading action of the template passes the check of its moment condition, and a reading query written without it fails that check.
- **SC-003**: Two editors saving the same note from the same moment never both succeed: the second always gets a conflict naming the first.
- **SC-004**: The bars for any stretch count exactly the changes the page would show between its ends, by kind, with the page's filters applied, in 100% of the tests.
- **SC-005**: The published notes at any moment between two revisions are always the earlier revision's, whatever is edited between them.
- **SC-006**: The plugin check accepts the template and refuses each malformed history declaration with a message naming the page and the fault.
- **SC-007**: A new plugin author can declare their pages' history by reading the template alone: its passport, its `navigation.yaml` and its folder `history/` hold every part of the contract.
- **SC-008**: After the move, no link in the repository's packages and documentation leads to the plugins' documentation at its old place.

## Assumptions

- The template's tests run without a database, on the recording connection the template uses today; the template on a real database is walked in bystrovmaxim/gnomon#92.
- Only an editor writes notes and publishes revisions; a reader reads notes, revisions, the draft and the scale's data. The roles are the template's existing ones.
- Revisions are not filtered by author: a page's author filter narrows its notes and its bars, not its milestones.
- A revision is published for one catalog item; the template has no revisions across items.
- The release label is free text chosen by the editor; the template gives it no rules of its own.
- The bar widths the scale may ask for, and the shapes the SDK describes, follow the core's scale as bystrovmaxim/gnomon#98 states it; if the scale later grows a field, it is added to the SDK as an optional part.
- What the scale draws, the template's pages, the canvas and anchors are out of scope: bystrovmaxim/gnomon#98 and bystrovmaxim/gnomon#100.
