# 8. The page

**Builds on**: [7. A place in the tree](07-a-place-in-the-tree.md). **Next**: [9. Now and the past](09-now-and-the-past.md).

Your page is a Next.js application under `/p/<name>`, shown in Maxitor's right panel. It draws with `@maxitor/panel`: the shell `PanelPage` draws its controls, and everything the page shows lies on the canvas — cards, a table, a revision — and moves and zooms with it. Nothing of a page is pinned to the screen.

## Two pages, one published state, a draft each

An item has two pages. **Published** is everyone's notes as the revision in force holds them: read only, with the Authors filter. **Draft** is the page of the person who reads it: their own changes over those published notes, and nobody else's. No edit writes the published notes; the only write that reaches them is publishing a revision.

The Draft page reads its own draft and, for an Edit opened from Published, the published notes too — in Diff the draft at the other moment as well (chapter 11) —; the server part hands them to a client component:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/items/[item_id]/page.tsx -->
```tsx
  return (
    <DraftView
      org={org}
      itemId={item_id}
      revision={draft?.revision ?? null}
      changes={draft?.changes ?? []}
      published={published?.notes ?? []}
      publishedRevision={published?.revision ?? null}
      other={against ? (other?.changes ?? []) : null}
    />
  );
```

A change carries its state — **New**, **Changed** or **Deleted** — the published text it was made over and the revision number of that text. A changed note shows the words that went and the words that came inside one text: one component draws that marking, so the card, both sides of a conflict and the revert dialog read alike:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/notes/marking.tsx -->
```tsx
        part.added ? (
          <ins key={index} className="nt-came">
            {part.value}
          </ins>
        ) : part.removed ? (
          <del key={index} className="nt-went">
            {part.value}
          </del>
        ) : (
          <span key={index}>{part.value}</span>
        ),
```

## The shell, the filter and the reverts

The Draft page gives the shell one filter, **State**: New, Changed and Deleted, each with a sign and a colour, a state with no change behind it faint. The page's actions are **New note** and **Publish**, at the top right, shown only at now; on a phone they stand above the bottom bar and a card's tools are a sheet behind "⋯".

New note opens the shell's `Dialog` — a sheet on a phone — and the note enters the draft as new. A card's Edit saves through the template's `EditNoteAction` with the base the change was made over; Revert asks once and gives the change up: a new note is removed, a changed or deleted note leaves the draft and the published note stays as it is. Every refusal of the template's actions has its words:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/notes/notes.ts -->
```ts
    case "nothing_to_publish":
      return `Nothing changed since revision ${Number(refusal.revision ?? 0) || "—"}: there is nothing to publish.`;
```

## Publishing, and its conflicts

Publish takes the whole draft as one revision with a title, a comment and an optional release — never one note at a time. Every change remembers the published version it was made over; publishing compares that base with the note as published now, by value:

- the published note still reads as the base: the change goes in as it is;
- it reads otherwise, or is deleted: the change is a **conflict**, and nothing is published until the person chooses for each one to **overwrite** what is published with their own text or **give up** their change;
- the person's own text has come to be the published text: the change leaves the draft without a question.

The draft already knows its conflicts: a notice stands above the cards, with a link to Published, and every card that meets someone else's publication is marked. The publishing dialog opens with them listed, then the changes that go in as they are; the server finds the conflicts again when the draft is published, so one that came meanwhile is asked too. The dialog shows each conflict as two sides — *Yours* and the other person's, each with its words marked, who changed or deleted the note and when — and its two choices; Publish stays off until every conflict has one. A change given up is gone from the draft; an overwrite of a note someone deleted restores it with the person's text, and an overwrite of a note someone changed while the person deleted it publishes the deletion.

Published then shows the new revision and marks every note waiting in the person's draft — "In your draft: changed" or "deleted" — with the count of what waits; Edit on a note opens Draft with its editor already open, and nothing is written until it is saved.

## Check it

1. On the local stand open an item's Draft: a note written through the gateway waits there, marked New and seen by you alone; Published shows nothing of it.
2. Edit the note, save, then revert it: the card asks once and the note leaves the draft.
3. Publish a change with a title and a comment: Published shows `v1`; the draft is empty.
4. Open Published and press Edit on a note: Draft opens with the editor; Cancel writes nothing, Save puts the change in the draft.
5. Press Delete on a published note: Published marks it "In your draft: deleted", and the draft card's Revert puts it back as it was.
