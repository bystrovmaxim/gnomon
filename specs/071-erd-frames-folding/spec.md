# Feature Specification: The ERD's frames, folding, paint switch, filters and speed

**Feature Branch**: `feature/issue-80-erd-frames-folding`

**Created**: 2026-11-09

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#80, "Maxitor: ERD frames, folding, paint switch, filters and speed".

## What this is

The ERD of Maxitor has two views since bystrovmaxim/gnomon#67 and bystrovmaxim/gnomon#78: a logical one (what the business is made of) and a physical one (where the data lies). This work settles how both views are framed, folded, painted and filtered, how the filters of every diagram decide what they offer, and how fast the ERD draws a large model.

Words used below:

- **Scope** — what a diagram is drawn for: the whole system, or one domain. It is chosen in the left panel.
- **1-hop** — the switch beside the zoom buttons that brings in the elements one relation away from the scope.
- **Frame** — the rounded box round a group of tables: a domain's in the logical view, a resource's (a database) in the physical view.
- **Folded frame** — a frame drawn as one box in place of its tables.
- **Paint switch** — the three-point slider at the foot of the filter panel that chooses what colours the tables: domains, kinds, resources, or changes in Diff.
- **Base** — what the panel lists: the scope with 1-hop on.
- **Layouts** — the five the layout switch offers: Dot left to right, Dot top to bottom, Neato, FDP and Circo.

## Clarifications

### Session 2026-11-09

- Q: What speed must the whole system's ERD reach on a large model? → A: Nothing freezes: on 1 000 tables no interaction blocks the page for more than 100 ms, alone or in a room. A hover and a repaint show in at most 100 ms; pan and zoom run at 30 frames a second or more; a fold or a filter change shows on the drawing in at most 100 ms and the drawing settles into its new layout in at most 1 s; the first picture comes in at most 3 s. In a room a follower's diagram shows the presenter's change in at most 0.5 s, then settles by the same rules. Measured in Chromium on the browser checks' machine. On 5 000 tables: it draws in full and answers, its times recorded with no target.
- Q: Does the filter rule of every diagram cover the lifecycle diagram too? → A: Yes: the rule covers the five diagrams with a filter panel — the ERD, use cases, events, lifecycle and the full graph.
- Q: What does the physical view do when no resource keeps a table of the diagram's base? → A: It is unavailable: the switch's Physical half is disabled, its counter reads "—", its tooltip says no resource keeps these tables, and an address with `model=physical` opens the logical view — as for a graph older than 1.6.
- Q: Which diagrams have the 1-hop switch? → A: Those that have it today — the ERD, use cases and lifecycle; the events and the full graph get none, and the rest of the filter rule applies to them.
- Q: How are frames drawn in Neato, FDP and Circo? → A: In every layout no two frames overlap and a frame holds only its own tables; inside a frame the tables are placed by the chosen layout's rules.

## User Scenarios & Testing

### User Story 1 - One frame per database, in every layout (Priority: P1)

An architect opens the physical view and sees each database as one frame holding its tables directly, in whichever layout they pick.

**Why this priority**: A domain frame nested in a database frame doubles the borders and hides the point of the view — where each table lies.

**Independent Test**: On the AOA demo's graph, the physical view in each of the five layouts draws every resource's frame, no domain frame anywhere, and the same picture on two loads.

**Acceptance Scenarios**:

1. **Given** the physical view, **Then** each resource frame holds its tables directly and no domain frame is drawn inside it.
2. **Given** the physical view, **When** the reader picks any of the five layouts, **Then** the resources' frames are drawn in it, no two of them overlap, and each holds only its own tables.
3. **Given** one model and one layout, **When** the page is loaded twice, or in two browsers, **Then** the two pictures are the same.
4. **Given** a diagram whose base holds no table that any resource keeps — a whole graph without resources, or a domain whose tables and 1-hop neighbours no resource keeps, **Then** the switch's Physical half is disabled with the tooltip "No resource keeps these tables", and an address with `model=physical` opens the logical view.

---

### User Story 2 - Domain frames that can be switched off, folded and drawn in every layout (Priority: P1)

An analyst reads the logical view with or without domain frames, folds a domain into one box to see how it connects to the rest, and keeps the frames in any layout.

**Why this priority**: The logical view is the one most readers open; on a large model the frames are what makes it readable, and folding is how a reader looks past one domain's inner detail.

