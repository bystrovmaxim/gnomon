# Contract: the panel protocol and `@maxitor/panel`

## Messages

Every message is `window.postMessage({type, ...fields}, location.origin)`. A side accepts a message only when `event.origin === location.origin`, `event.source` is the expected window (the core: the panel frame's `contentWindow`; the page: `window.parent`), and the fields have the types below; anything else is dropped without an answer.

| Type | Direction | Fields | Effect |
|---|---|---|---|
| `panel.ready` | page → core | `build: string`, `surface: "document" \| "canvas"` | the core starts sending `panel.location` and `panel.watermark` |
| `panel.navigate` | page → core | `path: string`, `query: Record<string,string>`, `mode: "push" \| "replace"` | the window's address changes: one entry for `push`, none for `replace` |
| `panel.title` | page → core | `text: string` | the last step of the top row's path and the browser tab |
| `panel.open` | page → core | `owner: string`, `path: string`, `query: Record<string,string>` | opens a page of `core` or a direct dependency; any other owner is ignored |
| `panel.location` | core → page | `path: string`, `query: Record<string,string>`, `at: string \| null` | the page rebuilds from it and sends nothing back |
| `panel.watermark` | core → page | `at: string` | a page without `at` reads again |

`path` is the page's path inside its owner, without the organization: `/items/4f1c`. `at` is an opaque string, never parsed as a date.

## `@maxitor/panel`

| Export | What it gives |
|---|---|
| `PanelDocument` | the page's root: transparent background, the tokens' CSS, the listener; sends `panel.ready` once mounted |
| `PanelPage {title}` | the page's content box; sends `panel.title` |
| `usePanelRouter()` | `push({path?, query})`, `replace(...)`: `panel.navigate` to the core, the frame's own address replaced |
| `usePanelQuery()` | the page's parameters, `at` included, as the address holds them |
| `useWatermark(callback)` | called on `panel.watermark` |
| `momentFrom(query)` | the moment string of the address, or `null` for now |
| `openPanel({owner, path, query})` | `panel.open` |
| `MaxitorCanvas {bounds, children}`, `useCanvas()` | the canvas (below) |
| `Card`, `DataTable` | the common content pieces drawn with the tokens |

## The canvas

- Wheel or two-finger swipe: move. Ctrl/⌘ + wheel or pinch: zoom around the pointer. Drag: move. Keys `+` `-` zoom, `0` fits, arrows move.
- Zoom limits 0.1 – 4; fit shows `bounds` with a margin.
- `useCanvas()`: `fit(bounds?)`, `show({x, y})`, `toCanvas({x, y})`, `toScreen({x, y})`, `zoom`.
- The field of dots moves and scales with the camera. The viewport is not written into the address.
