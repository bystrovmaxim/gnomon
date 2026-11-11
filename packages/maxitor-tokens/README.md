# @maxitor/tokens

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
