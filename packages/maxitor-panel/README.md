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
| `PanelPage {title, filters, layers, bar, actions, history, stepper, onMilestoneAction}` | the shell: the root of every page, which draws the page's controls from what it gives and writes them into the address, and gives the core the page's history, format 2 — `read`, `bars`, `milestones`, `card`, `kinds`, `small`, `flag`, `compare`, `actions` ([the history of a page](../../docs/plugins/history.md)) — without it the page is offered one moment only; in a comparison its corner holds `stepper` first; an action on a milestone stands there exactly on it; its title goes to the top row and the browser tab |
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
| `DataTable {name, rows, total, columns, rowKey, anchor, change, at}` | a list lying whole on the canvas: a card at full length, only the rows in view drawn, its head sticking to the top of the view; a column's `kind` is text, mono, number, date, person or status; alone on a page it lays its own canvas |
| `openDateRangePicker(options)`, `openDatePicker(options)` | the date pickers: `{anchor, unit, min, max, value, presets}`; they answer the choice as the address writes it, or `null` |
| `readRange`, `writeRange`, `inRange`, `readNumbers`, `numberIn` | a range filter's address value, and whether a date or a number lies in it |
| `usePanelHidden(anchors)` | tells the core what the page's filters hide now (`panel.hidden`) |
| `EmptyState {title}` | what a page shows when it has nothing to show: a dashed card with a title and a line, never bare text |
| `useMoment()` | the page's context: `at`, `against`, `side`, `milestone`; a page draws one canvas from it, never knowing how many panels there are |
| `useCounts(counts)`, `useChangeStep(listener)`, `useBackToNow()` | the comparison's counts for the pill (`panel.counts`), Shift + ↑ ↓ as `panel.step`, and now asked for (`panel.now`) |
| `PersonDisk {name, colour}` | a person: a disk of their palette colour with their initials, as a table's person cell and an Authors filter draw them |
| `StatusDisk {fill, sign, className?, label?}` | the graph viewer's production SVG for status filters and state counts; `fill` may be a CSS palette variable; an optional `label` names a standalone icon |
| `changeFilterRows(present)` | the four rows of Changes with labels, colours, signs and absence flags; absence never removes a sign |
| `ChangeStepper {entries, position, onGo}`, `DiffCard {target, at, beside, onClose}`, `StatusIcon {status}`, `VersionsBetween {items}` | what a page compares with, ported from the graph viewer: the stepper with its list grouped, the card of one change — standing beside the element `beside` names, as the graph viewer's does —, the disk of a change, what lies between A and B |
| `data-change`, `data-paint`, `data-room-anchor` | a comparison's halo under an element that changed and the fading of the rest while the changes paint; an element's anchor, which the canvas reports under the pointer and lights or brings into view when the core asks |
| `pageMessage`, `coreMessage`, `trusted` | the protocol's shape checks, for whoever speaks it by hand |

A page builds its view from its address only: on the server from `searchParams`, after a change from the new address. It never answers a change of address it did not ask for.

Use `StatusIcon` for a comparison status, `StatusDisk` for a custom palette colour and `changeFilterRows(compared.status.values())` for the Changes filter. They use the same SVG as the graph viewer. A sign in a CSS circle, a plain coloured status disk or a private SVG copy is not an alternative. The panel test run checks the repository for retired renderers and stale standalone mockups; the core browser walk checks actual Draft and Published filter rows.

Standalone mockup tree icons also come from the core's `treeMarks.tsx`: run `node scripts/sync-mockup-icons.mjs --write` from the repository root after changing them. Without `--write`, the command and the panel tests reject older redraws. The core browser walk inspects visible SVG geometry, image loading and Changes signs after each scenario, including nested plugin frames. The complete named-screen audit and scale regressions are recorded in [the verification report](../../specs/079-time-scale/verification.md).

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

### Stable form typography on the canvas

`MaxitorCanvas` accepts an optional `initialCamera: {x, y, zoom}`. Supplying it disables automatic fitting on content changes; the user can still pan, zoom and Fit. Administration starts at zoom 1 with space for the shell controls. Put editing forms in `Dialog`, whose portal stays outside the transformed scene. `heading={false}` suppresses the shell heading when existing content already supplies its own heading; keep the dialog title for its accessible name.

### Shared action buttons

Use `Button` from `@maxitor/panel` for card actions and form controls. The shell's `Actions` uses the same primitive. Keep contextual actions beside their record and register page-wide actions with `PanelPage`; sharing a component does not move an action.

```tsx
<Button variant="primary" disabled={busy} onClick={save}>Save</Button>
<Button onClick={cancel}>Cancel</Button>
```

The default type is `button`; specify `type="submit"` for form submission. Variants are `secondary` (default), `primary`, `danger`, `link` and `icon`. Give icon-only controls an accessible label. Native button attributes and handlers pass through. Labels use 14px text; phone touch targets are at least 44px, except inline links. Standalone mockups receive the same stylesheet through `scripts/sync-admin-canvas.mjs`.

The page layer selector uses `.mx-layer-pill`; `.mx-pill` belongs to the core time scale. Keep these CSS namespaces separate when embedding the panel and core in one document.

### Page choices through the core layer API

Declare page choices with `PanelPage.layers`. The shell renders them at the top centre, outside the transformed canvas, and owns selection and URL writes. Do not render a separate pill group in page content.

```tsx
<PanelPage title="Plugins" layers={{
  param: "tab", label: "Plugin views", default: "market",
  options: [
    { value: "installed", label: "Installed", count: 1 },
    { value: "market", label: "Marketplace", count: 6 },
  ],
}}>
  <MaxitorCanvas bounds={bounds}>{content}</MaxitorCanvas>
</PanelPage>
```

Choosing Installed writes `?tab=installed`; choosing Marketplace omits the default parameter. The page reads the selection with `usePanelQuery()`. Without `param`, the existing `layer` parameter is used. Without `label`, the accessible group name is Layer. Reserved core parameters remain protected by the panel router.

One native radio button is selected and in the tab order. Left/Right wrap, Home/End select the first/last option, and focus follows selection. Zero counts remain visible; omitted counts stay empty. Options may omit icons: text-only choices retain their labels and 44px touch targets on phones. Existing drawing layers keep their icons and compact phone appearance.

Panning and zooming change content only; the controls keep their screen coordinates and text size. Administration retains 14px labels and 11px counts and starts content below the shell controls. The standalone mockup synchronizer copies the same production pill appearance and shell placement rules.
