# Contract: navigation format 2

Format 2 is format 1 without `controls`.

```yaml
navigation: 2
nodes:
  - id: notes
    attach: root
    title: Notes
    page: /
    children:
      - id: item
        each: { source: list_items, key: item_id }
        children:
          - id: item-notes
            title: Notes
            page: /items/{item_id}
            room: { shared: [view], surface: document }
            history: { read: list_item_notes, milestones: list_note_history, card: note_milestone_card }
```

| Rule | |
|---|---|
| `navigation` | `const: 2`; a file with `navigation: 1` is refused: "navigation format 1 is not read; write format 2, without controls" |
| `controls` | not a field: refused as an unknown field |
| `room.shared` | names that are not `at`, `mode`, `from` or `_…` |
| Core passport | `reads.navigation: [2]` |
