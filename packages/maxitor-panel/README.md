# @maxitor/panel

What a Maxitor plugin's page draws with in the core's right panel. The core draws the frame — the tree, the top row and the panel's field of dots — and lays the plugin's page over the field in a transparent frame; this package is the page's side of that: its document, the panel protocol, its router and address parameters, the canvas and the common content.

The protocol and the address are described in [the plugin concept, section 7](../../docs/plugins/concept.md); the tutorial builds a page with this package in [chapter 7](../../docs/plugins/tutorial/07-a-place-in-the-tree.md).

## The page's document

```tsx
// web/app/layout.tsx of a plugin
import { PanelDocument } from "@maxitor/panel";

export default function RootLayout({ children }) {
  return <PanelDocument build="0.8.0">{children}</PanelDocument>;
}
```

`PanelDocument` renders `<html>` and `<body>` with a transparent background and `@maxitor/tokens`, and says `panel.ready` to the core once the page is mounted.

## Reading the address and changing it

```tsx
"use client";
import { PanelPage, usePanelQuery, usePanelRouter } from "@maxitor/panel";

export function Notes() {
  const { view = "cards", at } = usePanelQuery();   // at: the moment, an opaque string; absent means now
  const router = usePanelRouter();
  return (
    <PanelPage title="Notes">
      <button onClick={() => router.push({ query: { view: "table" } })}>Table</button>
    </PanelPage>
  );
}
```

| Export | What it does |
|---|---|
| `PanelDocument` | the page's document and the protocol's listener |
| `PanelPage {title, filters, layers, bar, actions, history}` | the shell: the root of every page, which draws the page's controls from what it gives and writes them into the address, and gives the core the page's history (`read`, `bars`, `milestones`, `card`, `compare`, `legend`) — without it the page is offered one moment only; its title goes to the top row and the browser tab |
| `usePanelRouter()` | `push` adds one history entry to the window's address, `replace` changes it in place; a change of `at`, `mode`, `from` or a `_…` name is refused |
| `usePanelQuery()` | the page's parameters, `at` among them when a moment is chosen |
| `usePanelPath()` | the page's path inside its plugin, without the organization |
| `useWatermark(listener)` | called when "now" moved: a page without `at` reads again |
| `useOpenPanel()` | opens a page of the core or of a direct dependency |
| `momentFrom(query)` | the moment of a server component's `searchParams`, or `null` for now |
| `MaxitorCanvas {bounds}`, `useCanvas()` | the canvas: moving and zooming, fit, the field of dots, the camera; its zoom stands first in the shell's bottom bar |
| `Icon`, `hasIcon` | the shell's icon set, which every control draws with |
| `LAYER`, `PAINT`, `isReserved` | the layer pills' and the paint switch's parameters, and the core's names |
| `Card` | a card of content, drawn with the tokens; `mx-cards` lays cards in a grid |
| `DataTable {name, rows, total, columns, rowKey, anchor, at}` | a list lying whole on the canvas: a card at full length, only the rows in view drawn, its head sticking to the top of the view; a column's `kind` is text, mono, number, date, person or status; alone on a page it lays its own canvas |
| `openDateRangePicker(options)`, `openDatePicker(options)` | the date pickers: `{anchor, unit, min, max, value, presets}`; they answer the choice as the address writes it, or `null` |
| `readRange`, `writeRange`, `inRange`, `readNumbers`, `numberIn` | a range filter's address value, and whether a date or a number lies in it |
| `usePanelHidden(anchors)` | tells the core what the page's filters hide now (`panel.hidden`) |
| `EmptyState {title}` | what a page shows when it has nothing to show: a dashed card with a title and a line, never bare text |
| `pageMessage`, `coreMessage`, `trusted` | the protocol's shape checks, for whoever speaks it by hand |

A page builds its view from its address only: on the server from `searchParams`, after a change from the new address. It never answers a change of address it did not ask for.

## The shell

Every page's root is `PanelPage`. A page gives it what it offers now, as data, and the shell draws each part in its place, the same for every plugin, and writes its value into the address:

```tsx
<PanelPage
  title="Notes"
  filters={[{ title: "Author", param: "author", rows: authors.map((a) => ({ key: a.key, label: a.title })) }]}
  bar={[{ kind: "choice", param: "view", default: "cards", options: [
    { value: "cards", title: "Cards", icon: "cards" },
    { value: "table", title: "Table", icon: "table" },
  ] }]}
>
  <NotesView notes={notes} />
</PanelPage>
```

| Part | Place | Address |
|---|---|---|
| `filters` | top left: an accordion of three kinds of section — a choice (a long one with a search and "N more"), a text, a range of numbers or dates — and the paint switch when two sections paint; a sheet from below on a phone | a choice's rows switched on, absent when all are; a text's words; a range's `from..to`; `paint` |
| `layers` | top centre: one chosen, an icon and a count each | `layer` |
| `bar` | bottom left, after the canvas's zoom: a choice, buttons, a switch, each behind a hairline | a choice's own parameter |
| `actions` | top right, bottom right on a phone; only at now | — |

A server page gives filters, layers and choices as plain data; a button, a switch and an action carry a function, and come from a client component. On a phone the shell folds every part the same way for every plugin. `panel.ready` says the page renders the shell, with its version; the core marks a page that does not.

## Installing it

Inside this repository the core's application and the plugin template take the package by path, installed as a copy (`install-links=true` in their `.npmrc`): a linked package would look for React beside itself. After changing the package, remove `node_modules/@maxitor` and run `npm install` again in the application that uses it: npm keeps a copy until then.
