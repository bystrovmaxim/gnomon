// @maxitor/panel — where a change's card stands while the stepper is on an element, as the graph viewer places it
// (maxitor-web lib/cardPlace.ts cardBeside): right of the element, else left of it, else under it; level with its top
// and always inside the panel.

/** A rectangle in the window's pixels. */
export type Box = { left: number; top: number; right: number; bottom: number };

/** The gap between the card and what it describes, and between the card and the panel's edge. */
const GAP = 8;

/** The card's top-left corner in the panel's pixels, for a card `width` by `height` beside `element`. */
export function besideBox(panel: Box, element: Box, width: number, height: number): { x: number; y: number } {
  const room = { width: panel.right - panel.left, height: panel.bottom - panel.top };
  const right = element.right - panel.left + GAP;
  const left = element.left - panel.left - GAP - width;
  const level = Math.max(GAP, Math.min(element.top - panel.top, room.height - height - GAP));
  if (right + width <= room.width - GAP) return { x: right, y: level };
  if (left >= GAP) return { x: left, y: level };
  const x = Math.max(GAP, Math.min(element.left - panel.left, room.width - width - GAP));
  return { x, y: Math.max(GAP, Math.min(element.bottom - panel.top + GAP, room.height - height - GAP)) };
}
