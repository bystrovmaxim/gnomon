// src/lib/dotWrap.ts
/**
 * Dot puts every part of a drawing that no line joins to another on the same ranks, so a model of many unlinked
 * tables or frames is drawn as one column — a thread twenty times taller than wide. This wraps those parts into
 * columns, the drawing about as wide as it is tall (spec 071): an invisible point per column, every part of the
 * column after it, and every part of the column before it before it. A part's own layout does not change; only where
 * the parts stand.
 *
 * Like ``buildDotSource`` it imports no value, so the drawing checks run it in plain Node.
 */

/** One part of a drawing: the DOT names of its nodes, and how big it is, in tables. */
export type DotPart = { nodes: readonly string[]; weight: number };

/**
 * The parts of a drawing: its nodes joined by ``links`` and by ``together`` (the members of a frame or of a block are
 * one part whatever their lines), in the order their first node comes in ``nodes``.
 */
export function dotParts(nodes: readonly string[], links: ReadonlyArray<readonly [string, string]>, together: ReadonlyArray<readonly string[]>, weightOf: (node: string) => number = () => 1): DotPart[] {
  const parent = new Map(nodes.map((node) => [node, node]));
  const find = (node: string): string => {
    let at = node;
    while (parent.get(at) !== at) at = parent.get(at)!;
    parent.set(node, at);
    return at;
  };
  const join = (one: string, other: string) => {
    if (!parent.has(one) || !parent.has(other)) return;
    const [a, b] = [find(one), find(other)];
    if (a !== b) parent.set(b, a);
  };
  for (const [one, other] of links) join(one, other);
  for (const members of together) for (let i = 1; i < members.length; i += 1) join(members[0]!, members[i]!);
  const parts = new Map<string, string[]>();
  for (const node of nodes) {
    const root = find(node);
    if (!parts.has(root)) parts.set(root, []);
    parts.get(root)!.push(node);
  }
  return [...parts.values()].map((members) => ({ nodes: members, weight: members.reduce((sum, node) => sum + weightOf(node), 0) }));
}

/**
 * How many parts of one table a column holds per table of the drawing's side, for the drawing to come out square: a
 * table laid out left to right takes about 316 points across (its 210 and the space between ranks) and 118 down (its
 * height and the space between nodes), so a column holds √(316/118) ≈ 1.6 times the side; top to bottom the column is a
 * row and holds √(118/316) ≈ 0.6 of it.
 */
export const COLUMN_STRETCH = { LR: 1.64, TB: 0.61 } as const;

/**
 * The DOT lines that wrap ``parts`` into columns, or none when one column is already about square. A part's length
 * along the column is taken as the square root of its weight, as a frame of n tables is laid out about √n tables high;
 * a column takes parts in order until it holds ``stretch`` times the side of the whole drawing.
 */
export function wrapParts(parts: readonly DotPart[], links: ReadonlyArray<readonly [string, string]>, within?: { clusters: readonly string[]; prefix: string }, stretch = 1): string[] {
  if (parts.length < 3) return [];
  const heights = parts.map((part) => Math.sqrt(Math.max(part.weight, 1)));
  const side = Math.sqrt(parts.reduce((sum, part) => sum + Math.max(part.weight, 1), 0)) * stretch;
  const columns: DotPart[][] = [[]];
  let filled = 0;
  parts.forEach((part, at) => {
    if (filled > 0 && filled + heights[at]! > side) {
      columns.push([]);
      filled = 0;
    }
    columns.at(-1)!.push(part);
    filled += heights[at]!;
  });
  if (columns.length < 2) return [];
  // The first nodes of a part are those no line of it enters; its last, those no line of it leaves.
  const enters = new Set(links.map(([, to]) => to));
  const leaves = new Set(links.map(([from]) => from));
  const lines: string[] = [];
  const point = '[shape=point style=invis width=0 height=0 label=""]';
  // A part all of whose nodes lie on a cycle has neither: its first node stands for it.
  const lasts = (part: DotPart) => (part.nodes.some((node) => !leaves.has(node)) ? part.nodes.filter((node) => !leaves.has(node)) : part.nodes.slice(0, 1));
  const firsts = (part: DotPart) => (part.nodes.some((node) => !enters.has(node)) ? part.nodes.filter((node) => !enters.has(node)) : part.nodes.slice(0, 1));
  columns.forEach((column, at) => {
    if (at === 0) return;
    // Inside a frame the point is the frame's own — the cluster is opened again to hold it —, so it does not pull the
    // frame's tables out of it.
    const marker = `__column_${within?.prefix ?? ""}${at}`;
    // The frame is reopened along its whole path from the root: a subgraph is found by its name within its parent.
    const open = (within?.clusters ?? []).map((cluster) => `subgraph "${cluster}" { `).join("");
    const close = (within?.clusters ?? []).map(() => " }").join("");
    lines.push(`  ${open}"${marker}" ${point};${close}`);
    for (const part of columns[at - 1]!) for (const node of lasts(part)) lines.push(`  "${node}" -> "${marker}" [style=invis weight=0 minlen=0];`);
    for (const part of column) for (const node of firsts(part)) lines.push(`  "${marker}" -> "${node}" [style=invis weight=0];`);
  });
  return lines;
}
