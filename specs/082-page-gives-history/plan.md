# Implementation Plan: a page gives the core its history; navigation.yaml holds the tree only

**Branch**: `feature/issue-116-page-gives-history` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/082-page-gives-history/spec.md`; issue bystrovmaxim/gnomon#116.

## Summary

A page's history moves from `navigation.yaml` into the page's code: `PanelPage history` sends `panel.history`, the core's frame keeps the last one for the open page and checks its names against the plugin version's actions and its passport's comparisons, which the version check now stores (`plugin_version.history_actions`, `history_compare`) and the organization's answer carries (`histories`). Navigation format 3 is the tree only: format 2 and a node with `history`, `room` or `controls` are refused, the node named. `room.shared` and `surface` leave the schema, the core, the protocol and the panel; the room shares nothing and pointers travel on the canvas.

## Technical Context

**Language/Version**: Python 3.12 (core, SDK), TypeScript, React 19, Next.js 16.

**Storage**: migration `plugins/0007_page_gives_history.sql`: `plugin_node.room` dropped, `plugin_version.history_actions` and `history_compare` added, with their versions.

**Testing**: pytest (SDK, core, template), `node --test` for `@maxitor/panel`, `check-core.mjs` on the stand.

## Constitution Check

- **One term, one name**: page history, navigation format 3, retired keys — the same in the spec, the code and the docs.
- **Versioned storage**: the new columns live in `plugin_version` and its versions, described.
- **Actions only**: the history names reach the frame inside `OpenOrganizationAction`'s answer; no route is added.

Post-design: no violation.

## Phases (as in the issue)

1. `@maxitor/panel` gives `history`; `panel.history`; the core keeps and checks it.
2. Navigation format 3 in the SDK, the tree builder and the version check; `room` and `surface` removed.
3. The template's pages give their history; its navigation in format 3; the tests.
4. Documentation, changelog, versions.
