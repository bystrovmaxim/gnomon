# 8. The page

**Builds on**: [7. A place in the tree](07-a-place-in-the-tree.md). **Next**: [9. Now and the past](09-now-and-the-past.md).

Your page is a Next.js application under `/p/<name>`, shown in Maxitor's right panel. `PanelPage` draws the controls declared through its API outside the canvas transform. The page puts its content — cards, a table, a revision — inside `MaxitorCanvas`. Moving or zooming that content leaves the shell controls in place.

## What stays in place

"Fixed" means fixed within the page's panel. In Side by side, each panel has its own shell and canvas; the core still owns the surrounding tree, header and Now control.

| Element | How the page supplies it | What happens when the canvas moves or zooms |
|---|---|---|
| Page pills | `PanelPage.layers` | Stay at the panel's top centre, with the same text size |
| Filters | `PanelPage.filters` | Stay in the shell; on a phone they open from its filter button |
| Zoom controls and view options in the bottom bar | `MaxitorCanvas` and `PanelPage.bar` | Stay in the shell's bottom bar |
| Page-wide actions | `PanelPage.actions` | Stay at the top right, or bottom right on a phone; ordinary writing actions are shown only at Now |
| Cards, tables, their headings, and a search field rendered in the content | Children of `MaxitorCanvas` | Move and zoom with the canvas |
| An action beside a record | `Button` inside that record | Moves with its record; the shared appearance does not change its placement |
| An editing dialog | `Dialog` from `@maxitor/panel` | Its portal stays outside the transformed scene; on a phone it is a sheet |

A search declared as a text filter belongs to the shell. A search input rendered above a table belongs to the canvas. Choose the appropriate API for its meaning; do not fix a content element by adding `position: fixed` or by raising its z-index. The plugin checker rejects that attempt to draw over the shell.

## Create page pills through the core API

The template currently offers Cards/Table in the bottom bar. If your page needs that choice as top-centre pills, replace the corresponding bottom-bar choice with `PanelPage.layers`; do not render both selectors for the same parameter. This API is available with **Maxitor 4.12.1 / `@maxitor/panel` 0.8.0**. A plugin using it sets `requires.maxitor: ">=4.12.1,<5"`; see [compatibility](../compatibility.md).

These are the API's own fields:

<!-- quote: packages/maxitor-panel/src/shell/types.ts -->
```ts
export type Layers = {
  default: string;
  options: LayerOption[];
  /** The shell owns this address parameter; omitted for the standard drawing layer. */
  param?: string;
  /** Accessible name of this mutually exclusive page choice. */
  label?: string;
};
```

The following client component is an optional adaptation, not a quotation of the template. It receives the two renderings of the same notes, their count, the existing page history and the bounds of the selected rendering. Place it under the `PanelDocument` from chapter 7. Keep data reads at the moment described in chapter 9.

<!-- example: core-pill-page -->
```tsx
"use client";

import type { ReactNode } from "react";
import {
  MaxitorCanvas,
  PanelPage,
  usePanelQuery,
  type Bounds,
  type PageHistory,
} from "@maxitor/panel";

export function NotesViews({ cards, table, count, bounds, history }: {
  cards: ReactNode;
  table: ReactNode;
  count?: number;
  bounds: Bounds;
  history: PageHistory;
}) {
  const { view = "cards" } = usePanelQuery();
  return (
    <PanelPage
      title="Notes"
      history={history}
      layers={{
        param: "view",
        label: "Note views",
        default: "cards",
        options: [
          { value: "cards", label: "Cards", count },
          { value: "table", label: "Table", count },
        ],
      }}
    >
      <MaxitorCanvas bounds={bounds} initialCamera={{ x: 24, y: 72, zoom: 1 }}>
        {view === "table" ? table : cards}
      </MaxitorCanvas>
    </PanelPage>
  );
}
```

For content beginning at canvas coordinates `(0, 0)`, this initial camera leaves space under the pills and starts at 100%. Supplying `initialCamera` disables automatic fitting when content changes; the person can still move, zoom and Fit. Pass bounds that describe the actual content. If you add filters or other shell controls, allow space for them too. Without `initialCamera`, the canvas fits its bounds with the shell's reserved space taken into account.

The shell creates the pill group, handles clicks and keys, and writes `view` into the page address. Choosing **Table** produces `?view=table`; choosing **Cards** removes that default parameter. Other address parameters remain. The component reads the same address with `usePanelQuery()`; it needs no separate selected-tab state or click handler. Reload, Back and a shared link restore the choice. An unavailable choice falls back to the declared default. Without `param`, the shell writes `layer`; without `label`, its accessible name is Layer. The core's `at`, `from`, `mode` and `_…` parameters are not available for a page to write.

`options` supplies `value`, `label`, optional `icon` and optional `count`. Use the panel's icon names when an icon is needed. A count of zero is displayed; an omitted count stays empty. Here both views show the same notes, so their counts are the same. Do not import the internal `Pills` renderer or put a lookalike selector inside `MaxitorCanvas`: ownership, placement and URL navigation come from `PanelPage.layers`.

On a phone, text-only choices such as Cards/Table keep their labels and have touch targets at least 44px high. Icon-bearing drawing layers use the core's compact icon-and-count layout. Left/Right select the neighbouring pill, Home/End select the first/last, and keyboard focus follows the selection. Panning and zooming change the content's scale, never the pills' coordinates or text size.

The choice still works in the past and in A/B: it changes the view, not the selected moments. Keep `history` on `PanelPage`, read each panel's moment with the APIs in chapters 9 and 11, and let the core retain the time parameters.

