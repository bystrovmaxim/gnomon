# Contract: how a plugin answers the core's time scale

Defined in `maxitor-plugin-sdk` (its JSON schemas and `checks`); the core's side is bystrovmaxim/gnomon#98.

## Declarations

```yaml
# maxitor-plugin.yaml — optional
history:
  compare: [diff, side_by_side]     # subset of {diff, side_by_side}; absent: one moment only
```

```yaml
# navigation.yaml, a node — optional
history:
  compare: [diff]                    # within the passport's list
  read: list_item_notes              # the page's reading action
  bars: notes_bars                   # optional: the plugin's own bars, an action in history/
  milestones: list_note_history      # optional: an action in history/
  card: note_milestone_card          # optional: an action in history/
```

The check refuses: a page's `compare` wider than the passport's; `bars`, `milestones` or `card` naming no `history/<name>_action.py` of the plugin (the name without `_action`, as Maxitor's list sources are named).

## The context every question carries

`organization` (from the address), the node, the page's address parameters, `from_at`, `to_at` (moments), `width` (a bar's width in seconds).

## Answers (`history-1.schema.json`)

- **Bars** — the reading action with `from_at`, `to_at`, `width`: `{"bars": [{"start", "added", "changed", "removed"}]}`; only bars with a change are listed.
- **Milestones** — `{"milestones": [{"id", "at", "kind", "ref", "title", "minor", "release", "link"}]}` in time order; a `proposal` last.
- **Card** — `{"id", "at", "kind", "ref", "title", "minor", "release", "link", "author_id", "author_name", "summary": {"added", "changed", "removed"}, "chips": [..], "comment"}`.

A moment is `YYYY-MM-DDTHH:MM:SS.ffffffZ`. A moment or `to_at` later than the watermark: `to_at` is cut to it; an `at` is refused (422).

## The template's routes (under `/p/notes/api/{organization}`)

| Method | Path | Action |
|---|---|---|
| GET | `/items/{item_id}/notes` (+ `at`, `author`, or `from_at`, `to_at`, `width`) | `ListItemNotesAction` |
| PATCH | `/notes/{note_id}` `{body, base_moment}` | `EditNoteAction` |
| DELETE | `/notes/{note_id}?base_moment=` | `DeleteNoteAction` |
| POST | `/items/{item_id}/revisions` `{title, comment, release?}` | `PublishNotesAction` |
| GET | `/items/{item_id}/published` (+ `at`) | `ListPublishedNotesAction` |
| GET | `/items/{item_id}/draft` (+ `at`) | `ListNoteDraftAction` |
| GET | `/history/list_note_history` (`item_id`, `from_at`, `to_at`) | `ListNoteHistoryAction` |
| GET | `/history/note_milestone_card` (`item_id`, `id`, `at`) | `NoteMilestoneCardAction` |
