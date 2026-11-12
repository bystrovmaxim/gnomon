// @maxitor/panel — anchors (spec 079, FR-021 – FR-024): every element a page draws on the canvas may carry an anchor,
// `data-room-anchor`, nested as the elements are — a field inside a table, a row inside a list. The chain under the
// pointer is the anchors from the deepest element out; another panel shows the deepest anchor of a chain it holds.
// Pure functions, so what is held, what is in view and what a panel says are checked without a browser.

import type { Bounds } from "./camera";

/** The attribute an element's anchor is written in. */
export const ANCHOR_ATTRIBUTE = "data-room-anchor";

type Node = { getAttribute(name: string): string | null; parentElement: Node | null } | null;

/**
 * The anchor chain from an element out to the canvas, the deepest first; empty when the element carries none. The
 * protocol's limits — how many anchors, how long each — are the caller's: an anchor longer than allowed is skipped.
 */
export function chainOf(element: Node, limits: { chain: number; anchor: number }): string[] {
  const chain: string[] = [];
  for (let node = element; node && chain.length < limits.chain; node = node.parentElement) {
    const anchor = node.getAttribute(ANCHOR_ATTRIBUTE);
    if (anchor && anchor.length <= limits.anchor && !chain.includes(anchor)) chain.push(anchor);
  }
  return chain;
}

/** The deepest anchor of a chain the page holds, and whether it is the deepest of the chain itself. */
export function deepestHeld(chain: readonly string[], holds: (anchor: string) => boolean): { anchor: string | null; deepest: boolean } {
  const index = chain.findIndex(holds);
  return index < 0 ? { anchor: null, deepest: false } : { anchor: chain[index], deepest: index === 0 };
}

/** Whether bounds lie wholly inside the view, both in canvas units. */
export function inView(bounds: Bounds, view: Bounds): boolean {
  return bounds.x >= view.x && bounds.y >= view.y && bounds.x + bounds.width <= view.x + view.width && bounds.y + bounds.height <= view.y + view.height;
}

/** Whether two chains name the same anchors in the same order. */
export function sameChain(a: readonly string[] | null, b: readonly string[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((anchor, index) => anchor === b[index]);
}
