# Feature Specification: Maxitor core and the plugin template — the time scale: one moment for the screen, its comparison panels, and the template's pages walked on it

**Feature Branch**: `feature/issue-98-time-scale`

**Created**: 2026-11-12

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#98, "09 · Maxitor core and the plugin template: the time scale — one moment for the screen, its comparison panels, and the template's pages walked on it". The issue's body is the source of truth. The accepted mockups are `specs/079-time-scale/mockup/index.html` (the core on its test page: the panels following one element, the step's card of a complex element, a list of 10,000 rows, the shell's filters and date pickers) and `specs/074-notes-history/mockup/index.html` (one time scale set up by each page: the template's Published and checkout-web's graph, with the legend behind the "i" built from each setup), with their copies in `archive/makets/`; Draft and Published themselves are the accepted mockup of bystrovmaxim/gnomon#121, `archive/makets/084-notes-draft-published`, and the tree is the accepted mockup of bystrovmaxim/gnomon#122, `archive/makets/085-entered-tree-node`. Every visual is taken from the graph viewer's code in `packages/maxitor/maxitor-web/client/src`, where it already works as it must.

## What this is

Every plugin's data in Maxitor is versioned: any page can be read at any past moment. Until now nothing in the core lets a person choose that moment, and nothing lets two moments be compared. This work gives the core its one time control — the scale — on the right of the top row, and the comparison panels that go with it; and it walks the whole of it on the first real pages, the plugin template's Draft and Published.

The scale is one tool for every page. The core draws it and drives it; a page sets it up by declaring its history — what its bars count, what kinds of point its milestones are, whether it has small points or flags, which comparisons it offers, which action it offers on a milestone — and gives the data. The legend behind the scale's "i" is built from the same declaration, so the scale, its points, their cards and their legend never disagree. Nothing of a plugin runs in the core's frame.

The scale is made from the graph viewer's history panel as it is today — the pill, the picker card, the track and its tips — keeping its look and behaviour. The frame and the canvas it lies in are brought to the graph viewer's look in the same step, and the template's two pages are brought to their accepted mockup before they walk the scale.

Words used below:

- **Scale** — the core's time control: the pill in the top row and the card that hangs from it, holding the bars, the milestones' lane and the axis.
- **Pill** — the button in the top row that names the moment shown and opens the card; its arrows step back and forward.
- **Moment** — the time a page is read at, written to the address as `at`; with no `at` the page reads now.
- **Watermark** — the latest moment whose answer can no longer change; "now" follows it, and no later moment can be chosen.
- **Mode** — One moment, Diff (A against B in one panel) or Side by side (A and B in two panels); written to the address as `mode`, with A as `from`.
- **Bars** — the histogram of a page's changes in each stretch of time: added, changed, removed.
- **Milestone** — an event that matters on its own, drawn as a point on the lane above the bars: a publication, a rollback, a pull request.
- **Kind** — one entry of a page's vocabulary of points: its tone, look, lead, name and one sentence; every milestone names its kind.
- **Setup** — what a page declares about its history: its reading action, its bars, its milestones, its card, its kinds, `small`, `flag`, its modes and its actions on a milestone.
- **Legend** — what opens behind the "i" in the card's head: the page's points, its bars, the marks and the keys.
- **Panel** — a place the core opens a page in: one in One moment and in Diff, two — A and B — in Side by side.
- **Context** — what the core tells a page in a panel: `at`, and in a comparison `against` and, in Side by side, `side`.
- **Anchor** — the identity an element of a page carries (`note:n2`, `table:Account`, `field:Account.email`), never its place on the canvas.
- **Track** — the following of one element between the two panels of Side by side, by its anchor.
- **Stepper** — the core's `ChangeStepper`: the changes between the two moments of a comparison, one step at a time.
- **Change card** — `DiffCard`: what changed in the element a step stands on.
- **Halo** — the soft glow in a change's colour under an element that changed in a comparison.
- **Publication** — a revision of the template's notes, published by a person and in force until the next one, named `vN`.
- **Rollback** — a publication that brings back the notes of an earlier one; everything published between them stays in the history.
- **Draft** — the template's page of my own changes, seen by me alone until I publish them.
- **Published** — the template's page of everyone's notes as the publication in force holds them.

## Clarifications

### Session 2026-11-12

These points were settled with the maintainer on the mockups before this specification; the specification is held to them.

