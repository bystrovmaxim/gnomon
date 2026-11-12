# Implementation Plan: the template's pages now, on the canvas

**Branch**: `feature/issue-102-template-pages-now` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/083-template-pages-now/spec.md`; issue bystrovmaxim/gnomon#102; the mockup `specs/074-notes-history/mockup/index.html`.

## Summary

The template's three pages lie on the canvas. Each page's server part reads its backend with the gateway's token and hands the data to a client view that draws `PanelPage` and `MaxitorCanvas`: the notes as cards or `DataTable`, "New note" as the page's action opening the shell's new `Dialog`, a card editing and deleting its note with every refusal in words, Published notes with the revision in force, Draft with its changes and publishing. A page at now reads again on `panel.watermark` (`router.refresh()`) and marks a colleague's note new.

## Technical Context

**Language/Version**: TypeScript, React 19, Next.js 16; the template's backend unchanged (#97).

**Dependencies**: `@maxitor/panel` gains `Dialog` — a page may place nothing fixed of its own (spec 078, FR-019).

**Testing**: `node --test` over `web/app/[org]/notes/notes.ts`; `check-core.mjs` on a fresh stand, a desktop and a phone.

## Constitution Check

- **One term, one name**: item, note, revision, draft, watermark, conflict — the spec's words in the code and docs.
- **Actions only**: every write is one of the template's actions through the gateway; no route is added.

Post-design: no violation.

## Project Structure

```text
packages/maxitor-plugin-template/web/
├── app/[org]/notes/notes.ts, api.ts, server.ts, parts.tsx, revision.tsx
├── app/[org]/items/[item_id]/page.tsx, NotesView.tsx
├── app/[org]/items/[item_id]/published/page.tsx, PublishedView.tsx
├── app/[org]/items/[item_id]/draft/page.tsx, DraftView.tsx
├── app/notes.css
└── tests/notes.test.ts
packages/maxitor-panel/src/content/Dialog.tsx
packages/maxitor/maxitor-core/web/scripts/check-core.mjs
```

## Phases (as in the issue)

1. The three nodes and the Notes canvas, now and `panel.watermark`.
2. Writing, editing with its conflicts, deleting.
3. Published notes and Draft, publishing.
4. The phone; the tests and the browser check; the walk.
5. Documentation, changelog, versions.
