// @maxitor/panel — a list's geometry on the canvas (spec 081, FR-001 – FR-003): a card at full length, its head and
// its rows at fixed heights in canvas units. Pure functions, so which rows are drawn and where the head sticks are
// checked without a browser.
import type { Bounds, Camera } from "../canvas/camera";

/** The list's card width, its head (its name and counts, then the column names) and one row, in canvas units. */
export const LIST_WIDTH = 820;
export const LIST_HEAD = 72;
export const LIST_ROW = 36;
/** Rows drawn beyond each edge of the view, so a quick move shows no gap. */
export const OVERSCAN = 8;

/** The card's height: the head and every row, or one row for the note that nothing passes. */
export function listHeight(rows: number): number {
  return LIST_HEAD + Math.max(1, rows) * LIST_ROW;
}

/** The part of the canvas the view shows, in canvas units. */
export function viewOf(camera: Camera, viewport: { width: number; height: number }): Bounds {
  return { x: -camera.x / camera.zoom, y: -camera.y / camera.zoom, width: viewport.width / camera.zoom, height: viewport.height / camera.zoom };
}

/** The rows to draw — from the first to the one before ``end`` — for a list at ``top`` seen through ``view``. */
export function rowsInView(rows: number, top: number, view: Bounds, overscan = OVERSCAN): { start: number; end: number } {
  const first = Math.floor((view.y - top - LIST_HEAD) / LIST_ROW) - overscan;
  const last = Math.ceil((view.y + view.height - top - LIST_HEAD) / LIST_ROW) + overscan;
  return { start: Math.max(0, Math.min(rows, first)), end: Math.max(0, Math.min(rows, last)) };
}

/** Where the head stands inside the card: at its top, or stuck to the top of the view while the rows go up under it. */
export function headOffset(rows: number, top: number, view: Bounds): number {
  return Math.max(0, Math.min(view.y - top, listHeight(rows) - LIST_HEAD));
}

/** Where a row lies on the canvas, for a list at ``left``, ``top``. */
export function rowBounds(index: number, left: number, top: number, width = LIST_WIDTH): Bounds {
  return { x: left, y: top + LIST_HEAD + index * LIST_ROW, width, height: LIST_ROW };
}

/** A person's initials for the disk of a person's cell: "Anna Volkova" → "AV". */
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
}