- Q: Is the scale one tool, or drawn anew for each plugin? → A: One tool. A page sets it up by its declaration and by nothing else; the core draws every page's scale alike from that declaration (issue, 1.1, item 5).
- Q: How does a milestone get its look? → A: From its kind. The page declares `kinds` once — `{ tone, look, lead, term, def }` each — and every milestone it answers names one; `small` and `flag` are each one sentence and each a promise: only a page that declares `small` may answer small points, only a page that declares `flag` may answer flags. A milestone of an undeclared kind, a small point without `small` or a flag without `flag` is refused by the core and named in the browser's console.
- Q: What does the legend show? → A: What the open page declared, nothing else: Points are its kinds in their order; Bars stand when it has bars; Size and the three points only with `small`, Flag only with `flag`; "now", the chosen moment and the keys always. The card's switch of small points stands only with `small`.
- Q: What marks does Published have? → A: Two kinds — Published (purple) and Rolled back (red) —, one size, no flag; the draft is a page of its own and no point of Published's history. The graph has its own: direct push, merged, review required, approved, changes requested, live, small points for pull requests that did not change the graph, flags for releases — as the graph viewer's `TrackLegend` names them today.
- Q: Does the point under the pointer grow? → A: No. It keeps its size and gains a ring, as the graph viewer's `VersionTrack` draws its `hover-ring`; a size means something only where the page declared `small`.
- Q: What does the template call a revision? → A: A publication; its milestone's badge reads `Published`, a rollback's `Rolled back`.
- Q: May a page act in the past? → A: Only by an action it declares for a milestone (`on: "milestone"`), shown when `at` stands exactly on one of its milestones and no comparison is chosen. The template's Roll back is the one such action.
- Q: Which comparisons do the template's pages offer? → A: The passport declares `compare: [diff, side_by_side]`; Published and Draft offer both: Draft's two panels show the person's draft at A and at B.
- Q: Where does the visual come from? → A: From the graph viewer's code: the canvas's surface and dots, the status disks of `lib/erdFilterPresence.ts`, the ERD table of `lib/buildDotSource.ts` with its halo and fading of `lib/erdPostPass.ts`, `DiffCard`, `ChangeStepper`, the tree's pictograms and the person's circle in their own colour. Nothing is drawn anew.
- Q: What do the crumbs and Back do? → A: The crumbs name the organization, then every section entered, each after a `›`; a page inside a section adds nothing. Back steps out of the deepest section entered and opens that level's page — the section above, or the organization's home at the root — through the address, so the tree, the crumbs, the address and the page show the same place; at the root Back is not drawn.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One moment for the whole screen (Priority: P1)

A person opens the pill on the right of the top row; the card hangs from it, with the scale of the open page. They click a moment on the scale: the page, the tree and everyone following them show that moment; the address holds it as `at`. The pill's arrows step to the previous or the next change. "Now" is a green dashed line; what lies right of it is hatched and cannot be chosen.

**Why this priority**: Without one shared moment nothing else of this step exists.

**Independent Test**: On the core's test page and on Published, open the pill, choose a moment, reload: the same moment; step with ‹ ›; try an `at` later than the watermark in the address: refused, the page leads to now.

**Acceptance Scenarios**:

1. **Given** any page, **When** the pill is opened, **Then** the card hangs 11 px under it, its right edge under the pill's, holding the page's scale.
2. **Given** the scale, **When** a moment is clicked, **Then** it is written to the address as `at`, sent to the page as `panel.location`, kept as chosen — to the minute, or to the second while the scale is zoomed below a minute — never moved to the start of a publication —, and the page reads at it.
3. **Given** a page at now, **When** the watermark moves, **Then** "now" moves with it, the page receives `panel.watermark` and reads again; a page in the past or in a comparison does not.
4. **Given** an address whose `at` is later than the watermark, **When** it opens, **Then** the moment is refused and the page says so and leads to now.
5. **Given** the pill, **When** its arrows or Shift + ← → are used, **Then** the moment steps to the previous or the next change of the page — through its milestones when it has only milestones —, except while one types or on a handle of the scale.

---

### User Story 2 - The scale set up by the page, and its legend (Priority: P1)

Published shows bars of the notes' changes with its publications as purple points on the lane above, and a rollback as a red one, all one size, with no flags; hovering a point shows its card — badge, ref, time, title, author, what changed. The graph shows only milestones: its pull requests in their colours, small points for those that did not change the graph, flags for releases. Behind the "i", each page's legend lists exactly what that page draws.

**Why this priority**: The scale serves every plugin only if each page can say what its marks mean and the core draws nothing else.

**Independent Test**: Open the card on Published and on the graph: compare their lanes, their cards' heads and their legends; zoom the bars from all the history to one morning; on the test page load each fixture — bars alone, milestones alone, both; send a milestone of an undeclared kind: refused and named in the console.

**Acceptance Scenarios**:

1. **Given** a page that declares bars, **When** the card opens, **Then** the bars are a histogram of its changes — green added, amber changed, red removed —, zoomed by dragging across a stretch, by the wheel or a pinch around the pointer, moved by a sideways swipe or Shift-wheel, with the presets 1 min, 10 min, 1 h, 1 d, 7 d, 30 d and All; the bars get finer as one zooms in, from a day to a minute, and a hovered bar lists its changes.
2. **Given** a page that declares milestones, **When** the card opens, **Then** each milestone is a point on the lane above the bars and the dates, where it happened, drawn from its kind's tone, look and lead.
3. **Given** a page that does not declare `small` or `flag`, **When** its scale is drawn, **Then** every point is one size and carries no flag, its card's head has no switch of small points, and its legend has no Size, Flag or three points.
4. **Given** a page that declares `small` and `flag`, **When** its scale is drawn, **Then** small points are smaller, the switch in the card's head hides them, a flag stands over a point that carries one, and the legend has Size, Flag and the three points, each with the page's sentence.
5. **Given** a milestone, **When** the pointer is on its point, **Then** the point keeps its size and gains a ring, and its card — the plugin's blocks — is asked by its `id` and drawn by the core from data only.
6. **Given** a milestone of a kind the page did not declare, or a small point or a flag the page did not declare, **When** the core receives it, **Then** it is not drawn and is named in the browser's console.
7. **Given** a chosen moment, **When** the scale is drawn, **Then** the comment of the milestone in force stands under it; in a comparison, A's on the left, B's on the right, and every milestone between them below; a page with bars alone has nothing under its scale.
8. **Given** a bar below the watermark, **When** it was read once, **Then** its answer is kept and a zoom asks the plugin only for the bars it does not have and for the right edge.

