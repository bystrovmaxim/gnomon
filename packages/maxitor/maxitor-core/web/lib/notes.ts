// packages/maxitor/maxitor-core/web/lib/notes.ts
// What a panel of Side by side says when it cannot show what the other panel points at (spec 079, FR-023;
// contracts/panel-protocol-time.md): from the page's panel.shown, a note of the core's own words.

/** What a page did with panel.mark or panel.bring. */
export type Shown = { chain: string[]; anchor: string | null; held: boolean; hidden: boolean; brought: boolean };

/** A note: an element's name, set apart, and the words after it; or the words alone. */
export type Note = { name: string | null; text: string; brief: boolean };

/** The part of an anchor after its kind: "field:Account.email" → "Account.email". */
export function anchorRest(anchor: string): string {
  const colon = anchor.indexOf(":");
  return colon < 0 ? anchor : anchor.slice(colon + 1);
}

/** An anchor's own name: the last part of its rest — "field:Account.email" → "email". */
export function anchorName(anchor: string): string {
  return anchorRest(anchor).split(".").pop() ?? anchor;
}

/**
 * The note a panel shows, null for none: an element it holds and shows says nothing; one it brought says so for a
 * moment (`brief`); one it holds only a parent of names the missing element and the parent shown; one its filters
 * hide says so; one it does not hold at all is not in it.
 */
export function noteOf(shown: Shown, panel: "A" | "B"): Note | null {
  if (shown.anchor === null) return shown.hidden ? { name: null, text: "Hidden by the filters", brief: false } : { name: null, text: `Not in ${panel}`, brief: false };
  if (!shown.held) return { name: anchorName(shown.chain[0]), text: `is not in ${panel} · showing ${anchorRest(shown.anchor)}`, brief: false };
  if (shown.brought) return { name: null, text: "Brought to the centre", brief: true };
  return null;
}
