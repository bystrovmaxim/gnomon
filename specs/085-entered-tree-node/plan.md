# Implementation Plan: a tree node that is entered

**Branch**: `feature/issue-122-entered-tree-node` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/085-entered-tree-node/spec.md`; issue bystrovmaxim/gnomon#122; the mockup `specs/085-entered-tree-node/mockup/index.html`, built in phase 1 and accepted before any code.

## Summary

`navigation.yaml` rises to format 4 and every node with children says `opens: expand|enter`; a node without children says nothing, and both faults are refused with the node named. The core's tree builder carries the field from the file to the database (migration plugins/0008) and out again in the tree action, so the frame knows how each node opens.

In the frame a *level* is the children of one entered node, kept as a stack of names in `Frame`: entering pushes, Back — the head's arrow of #109, whose up leaves — pops, and a crumb pops to its own level. The stack is rebuilt from the address whenever the address changes, entering every entered node on the line of the open page, so a reload lands where the person was. Expansion state stays a set of places in `Tree`, which keeps it across the stack's changes.

## Technical Context

**Language/Version**: Python 3.12, the core's action machinery; TypeScript, React 19, Next.js 16.

**Storage**: `plugin_node` gains `opens text NOT NULL DEFAULT 'expand'` with a check of its two values — old rows are format 3's, every node of which expands.

**Dependencies**: none added; `maxitor-plugin-sdk` gains `navigation-4.schema.json` beside formats 1–3, and `navigation_problems` gains the two `opens` rules.

**Testing**: `pytest` — the SDK's format tests, the core's tree builder, check action and frame tree; `node --test` over the web's `lib/tree.ts`; `check-core.mjs` on a fresh stand for the walk of the issue's checks 4.1–4.4.

## Constitution Check

- **One term, one name**: expand, enter, level, head, Back, crumbs, `opens` — the spec's words in the code, the tests and the docs; "up" disappears with the behaviour it named.
- **Actions only**: no route is added; the tree keeps arriving in the organization's answer.
- **A format is a version**: format 4 is a new file beside format 3, never an edit of it; format 3 is read as it is, every node expanding.
- **The page gives, the core draws**: nothing of this changes what a page sends; the shell and the panels are untouched.

Post-design: no violation.

## Project Structure

```text
packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/
├── schemas/navigation-4.schema.json          new
└── checks.py                                 `opens` rules, format 4 read, refusals name format 4

packages/maxitor/maxitor-core/maxitor/core/
├── migrations/plugins/0008_a_node_opens.sql  new
├── navigation.yaml                           format 4, Settings entered
├── plugins/tree_builder.py                   Node.opens, format 4 validator
├── plugins/organization_tree.py              the field from the row
├── plugins/actions/check_version_action.py   the column written
├── plugins/storage/plugins_storage.py        the column read
├── actions/organizations.py                  the field in the tree
└── schemas.py                                TreeNodeSchema.opens

packages/maxitor/maxitor-core/web/
├── lib/tree.ts                               TreeNode.opens, enteredLine, upOf removed
├── components/frame/Frame.tsx                the levels, the address, the crumbs
├── components/frame/Tree.tsx                 one level, the "›" mark, the head
├── components/frame/TreeHead.tsx             the arrow as Back
├── components/frame/TopRow.tsx               crumbs of the entered levels
├── components/frame/frame.css                the head of a level, the "›" mark
└── scripts/check-core.mjs                    the walk of checks 4.1–4.4

packages/maxitor-plugin-template/src/maxitor_notes/navigation.yaml   format 4, Notes entered
```

## Phases (as in the issue)

1. The mockup: a tree with expanding and entered nodes, the head of an entered level, Back, the crumbs, a reload inside an entered node, and the phone drawer.
2. The format: `opens`, format 4, the checks, the column, the core's and the template's files; Settings and Notes entered.
3. The frame: entering, the head, Back as the arrow, the crumbs, entering from an address, the drawer.
4. Tests and the browser check of the core; the walk on the local stand.
5. Documentation (the plugin concept, the tutorial's chapter on the tree), the changelog, the raised versions.
