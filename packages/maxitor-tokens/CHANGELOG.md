# Changelog of @maxitor/tokens

## 0.2.0

`--mx-layer-shell` (30) and `--mx-layer-shell-pop` (35): the shell's layers over a page's own content, which a plugin's layers stay below. ([#109](https://github.com/bystrovmaxim/gnomon/issues/109))

## 0.1.0

Maxitor's look in one file. The core's frame, its controls and every plugin's page draw with the same colours, the eight colours of the palette a plugin names in its `navigation.yaml`, the same radii, shadows, blur, type sizes and spacing, taken from the styles Maxitor's screens have today. A plugin writes no colour or size of its own: it takes `@maxitor/tokens/tokens.css` and uses its `--mx-*` properties.
