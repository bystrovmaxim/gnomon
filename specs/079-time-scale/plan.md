# Implementation Plan: the time scale — one moment for the screen, its comparison panels, and the template's pages walked on it

**Branch**: `feature/issue-98-time-scale` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/079-time-scale/spec.md`; issue bystrovmaxim/gnomon#98; the accepted mockups [`mockup/index.html`](mockup/index.html) and [`../074-notes-history/mockup/index.html`](../074-notes-history/mockup/index.html), with `archive/makets/084-notes-draft-published` and `archive/makets/085-entered-tree-node`.

## Summary

The core gains its one time control — the pill in the top row and the card hanging from it — ported from the graph viewer's `VersionButton`, `VersionPicker`, `VersionTrack`, `VersionTip` and `TrackLegend` into the core's frame as plain React and CSS on `@maxitor/tokens`, keeping their look. A page sets the scale up through its history in `PanelPage`: the format grows from the closed list of milestone kinds of history format 1 to a page's own `kinds`, with `small`, `flag` and `actions` as promises the core checks (history format 2). The core lays out the comparison panels and tells each page its context (`at`, `against`, `side`) by the panel protocol; `@maxitor/panel` releases what a page compares with — `ChangeStepper`, `DiffCard`, `StatusIcon`, `VersionsBetween` — and gives its canvas, list and table the anchors, the halo and the fading of the graph's ERD. The frame and the canvas are brought to the graph viewer's look, the template's Draft and Published to their accepted mockup, and the template walks the whole scale with its publications, rollbacks and date filters.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19 / Next.js 16 (the core's web, `@maxitor/panel`, the template's pages); Python 3.12 (the SDK and the template's server).

**Primary Dependencies**: `@maxitor/panel`, `@maxitor/tokens`, `maxitor-plugin-sdk`, AOA (`external/aoa`). No new runtime dependency: the graph viewer's MUI components are ported to plain markup, the Material pictograms are copied as SVG paths.

**Storage**: PostgreSQL through the template's `NotesStorage`; a rollback is a new publication written by the same storage; the table `revision` gains one nullable column `back_revision`, built by the core's installer from `schema.yaml`.

**Testing**: `node --experimental-strip-types --test` over `@maxitor/panel` (protocol, history format 2, anchors, the stepper's grouping, the halo's classes) and the core's web (the scale's geometry, the legend from the setup, the levels and crumbs); `pytest` over the SDK (history format 2, date bounds) and the template (rollback, the date filters, the milestones and cards); the browser check on the local stand walks both mockups on a desktop and at 375 px.

**Target Platform**: browsers on a desktop and a phone (375 px), the core's Next.js server, the template's ASGI process behind the gateway.

**Project Type**: web application in a monorepo of packages.

**Performance Goals**: a glide of 450 ms; a list of 10,000 rows draws only the rows in view; a zoom asks only for bars it does not have.

**Constraints**: nothing of a plugin runs in the core's frame; the address, never the screen, is the context of every history call; reads never later than the watermark; no writing in the past except the rollback on a milestone.

**Scale/Scope**: the core's frame and scale, `@maxitor/panel`, `@maxitor/tokens`, the SDK's history, and the template's two pages.

## Constitution Check

- **I. One term, one name**: scale, pill, moment, watermark, mode, bars, milestone, kind, setup, legend, panel, context, anchor, stepper, change card, halo, publication, rollback — the spec's words in the code, the protocol, the schema and the docs.
- **II. Spec ahead of code**: this plan follows [spec.md](spec.md); the history format 2 and the protocol's new messages are written in [contracts/](contracts/) before code.
- **III. The database does not decide**: the rollback's publication gets its id from the action; `back_revision` has no `DEFAULT`, an explicit `NULL` and a description; no cascade.
- **IV. Decision apart from idea**: every decision of the mockups is in the spec's Clarifications; the graph's own page is out of scope (spec, Assumptions).
- **V. Measured**: the spec's SC-001…SC-008, each checked by a test or the browser check.
- **Actions only** (memory, constitution 41–66): every endpoint is an AOA action — the rollback is `RollbackPublicationAction`; the history actions stay in `history/`.
- **67. Graph files**: the template's and the core's `graph.json` are rebuilt by `./update-graphs.sh` in the phases that change their actions.

Post-design: no violation.

## Project Structure

### Documentation (this feature)

```text
specs/079-time-scale/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/
│   ├── page-history-2.md      # the setup a page gives and the history format 2
│   ├── panel-protocol-time.md # the protocol's messages of the scale, the panels and the anchors
│   └── rollback.md            # the template's rollback action
├── checklists/requirements.md
└── mockup/index.html
```

### Source Code (repository root)

```text
packages/maxitor-tokens/tokens.css                         # the canvas's surface and dots
packages/maxitor-panel/src/
├── protocol.ts                                             # history format 2, the context, the anchors' messages
├── PanelPage.tsx, PanelProvider.tsx, hooks.ts             # the setup, the context, actions on a milestone
├── canvas/MaxitorCanvas.tsx, canvas/anchors.ts            # anchors: under the pointer, mark, bring into view
├── content/DataTable.tsx, content/list.ts                 # rows answering by anchor
├── compare/ChangeStepper.tsx, DiffCard.tsx, StatusIcon.tsx, VersionsBetween.tsx, marks.css   # halo and fading
├── shell/Filters.tsx, shell/BottomBar.tsx, shell.css      # disks, absent rows
└── tests/*.test.ts
packages/maxitor/maxitor-core/web/
├── components/scale/Pill.tsx, ScaleCard.tsx, Histogram.tsx, Lane.tsx, Legend.tsx, Tip.tsx, scale.css, geometry.ts
├── components/frame/Frame.tsx, TopRow.tsx, TreeHead.tsx, Tree.tsx, Panel.tsx, PageFrame.tsx, SidePanels.tsx, frame.css
├── components/marks.tsx                                     # the graph viewer's pictograms
├── app/(panel)/panel-test/…/TestPage.tsx                   # fixtures: bars alone, milestones alone, both, the graph's kinds
└── tests/*.test.ts
packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/
├── history.py, date_bounds.py, schemas/history-2.schema.json
└── tests/
packages/maxitor-plugin-template/
├── src/maxitor_notes/history/{list_note_history,note_milestone_card}_action.py
├── src/maxitor_notes/actions/{rollback_publication,list_published_notes}_action.py
├── src/maxitor_notes/storage/notes_storage.py, entities/milestone_entity.py
├── web/app/[org]/items/[item_id]/{DraftView.tsx,published/PublishedView.tsx}, web/app/[org]/notes/revision.tsx
└── tests/
docs/plugins/{history.md,compatibility.md,tutorial/}
```

**Structure Decision**: the core's scale is a component group of its own under `components/scale/`, owned by the frame; what a page compares with lives in `@maxitor/panel` under `compare/`, so every plugin builds with the same parts.

## Phases (as in the issue)

1. The frame and the canvas as the graph viewer draws them (1.3).
2. The template's Draft and Published as their accepted mockup draws them (1.4) — rollback excluded, it needs the scale.
3. The scale in the top row (1.1, items 1 and 2).
4. The histogram, the lane, the cards, the legend, the cache (1.1, items 4–8), with history format 2.
5. Diff and Side by side: the panels, the context, the anchors, Track, the list's rows, the change card, the comments, the keys (1.1, items 3, 9–11).
6. `DiffCard`, `StatusIcon`, `VersionsBetween`, `ChangeStepper` in `@maxitor/panel`; the counts; the stepper's row (1.1, items 11–12).
7. The check of 1.2 on the test page, desktop and phone.
8. The past on the template's pages (1.5).
9. Comparing on the template's pages (1.5).
10. The template on the scale, Roll back, the tests and the browser check of 1.5.
11. The closing check run, documentation, changelog, versions.

## Design decisions

- **Port, never re-draw**: the graph viewer's history components are MUI; the core has none. Each is ported to markup and CSS keeping its geometry, colours and texts, with its source named in the file's head. See [research.md](research.md), R1.
- **History format 2**: a page's setup carries `kinds`; a milestone names its kind and may be `small` or carry `flag` only when the setup promises it; the core drops and names the rest. Format 1's closed `kind` enum leaves. See [contracts/page-history-2.md](contracts/page-history-2.md).
- **The context travels with the location**: `panel.location` grows `against`, `side` and `milestone` (the id of the milestone `at` stands exactly on), so a page draws a comparison and shows its milestone action without asking the core. See [contracts/panel-protocol-time.md](contracts/panel-protocol-time.md).
- **Anchors through the canvas**: the canvas, the list and the table report the chain under the pointer and obey `panel.mark` and `panel.bring`; the core relays between the panels and writes the notes ("Not in A", "Hidden by the filters", "Brought to the centre").
- **Marks as classes**: `@maxitor/panel` gives `data-change="added|changed|removed|unchanged"` its halo and fading in `marks.css`, so a note's card, a table and a row look alike.
- **Rollback is a publication**: `RollbackPublicationAction` publishes the notes of vN as the next revision with `back` set; the draft is untouched. See [contracts/rollback.md](contracts/rollback.md).
- **Date filters on the server**: `written` and `changed` are read by the template's reading action through the SDK's `date_bounds`, so the bars and the page agree.