## Buttons keep their meaning

Register an action for the whole page through `PanelPage.actions`, as the template does below. Use `Button` from `@maxitor/panel` beside a card or inside a form. `variant="primary"` gives a main action the common dark appearance; `type="submit"` submits a form, while the default type is `button`. Sharing the button component does not move a card's action into the shell. Put editing forms in the core's `Dialog` so canvas zoom does not resize their fields and text. See the [button API](../../../packages/maxitor-panel/README.md#shared-action-buttons).

## Two pages, one published state, a draft each

An item has two pages. **Published** is everyone's notes as the revision in force holds them: read only, with the Authors filter. **Draft** is the page of the person who reads it: their own changes over those published notes, and nobody else's. No edit writes the published notes; the only write that reaches them is publishing a revision.

The Draft page reads its own draft and, for an Edit opened from Published, the published notes too — in Diff the draft at the other moment as well (chapter 11) —; the server part hands them to a client component:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/items/[item_id]/page.tsx -->
```tsx
  return (
    <DraftView
      org={org}
      itemId={item_id}
      revision={draft?.revision ?? null}
      changes={draft?.changes ?? []}
      published={published?.notes ?? []}
      publishedRevision={published?.revision ?? null}
      other={against ? (other?.changes ?? []) : null}
    />
  );
```

A change carries its state — **New**, **Changed** or **Deleted** — the published text it was made over and the revision number of that text. A changed note shows the words that went and the words that came inside one text: one component draws that marking, so the card, both sides of a conflict and the revert dialog read alike:

Every card names its writer the same way: `Writer` of the template's `notes/parts.tsx` draws `@maxitor/panel`'s `PersonDisk` — the writer's initials in their own colour, as the Authors filter draws them — with the name and under it the time, each cut short in a narrow card and said whole on hover. A published note adds `Last change by <person>` under its text.

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/notes/marking.tsx -->
```tsx
        part.added ? (
          <ins key={index} className="nt-came">
            {part.value}
          </ins>
        ) : part.removed ? (
          <del key={index} className="nt-went">
            {part.value}
          </del>
        ) : (
          <span key={index}>{part.value}</span>
        ),
```

## The shell, the filter and the reverts

The Draft page gives the shell one filter, **State**: New, Changed and Deleted, each with a sign and a colour, a state with no change behind it faint. The page's actions are **New note** and **Publish**, at the top right, shown only at now; on a phone they stand above the bottom bar and a card's tools are a sheet behind "⋯".

New note opens the shell's `Dialog` — a sheet on a phone — and the note enters the draft as new. A card's Edit saves through the template's `EditNoteAction` with the base the change was made over; Revert asks once and gives the change up: a new note is removed, a changed or deleted note leaves the draft and the published note stays as it is. Every refusal of the template's actions has its words:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/notes/notes.ts -->
```ts
    case "nothing_to_publish":
      return `Nothing changed since revision ${Number(refusal.revision ?? 0) || "—"}: there is nothing to publish.`;
```

## Publishing, and its conflicts

Publish takes the whole draft as one revision with a title, a comment and an optional release — never one note at a time. Every change remembers the published version it was made over; publishing compares that base with the note as published now, by value:

- the published note still reads as the base: the change goes in as it is;
- it reads otherwise, or is deleted: the change is a **conflict**, and nothing is published until the person chooses for each one to **overwrite** what is published with their own text or **give up** their change;
- the person's own text has come to be the published text: the change leaves the draft without a question.

The draft already knows its conflicts: a notice stands above the cards, with a link to Published, and every card that meets someone else's publication is marked. The publishing dialog opens with them listed, then the changes that go in as they are; the server finds the conflicts again when the draft is published, so one that came meanwhile is asked too. The dialog shows each conflict as two sides — *Yours* and the other person's, each with its words marked, who changed or deleted the note and when — and its two choices; Publish stays off until every conflict has one. A change given up is gone from the draft; an overwrite of a note someone deleted restores it with the person's text, and an overwrite of a note someone changed while the person deleted it publishes the deletion.

Published then shows the new revision and marks every note waiting in the person's draft — "In your draft: changed" or "deleted" — with the count of what waits; Edit on a note opens Draft with its editor already open, and nothing is written until it is saved.

## Check it

1. On the local stand open an item's Draft: a note written through the gateway waits there, marked New and seen by you alone; Published shows nothing of it.
2. Edit the note, save, then revert it: the card asks once and the note leaves the draft.
3. Publish a change with a title and a comment: Published shows `v1`; the draft is empty.
4. Open Published and press Edit on a note: Draft opens with the editor; Cancel writes nothing, Save puts the change in the draft.
5. Press Delete on a published note: Published marks it "In your draft: deleted", and the draft card's Revert puts it back as it was.

For the optional pill component above:

1. Choose Table and inspect the address: it has `view=table`. Choose Cards: `view` is absent. Reload and use Back; the selected pill and content follow the address.
2. Move the canvas horizontally and vertically, then zoom in and out. The content must move and scale, while the pills keep their screen coordinates and text size. Repeat with touch at 375px width.
3. Open a past moment, Diff and Side by side. Change the view and check that the selected moments stay the same. Move and zoom each visible canvas; its pills remain in its shell.
4. Exercise Left/Right/Home/End. Check a zero count and an omitted count. Open a core dialog after zooming and verify that its type and controls have not scaled with the scene. [Chapter 13](13-tests.md) describes the regression checks.
