# Tasks: a tree node that is entered

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 — The mockup (US1–US5)

- [x] T001 `mockup/index.html`: the tree at the root with Settings entered ("›") and expanded nodes, the entered level of Settings with its head and Back, the level of Notes with an item expanded, the crumbs of the entered levels, a reload inside an entered node, and the phone drawer with the same head and Back.

## Phase 2 — The format (US5)

- [x] T002 `navigation-4.schema.json`: format 4, `opens` on a node; formats 1–3 left as they are.
- [x] T003 `checks.py`: format 4 is read, format 1 and 2 are refused naming format 4, and the two `opens` rules name the node.
- [x] T004 The core: `Node.opens`, the validator by format, migration 0008, the column written and read, the field in the tree.
- [x] T005 The core's `navigation.yaml` and the template's: format 4, `opens` on every node with children, Settings and Notes entered.
- [x] T006 Tests: the SDK's two refusals by node name, format 3 still read, the builder carrying `opens`, the check action storing it.

## Phase 3 — The frame (US1–US4)

- [x] T007 `lib/tree.ts`: `TreeNode.opens`, `enteredLine`; `upOf` removed with the up it served.
- [x] T008 `Frame.tsx`: the stack of levels, rebuilt from the address, pushed by entering, popped by Back and by a crumb; the crumbs' titles.
- [x] T009 `Tree.tsx` and `frame.css`: one level at a time, the "›" mark, the head of a level, the drawer alike.
- [x] T010 `TreeHead.tsx`: the arrow as Back, off at the root; `TopRow.tsx`: crumbs of the entered levels; `#109`'s FR-018 amended.

## Phase 4 — Tests and the browser check (US1–US4)

- [ ] T011 `node --test` over `lib/tree.ts`: the entered line of a page, the levels of an address.
- [ ] T012 `check-core.mjs`: entering Settings, Back, Notes, an item expanded, the crumbs, a reload, the phone; the walk on the stand.

## Phase 5 — Documentation, changelog, versions (US5)

- [ ] T013 The plugin concept and the tutorial's chapter 7; the core's README of the tree; the format's table.
- [ ] T014 Versions and changelogs: `maxitor-plugin-sdk`, the core and its web, `maxitor`, the template.