---

### User Story 3 - Comparing two moments (Priority: P1)

A person switches the card to Diff and chooses A and B: the page draws one canvas with what happened between them — painted by change, a soft halo under what changed, the rest faded. Side by side opens the page twice, A and B. The stepper walks the changes; each step brings the change into view and opens its card beside it.

**Why this priority**: Comparing is the reason the past is worth reading.

**Independent Test**: On Published, Diff from a past moment to now: changed notes glow in their colour, unchanged are faded; step with Shift + ↓: each note is brought into view with its card; Side by side: two panels, each with its letter and moment; switch an author off in A: off in B.

**Acceptance Scenarios**:

1. **Given** a page that offers comparisons, **When** Diff or Side by side is chosen, **Then** `mode` and `from` are written to the address beside `at`, and no mode writes any data.
2. **Given** an address with a mode the page does not offer, **When** it opens, **Then** its `at` opens as one moment.
3. **Given** Diff, **When** the page draws, **Then** it receives `at` = B and `against` = A and draws one canvas with every element marked by what happened to it.
4. **Given** Side by side, **When** the page draws, **Then** the core opens it in two panels, A brown and B blue, each with its head and its own camera; panel A receives `at` = A, `against` = B, `side` = `a`, panel B `at` = B, `against` = A, `side` = `b`; the page never knows there are two.
5. **Given** a comparison painted by its changes, **When** it is drawn, **Then** an element that changed wears its change's colour on its frame and a halo of that colour under it — 40 px round the element, fill-opacity 0.16, blurred by 22 —, and an element nothing happened to is faded to 0.32, its lines to the grey `#94a3b8` at a third; painted by anything else, nothing is faded.
6. **Given** a comparison, **When** the stepper is used — its arrows, its list or Shift + ↑ ↓ —, **Then** the change is brought into view keeping the zoom and its change card opens beside it: the element's title and status disk, then each property that changed by its path, before struck and after; an added or removed element in one line; for a complex element the parts that changed inside it, by group.
7. **Given** the stepper, **When** it stands, **Then** it stands only with a chosen range, in the panel's top right corner — on panel B in Side by side —, first in one row with the page's actions when B is now and alone when B is in the past, and the row never lets one cover the other, on a desktop or on a phone.
8. **Given** a comparison, **When** the pill names it, **Then** it shows both moments and the counts `+ − ~` the page sends.

---

### User Story 4 - The panels follow one element (Priority: P1)

In Side by side, the pointer on an element lights the same element in the other panel when it is there in view; a click chooses it and the other panel's camera glides to it, keeping its zoom. A field the other moment does not have falls back to its table, with a note; a row of a list of 10,000 is brought into view the same way.

**Why this priority**: Two panels that do not follow each other make every comparison a search.

**Independent Test**: On the core's test page: hover a table in B, choose a far table, a field A lacks, a table added after A, a table the filters hide; in the list choose a row far below, a row added after A, a row A's filters leave out; on a phone choose in B and switch to A.

**Acceptance Scenarios**:

1. **Given** Side by side, **When** the pointer rests on an element, **Then** the same element is lit in the other panel only if it is in that panel's view; nothing moves under the pointer.
2. **Given** Side by side, **When** an element is chosen, **Then** it is lit in both panels and the other panel's camera brings it into view keeping its zoom, saying "Brought to the centre".
3. **Given** a chosen element inside another (a field inside a table), **When** the other panel lacks it, **Then** that panel shows the deepest anchor of the chain it holds, outlined, and says what it could not show; a folded parent says the element is inside; nothing held — "Not in A" or "Not in B"; held but filtered away — "Hidden by the filters".
4. **Given** a list or a table lying whole on the canvas, **When** a row is chosen in one panel, **Then** the other panel's camera glides to that row by its anchor, wherever it stands, as it does for an element of a drawing.
5. **Given** a step of the stepper in Side by side, **When** it lands, **Then** the change's anchor with its chain of parents goes through the core to panel A, which shows it by the same rules.
6. **Given** a phone, **When** an element is chosen in B and A is opened by the A / B switch, **Then** A brings it into view by the same rules.

---

### User Story 5 - The frame and the canvas as the graph viewer draws them (Priority: P2)

The canvas lies on the graph viewer's surface with its dots; the tree's pictograms, the filter's disks and the person's circle are the graph viewer's; the tree's head stands on one left edge; the crumbs name the organization and the sections entered; Back leaves the deepest section through the address and is not drawn at the root; the collapsed tree is a strip with one button.

