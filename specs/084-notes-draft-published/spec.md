# Feature Specification: Maxitor plugin template — a draft of my own over everyone's published notes

**Feature Branch**: `feature/issue-121-notes-draft-published`

**Created**: 2026-11-12

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#121, "08.1 · Maxitor plugin template: a draft of my own over everyone's published notes — the common data environment in one folder". The issue's body is the source of truth. The screens, accepted by the maintainer, are in [`mockup/index.html`](mockup/index.html), groups "Draft — my work, seen by me alone", "Published — everyone's notes", "Publishing" and "Phone"; the group "The past" is walked with the time scale of bystrovmaxim/gnomon#100.

## What this is

The plugin template `notes` is what every plugin is written from. After bystrovmaxim/gnomon#102 its item has three pages — Notes (every note as it is now), Published notes (the last revision's snapshot) and Draft (the difference between the two) — and an edit writes the note for everyone at once. The same notes therefore show on three pages at three angles, the "draft" is a comparison of two states rather than a draft, and anyone's half-finished change is already everyone's.

This work replaces the three pages with two: **Draft** — one person's own changes over the one published state — and **Published notes** — everyone's notes, read only. What a person writes, changes or deletes reaches nobody else until they publish their whole draft as one revision; what someone else published in between is met at publishing as a conflict, each conflict overwritten or given up. Draft and Published are read at any moment. This is the first and smallest form of the common data environment inside one folder (bystrovmaxim/gnomon#106); the time scale (bystrovmaxim/gnomon#98) and walking the past and comparing (bystrovmaxim/gnomon#100) come after.

Words used below:

- **Item** — a thing of the template its notes are written about; it has two nodes in the tree, Draft and Published notes.
- **Note** — a short text about an item, written by one person. A note as everyone has published it is a **published note**; its writer is its author.
- **Published state** — every note of the item as everyone has published it, at the revision in force; read only, and changed only by publishing a revision.
- **Revision** — the whole published state as it was published at once, with a number, a title, a comment and an optional release, a milestone of the time scale.
- **Draft** — one person's changes over the published state, for one item; its person sees it and nobody else does.
- **Change** — one note in a draft, with a state — **new**, **changed** or **deleted** — and the published version it was made over (its **base**: the revision's number and the published text).
- **Revert** — giving up one change, leaving the published state as it is.
- **Conflict** — a change whose published note now reads otherwise than its base: the note was changed and now reads differently, or was deleted, by someone else since. Where the published text has come back to the base, or the change's text has come to equal the published text, there is no conflict.
- **Moment** — the instant a page reads; **now** is the watermark, the latest moment whose answer cannot change.
- **Marking** — the changed note's words shown inside one text: the words that went struck through in red, the words that came in green.

## Clarifications

### Session 2026-11-12

Decided with the maintainer in bystrovmaxim/gnomon#121 and its accepted mockup.

- Q: Does the item keep a Notes page beside Draft and Published? → A: No. Draft replaces Notes; the item has two pages, and no third shows the same notes at another angle.
- Q: Whose notes may I change? → A: Anyone's, but only through my own draft. The published state is never written by an edit; it changes when a revision is published.
- Q: Is a draft published note by note? → A: No. My whole draft is published as one revision; what is not ready is reverted before publishing.
- Q: How is a change that meets someone else's resolved? → A: For each note, at publishing: **overwrite** with mine, or **give up** mine. Nothing is published until every conflict has a choice.
- Q: Where does the past live? → A: On the template's server: Draft and Published answer at any moment not later than the watermark. Choosing a moment on a scale and comparing two of them are the core's (bystrovmaxim/gnomon#98 and bystrovmaxim/gnomon#100); the template has no page of comparing.
- Q: Where is the changed note's marking computed? → A: In the browser, from the two texts the server gives — the base and the changed one. Nothing is stored. The plan chooses the library: `diff` (jsdiff)'s `diffWords`, the first candidate, or `diff-match-patch`; this specification fixes only what the marking shows.
- Q: Who walks the stand of this step? → A: Two people walk 1.6 of the issue during this work, and its result stands on the pull request.
- Q: Is a conflict decided by the note's version or by its value? → A: By its value. A conflict is a change whose published note now reads otherwise than the base or is deleted; a note changed and published back to the base text conflicts with nothing, and a change whose text has come to equal the published text leaves the draft without a question.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - My draft: new, changed and deleted notes, the filter and reverts (Priority: P1)

A member opens Draft and finds their own changes, each saying its state and whose note it is; a filter in the shell chooses which states show; every change can be reverted, and the published notes stay as they are.

**Why this priority**: The draft is the half of the common data environment that the item's work lives in.

**Independent Test**: On the local stand one person writes a note, changes a published note of their own and deletes another; Draft shows three cards with their states; the State filter hides Changed; reverting each leaves the published notes exactly as they were.

**Acceptance Scenarios**:

1. **Given** a published note, **When** the member changes it, **Then** Draft shows it as **changed**, the published text struck above the new one, and Published notes stays unchanged for everyone.
2. **Given** a draft holding a new, a changed and a deleted note, **When** the member switches Changed off in the State filter, **Then** only New and Deleted stand; a state with nothing behind it fades, and comes back when a change of that state is made.
3. **Given** any change, **When** the member reverts it and confirms, **Then** a new note is removed, a changed or deleted note leaves the draft, and the published note stays as it is.
4. **Given** a changed note in the draft, **When** the member changes it again, **Then** the draft keeps the last text and the base stays the revision it was made over.
5. **Given** two people with drafts of one item, **When** either opens Draft, **Then** each sees only their own changes.
6. **Given** an empty draft, **When** Draft opens, **Then** the page says nothing waits and leads to writing a new note or changing a published one.
7. **Given** a note whose edit left it as published, **When** the edit is saved, **Then** no change stays in the draft.

---

### User Story 2 - Published notes: everyone's notes, read only, and my changes through them (Priority: P1)

A member opens Published notes and reads everyone's published notes of the revision in force — its number, title, comment and optional release — filtered by author. Edit and Delete on any note act in the member's own draft, and the page says what waits there.

**Why this priority**: The published state is what the whole organization shares and what every draft is measured against.

**Independent Test**: Open Published notes in two browsers; change one of the other person's notes: their page does not change, and the changer's Draft holds the note as changed while Published notes marks it "In your draft: changed".

**Acceptance Scenarios**:

1. **Given** an item with a revision, **When** Published notes opens, **Then** it lays everyone's published notes of the revision in force with the revision's number, title, comment and release; before the first revision it says nothing is published yet.
2. **Given** the Authors filter, **When** only one person is chosen, **Then** only their notes stand, each with their initials in their colour.
3. **Given** any published note, **When** the member presses Edit or Delete, **Then** nothing changes for anyone else: the change waits in the member's draft, the note is marked "In your draft: changed" or "In your draft: deleted" and leads to Draft.
4. **Given** the revision in force, **When** Published notes opens, **Then** the head says how many changes wait in the member's draft; nothing on the page can be typed into.
5. **Given** someone publishes while the page is at now, **When** the core's watermark moves, **Then** the new revision appears without a reload.

---

### User Story 3 - Publishing the whole draft as one revision, with its conflicts (Priority: P1)

A member publishes their whole draft as one revision with a title, a comment and an optional release. When someone published over the base of a change, nothing is published until the member has overwritten or given up each such change.

**Why this priority**: Publishing is where the common data environment stops being private and becomes everyone's.

**Independent Test**: Publish a draft nobody touched: the revision is everyone's and the draft is empty. Then two people change one note; the second to publish sees the conflict with the first's name and value, overwrites one change and gives up another, and the given-up one is gone from the draft.

**Acceptance Scenarios**:

1. **Given** a draft, **When** the member publishes from the page's action with a title, a comment and an optional release, **Then** the whole draft goes in as one revision, with nothing chosen note by note.
2. **Given** no conflict, **When** the draft is published, **Then** every change applies as it is, the draft empties, and Published notes shows the revision for everyone.
3. **Given** a conflict, **When** the member presses Publish, **Then** nothing is published: the conflicts are listed, each with the member's value and the value it would overwrite, whose that value is and when; each is overwritten or given up, and Publish is off until every one has a choice.
4. **Given** a conflict, **When** the member gives their change up, **Then** it disappears from the draft and the published note stays as it is.
5. **Given** the member changed a note someone else deleted, **When** the member overwrites it, **Then** the note is restored with the member's text; **Given** the member deleted a note someone else changed, **When** the member overwrites it, **Then** the note is published deleted with the other's change gone.
6. **Given** a draft with nothing in it, **When** the member publishes, **Then** the refusal is said in words and nothing is written.
7. **Given** two people publishing at once, **When** both publish, **Then** the revisions get consecutive numbers, and the second meets the first as conflicts wherever the published notes no longer read as its bases.
8. **Given** a published revision, **When** it is read, **Then** my draft is empty and everyone's Published notes holds my changes.
9. **Given** a published note that now reads as the change's base — nobody touched it, or someone changed it and published the old text back — **When** the member publishes, **Then** the change is no conflict and applies as it is; a change whose own text has come to equal the published text leaves the draft without a question.

---

### User Story 4 - Draft and Published notes at any moment (Priority: P2)

The template's server answers Draft and Published notes at any moment not later than the watermark: my draft as it was then, and what everyone had published then, read only.

**Why this priority**: The time scale and every comparison are built on these two answers.

**Independent Test**: With the template's tests, read Draft and Published notes before and after a publication and between two changes of a draft: each answer is the state at that moment.

**Acceptance Scenarios**:

1. **Given** a moment in the past, **When** Draft is read at it, **Then** it shows my draft as it was then, read only.
2. **Given** a moment in the past, **When** Published notes is read at it, **Then** it shows what everyone had published then — the revision in force at that moment.
3. **Given** a page at a moment that is not now, **When** it opens, **Then** it has no actions and nothing can be changed.
4. **Given** a moment not yet come, **When** a page asks for it, **Then** the server refuses it in words.
5. **Given** two moments, **When** a person wants to compare them, **Then** the template offers no page of comparing: that is the core's scale (bystrovmaxim/gnomon#100).

---

### User Story 5 - The changed words marked the same everywhere (Priority: P2)

Every page that shows a changed text marks it alike: the words that went struck through in red, the words that came in green, inside the one text.

**Why this priority**: A change is read on the draft's cards, on both sides of a conflict and in the revert dialog; four drawings of one difference would be four truths.

**Independent Test**: Open a changed note, the same note in a conflict, and its revert dialog: the three markings are identical; compare them with the two texts.

**Acceptance Scenarios**:

1. **Given** a changed note, **When** it is shown, **Then** the words that went are struck through in red and the words that came in green, inside one text; a deleted note is struck through.
2. **Given** the two texts, **When** the marking is drawn, **Then** it comes from them alone, computed in the browser; nothing of it is stored.
3. **Given** any two texts, **When** the marking is drawn, **Then** every word of both appears exactly once — struck, green, or unchanged.
4. **Given** the marking, **When** any page shows a changed text, **Then** one place in the template draws it, so the draft's cards, both sides of a conflict and the revert dialog show it alike.
5. **Given** a long note or a long word, **When** it is marked, **Then** it wraps inside its card and the card grows.

---

### User Story 6 - The same on a phone (Priority: P2)

**Why this priority**: The template's pages are opened on phones too, and a conflict must be resolvable there.

**Independent Test**: At 375 px walk 1.6: the canvas takes the screen, the tree is a drawer, a change's tools are a sheet behind "⋯", the publishing dialog and the conflicts are sheets, and each conflict's choice is two wide buttons.

**Acceptance Scenarios**:

1. **Given** a phone, **When** Draft or Published notes opens, **Then** the canvas takes the screen, the tree is a drawer and the filters fold behind their button.
2. **Given** a change on a phone, **When** "⋯" is pressed, **Then** the shell's sheet holds Edit and Revert, or Edit in my draft and Delete in my draft on Published notes.
3. **Given** publishing with conflicts on a phone, **When** the dialog opens, **Then** it is a sheet and each conflict's overwrite or give up is a wide button.

---

### User Story 7 - Tests, the walk, documentation and versions (Priority: P2)

**Why this priority**: The template is copied; what it does must be shown by its tests and described by its pages.

**Independent Test**: Run the template's tests and the browser check on the stand; read the tutorial's chapters 8, 9 and 13, the plugin concept and the template's README.

**Acceptance Scenarios**:

1. **Given** the template's tests, **When** they run, **Then** they read Draft and Published notes at past moments — before and after a publication, and between two changes of a draft — and prove that a draft is seen by its person alone.
2. **Given** the tests, **When** each rule is broken on purpose, **Then** its test fails and no other test of the phase does.
3. **Given** the browser check, **When** it runs, **Then** it walks 1.6 on a desktop and at 375 px: two people, each writing in their own draft and not seeing the other's, one publishing and the other seeing it, both changing one note, the conflict with the other's name and value, one overwritten and one given up, a deletion and a restoration, and a revert of each state leaving the published note as it was.
4. **Given** the local stand, **When** two people walk 1.6, **Then** its result stands on the pull request.
5. **Given** the documentation, **When** it is read, **Then** the tutorial's chapters 8, 9 and 13 and the plugin concept describe the two pages, the draft and its conflicts, and the template's README says the same; the index's rows name this step.

---

### Edge Cases

- A change is made and then deleted in the draft: it is one change, **deleted**, not two.
- A deleted note is reverted: it returns to the draft's view as the published note, and the draft holds nothing of it.
- A change is reverted after someone published over its base: the revert gives up only my change and touches nothing published.
- Someone publishes while I read: my draft marks the changes that meet theirs, and nothing of mine is lost; the choice waits for publishing.
- A note I changed is deleted by someone else, and I revert instead of publishing: my change goes, the note stays deleted.
- A note I deleted is restored by someone else before I publish: publishing meets it as a conflict.
- A note added in my draft, not yet published, cannot conflict with anyone.
- The same text saved as the published one: no change remains in the draft.
- The State filter's row for a state no change holds fades and comes back when one is made.
- Draft read at a moment before my first change is empty and read only; read after a publication it is empty again.
- Published notes read before the first revision says nothing is published.
- Two people at one moment have two independent drafts.
- The publishing dialog is closed after its conflicts are shown: nothing is published, the draft stays as it was, and the choices are made again next time.
- A very long note and a word longer than the card wraps inside it; the marking does not break the card.
- A moment not later than the watermark is answered; a moment not yet come is refused in words.
- A publication that meets a conflict changed since the member last read is shown as it is now, not as it was when the dialog opened.
- Someone changes a note and publishes its old text back: the published note reads as my base, my change of it is no conflict and applies as it is.
- Someone publishes exactly the text of my change: my change leaves the draft without a question.
- I delete a note someone changed and published back to the base text: nothing conflicts, and the deletion applies.

## Requirements *(mandatory)*

### Functional Requirements

#### The two pages

- **FR-001**: An item MUST have two pages — Draft and Published notes — and Draft MUST replace Notes; no third page MUST show the same notes.
- **FR-002**: Draft MUST hold only the changes of the person who reads it; another person's draft MUST never be shown, at any moment.
- **FR-003**: Every change MUST carry its state — new, changed or deleted — and the published version it was made over: the revision's number and the published text.
- **FR-004**: A changed note MUST show the words that went and the words that came marked inside its text, as the accepted mockup draws them; a deleted note MUST be struck through; a new note MUST stand as written. Every card MUST say whose note it is.
- **FR-005**: The shell's **State** filter MUST choose which of New, Changed and Deleted stand; a state with no change behind it MUST fade and MUST come back when a change of that state is made.

#### My work in the draft

- **FR-006**: A change in the draft MUST be revertable after one question: a new note is removed; a changed or deleted note gives the change up, and the published note stays as it is.
- **FR-007**: **New note** and **Publish** MUST be the page's actions; New note MUST open a dialog — a sheet on a phone — and the note MUST enter the draft as new, seen by its writer alone.
- **FR-008**: A changed note of the draft MUST be changeable again; the draft MUST keep the last text and the base MUST stay the revision it was made over.
- **FR-009**: An empty draft MUST say nothing waits and MUST lead to writing a new note or changing a published one.
- **FR-010**: When a change's published note now reads otherwise than its base or is deleted, the draft MUST say so and mark that change; nothing of the member's MUST be lost, and the choice MUST wait for publishing.
- **FR-011**: A change that leaves a note as it is published MUST leave no change in the draft, including a change whose text has come to equal the published text by someone else's publication.

#### Everyone's published notes

- **FR-012**: Published notes MUST be read only and MUST show everyone's published notes of the revision in force, with its number, title, comment and optional release; with no revision yet it MUST say nothing is published.
- **FR-013**: The shell's **Authors** filter MUST choose whose notes stand, each person's initials in their colour.
- **FR-014**: Edit and Delete on any published note MUST act in the member's own draft and MUST NOT change anything for anyone else; the note MUST be marked "In your draft: changed" or "In your draft: deleted" and MUST lead to Draft; the head MUST say how many changes wait in the member's draft.
- **FR-015**: A page at now MUST read again when the core's watermark moves, so a publication and what it does to the member's draft MUST appear without a reload.

#### Publishing and its conflicts

- **FR-016**: Publishing MUST take the whole draft as one revision with a title, a comment and an optional release, without choosing notes one by one; what is not ready MUST be reverted before publishing.
- **FR-017**: Publishing MUST compare every change's base with the note as published now: where the published note still reads as the base, the change MUST apply as it is; where it reads otherwise or is deleted, the change is a conflict. A change whose own text has come to equal the published text MUST leave the draft and MUST NOT be put as a conflict.
- **FR-018**: Where the published note reads otherwise than a change's base or is deleted, publishing MUST publish nothing: it MUST list each conflict with the member's value and the value it would overwrite, whose it is and when, and MUST offer overwrite or give up for each; Publish MUST stay off until every conflict has a choice, and a change given up MUST disappear from the draft.
- **FR-019**: A conflict MUST hold for a change, for a deletion and for a restoration: overwriting a note someone deleted restores it with the member's text, and overwriting a note someone changed while the member deleted it publishes it deleted.
- **FR-020**: Publishing a draft with nothing in it MUST be refused in words, and nothing MUST be written.
- **FR-021**: Two publications at once MUST get consecutive numbers, and the second MUST meet the first as conflicts wherever their bases meet it.
- **FR-022**: A published revision MUST leave the member's draft empty and MUST show the changes to everyone in Published notes.

#### The past

- **FR-023**: Draft and Published notes MUST be answerable at any moment not later than the watermark; a page at a moment that is not now MUST have no actions, and a moment not yet come MUST be refused in words.
- **FR-024**: The template MUST NOT offer a page or an action of comparing two moments; choosing a moment and comparing are the core's (bystrovmaxim/gnomon#98, bystrovmaxim/gnomon#100).

#### The changed words

- **FR-025**: A changed text MUST show the words that went struck through in red and the words that came in green, inside one text, on the draft's cards, on both sides of a conflict and in the revert dialog.
- **FR-026**: The marking MUST be computed from the base text and the changed text alone, in the browser; nothing of it MUST be stored.
- **FR-027**: Every word of both texts MUST appear exactly once — struck, green or unchanged.
- **FR-028**: One place in the template MUST draw the marking, so every page that shows a changed text shows it alike.
- **FR-029**: A long note and a long word MUST wrap inside the card, and the marking MUST NOT break the card.

#### The phone

- **FR-030**: On a phone the canvas MUST take the screen, the tree MUST be a drawer, the filters MUST fold behind their button, the page's actions MUST stand above the bottom bar, and a change's or a note's tools MUST be a sheet behind "⋯"; the publishing dialog and the conflicts MUST be sheets, each conflict's choice two wide buttons.

#### Tests, the walk, documentation, versions

- **FR-031**: The template's tests MUST read Draft and Published notes at past moments — before and after a publication, and between two changes of a draft — MUST prove that a draft is seen by its person alone, and MUST prove the conflicts of a change, a deletion and a restoration, the revert of each state, and the refusal of publishing an empty draft.
- **FR-032**: A browser check MUST walk 1.6 on a desktop and at 375 px; each rule MUST be broken on purpose, its test seen failing and no other test of the phase failing, then restored.
- **FR-033**: Two people MUST walk 1.6 on the local stand during this work, and its result MUST stand on the pull request.
- **FR-034**: The tutorial's chapters 8, 9 and 13, the plugin concept wherever the pages and the revisions change, the template's README and the index's rows naming this step MUST describe what this work builds.
- **FR-035**: The template MUST raise its version, and the changelog MUST describe the work in plain words.

### Key Entities

- **Item** — the folder the notes live in; two nodes, Draft and Published notes.
- **Note** — one text about an item, with its writer (its author).
- **Published note** — a note as everyone has published it, read only, carrying its revision in force.
- **Revision** — the whole published state published at once: number, title, comment, optional release, publisher and moment.
- **Draft** — one person's changes over the published state of one item; its person alone sees it.
- **Change** — one note in a draft: its state (new, changed, deleted), its base (revision and published text), the member's text, and when it was last changed.
- **Conflict** — a change whose published note now reads otherwise than its base or is deleted, with the member's value and the value it would overwrite, whose and when.
- **Moment and watermark** — the instant a read answers and the latest moment whose answer cannot change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tries on the stand, neither of two people sees any change of the other's draft before it is published — 0 drafts visible across people.
- **SC-002**: 0 changes reach the published state without a publication, and 100% of published changes are seen by everyone in Published notes at once.
- **SC-003**: Every conflicting change is shown at publishing with the other person's name, value and moment in 100% of tries, and 0 publications go through with a conflict left undecided.
- **SC-004**: 0 changes are lost silently: in the walk every change of a draft is either published or explicitly given up.
- **SC-005**: Reads at past moments match the state at those moments in 100% of the test moments — before and after a publication, and between two changes of a draft.
- **SC-006**: The marking loses and repeats 0 words over the sample texts, and reads identically on the draft's card, both sides of a conflict and the revert dialog.
- **SC-007**: The walk of 1.6 completes on a desktop and at 375 px with every step as the issue states.
- **SC-008**: A search of the template's pages, the tutorial and the concept finds 0 places that describe a third page or a draft shared by everyone.

## Assumptions

- The template's server of bystrovmaxim/gnomon#97, its items and nodes of bystrovmaxim/gnomon#103, the shell of bystrovmaxim/gnomon#109, the build of the frontend of bystrovmaxim/gnomon#110, the filters and lists of bystrovmaxim/gnomon#115, the page's history of bystrovmaxim/gnomon#116 and the two pages of bystrovmaxim/gnomon#102 are in place.
- A draft is one person's and one item's; its changes are read by that person alone at every moment.
- Every member of the organization may write, change, delete and publish on the item, as today; this work adds no role.
- The release a revision is published as is a milestone of the core's time scale (bystrovmaxim/gnomon#98); this work only carries the label.
- The time scale and the comparisons of bystrovmaxim/gnomon#98 and bystrovmaxim/gnomon#100 follow this work; the mockup's "The past" screens are walked there, while the server's reads at past moments are tested here.
- The marking's library is chosen in the plan from the issue's candidates — `diff` (jsdiff)'s `diffWords` first, `diff-match-patch` second — by its licence and by how it reads a text rewritten almost whole.
- Two people with accounts on the local stand walk 1.6; the browser checks run locally, as CI cannot run them.
- The common data environment's four states are bystrovmaxim/gnomon#106; this work builds its first form, with a draft, a published state and a revision, and nothing more.
