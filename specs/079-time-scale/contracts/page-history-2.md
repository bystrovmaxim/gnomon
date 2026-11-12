# Contract: a page's history, format 2

A page gives its history in `PanelPage`'s `history` and the shell sends it as `panel.history`. The core checks it against the plugin version's actions and passport, keeps what holds and names in the console what it drops.

```tsx
<PanelPage
  history={{
    read: "list_published_notes",
    milestones: "list_note_history",
    card: "note_milestone_card",
    kinds: {
      published: { tone: "purple", look: "filled", lead: "solid", term: "Published", def: "The notes as they were published, in force until the next publication." },
      rollback: { tone: "red", look: "filled", lead: "solid", term: "Rolled back", def: "A publication that brought back the notes of an earlier one; everything between them stays in the history." },
    },
    compare: ["diff", "side_by_side"],
    actions: [{ on: "milestone", kinds: ["published", "rollback"], title: "Roll back to {ref}", action: "rollback_publication", ask: true }],
  }}
>
```

## Checks of the core

1. `read`, `bars`, `milestones`, `card` and every `actions[].action` must be actions of the plugin version; otherwise dropped and named.
2. `compare` must narrow the passport's `history.compare`; a wider value is dropped and named.
3. `kinds` keys match `^[a-z][a-z0-9_]{0,31}$`, at most 12; a kind with a tone, look or lead outside its list is dropped and named.
4. `small` and `flag` are strings of at most 160 characters.
5. `actions[].kinds` must name declared kinds.

## Milestones answered (`schemas/history-2.schema.json`)

```json
{ "milestones": [
  { "id": "v3", "at": "2026-11-04T12:00:00.000000Z", "ref": "v3", "title": "Refunds and settlement", "kind": "published", "comment": "…" },
  { "id": "v6", "at": "2026-11-10T11:30:00.000000Z", "ref": "v6", "title": "Back to v3", "kind": "rollback", "comment": "…" }
] }
```

The core drops and names: a milestone whose `kind` the page did not declare; `small: true` without the setup's `small`; `flag` without the setup's `flag`.

## The legend from the setup

| Row | Stands when |
|---|---|
| Points: one per kind, in order, `term` and `def` | always, when `kinds` is given |
| Bars | `read` or `bars` is given |
| Size, Three points | `small` is given; its sentence |
| Flag | `flag` is given; its sentence |
| Now, The chosen moment, the keys | always |

The card's switch of small points stands only with `small`.

## The setups of this step

| Page | read / bars | kinds | small | flag | compare | actions |
|---|---|---|---|---|---|---|
| Notes · Published | `list_published_notes` | published, rollback | — | — | diff, side_by_side | Roll back on a milestone |
| Notes · Draft | `list_note_draft` | published, rollback | — | — | diff | — |
| The test page, graph fixture | — | direct, merged, review_required, approved, changes_requested, live | yes | yes | diff, side_by_side | — |
