// packages/maxitor/maxitor-core/web/lib/levels.ts
// The levels of the left panel (spec 085): what an address gives it, and what Back and a crumb step out of. It holds
// no framework and no address, so the rule can be run and proved on its own.

/** A node as far as a level cares: its name, the node it stands under, and the way it opens. */
export type Openable = { name: string; parent: string; opens: "expand" | "enter" };

/** The line from the root to a node, the node last. A node whose parent is unknown ends the line. */
export function lineOf<T extends Openable>(nodes: T[], node: T): T[] {
  const byName = new Map(nodes.map((each) => [each.name, each]));
  const line: T[] = [node];
  let parent = byName.get(node.parent);
  while (parent) {
    line.unshift(parent);
    parent = byName.get(parent.parent);
  }
  return line;
}

/**
 * The entered nodes on a node's line, the deepest last — the levels an address gives the panel (spec 085, FR-013).
 * The node itself is among them when it is entered: opening its own page lands at its level, not above it.
 */
export function enteredInLine<T extends Openable>(nodes: T[], node: T): T[] {
  return lineOf(nodes, node).filter((step) => step.opens === "enter");
}
