// web/app/[org]/notes/notes.ts — what the template's pages decide without a browser: the words of every refusal of
// its actions, which notes are new since the page last read, the order of the cards and where they lie on the canvas.
// Pure functions, tested by web/tests/notes.test.ts.

/** A refusal of one of the template's actions, as its backend answers it: a reason and its details. */
export type Refusal = { error: string; [detail: string]: unknown };

/** The canvas's grid of cards: their width, the gap between them, how many stand in a row, and a row's height. */
export const CARD_WIDTH = 280;
export const CARD_GAP = 16;
export const CARD_COLUMNS = 3;
export const CARD_ROW = 180;

/** A moment as people read it: `12 Nov 2026, 14:05`, in UTC like the address. */
export function when(moment: string | null | undefined): string {
  if (!moment) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [date, time = ""] = moment.split("T");
  const [year, month, day] = date.split("-");
  return `${Number(day)} ${months[Number(month) - 1]} ${year}${time ? `, ${time.slice(0, 5)}` : ""}`;
}

/** The words a page says for a refusal of the template's actions; every reason has its own. */
export function refusalText(refusal: Refusal | null, status = 0): string {
  const name = (key: string) => String(refusal?.[key] ?? "someone");
  switch (refusal?.error) {
    case "changed_since":
      return `${name("changed_by")} changed this note on ${when(String(refusal.changed_at ?? ""))} after you opened it. Your text is kept: save again to replace theirs, or cancel to read their version.`;
    case "deleted":
      return `${name("deleted_by")} deleted this note on ${when(String(refusal.deleted_at ?? ""))}. Your text is kept: copy it into a new note if it still matters.`;
    case "nothing_to_publish":
      return `Nothing changed since revision ${Number(refusal.revision ?? 0) || "—"}: there is nothing to publish.`;
    case "no_such_item":
      return "This item no longer exists.";
    case "no_such_note":
      return "This note no longer exists.";
    case "moment_not_come":
      return "That moment has not come yet: the page reads now.";
    case "title_taken":
      return `The title “${String(refusal.title ?? "")}” is taken by another item.`;
    case "forbidden":
      return "You may not do this here.";
    case "not_found":
      return "Not found: you may no longer belong to this organization.";
    default:
      return status >= 500 || status === 0 ? "The notes could not be reached. Try again in a moment." : "This could not be done.";
  }
}

/** The notes the page did not hold before it read again: a colleague's note, marked new. The first reading marks none. */
export function newSince(known: ReadonlySet<string> | null, ids: readonly string[]): Set<string> {
  if (known === null) return new Set();
  return new Set(ids.filter((id) => !known.has(id)));
}

/** The cards' order: the note changed last first, so a note just written stands first. */
export function latestFirst<Note extends { updated_at: string }>(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0));
}

/** The part of the canvas the cards take: the grid's width and its rows' height. */
export function cardsBounds(count: number): { x: number; y: number; width: number; height: number } {
  const rows = Math.max(1, Math.ceil(count / CARD_COLUMNS));
  return { x: 0, y: 0, width: CARD_COLUMNS * CARD_WIDTH + (CARD_COLUMNS - 1) * CARD_GAP, height: rows * CARD_ROW + (rows - 1) * CARD_GAP };
}

/** A revision's line: `v3 · First release · 2026.11`. */
export function revisionLine(revision: { ref: string; title: string; release?: string | null }): string {
  return [revision.ref, revision.title, revision.release].filter(Boolean).join(" · ");
}
