# 11. Comparing

**Builds on**: [10. History on the scale](10-history-on-the-scale.md). **Next**: chapter 12, written with bystrovmaxim/gnomon#76.

The card's mode switch compares two moments: **Diff** draws B with what changed since A marked on it, **Side by side** draws A and B in two panels. The passport says which comparisons the plugin's pages may draw, and a page may narrow the list:

<!-- quote: packages/maxitor-plugin-template/src/maxitor_notes/maxitor-plugin.yaml -->
```yaml
history:
  compare: [diff, side_by_side]
```

Neither page narrows the list: Draft too offers Diff and Side by side — its two panels show the person's draft at A and at B. On Draft a note the other moment lacks wears its own state through `arrival` — a changed note glows amber, not green.

## The page draws one canvas from its context

The core lays the panels out and tells each page its context with `panel.location`: in Diff `at` is B and `against` is A; in Side by side panel A gets `at` A and `against` B with `side` `a`, panel B the other way round. A page reads it with `useMoment()` and never knows how many panels there are:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/items/[item_id]/published/PublishedView.tsx -->
```tsx
  const { side } = useMoment();
```

Published's server part reads the notes at both moments; the page compares them by note:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/notes/compare.ts -->
```ts
  const status = new Map<string, NoteChange>();
  if (other === null) return { status, ghosts: [], steps: [] };
  const before = new Map(other.map((note) => [note.id, note]));
  for (const note of shown) {
    const was = before.get(note.id);
    // A note the other moment lacks is added — removed on A's side —, unless the page says what its arrival is.
    status.set(note.id, !was ? (arrival?.(note) ?? (side === "a" ? "removed" : "added")) : was.body !== note.body ? "changed" : "unchanged");
  }
  const ghosts = side === null ? other.filter((note) => !status.has(note.id)) : [];
```

Each card carries `data-change` and `data-room-anchor="note:<id>"`. `@maxitor/panel` draws the rest as the graph's ERD does: the change's colour on the card's frame and a soft halo under it, and, while the filter's Changes paints, everything unchanged faded.

## The stepper, the card and the counts

`ChangeStepper` walks the changes — Shift + ↑ ↓ from anywhere, the core passing them on as `panel.step` —, `DiffCard` shows what changed in the one it stands on, and `useCounts` sends the pill its "+2 −1 ~1":

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/items/[item_id]/published/PublishedView.tsx -->
```tsx
  useCounts(other !== null && side !== "a" ? countsOf(compared.steps) : null);
```

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/items/[item_id]/published/PublishedView.tsx -->
```tsx
      stepper={other !== null ? <ChangeStepper entries={compared.steps} position={position} onGo={setPosition} /> : undefined}
```

The shell puts the stepper first in the panel's corner; the page's actions are gone in a comparison, since nothing is written there.

## Following one note through both panels

In Side by side, B's head has **Track**. What the pointer is on in one panel is lit in the other; what is chosen in one is brought into the other's view. The core finds it by its anchor: a note is `note:<id>` in both. A panel that cannot show it says why — "Not in A", or "Hidden by the filters". The page writes nothing for this: the canvas of `@maxitor/panel` answers by the anchors it draws.

## Check it

On Published choose Diff with A before the last publication: the notes it changed glow amber, the new ones green, the removed ones stand faint and red, the rest is faded, and the pill counts them. Press Shift + ↓: the stepper stands on the first change and its card opens. Choose Side by side: point at a note in B that A did not have — A says "Not in A".