**Why this priority**: The scale lies in this frame; a frame that looks and behaves otherwise than the graph viewer is not ready for a customer.

**Independent Test**: On the stand open Draft and Published and the test page: compare the canvas, the tree's head, the filter's disks and the account's circle with the graph viewer; enter Notes, open Published, press Back, collapse the tree.

**Acceptance Scenarios**:

1. **Given** any page's canvas, **When** it is drawn, **Then** it lies on `#f4f5f7` with a dot of `rgba(160, 168, 180, 0.42)`, 1 px, every 20 px, as the ERD's canvas.
2. **Given** the tree, **When** it is drawn, **Then** its collapse button is `SidebarToggleIcon`, a branch's arrow is `ChevronRight` / `ExpandMore`, Back is `ChevronLeft`, and a node's icon is a Material Outlined pictogram at 16 px and opacity 0.88; no node carries a counter.
3. **Given** a filter, **When** a row is drawn, **Then** its disk is the graph viewer's status disk at 20 px in its 1 px ring, a person's disk the same with the initials; a row with nothing of its kind on the page keeps its disk in colour and fades only its label to 0.4; a row switched off fades whole.
4. **Given** the top row, **When** the account's circle is drawn, **Then** it is filled with the person's colour and carries white initials.
5. **Given** the tree's head, **When** it is drawn, **Then** its buttons stand on the same left edge as the level's icon and the tree's first column.
6. **Given** a section entered, **When** a page inside it opens, **Then** the crumbs read `ORG <organization> › <section>` and the page adds nothing; a node inside that opens a section of its own adds its link.
7. **Given** a place inside a section, **When** Back is pressed, **Then** the tree shows the level above, the crumbs lose their last link, the panel opens that level's page — or the organization's home at the root —, and the address changes so the browser's Back returns.
8. **Given** the root, **When** the tree is drawn, **Then** Back is not drawn; **Given** the collapsed tree, **Then** it is a strip with the expand button alone.

---

### User Story 6 - The template's Draft and Published as their accepted mockup draws them (Priority: P2)

Published's head is the mockup's — the ref as a chip, the title, one line of who published it and when, the release, how many notes by how many authors, read only — and ends with `Your draft: N`. Before the first publication the card says nothing is published yet. After publishing, the panel opens Published with the new publication. The bottom bar holds the zoom alone. Published filters by Authors, Written and Last change.

**Why this priority**: The template's pages are the first pages on the scale; they must be what the maintainer accepted.

**Independent Test**: On the stand with no publication, open Published; write a note in Draft and publish; filter Published by Written and by Last change; compare each screen with `archive/makets/084-notes-draft-published`.

**Acceptance Scenarios**:

1. **Given** Published with a publication in force, **When** it is drawn, **Then** its head is the chip `vN`, the title in bold and one line `<person> published it <when> · release <name> · <n> notes by <m> authors · read only`; with changes waiting in my draft the head ends with the button `Your draft: N`, which opens Draft; nothing of it stands loose on the canvas.
2. **Given** Published before the first publication, **When** it is drawn, **Then** the card says nothing is published yet and holds the same `Your draft: N`; "Nothing to show — the Authors filter hides every published note" is said only when that filter hides every note of a publication.
3. **Given** a publication that succeeds, **When** its dialog closes, **Then** the panel opens the item's Published showing the new publication, and the draft starts empty.
4. **Given** Draft or Published, **When** the bottom bar is drawn, **Then** it holds the zoom alone.
5. **Given** Published, **When** its filters are drawn, **Then** they are Authors, then two ranges of dates — Written, when a note was first written, and Last change, when it last changed —, each two rows From and To opening the date range picker with the page's own ready stretch "Since the first publication"; each is an address parameter (`written=…`, `changed=…`), one for both panels, and the table shows both columns of the same names.
6. **Given** a range of dates, **When** it is applied, **Then** it chooses among the notes the page shows and never moves the scale.

---

### User Story 7 - Published and Draft in the past, compared and on the scale, with Roll back (Priority: P1)

A person opens Published at a past moment: the notes as that publication held them, read only. They compare two publications in Diff and Side by side, follow a note between the panels, step through the changes. Standing exactly on v3, they roll back to it: v6 holds the notes of v3, stands on the scale as a red point, and v4 and v5 stay in the history.

**Why this priority**: The scale is accepted only on real pages; these are the first.

**Independent Test**: On the stand walk Published and Draft through every screen of `specs/074-notes-history/mockup` groups "Notes · Published — …": a past moment, before the first publication, a moment not come yet, Diff, Side by side, a note chosen in B, the legend, Roll back exactly on v3 and between two publications.

**Acceptance Scenarios**:

