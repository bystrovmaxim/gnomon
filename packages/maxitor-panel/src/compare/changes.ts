// @maxitor/panel — what a comparison steps through (spec 079, FR-025, FR-026), as the graph viewer's lib/changeStepping.ts
// and lib/mapDiff.ts: the changes in the page's order, each group's name above its changes, and one step round the end.
// Pure functions, checked without a browser.

/** What happened to an element between A and B. */
export type Change = "added" | "changed" | "removed";

/** The sign of each change, as the graph's ERD writes it in a list and on a disk. */
export const CHANGE_SIGN: Record<Change | "unchanged", string> = { added: "+", changed: "~", removed: "−", unchanged: "=" };

/** One change the stepper steps to: its anchor, its title, a short detail, what happened, and its group. */
export type ChangeEntry = { key: string; title: string; detail?: string; status: Change; group: string };

/** One row of the stepper's list: a group's name, or a change at its place in the steps. */
export type ChangeLine = { group: string } | { entry: ChangeEntry; position: number };

/** The list's rows: each group's name above its changes, in the order of the steps. */
export function changeLines(entries: readonly ChangeEntry[]): ChangeLine[] {
  const lines: ChangeLine[] = [];
  entries.forEach((entry, position) => {
    if (position === 0 || entries[position - 1].group !== entry.group) lines.push({ group: entry.group });
    lines.push({ entry, position });
  });
  return lines;
}

/** The next change from a position, round the end; from none, the first forwards and the last backwards. */
export function nextChange(position: number | null, by: -1 | 1, total: number): number {
  return ((position ?? (by > 0 ? -1 : 0)) + by + total) % total;
}

/** What the stepper's middle says: how many changes, or where one stands among them. */
export function stepperText(position: number | null, total: number, compact = false): string {
  if (position === null) return `${total} ${total === 1 ? "change" : "changes"}`;
  return compact ? `${position + 1}/${total}` : `${position + 1} of ${total}`;
}

/** The counts of a comparison's changes, for the pill. */
export function countsOf(entries: readonly { status: Change }[]): { added: number; removed: number; changed: number } {
  return {
    added: entries.filter((entry) => entry.status === "added").length,
    removed: entries.filter((entry) => entry.status === "removed").length,
    changed: entries.filter((entry) => entry.status === "changed").length,
  };
}
