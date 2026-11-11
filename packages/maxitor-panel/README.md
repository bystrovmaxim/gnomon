# @maxitor/panel

What a Maxitor plugin's page draws with in the core's right panel. The core draws the frame — the tree, the top row, the panel's field of dots and the controls — and lays the plugin's page over the field in a transparent frame; this package is the page's side of that: its document, the panel protocol, its router and address parameters, the canvas and the common content.

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
  const { view = "list", at } = usePanelQuery();   // at: the moment, an opaque string; absent means now
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
| `PanelPage {title}` | the content box; its title goes to the top row and the browser tab |
| `usePanelRouter()` | `push` adds one history entry to the window's address, `replace` changes it in place |
| `usePanelQuery()` | the page's parameters, `at` among them when a moment is chosen |
| `usePanelPath()` | the page's path inside its plugin, without the organization |
| `useWatermark(listener)` | called when "now" moved: a page without `at` reads again |
| `useOpenPanel()` | opens a page of the core or of a direct dependency |
| `momentFrom(query)` | the moment of a server component's `searchParams`, or `null` for now |
| `Card`, `DataTable` | the common content, drawn with the tokens |
| `pageMessage`, `coreMessage`, `trusted` | the protocol's shape checks, for whoever speaks it by hand |

A page builds its view from its address only: on the server from `searchParams`, after a change from the new address. It never answers a change of address it did not ask for.

## Installing it

Inside this repository the core's application and the plugin template take the package by path, installed as a copy (`install-links=true` in their `.npmrc`): a linked package would look for React beside itself. After changing the package, run `npm install` in the application that uses it.