1. **Given** Published or Draft with `at`, **When** it is drawn, **Then** it reads at that moment and offers no writing, editing or deleting.
2. **Given** Published, **When** a moment between two publications is chosen, **Then** the page shows the publication in force and does not change until the next one.
3. **Given** a comparison on the template's pages, **When** it is drawn, **Then** the filter adds Changes, painting by change starts on, the halo and the fading of User Story 3 apply, every note carries `data-room-anchor` = `note:<id>`, and the camera is kept between moments.
4. **Given** Published's scale, **When** it is drawn, **Then** its bars count the notes' changes — the address's filters change them as they change the page —, its points are its publications and rollbacks, and its card's head has no switch of small points; Draft's scale has the bars of my draft's own changes with the publications on its lane.
5. **Given** a page at now, **When** someone else publishes, **Then** the newest bar grows and the publication stands as a point without a reload.
6. **Given** Published with `at` exactly on a past publication and no comparison, **When** it is drawn, **Then** the panel's top right corner offers `Roll back to vN`; on the publication in force, between two publications, at now and in a comparison it offers nothing.
7. **Given** Roll back, **When** it is confirmed with a title and a comment, **Then** a new publication holding the notes of vN is published, every publication after vN stays in the history, the new one stands on the scale as a red point with the badge `Rolled back` naming vN, and its comment stands under the scale when it is chosen.
8. **Given** a draft made over a publication older than the one in force after a rollback, **When** its owner publishes, **Then** the draft meets the case of a draft over an older base as the accepted mockup of #121 draws it (1.7).

---

### User Story 8 - Everything on a phone (Priority: P2)

On a phone the card is a sheet, Side by side shows one panel at a time switched by A / B, the stepper and the page's actions stand in one row above the zoom, the filters are one button, and the date pickers are sheets.

**Why this priority**: A person opens Maxitor from a phone as often as from a desktop.

**Independent Test**: At 375 px walk the screens of both mockups in their phone version.

**Acceptance Scenarios**:

1. **Given** a phone, **When** Side by side is chosen, **Then** one panel is shown at a time, opening on B, switched by A / B in its head, and an element chosen in one is brought into view in the other when it opens.
2. **Given** a phone, **When** the stepper stands with the page's actions, **Then** they stand in one row above the zoom, and the change card stands above them.
3. **Given** a phone, **When** any screen of the mockups is drawn, **Then** no text is squeezed to a word a line and nothing covers the zoom.

### Edge Cases

- An `at` between two publications: Published shows the publication in force; Roll back is not offered.
- An `at` exactly on the publication in force: no Roll back — there is nothing to bring back.
- A rollback to a publication that was itself a rollback: the new publication holds the notes that one brought back.
- A milestone answered with a kind the page did not declare: not drawn, named in the console; the rest of the lane is drawn.
- A page that declares neither bars nor milestones: its scale offers the moment alone, and its legend has only the core's marks and keys.
- A chosen element whose parent is folded in the other panel: the parent is outlined and the note says the element is inside it.
- A row the other panel's filters leave out: "Hidden by the filters", and that panel does not move.
- The pointer on an element the other panel holds out of view: nothing is lit and nothing moves; a click brings it.
- An address with `mode=side_by_side` on Draft, which offers Diff only: its `at` opens as one moment.
- A comparison painted by authors: nothing is faded; the frame, the signs and the halo still say what changed.
- A range of dates whose bound moves with today (`now-30d`): read again every day; the address keeps it as written.
- A tree whose root is open: Back is not drawn; the collapsed strip still holds the expand button alone.

## Requirements *(mandatory)*

### Functional Requirements

#### The scale and the moment

- **FR-001**: The core MUST have one time control on the right of the top row — the pill and the card hanging from it, 11 px under it, its right edge under the pill's — made from the graph viewer's `VersionButton`, `VersionPicker`, `VersionTrack` and `VersionTip`, keeping their look and behaviour; every plugin MUST use it.
- **FR-002**: The moment MUST be one for the whole screen — the tree, the panel and everyone following —, written to the address as `at`, sent to the page as `panel.location`, kept as chosen — to the minute, or to the second while the scale is zoomed below a minute —, never moved to the start of a publication.
- **FR-003**: "Now" MUST be a green dashed line with nothing written on it, following the watermark and sending `panel.watermark`; what lies right of it MUST be hatched and MUST NOT be chosen; an `at` later than the watermark MUST be refused, the page saying so and leading to now.
- **FR-004**: Continuous history and publications MUST be read the same way: reading at a moment gives the state then; between two publications the answer does not change.
- **FR-005**: The pill's arrows and Shift + ← → MUST step to the previous or the next change of the page, through its milestones when it has only milestones; Shift + ↑ ↓ MUST step a comparison's changes; neither while one types nor on a handle of the scale; the keys MUST work whether the focus is in the core's frame or in the page, passed through the panel protocol.

#### The page's setup and the legend

