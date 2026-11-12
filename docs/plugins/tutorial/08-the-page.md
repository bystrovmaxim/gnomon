# 8. The page

**Builds on**: [7. A place in the tree](07-a-place-in-the-tree.md). **Next**: [9. Now and the past](09-now-and-the-past.md).

Your page is a Next.js application under `/p/<name>`, shown in Maxitor's right panel. It draws with `@maxitor/panel`: the shell `PanelPage` draws its controls, and everything the page shows lies on the canvas — cards, a table, a revision — and moves and zooms with it. Nothing of a page is pinned to the screen.

## Read on the server, draw on the canvas

The notes page reads its notes and its authors on the server, from its own backend, with the token Maxitor's gateway put on the request, and hands them to a client component that draws the shell and the canvas:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/items/[item_id]/page.tsx -->
```tsx
  // The page's shell, its canvas, its writing and its reading again when "now" moved are drawn by NotesView.
  return <NotesView org={org} itemId={item_id} notes={notes} filters={filters} bar={bar} />;
```

The cards lie in a grid on `MaxitorCanvas`; the table is `DataTable`, which lies whole on the canvas with its head sticking. Each note carries its anchor by identity, `note:<id>`, so a pointer lands on the same note on every screen.

## Write in a dialog, edit in the card

"New note" is the page's action at the top right, shown only at now. It opens a `Dialog` of `@maxitor/panel` — a page places nothing fixed of its own, so dialogs are the shell's; on a phone it is a sheet from below. The note written stands first among the cards.

A card edits its note in place and sends the moment its version began, `since`, as `base_moment`. When a colleague changed or deleted the note meanwhile, the backend refuses with `changed_since` or `deleted`, and the card says so in words while keeping the person's text; saving again replaces the new version. Deleting asks once. Every refusal of the template's actions has its words:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/notes/notes.ts -->
```ts
    case "nothing_to_publish":
      return `Nothing changed since revision ${Number(refusal.revision ?? 0) || "—"}: there is nothing to publish.`;
```

## Published notes and Draft

Published notes shows the revision in force — its number, title, comment and release — and its notes, as cards or a table. Draft shows a card per change since that revision, with who and when; at now "Publish" opens a dialog with a title, a comment and an optional release.

## Check it

1. On the local stand open an item's Notes: the notes lie on the canvas beside the filters; drag them, zoom with the bar.
2. New note → write → Write: the note stands first. Edit it, and before saving change it from another tab: the card says who changed it and keeps your text; Save again.
3. Delete a note: the card asks once.
4. Draft → Publish → a title and a comment → Publish; Published notes shows `v1` with your title.
