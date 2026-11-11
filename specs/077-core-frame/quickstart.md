# Quickstart: the frame on the local stand

## Prerequisites

The local stand of `docs/how-to/run-the-core-locally.md`: PostgreSQL, the core's backend and application, the gateway and the plugin runner (`scripts/core-stand.sh up`), Docker for the template's processes.

## 1. The template in the frame

1. Build the template with its frontend: `cd packages/maxitor-plugin-template/web && npm ci && npm run build`, then `uv build` in the template.
2. Add it as a private plugin of your organization in Settings → Plugins, install and enable it.
3. Open `/w/<code>`: the tree shows Notes. Open Notes: its items load. Add two items through the API (`POST /p/notes/api/<code>/items`) if there are none.
4. Open an item → Notes: the notes page shows in the right panel at `/w/<code>/notes/items/<item_id>`, the path in the top row reads Notes › <item> › Notes.
5. Switch the view to Table and filter by one writer: the address gets `?view=table&author=<id>`; reload and open it in a new tab — the same screen.
6. Press Back twice and Forward twice: one change per press.

## 2. The protocol, the canvas and the controls on the test page

Open `/w/<code>/core/panel-test` as an administrator: a mode pill at the top centre, a view switch at the top right, a filter on the left, a legend at the bottom left, the zoom bar at the bottom right, a scene in the canvas. Move and zoom by every gesture, press fit, switch every control and go Back.

## 3. The checks

- The core's tests: `uv run pytest packages/maxitor/maxitor-core/tests -k "tree or watermark or navigation"`.
- The SDK's tests: `uv run pytest packages/maxitor-plugin-sdk/tests`.
- The tokens' check: `node packages/maxitor/maxitor-core/web/scripts/check-tokens.mjs`.
- The browser check of the core on the local stand: `node packages/maxitor/maxitor-core/web/scripts/check-core.mjs` — the frame, the address, the protocol, the canvas, the controls and the template's notes page, on a desktop and on a phone.

Contracts: [panel protocol](contracts/panel-protocol.md), [core actions](contracts/core-actions.md); entities: [data model](data-model.md).
