# Contract: the shell of `@maxitor/panel`

```tsx
<PanelPage
  title="Events"
  layers={{ default: "domains", options: [
    { value: "domains", label: "Domains", icon: "domain", count: 12 },
    { value: "events", label: "Events", icon: "event", count: 40 },
    { value: "actions", label: "Actions", icon: "action", count: 31 },
  ] }}
  filters={[{ title: "Domains", param: "domain", paints: true, rows: [{ key: "billing", label: "Billing", colour: "blue" }] }]}
  bar={[
    { kind: "choice", param: "layout", default: "lr", options: [
      { value: "lr", title: "Left to right", icon: "layout-lr" },
      { value: "tb", title: "Top to bottom", icon: "layout-tb" },
    ] },
    { kind: "button", items: [{ title: "Close every port", icon: "close-ports", onClick: closeAll }] },
  ]}
  actions={[{ title: "New note", icon: "plus", onClick: openNew }]}
>
  <MaxitorCanvas bounds={bounds}>{nodes}</MaxitorCanvas>
</PanelPage>
```

| Rule | |
|---|---|
| Address | a filter writes the options on, comma-separated, absent when all are on; a choice drops its default; the layer pills write `layers.param` or `layer` when omitted |
| Reserved | `at`, `mode`, `from`, `_…`, case ignored: refused by `usePanelRouter` and by the core |
| Missing value | a chosen value not among the new options gives way to the default, by `replace` |
| Actions | hidden when the address has `at` or `mode` |
| Zoom | first in the bottom bar when a `<MaxitorCanvas>` is inside; absent on a document |
| Icons | `cards`, `table`, `list`, `layout-lr`, `layout-tb`, `close-ports`, `hover-cards`, `plus`, `domain`, `event`, `action`, `note`; an unknown icon draws `dot` and errs in development |
| Phone (≤ 520 px) | filters behind a button; bar sections after the zoom into one "⋯" menu when they do not fit; icon-bearing pills show icon and count, text-only pills keep labels; actions behind "⋯" |

`layers.param` and `layers.label` are optional. For page views, use `layers={{ param: "tab", label: "Plugin views", default: "market", options: [...] }}`. Options may omit `icon`; the shell keeps their text on phones. Both variants remain outside the canvas transform, with keyboard selection and URL ownership in the shell. See [spec 087](../../087-admin-pill-tabs/spec.md).
