# @maxitor/tokens

The graph viewer's production status disks live in `status-disks.js`, exported as `@maxitor/tokens/status-disks`. `statusDiskSvg(fill, sign)` returns the SVG for inline use, including CSS palette variables; `statusDiskUri(fill, sign)` returns the same drawing as an image source, with a resolved colour. Signs are `+`, `−`, `~` and `=`; a third argument of `9` draws a person's initials. Text and attributes are escaped.

React pages use `StatusDisk` or `StatusIcon` from `@maxitor/panel`. Standalone mockups embed the generated block so they still open without a server. Run `node scripts/sync-status-disks.mjs --write` after changing the source; without `--write` it checks every mockup and rejects retired CSS/text disks. Do not keep a private rendition as a template or fallback.

Maxitor's look in one place: colours, the palette, radii, shadows, blur, type sizes and spacing, as CSS custom properties named `--mx-*`. The core's frame and the shell and content of [`@maxitor/panel`](../maxitor-panel/README.md) draw with them, and so does every plugin's page: nobody writes a colour code or a size number of their own.

## Use

```css
@import "@maxitor/tokens/tokens.css";

.note { background: var(--mx-surface); border: var(--mx-line-width) solid var(--mx-line); border-radius: var(--mx-radius-md); }
```

`@maxitor/panel`'s `PanelDocument` already takes `tokens.css`, so a plugin's page has the properties without importing them.

In code, a palette colour is named, never coded:

```ts
import { PALETTE, paletteColour } from "@maxitor/tokens";

paletteColour("green"); // "var(--mx-palette-green)"
```

## The palette

`grey`, `blue`, `green`, `amber`, `red`, `violet`, `teal`, `pink` — the names a page gives as the `colour` of a filter's row to the shell of `@maxitor/panel` ([the plugin concept, 7.8](../../docs/plugins/concept.md)).

## The layers

`--mx-layer-shell` (30) is the shell's layer over a page's own content, `--mx-layer-shell-pop` (35) its menus; a plugin's layers stay below 30, and `maxitor-plugin-check` refuses one that does not.

## The check

`packages/maxitor/maxitor-core/web/scripts/check-tokens.mjs` reads the frame and `@maxitor/panel` and refuses a colour code (`#…`, `rgb(`, `hsl(`) or a size in `px`/`rem` outside this package.

Status signs use centred SVG paths, independent of font baselines. Initials remain text. Render disks with a white separation ring and a thin outer contour; the SVG circle leaves space for that separation. The panel shares this frame across status filters, author filters and cards.

`disk-frames.css` is the canonical standalone-mockup frame. The same sync command copies it to every style scope, including embedded panels. The guard rejects a missing or changed frame as well as outdated sign geometry.

Common action controls use `--mx-action-height` and `--mx-action-height-phone`; disk frames use `--mx-disk-line` and `--mx-shadow-disk`. These keep the existing dimensions and colors while allowing the core and standalone prototypes to consume the same values.