- **FR-006**: A page MUST set the scale up by one declaration given through `PanelPage` of `@maxitor/panel`: `read`, optional `bars`, optional `milestones`, `card`, `kinds`, optional `small`, optional `flag`, optional `compare` and optional `actions`; the actions it names MUST lie in the plugin's folder `history/`, one AOA action per file.
- **FR-007**: `kinds` MUST be the page's vocabulary of points — `{ tone, look, lead, term, def }` each, `tone` one of the core's palette (neutral, purple, blue, green, amber, red), `look` filled, hollow or dashed, `lead` solid or dashed —, given once, in the legend's order.
- **FR-008**: Every milestone the page answers MUST name one of its `kinds`; it MAY be small only when the page declared `small`, and MAY carry a flag only when the page declared `flag`.
- **FR-009**: The core MUST refuse to draw a milestone of an undeclared kind, a small point without `small` and a flag without `flag`, and MUST name each in the browser's console; the rest of the scale MUST be drawn.
- **FR-010**: The legend behind the "i" MUST be built from the same declaration: Points are the page's kinds in their order, each with its `term` and `def`; Bars only when the page has bars; Size and the three points only with `small`, Flag only with `flag`, each with the page's sentence; "now", the chosen moment and the keys always. The card's switch of small points MUST stand only with `small`.
- **FR-011**: Which comparisons a plugin's pages can draw MUST be declared in its passport, `history: { compare: [diff, side_by_side] }` in `maxitor-plugin.yaml`; a page MAY narrow the list, never widen it; without the block the scale MUST offer one moment only; the card's switch MUST show only what the open page offers.

#### Bars and milestones

- **FR-012**: Bars MUST be drawn as a histogram of the page's changes — added green, changed amber, removed red —, zoomed by dragging across a stretch, by the wheel or a pinch around the pointer, moved by a sideways swipe or Shift-wheel, with the presets 1 min, 10 min, 1 h, 1 d, 7 d, 30 d and All moving smoothly; they MUST get finer as one zooms in, from a week to a second, the narrowest stretch a minute, so changes seconds apart stand apart; continuous changes MUST NOT be drawn as points; a hovered bar MUST list its changes — who, what, when.
- **FR-013**: With no `bars`, the SDK MUST give them by running the page's reading action over the interval, every reading query writing its moment condition through one function of the SDK with two forms — at a moment and over an interval —, the bounds inside the interval grouped into bars by `date_bin`.
- **FR-014**: A milestone MUST be a point on its own lane at the top of the scale, above the bars and the dates, where it happened — never at an equal step —, drawn alike for every plugin from its kind; the point under the pointer MUST keep its size and gain a ring.
- **FR-015**: A milestone's card MUST be the plugin's list of blocks of `@maxitor/panel` — `line`, `badge`, `title`, `text`, `fields`, `person`, `chips`, `warn` — asked by its `id` on hover or when it is chosen, drawn by the core from data only, with the milestone's `comment` and `link`; a milestone that is not a state at any moment MUST give `opens` and choosing it MUST open that page without changing `at`.
- **FR-016**: Under the scale the core MUST show the comment of the milestone in force — in a comparison A's on the left, B's on the right, and every milestone later than A and not later than B below —; a page with bars alone MUST show nothing there.
- **FR-017**: Every call MUST carry the organization, the open node, the page's address parameters, the interval and the bar's width — never what is visible on the screen —, through the gateway with the organization's token; an answer whose bar lies below the watermark MUST be kept, and a zoom MUST ask only for the bars the core does not have and for the right edge.

#### Comparisons

- **FR-018**: Diff and Side by side MUST add `mode` and `from` to the address beside `at`; the plugin concept MUST reserve `mode` and `from` as it reserves `at`; no mode MUST write any data; an address with a mode the page does not offer MUST open its `at` as one moment.
- **FR-019**: The core MUST lay out the panels and give each page its context — One: `at`; Diff: `at` = B, `against` = A; Side by side: panel A `at` = A, `against` = B, `side` = `a`, panel B `at` = B, `against` = A, `side` = `b` —, sent with `panel.location`; the page MUST draw one canvas from its context and never know how many panels there are.
- **FR-020**: Side by side MUST be laid out as the graph viewer's `SideBySide`: two panels, each with its head — its letter, A brown and B blue, its moment — and its own camera, and Track at the end of B's head, on by default; on a phone one panel at a time with an A / B switch, opening on B.
- **FR-021**: The address parameters MUST be one for both panels: a filter, a view or a paint switched in one is switched in the other.
- **FR-022**: A comparison MUST start painted by its changes; `@maxitor/panel` MUST give every card and every element of the canvas the graph viewer's marks: an element that changed wears its change's colour on its frame and a halo of it under it — 40 px round the element, fill-opacity 0.16, blurred by 22 —; an element nothing happened to is faded to 0.32, its lines to `#94a3b8` at a third; painted by anything else, nothing is faded.
- **FR-023**: The pill MUST name both moments of a comparison and the counts `+ − ~` the page sends through the panel protocol.

#### Following one element

- **FR-024**: Every object a page shows MUST carry `data-room-anchor` naming what it is, never where it stands; a complex element MUST nest its parts' anchors inside its own.
- **FR-025**: The canvas of `@maxitor/panel` MUST answer the core by anchors — what lies under the pointer with its chain of parents, mark this element, bring it into view keeping the zoom —, so a plugin writes nothing for Track.
- **FR-026**: Hovering MUST light the same element in the other panel only when it is in that panel's view; choosing — a click, a selection or a step of the stepper — MUST bring it into the other panel's view keeping its zoom.
- **FR-027**: To show a chain, a panel MUST take the deepest anchor it holds and say why when it shows less: a part gone or a parent folded — the parent outlined with the note; nothing held — "Not in A" / "Not in B"; held but filtered away — "Hidden by the filters"; brought from out of view — "Brought to the centre".
- **FR-028**: The list and the `DataTable` of `@maxitor/panel`, lying whole on the canvas, MUST keep the anchors of all their rows and answer the core as the canvas does, bringing a row into view wherever it stands.
- **FR-029**: On a phone, opening the other panel by the A / B switch MUST bring the chosen element into its view by the same rules.

