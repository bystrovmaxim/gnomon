# 10. History on the scale

**Builds on**: [9. Now and the past](09-now-and-the-past.md). **Next**: [11. Comparing](11-comparing.md).

The core has one time control for every page: the pill on the right of the top row, and the card hanging from it with the time scale. The scale draws the history of the open page — bars of its changes, points of its milestones — from what the page tells it. In this chapter Published tells it.

## The page sets the scale up

A page gives its history to `PanelPage` in its code. The template keeps it in one file:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/notes/history.ts -->
```ts
export const NOTE_KINDS: Record<string, Kind> = {
  published: { tone: "purple", look: "filled", lead: "solid", term: "Published", def: "The notes as they were published, in force until the next publication." },
  rollback: {
    tone: "red",
    look: "filled",
    lead: "solid",
    term: "Rolled back",
    def: "A publication that brought back the notes of an earlier one; everything published between them stays in the history.",
  },
};

/** Published on the scale: the bars of its notes' changes, its publications as points with their cards, and Roll back
    offered exactly on a past publication. */
export const PUBLISHED_HISTORY: PageHistory = {
  read: "list_published_notes",
  milestones: "list_note_history",
  card: "note_milestone_card",
  kinds: NOTE_KINDS,
  actions: [{ on: "milestone", kinds: ["published", "rollback"], title: "Roll back to {ref}", action: "rollback_publication", ask: true }],
};
```

- `read` is the page's reading action. Asked over a stretch with a bar's width, it answers bars: what was added, changed and removed in each stretch.
- `milestones` and `card` are the points on the lane above the bars and the card a point shows on hover.
- `kinds` is the page's vocabulary of points: each has a tone of the core's palette, a look, the line leading to it, and the words the legend behind the "i" says of it. The template has two kinds and promises nothing more: no `small`, no `flag`. So its points are one size, they carry no flags, and the legend speaks of Published and Rolled back alone.
- `actions` offers an action on a milestone: "Roll back to v3" stands in the page's corner exactly when the moment is v3, and never in a comparison.

The core checks every name against the plugin's actions and every kind against its own words. A milestone of a kind the page did not declare, a small point without `small`, a flag without `flag` — each is left out and named in the browser's console; the rest of the scale is drawn.

## Where the core asks

The core calls each action at `history/<action>` of the plugin's API, through the gateway, with the open node's path parameters (`item_id`) and the page's own address parameters. A page's reading action is mounted there as well:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/app.py -->
```py
    adapter.get(f"{prefix}/history/list_note_history", ListNoteHistoryAction, connections=connections)
    adapter.get(f"{prefix}/history/note_milestone_card", NoteMilestoneCardAction, connections=connections)
    # The core's time scale asks every action a page's history names at history/<action>: the pages' reading actions
    # answer their bars there, over a stretch.
    adapter.get(f"{prefix}/history/list_published_notes", ListPublishedNotesAction, connections=connections)
    adapter.get(f"{prefix}/history/list_note_draft", ListNoteDraftAction, connections=connections)
```

Over a stretch the reading action runs its own query with the SDK's stretch condition and lets `bars_of` count what the versions say:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/actions/list_published_notes_action.py -->
```py
        if params.from_at is not None and params.to_at is not None and params.width is not None:
            # The core's time scale asks for bars: the published notes' versions over the stretch, by what they say.
            end, versions = await storage.note_versions_between(organization_id, params.item_id, params.from_at, params.to_at, None)
            bars = bars_of(versions, params.from_at, end, params.width) if params.from_at < end else []
            return ListPublishedNotesResult(bars=[BarCoreEntity(start=bar.start, added=bar.added, changed=bar.changed, removed=bar.removed) for bar in bars])
```

## A card is blocks of data

A point's card is the plugin's list of blocks — a first line with a badge, a title, a person, chips —, drawn by the core from data alone; no code of the plugin runs in the core's frame:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/history/note_milestone_card_action.py -->
```py
def card_blocks(card: MilestoneCardCoreEntity) -> list[dict[str, Any]]:
    """A publication's card as the core draws it: a purple Published badge or a red Rolled back one, then the rest."""
    badge = {"icon": "undo", "label": "Rolled back", "tone": "red"} if card.kind == "rollback" else {"icon": "tag", "label": "Published", "tone": "purple"}
    blocks: list[dict[str, Any]] = [{"line": [{"badge": badge}, {"ref": card.ref}, {"ago": card.at}]}, {"title": card.title}]
    if card.kind == "rollback" and card.back is not None:
        blocks.append({"text": f"to v{card.back} · everything published after it stays in the history"})
    if card.author_id and card.author_name:
        blocks.append({"person": {"id": card.author_id, "name": card.author_name}})
    chips: list[dict[str, Any]] = [{"chip": f"{card.notes} {'note' if card.notes == 1 else 'notes'}"}, {"text": summary_text(card.summary)}]
    if card.release:
        chips.append({"release": card.release})
    blocks.append({"chips": chips})
    return blocks
```

The shapes are `maxitor-plugin-sdk`'s `history-2.schema.json`; [the history of a page](../history.md) lists every field.

## Roll back is a publication

Rolling back never erases. `RollbackPublicationAction` publishes the notes of a past revision again as the next one, and names the revision it brought back; the revisions between stay in the history and on the scale:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/actions/rollback_publication_action.py -->
```py
        number, changed_at = await storage.rollback_publication(
            organization_id=organization_id,
            item_id=params.item_id,
            to_revision=params.to_revision,
            title=params.title,
            comment=params.comment,
            publisher_id=person_id,
            operation=type(self).__name__,
        )
        return RollbackPublicationResult(number=number, back=params.to_revision, changed_at=changed_at)
```

Its milestone is of the kind `rollback`, a red point; its card says which revision it brought back.

## Check it

Publish twice, open Published and the pill: two purple points, the bars of what each publication changed, and the comment of the one in force under the scale. Click v1: the page shows v1's notes, read only, and "Roll back to v1" stands in its corner. Roll back: the screen returns to now, and a red v3 stands after v1 and v2. Click between two points: the page shows that moment, and no Roll back is offered.
