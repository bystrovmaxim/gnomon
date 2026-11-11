# Quickstart: the page shell on the local stand

## Prerequisites

`scripts/core-stand.sh up` with `notes` installed and enabled in an organization with two items.

## 1. The template in the shell

Open Notes → an item → Notes. The authors stand in the filters at the top left; list and table in the bottom bar. Switch both: the address carries `author` and `view`; nothing of the core stands over the panel.

## 2. The test drawing

Open `/w/<code>/core/panel-test/drawing`: three layer pills with counts, filters, a layout choice and "Close every port" after the zoom. Add `?mode=diff`: the Changes section appears in the filters. Open `/w/<code>/core/panel-test/unframed`: the red strip.

## 3. The head of the tree

Collapse and expand the tree; from Draft of an item press up.

## 4. The checks

```bash
node --experimental-strip-types --test packages/maxitor-panel/tests/*.test.ts
```

```bash
uv run --extra dev pytest packages/maxitor-plugin-sdk/tests packages/maxitor/maxitor-core/tests packages/maxitor-plugin-template/tests
```

```bash
node packages/maxitor/maxitor-core/web/scripts/check-core.mjs
```
