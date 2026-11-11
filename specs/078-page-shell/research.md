# Research: Maxitor core — the page shell

## R1. What a page gives the shell, and from where

`PanelPage` is a client component, and a page's server component renders it. So everything a server page gives — filter sections and rows, layer options and counts, the bottom bar's choices — is plain data the shell turns into address writes by itself: a choice names its `param`, its `default` and its options, and the shell writes the address. Only a button, a switch and a page action carry a function (`onClick`, `onChange`), so a page gives them from a client component.

Rejected: a context the page fills after mount (`useShell().set(...)`): the first paint of a server-rendered page would come without controls.

## R2. Where the parts stand, and what "no control covers the content" means

The places are the mockup's and maxitor-web's: filters top left (148 px), layer pills top centre, page actions and the change stepper top right, the bottom bar bottom left. On a document page the shell pads the content field by the width of the filters and the height of the pills, so no control lies over a card. On a canvas the controls float over the dotted field, as in the ERD, and the canvas fits its scene inside the field left free by them (the insets of the filters and the bottom bar), so no node is drawn under a control when the scene is fitted.

## R3. The canvas and the bottom bar

`<MaxitorCanvas>` stops drawing `ZoomBar`. It gives the shell its zoom (in, out, fit, the percentage) through the shell's context; the shell draws the bottom bar with the zoom first when a canvas gave it, and without it on a document page.

## R4. The address rules

- A filter writes the options switched on, comma-separated, and is absent when all are on (the rule of spec 077, FR-034).
- A choice of one writes its value and drops it at its default.
- `layer` is the layer pills' parameter.
- A chosen value missing from the page's new options gives way to the default, written once by `replace`.

These rules live in one pure module (`shell/address.ts`) so Node's test runner checks them without a browser.

## R5. Refusing the core's names

`usePanelRouter` checks every name of a write against `at`, `mode`, `from` and `_…`, case ignored. In development (`process.env.NODE_ENV !== "production"`) and under the test runner it throws an error naming the parameter; in production it writes one line to the console and leaves the address. The page does not know its route's template, so the core — `PageFrame`, which knows the open node's scope — refuses `panel.navigate` and `panel.open` with a reserved name or a name of the node's path parameters, and leaves the window's address.

## R6. Navigation format 2

`navigation-2.schema.json` is format 1 without `controls` and its definitions (`choiceBody`, `filter`, `legend`); `navigation` is `const: 2`; `param` (used by `room.shared`) excludes `at`, `mode` and `from`. The core passport reads `navigation: [2]`. `navigation-1.schema.json` is deleted. A file of format 1 fails before the schema with "navigation format 1 is not read; write format 2, without controls". The SDK's `_control_problems` and the control parts of `named_actions` go; `source_problems` keeps only list nodes. The template's `list_note_authors` stays an action: its page reads it.

## R7. The column

Migration `0004_plugin_node_no_controls.sql` drops `controls` from `plugin_node` and `plugin_node_versions`. The entity's field, the storage's select, `check_version_action`'s write, the tree action's `controls` field and the frame's `TreeNode.controls` go with it.

## R8. The head of the tree

Collapse lives in the frame's state, not stored; on a phone the tree stays the drawer of spec 077. Up takes the open node's line (`lineOf`), walks up to the nearest node with a page, fills its path from the current scope and opens it at the same `at`, with no other parameter; with none, the button is disabled.

## R9. The boundary check

`maxitor-plugin-check` reads the frontend's sources under the passport's `frontend` folder's `web/app` and `web/components`, without `node_modules` and built folders:

1. every `page.tsx` renders `<PanelPage` — itself or through a component of its folder that does;
2. no `position: fixed` / `position: "fixed"` in `.ts`, `.tsx`, `.css`;
3. no `z-index` / `zIndex` of 30 or more — the shell's layer, `--mx-layer-shell: 30` in `@maxitor/tokens`.

Each refusal names the file and the line. Positioning, other kits and colours inside the field pass.

## R10. The shell's mark

`PanelPage` marks the provider during its render; `PanelProvider` sends `panel.ready` from its effect, which runs after the children's, with `shell` and `shellVersion` (`SHELL_VERSION`, a constant kept equal to `package.json` by a test). The core's `PageFrame` on a ready without `shell` shows the red strip when `NEXT_PUBLIC_MAXITOR_MARK_UNFRAMED` is `1` (set by `scripts/core-stand.sh`) or in development, and otherwise writes a console warning naming the plugin and the path.

## R11. The test page

`/w/<code>/core/panel-test/drawing` draws a canvas with three layers and counts that change with the layer, filters with a section only when `mode` is in the address, two bottom-bar sections (a layout choice and a "Close every port" button); `/w/<code>/core/panel-test/unframed` renders without the shell.

## R12. Versions

`maxitor` minor (as passport 1 in #82), the core's application minor, the SDK minor, `@maxitor/panel` minor (0.2.0), `@maxitor/tokens` minor (the layer token), the template minor and its pages minor.