**Independent Test**: On the AOA demo's graph, the logical view's frames switch takes the frames away and brings them back; a domain frame folds into one box and unfolds; the frames are drawn in all five layouts, the same on two loads.

**Acceptance Scenarios**:

1. **Given** the logical view with frames on, **When** the reader turns the frames switch off, **Then** the tables are drawn without frames; turning it on brings them back.
2. **Given** the logical view, **When** the reader folds a domain frame, **Then** it is drawn as one box, the same way a resource frame folds in the physical view, and the lines to its tables end at the box.
3. **Given** the logical view, **When** the reader picks any of the five layouts, **Then** the domain frames are drawn in it, no two of them overlap, each holds only its own tables, and the same model gives the same picture on every load and in every browser.

---

### User Story 3 - Fold and unfold by a click anywhere in the frame (Priority: P1)

A reader zoomed out over a large model folds a frame by clicking its empty space, and unfolds it by clicking the box.

**Why this priority**: The corner minus and plus are too small to see and hit when zoomed out — exactly when folding is needed.

**Independent Test**: In both views, a click on empty space inside a frame folds it; a click on the folded box unfolds it; no corner control is drawn.

**Acceptance Scenarios**:

1. **Given** an unfolded frame, **When** the reader clicks empty space inside it, **Then** the frame folds into one box.
2. **Given** a folded box, **When** the reader clicks it, **Then** it unfolds.
3. **Given** a frame, **When** the reader clicks a table or a line inside it, **Then** the frame does not fold, and the table or line behaves as it does today.
4. **Given** any frame, folded or not, **Then** no minus or plus control is drawn in its corner.

---

### User Story 4 - The card of a frame opens anywhere on it (Priority: P2)

A reader rests the pointer anywhere inside a frame — its border, its name or its empty space — and sees the frame's card.

**Independent Test**: Hovering the border, the name and the empty space of a frame each opens the frame's card; hovering a table or a line inside it opens that table's or line's card.

**Acceptance Scenarios**:

1. **Given** a frame, **When** the pointer rests on its border, its name or its empty space, **Then** the frame's card opens.
2. **Given** a table or a line inside a frame, **When** the pointer rests on it, **Then** its own card opens and its own hover highlight is drawn, not the frame's.

---

### User Story 5 - The paint switch works everywhere and stays in sight (Priority: P2)

A reader moves the paint switch and the tables change colour at once, on every diagram that has it, the whole system's ERD included; on a short screen the switch stays at the panel's foot while the sections above it scroll.

**Independent Test**: On the whole system's ERD, each point of the paint switch repaints the tables at once; with the window shorter than the panel, the switch stays fixed at its foot while the sections scroll.

**Acceptance Scenarios**:

1. **Given** any diagram with a paint switch, the whole system's ERD included, **When** the reader moves it, **Then** the tables are painted by the chosen section at once, with no reload.
2. **Given** a filter panel taller than the screen, **When** the reader scrolls it, **Then** the sections scroll and the paint switch stays fixed at the panel's foot.

---

### User Story 6 - The filters decide the same way on every diagram (Priority: P1)

A reader of any diagram — the ERD, use cases, events, lifecycle, the full graph — picks a scope, turns 1-hop on or off and turns elements off in the panel, and the diagram and the panel follow one rule.

**Why this priority**: Today the diagrams decide differently, and 1-hop brings back what the reader turned off; a filter that does not hide is not a filter.

**Independent Test**: On each of the five diagrams in its own scope — one domain for the ERD, use cases and events, one lifecycle, the whole system for the full graph: an element turned off in the panel stays hidden with 1-hop on; the panel lists the base with 1-hop on whether 1-hop is on or off; an element outside the base has no row; an element in the base that 1-hop off or another filter hides has a dimmed row. On the whole system's diagrams the 1-hop switch is not shown.

**Acceptance Scenarios**:

1. **Given** a domain's ERD or use cases, or a lifecycle, **When** 1-hop is turned on, **Then** the elements one relation away from what the scope found are drawn too.
2. **Given** such a diagram with 1-hop on, **When** the reader turns an element off in the panel, **Then** it is hidden, even though 1-hop would bring it in.
3. **Given** the whole system's diagram, **Then** the 1-hop switch is not shown.
4. **Given** any diagram, **Then** the panel's rows are taken from the base — the scope with 1-hop on — whether the 1-hop switch is on or off.
5. **Given** an element the base does not hold, **Then** the panel has no row for it.
6. **Given** an element the base holds but 1-hop off or another filter hides, **Then** its row stays, dimmed.

