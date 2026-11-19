# Changelog of @maxitor/tokens

## 0.5.1 — 2026-11-19

Common button heights, destructive borders and disk contours are platform tokens with the existing values, so live controls and standalone prototypes share their appearance.

The graph viewer's status disks now have one production source, exported as `@maxitor/tokens/status-disks`. React pages, graph legends and standalone mockups use the same circle and centred SVG paths for status signs; initials remain text. A shared frame stylesheet also keeps the white gap and outer contour aligned across every standalone mockup style scope, including embedded filters and cards. SVG text is escaped, and the repository check rejects obsolete CSS/text disks and generated mockups that differ from this source.

## 0.5.0

The time scale's look and a comparison's (#98): the canvas's surface and dots as the graph viewer draws them, a change's colours, its halo and the fading of what did not change; the pill, its card, the scale's axis, hatch, range and brush; the milestones' palette — a point's colour, its badge's tint and ink for `neutral`, `purple`, `blue`, `green`, `amber`, `red`; the card's blocks, the legend, the stepper and the change card; Side by side's A brown and B blue, and the glow of an element another panel points at. ([#98](https://github.com/bystrovmaxim/gnomon/issues/98))

## 0.4.0

The date pickers' colours and sizes — the band between two days, the side of ready stretches, a day's cell, a field, the wheels, a sheet's corners and its scrim — and `--mx-mono` for a monospace cell. ([#115](https://github.com/bystrovmaxim/gnomon/issues/115))

## 0.3.0

The sizes of the shell after the mockup: the filters' padding, a person's disk and its letters, the bottom bar's buttons and hairline, the empty state's card, a card's least width in a grid.

## 0.2.0

`--mx-layer-shell` (30) and `--mx-layer-shell-pop` (35): the shell's layers over a page's own content, which a plugin's layers stay below. ([#109](https://github.com/bystrovmaxim/gnomon/issues/109))

## 0.1.0

Maxitor's look in one file. The core's frame, its controls and every plugin's page draw with the same colours, the eight colours of the palette a plugin names in its `navigation.yaml`, the same radii, shadows, blur, type sizes and spacing, taken from the styles Maxitor's screens have today. A plugin writes no colour or size of its own: it takes `@maxitor/tokens/tokens.css` and uses its `--mx-*` properties.
