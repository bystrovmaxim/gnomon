# 7. A place in the tree

**Builds on**: [6. The backend](06-the-backend.md). **Next**: [8. The page](08-the-page.md).

Your plugin's pages open in Maxitor's frame: the tree on the left, the top row and the right panel. You do not draw any of it. You declare your nodes in `navigation.yaml`, Maxitor joins them into the organization's tree, and your page opens in the right panel when a person chooses one.

## Your nodes

The template hangs a section of its own in the root of the tree. Under it is one node per item of the organization, and under every item are its two pages: Draft and Published notes.

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/navigation.yaml -->
```yaml
  - id: notes
    attach: root
    title: Notes
    icon: note
    order: 500
    page: /
    roles: [member]
    children:
      # A list node: one instance per item of the organization, read from the plugin's action list_items at the
      # panel's moment. Each instance shows the item's title and puts its key into the scope as item_id, for every
      # node beneath it. It opens no page of its own: its two pages stand under it.
      - id: item
        each:
          source: list_items
          key: item_id
        roles: [member]
```

- `attach` says where a top node stands: `root`, a node of the core (`core:settings`) or a node of a plugin you depend on directly (`notes:item`). Nothing else.
- `page` is a path inside your plugin. Maxitor puts the organization and your name in front of it: the page `/items/{item_id}` of an item `4f1c` opens at `/w/<organization>/notes/items/4f1c`.
- `each` makes a node a list. `source` is a reading action of your plugin, and `key` is the parameter each instance adds for every node beneath it. That is how `{item_id}` reaches the two pages.
- `roles` asks for the core's `member` or `administrator`; a person without them does not see the node or anything under it.

## The list a node reads

A list node's records come from your own action, called through the gateway with the person's token, at the panel's moment, in parts:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/actions/list_items_action.py -->
```python
class ListItemsParams(BaseParams):
    """Which moment, and which part of the list."""

    at: str | None = Field(default=None, pattern=MOMENT_PATTERN, description="The panel's moment; none means now, the watermark")
    limit: int = Field(default=50, ge=1, le=200, description="How many entries one part holds")
    after: str | None = Field(default=None, pattern=UUID_PATTERN, description="The key of the last entry of the part before")
```

Maxitor calls it at `/p/notes/api/<organization>/lists/list_items` and expects `entries` of `key`, `title` and `icon`, and `next` for the part after. Your page may read the same kind of action for the options of its own controls, as the notes page reads its authors. Every list's source must be an action of your plugin: a file `actions/<name>_action.py` or `history/<name>_action.py`.

## What Maxitor checks

The tree is built by Maxitor's installer, never in the browser. It refuses a plugin before anyone sees a broken tree:

| When | What is refused |
|---|---|
| `python -m maxitor_plugin_sdk.checks .`, and again when the version enters the marketplace | a file that breaks the schema; an `id` used twice; two nodes opening one page; a `{name}` no list node above defines; a list key defined twice in one line; a list's `source` that is no action of the plugin; a node attached to a node the core does not have; navigation format 1, which declared controls; a page that does not render `<PanelPage>`, an element placed `fixed` or a layer at the shell's (30) or above |
| installing or enabling the plugin in an organization | a node attached to a plugin that is not a direct dependency; to a node that dependency does not have; a parameter the node it attaches to does not give |

A refused installation answers `navigation` with the reason in words, and the organization's tree stays as it was.

## Your page in the right panel

Your frontend draws only its content. `PanelDocument` of `@maxitor/panel` gives it a transparent document over the core's field of dots and speaks the panel protocol with the core:

<!-- quote: packages/maxitor-plugin-template/web/app/layout.tsx -->
```tsx
export default function RootLayout({ children }: { children: ReactNode }) {
  return <PanelDocument build={version}>{children}</PanelDocument>;
}
```

The page's controls are its own, and it does not draw them. It gives them to the shell — `PanelPage` of `@maxitor/panel` — as data when it opens: Draft gives the State filter and its two actions, Published notes gives the item's writers for the filter at the top left and the choice of cards or a table for the bottom bar. The shell draws them in the same places as on every page of Maxitor and writes each into the address:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/items/[item_id]/DraftView.tsx -->
```tsx
      filters={[{ title: "State", param: "state", rows: stateRows(changes) }]}
      actions={[
        { title: "New note", icon: "plus", onClick: () => { setWriting(true); setSaid(""); } },
        { title: "Publish", icon: "check", onClick: () => { setPublishing(true); setSaid(""); } },
      ]}
```

The page then reads the view like any parameter of its address:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/items/[item_id]/published/PublishedView.tsx -->
```tsx
  const { view = "cards", at, author } = query;
```

A section of the filters is one of three kinds. The writers above are a **choice**: a disk and a label per row, the address listing those switched on; a choice of more than eight rows gets a search and "N more" by itself. A **text** is `{ kind: "text", title: "Search", param: "q", placeholder: "Note or writer" }`. A **range** is `{ kind: "range", title: "Written", param: "written", unit: "date" }` — two rows, From and To, a date chosen in the date range picker and written as `?written=now-30d..now` — or `unit: "number"`, typed in the rows. The page filters its own notes by these parameters; `inRange` and `numberIn` of `@maxitor/panel` read a range the way the shell writes it. A page that needs one date from a person — "Review on…" — calls `openDatePicker({ anchor: button })` and gets the date back as the address would write it.

A page may name any parameter but the core's: `at`, `mode`, `from` and every name starting with `_`. The panel router refuses to change them, and in development the refusal is an error naming the parameter.

The address is everything the panel shows. A reload, a link to a colleague, Back and Forward all give exactly what was on screen, so a page builds its view from its address alone and never keeps a filter in its own state.

## Check it

1. Check the plugin: `uv run python -m maxitor_plugin_sdk.checks packages/maxitor-plugin-template` prints nothing.
2. Break it: change `source: list_items` to `source: list_things` and run the check again. It answers `'item' reads 'list_things', which is no action of the plugin`. Put it back.
3. On the local stand, install Notes in your organization and open `http://localhost:3000/w/<code>`. The tree shows Notes; open it and its items load under it. Add an item if there is none: `POST /p/notes/api/<code>/items` with `{"title": "Payments"}`.
4. Open an item, then Notes under it. The notes page opens in the right panel at `/w/<code>/notes/items/<item_id>`, and the top row reads Notes › Payments › Notes.
5. Switch the view to Table in the bottom bar after the hairline: the address gets `?view=table`; switch a writer off in the filters at the top left: the address lists the writers still on. Reload, open the address in another tab, press Back: each time the screen is what the address says.