---

### User Story 7 - A large model draws and moves smoothly (Priority: P1)

An architect of a large company opens the whole system's ERD of a model of 1 000 tables and hovers, pans, zooms, paints, filters and folds without waiting; a model of 5 000 tables still draws in full and answers.

**Why this priority**: Maxitor is meant as the catalog of a whole company; an ERD that stalls on a large model cannot be used there.

**Independent Test**: Generated models of 1 000 and 5 000 tables, kept with the checks, are measured before and after: time to the first picture, to each interaction and to a follower's update in a room, and the longest time the page is blocked; the 1 000-table model against the targets of SC-007.

**Acceptance Scenarios**:

1. **Given** either generated model, **When** the whole system's ERD opens, **Then** it is drawn with the same layout, look and interactions as on a small model.
2. **Given** the 1 000-table model, **When** the reader hovers, pans, zooms, paints, filters or folds, **Then** each answers within the targets of SC-007, and the page never freezes.
3. **Given** a room on the 1 000-table model, **When** the presenter folds, filters or paints, **Then** each follower's diagram follows within the targets of SC-007.
4. **Given** the 5 000-table model, **When** the reader does the same, **Then** each interaction answers, and its time is recorded.
5. **Given** the checks, **Then** the measurement on both models is kept with them, with the numbers before and after this work.

### Edge Cases

- A frame with no empty space left inside it (its tables fill it): it is still folded by a click on its border or its name.
- A folded frame whose tables are filtered out entirely: the frame is not drawn, folded or not.
- A folded frame and a line to a table inside it from another frame: the line ends at the box.
- The logical view with frames off: folding has nothing to act on; a folded domain is drawn unfolded, and the fold is kept for when the frames come back.
- 1-hop brings in a table of another domain on a domain's diagram: in the logical view it sits in its own domain's frame.
- An element turned off in the panel and also outside the scope: it is hidden; its row is shown if the base holds it.
- The paint switch's section not offered by a view (resources in the logical view): the switch offers only what the view has, and a choice the view does not have falls back to the view's first section.
- Side by side and Diff: both halves follow the same frames switch, folds and paint; a room shares them.
- A domain whose tables no resource keeps, but a 1-hop neighbour of which one does: the physical view is available, with 1-hop on or off, because the base holds that neighbour.
- Old addresses: a shared address written before this work opens as it did, the frames on.

## Requirements

### Functional Requirements

- **FR-001**: In the physical view a resource's frame holds its tables directly; no domain frame is drawn inside it.
- **FR-002**: The physical view is drawn in every layout the layout switch offers, with the resources' frames.
- **FR-003**: The physical view is unavailable when no resource keeps a table of the diagram's base, as it is for a graph older than 1.6: the switch's Physical half is disabled, its counter reads "—", its tooltip says "No resource keeps these tables", and an address with `model=physical` opens the logical view.
- **FR-004**: The logical view has a switch that turns the domain frames on and off; on by default; off, the tables are drawn without frames. The switch is part of the page's settings: the address carries it and a room shares it.
- **FR-005**: A domain's frame folds into one box, the same way a resource's frame folds in the physical view.
- **FR-006**: The logical view is drawn in every layout the layout switch offers, with the domain frames.
- **FR-007**: In both views and in every layout, no two frames overlap and a frame holds only its own tables; inside a frame the tables are placed by the chosen layout's rules.
- **FR-008**: In both views and in every layout, the same model, filters and folds give the same picture on every load and in every browser.
- **FR-009**: A click on empty space inside a frame, on its border or on its name folds it; a click on a folded box unfolds it; a click on a table or a line inside a frame does not fold it.
- **FR-010**: The minus and plus controls in the frames' corners are removed.
- **FR-011**: Resting the pointer on a frame's border, name or empty space opens the frame's card; a table or a line inside the frame keeps its own card and its own hover.
- **FR-012**: The paint switch repaints the tables at once, with no reload, on every diagram that has it, the whole system's ERD included.
- **FR-013**: When the filter panel is taller than the screen, the paint switch stays fixed at the panel's foot; the sections above it scroll.
- **FR-014**: On every diagram with a filter panel — the ERD, use cases, events, lifecycle, the full graph — the first filter is the scope: the whole system or one domain for the ERD, use cases and events; one lifecycle for a lifecycle diagram; the whole system for the full graph.
- **FR-015**: On a domain's diagram of the ERD and use cases, and on a lifecycle diagram, 1-hop on brings in the elements one relation away from what the scope found. On the whole system's diagrams the 1-hop switch is not shown; the events and the full graph have none.
- **FR-016**: An element turned off in the panel is hidden, even when 1-hop would bring it in.
- **FR-017**: The panel's rows are taken from the base — the scope with 1-hop on — whether 1-hop is on or off. An element outside the base has no row. An element in the base that 1-hop off or another filter hides keeps its row, dimmed.
- **FR-018**: The whole system's ERD keeps its layout, look and interactions on a model of up to 5 000 tables; on a model of 1 000 tables it meets the targets of SC-007.
- **FR-019**: A generator of large models and a measurement on models of 1 000 and 5 000 tables are kept with the checks; the measurement records the time to the first picture and to each interaction, before and after this work.
- **FR-020**: Every changed level raises its version; the graph files are rebuilt if they change; the documentation of the ERD, the filter panel and the filters of every diagram is updated; the changelog says what this work made.