#### The stepper and the change card

- **FR-030**: `ChangeStepper`, `DiffCard`, `StatusIcon` and `VersionsBetween` MUST be released in `@maxitor/panel`; a page MUST build its comparison from them, configured by their properties.
- **FR-031**: The stepper MUST stand only when a range is chosen, in the panel's top right corner — on panel B in Side by side —, first in one row with the page's actions when B is now and alone when B is in the past; the row MUST never let one cover the other, on a desktop or on a phone, where it stands above the zoom.
- **FR-032**: A step MUST bring the change into view keeping the zoom and open its change card beside it, as the graph viewer's `DiffCard`: the title and `StatusIcon`, "Added in B" or "Removed in B" in one line, each property that changed by its path, before struck and after, and the parts that changed inside a complex element by group, each part its coloured sign and its label with its rows; the words MUST be the page's answer of an anchor's differences between `against` and `at`; the card MUST close on Escape or a click outside, and a click on the stepper MUST move it to the next change.
- **FR-033**: The stepper's list MUST be grouped by the object the changes belong to, its signs coloured text as in the graph viewer.

#### A page's actions in the past

- **FR-034**: A page's actions MUST show whenever B is now, in a comparison too (`actionsShown` by `at` alone); an action declared for a milestone (`on: "milestone"`) MUST show only when `at` stands exactly on one of the page's milestones and no comparison is chosen.

#### The frame and the canvas

- **FR-035**: The canvas of `@maxitor/panel` MUST lie on `#f4f5f7` with a dot of `rgba(160, 168, 180, 0.42)`, 1 px, every 20 px, the tokens `--mx-canvas`, `--mx-dot` and `--mx-dot-step` of `@maxitor/tokens` holding these values.
- **FR-036**: The tree's pictograms MUST be the graph viewer's — `SidebarToggleIcon`, `ChevronRight` / `ExpandMore`, `ChevronLeft`, Material Outlined node icons at 16 px and opacity 0.88 —; no node MUST carry a counter.
- **FR-037**: A filter's disk MUST be `statusDiskUri` of the graph viewer at 20 px in a 1 px ring, a person's disk the same with the initials; a row with nothing of its kind on the page MUST keep its disk in colour and fade only its label to 0.4.
- **FR-038**: The account's circle in the top row MUST be filled with the person's colour and carry white initials.
- **FR-039**: The tree's head buttons MUST stand on the same left edge as the level's icon and the tree's first column.
- **FR-040**: The crumbs MUST name the organization, then every section entered, each after a `›`; a page inside a section MUST add nothing; only a node that opens a section of its own MUST add a link.
- **FR-041**: Back MUST step out of the deepest section entered: the tree shows the level above, the crumbs lose their last link, and the panel opens that level's page — the section above, or the organization's home at the root —, through the address; at the root Back MUST NOT be drawn; collapsed, the tree MUST be a strip holding the expand button alone.

#### The template's pages

- **FR-042**: Published's head MUST be the accepted mockup's — the chip `vN`, the title in bold, one line `<person> published it <when> · release <name> · <n> notes by <m> authors · read only` — and MUST end with `Your draft: N` when changes wait in my draft, opening Draft; nothing of it MUST stand loose on the canvas.
- **FR-043**: Published before the first publication MUST say nothing is published yet and hold `Your draft: N`; "Nothing to show — the Authors filter hides every published note" MUST be said only when the Authors filter hides every note of a publication.
- **FR-044**: A publication that succeeds MUST close its dialog and open the item's Published showing it; the draft starts empty.
- **FR-045**: On Draft and on Published the bottom bar MUST hold the zoom alone.
- **FR-046**: Published's filters MUST be Authors, Written and Last change; Written and Last change MUST be ranges of dates of the shell, opening `@maxitor/panel`'s date range picker with the page's ready stretch "Since the first publication", each an address parameter (`written`, `changed`), one for both panels; Published's table MUST show the columns Written and Last change.
- **FR-047**: The template's passport MUST declare `compare: [diff, side_by_side]`; Published and Draft MUST offer both.
- **FR-048**: Published's setup MUST be: bars from its reading action through the SDK; milestones its publications; kinds `published` (purple, filled, "Published") and `rollback` (red, filled, "Rolled back"); no `small`; no `flag`; the action Roll back on a milestone. Draft's setup MUST be: bars of my draft's own changes; the publications as its milestones, of the same kinds.
- **FR-049**: The template's pages MUST read at `at`, offer no writing, editing or deleting in the past and in a comparison, mark every note `note:<id>`, draw Diff and both sides from their context with the filter's Changes and painting by change, keep the camera between moments, answer a note's differences for the change card (its `body`, before and after), group the stepper's list by the item, and send the counts.
- **FR-050**: A publication's card MUST be the blocks: the badge `Published` or `Rolled back`, the ref, the time, the title, the author, the notes it holds and what changed; a rollback's card MUST name the publication it brings back.
- **FR-051**: Roll back MUST be offered on Published exactly on a past publication's milestone and nowhere else; it MUST ask first, with a title (`Back to vN`), a comment and what it changes against the publication in force; confirmed, it MUST publish a new publication holding the notes of vN, keeping every publication after vN in the history and on the scale.

