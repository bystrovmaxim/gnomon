// src/lib/erdLeaving.ts
/**
 * A fold or a filter change shown on the drawing at once (spec 071, SC-007; #85). The new picture is laid out off the
 * page; meanwhile every table and box the new picture no longer holds, and every line with an end among them, leaves
 * the drawing on the page. What the new picture adds comes with it.
 */

/** The ids of every table and box the DOT ``dot`` declares. */
export function nodesOfDot(dot: string): Set<string> {
  const nodes = new Set<string>();
  for (const match of dot.matchAll(/^ {2,}"((?:[^"\\]|\\.)*)" \[/gm)) nodes.add(match[1]!.replace(/\\(.)/g, "$1"));
  return nodes;
}

/** Hide each table, box and line of ``svg`` that ``staying`` does not hold; returns how many left. */
export function hideWhatLeaves(svg: Element, staying: ReadonlySet<string>): number {
  let left = 0;
  const hide = (element: Element) => {
    if ((element as SVGElement).style.display === "none") return;
    (element as SVGElement).style.display = "none";
    left += 1;
  };
  for (const node of svg.querySelectorAll("g.node")) {
    const id = node.querySelector(":scope > title")?.textContent?.trim() ?? "";
    if (id && !staying.has(id)) hide(node);
  }
  for (const edge of svg.querySelectorAll("g.edge")) {
    const ends = (edge.querySelector(":scope > title")?.textContent ?? "").split("->");
    if (ends.length === 2 && ends.some((end) => !staying.has(end.trim()))) hide(edge);
  }
  return left;
}

/**
 * The folded box of ``svg`` that holds one of ``owners`` — the tables a change belongs to — by ``holder`` (a table's id to
 * the frame folded over it): what a step to a change inside a folded frame lights and centres (#89).
 */
export function foldedBoxOf(svg: ParentNode, holder: ReadonlyMap<string, string>, owners: readonly string[]): SVGElement | null {
  for (const owner of owners) {
    const box = holder.get(owner);
    if (!box) continue;
    const node = [...svg.querySelectorAll<SVGElement>("g.node")].find((each) => each.querySelector(":scope > title")?.textContent?.trim() === box);
    if (node) return node;
  }
  return null;
}