### Key Entities

- **Frame**: a domain's (logical view) or a resource's (physical view) box round its tables; folded or unfolded; has a card.
- **Frames switch**: a page setting of the logical view — frames on or off.
- **Base**: the set of elements of a diagram's scope with 1-hop on; it decides which rows the panel lists.
- **Row**: an element's line in the filter panel — on, off, or dimmed when the base holds it but it is not drawn.
- **Large model**: a generated model of 1 000 or 5 000 tables, kept with the checks for measurement.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On the AOA demo's graph, the physical view in each of the five layouts draws every resource of the model as a frame and no domain frame, with no two frames overlapping and no table inside a frame not its own — checked by a drawing check per layout.
- **SC-002**: On the AOA demo's graph, the logical view in each of the five layouts draws every domain of the model as a frame with the frames switch on, with no two frames overlapping and no table inside a frame not its own, and no frame with it off — checked by a drawing check per layout.
- **SC-003**: For each view and each layout, two loads of the same model give pictures with the same layout hash — checked by the layout determinism check, in all three browsers of the browser checks.
- **SC-004**: In both views, one click on a frame folds it and one click on the box unfolds it; the picture has no corner control — checked by a browser check.
- **SC-005**: Hovering a frame's border, name and empty space opens the frame's card in 3 of 3 cases; hovering a table or line inside it opens that element's card in 2 of 2 — checked by a browser check.
- **SC-006**: On each of the five diagrams of the AOA demo, in its own scope — one domain for the ERD, use cases and events, one lifecycle, the whole system for the full graph: an element turned off stays hidden with 1-hop on; the panel's rows equal the base with 1-hop on; no row lies outside the base; every hidden element of the base has a dimmed row; the whole system's diagrams show no 1-hop switch — checked by tests per diagram.
- **SC-007**: On a generated model of 1 000 tables, the whole system's ERD in its default layout (Dot left to right, frames on) meets these targets, measured in Chromium on the machine the browser checks run on; the other layouts and frames off are measured and recorded:
  - no interaction blocks the page for more than 100 ms;
  - the first picture in at most 3 s;
  - a hover highlight and a repaint in at most 100 ms;
  - pan and zoom at 30 frames a second or more;
  - a fold and a filter change show on the drawing in at most 100 ms, and the drawing settles into its new layout in at most 1 s;
  - in a room, a follower's diagram shows the presenter's fold, filter or paint in at most 0.5 s, then settles by the same rules.
- **SC-008**: On a generated model of 5 000 tables, the whole system's ERD draws in full, with the same layout, look and interactions, and every interaction answers; its times are measured and recorded, with no target.
- **SC-009**: The numbers of SC-007 and SC-008, before and after this work, are kept with the checks.

## Assumptions

- The AOA demo's graph is the small model for the drawing checks; the large model is generated from it, keeping its proportions of domains, resources, tables and relations.
- A folded domain frame looks and behaves like a folded resource frame today: one box with its name and the count of its tables, lines to its tables ending at the box.
- The card of a folded box is the card of its frame.
- A dimmed row can still be switched on and off; its setting takes effect when what hides the element goes away. A dimmed row carries no mark of what hides it; the full graph keeps the mark it has today.
- The frames switch sits beside the view switch of the ERD.
- The diagrams' existing drawing machinery — Diff, Side by side, rooms, hover highlight, folding of resource frames — is reused; this work changes what it draws and how a reader acts on it, not the diagrams it serves.
- Publishing Maxitor and deploying the stand are outside this work.