#### Tests, documentation, versions

- **FR-052**: The tests MUST prove: every note and row carries its anchor and is brought into view by it in the other panel, with "Not in A" / "Not in B" when absent; the page draws from its context, one test per row of the context's table; a step opens the change card with the page's words; the core refuses an undeclared kind, small point or flag; the legend holds exactly the declared marks; Roll back publishes the notes of vN as a new publication. A browser check MUST walk the issue's 1.2, 1.3, 1.4 and 1.5 and the screens of both mockups, on a desktop and at 375 px.
- **FR-053**: The documentation MUST describe the work as built: the core's README and a how-to guide for a reader (the scale, its modes, its card, its legend); the tutorial's chapters of this step, with the index naming this issue — the scale and its setup, comparing with the halo and the fading, Side by side following one element, the frame's crumbs and Back, the template's Draft and Published —; `docs/plugins/history.md` and `docs/plugins/compatibility.md` — what a plugin gets for nothing, what it declares and why only marks that mean something in its history, the shapes of the context, the bars, the milestones and the card, anchors, and which version of the core and of `maxitor-plugin-sdk` brings each part —; the plugin concept reserving `mode` and `from`.
- **FR-054**: The core, `@maxitor/panel`, `@maxitor/tokens`, the SDK and the template MUST raise their versions, and the changelog MUST describe the work in plain words.

### Key Entities

- **Moment** — the time a page is read at: `at` in the address; with no `at`, the watermark.
- **Mode** — One moment, Diff or Side by side: `mode` and `from` in the address.
- **Setup** — a page's declaration of its history: `read`, `bars`, `milestones`, `card`, `kinds`, `small`, `flag`, `compare`, `actions`.
- **Kind** — one point of a page's vocabulary: `tone`, `look`, `lead`, `term`, `def`.
- **Bar** — the changes of one stretch of time: `t`, `added`, `changed`, `removed`.
- **Milestone** — `id`, `at`, `ref`, `kind`, optional small, optional flag, optional `comment`, optional `opens`.
- **Card** — a milestone's list of blocks of `@maxitor/panel`, with its `comment` and `link`.
- **Context** — what a panel tells its page: `at`, `against`, `side`.
- **Anchor** — an element's identity, with its chain of parents.
- **Publication** — the template's revision: number, title, comment, release, publisher, moment; a rollback names the publication it brings back.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every screen of `specs/079-time-scale/mockup` and of `specs/074-notes-history/mockup`, on a desktop and at 375 px, is reproduced on the stand by the browser check, with 0 differences the maintainer finds when comparing them side by side.
- **SC-002**: For every page, the legend's rows equal the marks the page declared: 0 rows for an undeclared mark across Published, Draft, the graph's fixture and the test page's fixtures.
- **SC-003**: A milestone of an undeclared kind, a small point without `small` and a flag without `flag` are refused in 100% of tries, each named in the console.
- **SC-004**: In Side by side, a chosen element is brought into the other panel's view in 100% of tries where that panel holds it, within the glide of 450 ms, including a row of a list of 10,000.
- **SC-005**: A reload or a shared address with `at`, `mode` and `from` opens the same moment and mode in 100% of tries; an `at` later than the watermark is refused in 100% of tries.
- **SC-006**: Roll back creates exactly one new publication holding the notes of the chosen one, with 0 publications lost from the history.
- **SC-007**: A zoom of the bars across a range already read asks the plugin for 0 bars below the watermark it already has.
- **SC-008**: The closing check run and the browser check end green, and the maintainer's walk of the steps 07–09 on the local stand finds nothing that contradicts this specification.

## Assumptions

- The frame, the panel protocol and `@maxitor/panel` of bystrovmaxim/gnomon#74, the shell of bystrovmaxim/gnomon#109, the filters and lists of bystrovmaxim/gnomon#115, the page's history of bystrovmaxim/gnomon#116, the template's pages of bystrovmaxim/gnomon#102 and bystrovmaxim/gnomon#121 and the entered tree of bystrovmaxim/gnomon#122 are in place.
- The template's history on the server of bystrovmaxim/gnomon#97 — reading at any moment, publications — is the data the scale reads; Roll back is a new publication written through the same history.
- The graph viewer's code in `packages/maxitor/maxitor-web/client/src` is the reference for every visual of this step, and its parts named here are moved or copied into the core and `@maxitor/panel`, not drawn anew.
- The graph's own page is not built in this step: its setup is checked on the core's test page with fixtures in the graph's shapes, and the graph viewer comes onto the scale with bystrovmaxim/gnomon#77.
- The browser checks run locally on the stand, as CI cannot run them.
