# Feature Specification: Maxitor core — the shell's filters in full and lists lying whole on the canvas

**Feature Branch**: `feature/issue-115-shell-filters-lists`

**Created**: 2026-11-12

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#115, "07.1 · Maxitor core: the shell's filters in full and lists lying whole on the canvas — three kinds of filter, the date pickers, @maxitor/panel's list and table". The issue's body is the source of truth. The look is in the mockup `specs/079-time-scale/mockup/index.html`, screens 2.1–2.16, and in today's `Filters`, `BottomBar` and `DataTable` of `@maxitor/panel`.

## What this is

Content in Maxitor is never pinned to the screen: every view lies on the canvas and moves and zooms with it. A list of records is no exception — it is a card on the canvas drawn at its full length, not a box that scrolls by itself or a set of pages. The shell of `@maxitor/panel` (bystrovmaxim/gnomon#109) gives a page its filters in fixed places; this work gives those filters their three kinds — a choice of values, a text, a range — and the two date pickers a range of dates needs, which plugins also call like functions.

Words used below:

- **Shell** — `PanelPage` of `@maxitor/panel`, which draws a page's controls from what the page gives it.
- **Canvas** — the surface a page's content lies on; the panel's camera moves and zooms it.
- **List** — `@maxitor/panel`'s list and `DataTable`: a page's records, laid on the canvas as a card.
- **Filter section** — a group of the filters panel: a choice of values, a text or a range.
- **Paint switch** — the stops at the foot of the filters that choose which section paints the content.
- **Bound** — one end of a range: a number, a date, a date relative to now, or none.
- **Date range picker** and **date picker** — `@maxitor/panel`'s two pickers, for a range and for one date.
- **Test page** — the core's own page for checking the panel, reached only by an administrator.

## Clarifications

### Session 2026-11-12

Decided with the maintainer before this specification was written, and recorded in bystrovmaxim/gnomon#115, bystrovmaxim/gnomon#109 and the plugins epic.

- Q: Do lists scroll inside themselves or come in pages? → A: Neither. A list lies whole on the canvas and moves with the camera, so the wheel always moves the picture; only rows inside the camera's view are drawn.
- Q: Where do a list's filters stand — in its head, or in the shell? → A: In the shell's panel, like every page's. Controls inside the content would zoom with it and be lost when it moves.
- Q: How many kinds of filter? → A: Three: a choice of values, a text, a range. A filter that is on or off is a choice of one value; there is no switch of another look.
- Q: Where is the count of a list's rows shown? → A: In the list's own head. Only the page knows its rows, and a page may hold several lists; the panel's head holds only the core's.
- Q: Does a long choice show counts beside its values? → A: No. Rows are a disk and a label, as `ErdFilterPanel` draws them; a long choice shows its first values, "N more" and a search inside the section.
- Q: Is a range of dates drawn with its distribution? → A: No. Two rows, From and To; a date is chosen in the date range picker.
- Q: What does the date range picker look like? → A: Apple's layout — round days, a band between the ends, the month's title with a chevron, wheels to jump to a month and a year — in Maxitor's own colours, type and sizes, as in the mockup.
- Q: How does a bound that moves with today show? → A: Its date first, the same for both bounds; how it is set ("30 days ago") under it.
- Q: From which "now" is a relative bound counted when the page is read at a past moment? → A: From the real now, today, whatever moment the time scale shows: `now-90d` is always the last 90 days before today.
- Q: How do the filters and the pickers look on a phone? → A: The filters behind one button with how many are on, opening a sheet from below; both pickers as sheets from below, the ready stretches as a row of chips, one month.
- Q: Who walks the stand of this step? → A: The walk of 1.4 is made during this step, its result on the pull request; the maintainer walks the steps 07–10 together after bystrovmaxim/gnomon#100.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A list lies whole on the canvas (Priority: P1)

A page shows 10,000 records as a list. The list is a card on the canvas at its full length; the person moves through it with the wheel, zooms with a pinch, drags it, and its head — its name, how many rows pass of how many, the column names — stays at the top of the view while the rows go up under it.

**Why this priority**: Every page of records rests on it, and bystrovmaxim/gnomon#102 and bystrovmaxim/gnomon#98 build on it.

**Independent Test**: Open the test page's list of 10,000 rows: move to the middle with the wheel, zoom out and in, drag; the head stays, the rows in view are drawn, and the page holds only those rows.

**Acceptance Scenarios**:

1. **Given** a page with a list, **When** it opens, **Then** the list lies on the canvas as a card at its full length, with no scroll of its own and no pages.
2. **Given** the list, **When** the person turns the wheel, swipes with two fingers, pinches or drags, **Then** the camera moves or zooms the list like everything else on the canvas.
3. **Given** a list of 10,000 rows, **When** the camera moves, **Then** only the rows inside its view are in the page, and the list keeps the anchors of all its rows.
4. **Given** the list moved up, **When** its head would leave the view, **Then** the head sticks to the top of the view with the list's name, its count and the column names.
5. **Given** a page with several lists, a scheme and a picture, **When** it opens, **Then** all lie on one canvas, each list with its own head.
6. **Given** a column, **When** the plugin gives it, **Then** it gives a title and a kind of cell — text, mono, number, date, person or status.

---

### User Story 2 - The shell's filters come in three kinds (Priority: P1)

A page gives the shell its filter sections — a choice of values, a text, a range — and the shell draws them in one look; the page reads the address and filters its own data. A long choice shows its first values with "N more" and a search inside; a choice of one value is a filter that is on or off.

**Why this priority**: The filters of every page of records are made of these kinds.

**Independent Test**: On the test page, switch a status off, type in the search, set a range of balances, open a long choice and search in it: each changes the rows and the address, and the address opened in a new tab shows the same.

**Acceptance Scenarios**:

1. **Given** a choice of values, **When** it is drawn, **Then** each row is a colour disk — a person's disk with initials — and a label, and a value absent from the data shows as absent.
2. **Given** a choice of more than eight values, **When** its section opens, **Then** a search stands at its top, then the first eight values by how many rows they hold, then "N more"; "N more" shows all, "Show fewer" folds them, and the search keeps the values that hold the text.
3. **Given** a choice of one value, **When** its row is switched, **Then** the filter is on or off, drawn as any row.
4. **Given** a text section, **When** the person types, **Then** the address holds what is typed and the page filters by it, in the words the page gave ("Account or email").
5. **Given** a range of numbers, **When** the person types a bound in its From or To row, **Then** the address holds the bounds (`balance=100..250`), either side open.
6. **Given** a range of dates, **When** its rows are drawn, **Then** each shows its date — "From the start" or "To the end" when not set — and a click opens the date range picker.
7. **Given** more than one section that can paint, **When** the filters are drawn, **Then** the paint switch stands at their foot, a stop per section, and moving it repaints the content and opens the section it paints by.
8. **Given** a row a panel holds but its filters leave out, **When** the page is asked about it, **Then** it reports it as hidden.

---

### User Story 3 - Dates are chosen in the date range picker and the date picker (Priority: P1)

A person chooses a stretch of dates — typed, clicked in two months, jumped to with the wheels, taken from the ready stretches — and nothing changes before Apply. A plugin opens the same pickers by calling a function and gets the choice back.

**Why this priority**: Every range of dates in every plugin uses them; plugins also need one date.

**Independent Test**: Open the range picker from Created: type "30 days ago", click a day, jump to a year with the wheels, take "Last 90 days", Apply; open the date picker from the test page's button: take "A week ago", Apply. Cancel, Escape and a press outside leave things as they were.

**Acceptance Scenarios**:

1. **Given** the range picker, **When** it opens, **Then** it shows the ready stretches on the left, the From and To fields, two months, and the foot with the choice in words, how many days it holds, Cancel and Apply.
2. **Given** a field, **When** the person types `5 Mar 2026`, `2026-03-05`, `today`, `30 days ago` or `30d`, **Then** the bound takes that date or that moving bound; an empty field is no bound; text that is not a date leaves the bound as it was.
3. **Given** a bound that moves with today, **When** the field is drawn, **Then** it shows its date and, under it, how it is set; the field's arrow turns it into a fixed date and back.
4. **Given** the months, **When** the person clicks a month's title, **Then** two wheels open, the months going round and the years outside the bounds pale; where the wheels stop is the month shown.
5. **Given** the range picker, **When** From is chosen, **Then** it moves on to To; days outside the bounds or before From are not chosen.
6. **Given** a choice, **When** Apply is pressed, **Then** the address takes it as written (`created=now-90d..now`); Cancel, Escape and a press outside leave it as it was.
7. **Given** a plugin, **When** it calls `openDateRangePicker` or `openDatePicker` with an anchor, a unit, bounds, a value and its ready stretches, **Then** the picker opens beside the anchor and gives back the choice as written, or nothing when closed without a choice.

---

### User Story 4 - The filters and the pickers on a phone (Priority: P2)

On a phone the filters are one button with how many are on, opening the same sections in a sheet from below; both pickers open as sheets from below.

**Why this priority**: Every page of every plugin is opened on a phone too.

**Independent Test**: At 375 px, open the test page's list: tap Filters, switch a status, close; open Created's range: the sheet holds chips, the fields, one month and the foot.

**Acceptance Scenarios**:

1. **Given** a phone, **When** a page with filters opens, **Then** the filters are one button with the count of those on; it opens a sheet with the same sections, and Done closes it.
2. **Given** a phone, **When** a picker opens, **Then** it is a sheet from below with the ready stretches as a row of chips, the fields, one month and the foot.

---

### User Story 5 - The documentation describes it as built (Priority: P2)

**Why this priority**: Authors copy what the concept, the tutorial and the README show.

**Independent Test**: Read the plugin concept, the README of `@maxitor/panel` and the tutorial's chapters 7 and 13: every statement and example matches the code.

**Acceptance Scenarios**:

1. **Given** the documentation, **When** it is read, **Then** it describes lists on the canvas, the three kinds of filter, the paint switch and both pickers with their calls, and the tutorial's rows in the index name this step.

---

### Edge Cases

- A list with no rows that pass the filters: the list says "No rows pass the filters" in its card; its head stays.
- The camera glides far along a list: the rows along the way are drawn as it passes.
- A filter's value disappears from the data: its row shows as absent; a value switched off stays so in the address.
- A range of numbers typed with a letter in it: the bound is not taken; the row keeps what was typed until it is a number or empty.
- A range where From is later than To: the picker does not allow it; a typed address like that matches no rows.
- A long choice searched with nothing matching: "No … matches" in the section.
- The wheel over the filters panel or a picker scrolls them, never the canvas.
- A relative bound in the address read on another day: it gives that day's date.
- A relative bound on a page read at a past moment: it is still counted from today, so it may match no rows at that moment.
- A row without a date under a range of dates: outside any range; it shows only while both bounds are open.
- Bounds given as months (`2019-01`): the first and the last day of those months.

## Requirements *(mandatory)*

### Functional Requirements

#### Lists on the canvas

- **FR-001**: `@maxitor/panel`'s list and `DataTable` MUST lie on the canvas as a card drawn at full length, with no scroll of their own and no pages, and MUST move and zoom with the panel's camera.
- **FR-002**: Only the rows inside the camera's view MUST be in the page; the list MUST keep the anchors of all its rows.
- **FR-003**: The list's head — its name, how many of its rows pass of how many, the column names — MUST stick to the top of the view while the rows go up under it; the panel's head MUST hold nothing of the page's counts.
- **FR-004**: A column MUST have a title and a kind of cell from the set text, mono, number, date, person, status; a missing kind is added to the set for everyone.
- **FR-005**: The wheel over the filters panel, a sheet or a picker MUST scroll them and MUST NOT move the canvas.

#### Filters

- **FR-006**: The shell MUST draw three kinds of filter section from the page's data: a choice of values, a text, a range; the page MUST read the address and filter its own data.
- **FR-007**: A choice's row MUST be a colour disk — a person's disk with initials — and a label, with no count; a value absent from the data MUST show as absent; a choice MUST write the values switched on and MUST be absent from the address when all are on.
- **FR-008**: A choice of more than eight values MUST show a search at the top of its section, its first eight values by how many rows they hold, and "N more"; the search and the folding MUST NOT enter the address.
- **FR-009**: A text section MUST be a row with a magnifier and a field, in the page's words, writing what is typed.
- **FR-010**: A range MUST be two rows, From and To, a bound drawn the same way in both; a number is typed in the row, a date chosen in the date range picker; the address MUST keep the bounds as written, either side open, a relative bound counted from today and read again every day, whatever moment the page is read at.
- **FR-011**: A range of dates MUST be named by its column, never "Time", and MUST NOT take the time scale's look.
- **FR-012**: The page MUST mark which sections can paint; with more than one, the paint switch MUST stand at the foot of the filters, and moving it MUST repaint the content and open the section it paints by.
- **FR-013**: The page MUST report a row or an element it holds but its filters leave out as hidden.

#### Date pickers

- **FR-014**: `openDateRangePicker({ anchor, unit, min, max, value, presets })` MUST give `{ from, to }` as written, or nothing when closed without a choice; `openDatePicker` with the same arguments MUST give one date as written.
- **FR-015**: The range picker MUST show the core's ready stretches (today, the last 7, 30 and 90 days, this month, quarter and year, last year) and under a hairline the page's own; two fields From → To that take typing; two months with arrows; wheels behind a month's title; the foot with the choice in words, its days, Cancel and Apply.
- **FR-016**: A field MUST show its date, the same for both bounds, and under it how a moving bound is set; its arrow MUST turn a fixed date into a moving one and back.
- **FR-017**: Nothing MUST change before Apply; Cancel, Escape and a press outside MUST leave the bounds as they were.
- **FR-018**: `min` and `max` MUST bound every choice, given as a day or a month; days outside them MUST NOT be chosen, and the wheels MUST roll back to the nearest month allowed.
- **FR-019**: The pickers MUST follow Apple's layout in Maxitor's colours, type and sizes, as in the mockup.

#### The phone

- **FR-020**: On a phone the filters MUST be one button with the count of those on, opening a sheet from below with the same sections and Done.
- **FR-021**: On a phone both pickers MUST be sheets from below, with the ready stretches as a row of chips and one month.

#### The test page, documentation, versions

- **FR-022**: The core's test page MUST show a list of 10,000 rows on the canvas, filtered by every kind of section, with a button that opens the date picker as a plugin would.
- **FR-023**: The plugin concept, the README of `@maxitor/panel` and the tutorial's chapters 7 and 13 with their rows in the index MUST describe what this work builds; every changed package MUST raise its version and the changelog MUST describe the work.

### Key Entities

- **List**: a page's records on the canvas; a name, columns with kinds of cell, rows with anchors.
- **Filter section**: a choice of values, a text or a range; its address parameter; whether it paints.
- **Bound**: a number, a date, a date relative to now, or none.
- **Ready stretch**: a name and two bounds, the core's or the page's.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the test page, a list of 10,000 rows moves and zooms with the camera at the speed of an empty canvas, and the page holds no more than the rows of two views at any moment.
- **SC-002**: Every kind of filter changes the rows and the address, and the address opened in a new tab gives the same rows and the same filters in 100% of tries.
- **SC-003**: A choice of 46 values shows 8 first, and its search finds every matching value in one keystroke.
- **SC-004**: A person sets a range of dates with the picker in at most 4 actions for any ready stretch, and Cancel leaves the bounds unchanged in 100% of tries.
- **SC-005**: On a phone at 375 px, the filters' sheet and both pickers fit the width with no sideways scrolling of the page.
- **SC-006**: Every refusal and every fallback of the edge cases has a test that builds the fault and sees it handled; every such test fails when its handling is removed.

## Assumptions

- The shell of bystrovmaxim/gnomon#109 — its filters of one kind, the paint switch, the bottom bar, the phone's folding — is in place and grows here.
- The core's test page of bystrovmaxim/gnomon#74 is the place the panel's parts are checked; its data are fixtures.
- Pointing into a list by anchors and bringing a row into another panel's view are bystrovmaxim/gnomon#98; this work keeps the anchors of all rows for it.
- The browser checks run locally on the stand, as CI cannot run them.
