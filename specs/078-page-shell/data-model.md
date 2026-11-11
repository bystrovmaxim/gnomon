# Data model: Maxitor core — the page shell

## Shell input (props of `PanelPage`)

| Field | Type | Rule |
|---|---|---|
| `title` | string | to the top row and the tab |
| `filters` | `FilterSection[]` | top left; absent or empty — not drawn |
| `layers` | `{ default, options: LayerOption[] }` | top centre, parameter `layer` |
| `bar` | `BarSection[]` | bottom bar, after the zoom |
| `actions` | `PageAction[]` | top right; shown only with no `at` and no `mode` |

## FilterSection

| Field | Type | Rule |
|---|---|---|
| `title` | string | the section's head |
| `param` | string | not reserved |
| `rows` | `{ key, label, colour?, absent? }[]` | `colour` a palette name; `absent` greys the row |
| `paints` | boolean | with two or more such sections the paint switch shows |

## LayerOption

`{ value, label, icon, count? }` — `count` undefined shows as empty, never zero.

## BarSection

- `{ kind: "choice", param, default, options: { value, title, icon }[] }` — written by the shell.
- `{ kind: "button", items: { title, icon, onClick, disabled? }[] }` — from a client component.
- `{ kind: "switch", title, icon, on, onChange }` — from a client component.

## PageAction

`{ title, icon?, onClick }` — from a client component.

## `panel.ready`

`{ type, build, surface, shell, shellVersion }` — `shell` true when the page renders `PanelPage`; `shellVersion` the shell's version.

## `plugin_node` / `plugin_node_versions`

The column `controls` is dropped from both (migration `0004`). No other column changes.
