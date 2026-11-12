# Quickstart: walking spec 084

## The tests

```bash
# the template's server and its actions
uv run pytest packages/maxitor-plugin-template/tests -q
# the pages' rules without a browser
node --experimental-strip-types --test packages/maxitor-plugin-template/web/tests/*.test.ts
# the plugin is still a valid plugin
uv run maxitor-plugin-check packages/maxitor-plugin-template
```

## The stand

```bash
./scripts/core-stand.sh
```

Open the template's notes plugin in two browsers as two members of one organization (`http://localhost:3000`, the stand prints its address and accounts).

## The walk of 1.6

1. Anna writes a note in Draft; Olga's Draft does not show it, and Published does not either.
2. Anna publishes it: Olga's Published shows it after the watermark; Anna's Draft is empty.
3. Both change one note; Anna publishes first; Olga's Draft says a publication met her change and rings it.
4. Olga publishes: the conflict list shows Anna's name and value against hers; she overwrites one note and gives up another; the given-up change leaves her draft.
5. Olga deletes a note and Anna changes it; Anna publishes, overwrites, and the note returns with her text.
6. Anna reverts a changed note: Published stays as it was.
7. Open Draft and Published with a moment in the address: both read only, no actions.
8. The same at 375 px: the tree is a drawer, the filters fold behind their button, a card's tools are a sheet behind "⋯", the publishing and conflict dialogs are sheets.

## The browser check

```bash
node packages/maxitor/maxitor-core/web/scripts/check-core.mjs
```

It walks 1.6 on the stand at a desktop and at 375 px and prints each step; a failing step names the screen and the rule.
