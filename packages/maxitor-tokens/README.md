# @maxitor/tokens

Maxitor's look in one place: colours, the palette, radii, shadows, blur, type sizes and spacing, as CSS custom properties named `--mx-*`. The core's frame, its controls and [`@maxitor/panel`](../maxitor-panel/README.md) draw with them, and so does every plugin's page: nobody writes a colour code or a size number of their own.

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

`grey`, `blue`, `green`, `amber`, `red`, `violet`, `teal`, `pink` — the names a plugin writes as `colour:` of a filter's option or a legend's row in `navigation.yaml` ([the plugin concept, 7.8](../../docs/plugins/concept.md)).

## The check

`packages/maxitor/maxitor-core/web/scripts/check-tokens.mjs` reads the frame, the controls and `@maxitor/panel` and refuses a colour code (`#…`, `rgb(`, `hsl(`) or a size in `px`/`rem` outside this package.
