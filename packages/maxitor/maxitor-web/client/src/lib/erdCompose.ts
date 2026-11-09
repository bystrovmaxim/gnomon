// src/lib/erdCompose.ts
/**
 * Frames in the three engines that cannot frame reproducibly (research R2): neato, fdp and circo.
 *
 * Dot lays a frame out as a Graphviz cluster, reliably. Neato and Circo ignore clusters, FDP's are not
 * reproducible, and none of the three can place a node at a fixed position (this WASM build reads no
 * ``pos``). So those three are composed: each frame's tables are laid out alone, which gives the frame's
 * size and the tables' places inside it; then the frames, as fixed-size boxes, and one weighted line per
 * pair of linked frames are laid out with ``overlap=false``. The final drawing keeps every table's card
 * from one full layout — its ids, rows and fills — moved to its frame's place plus its place inside the
 * frame, draws the lines straight between the moved tables, and writes each frame into the SVG as a
 * ``g.cluster`` with the Dot frames' ids, label and rounded outline, so hover, cards, folds and rooms
 * read it exactly as they read a Dot frame.
 *
 * Like ``erdPostPass`` it works on markup and imports no value, so the drawing checks run this very
 * function in plain Node.
 */

// Relative, with its extension: the ERD checks in ``scripts/`` run this module under plain Node, which knows no ``@/``.
import {
  buildBlockMeasureDot,
  buildDotSource,
  CONTOUR_ID_PREFIX,
  DOMAIN_CONTOUR_ID_PREFIX,
  erdBlockWidths,
  erdDomainFrameColour,
  erdGraphvizEngine,
  erdResourceFrameColour,
  foldPlan,
  specializationId,
  frameInk,
  frameTitleLabel,
  FRAME_GREY,
  tableResource,
  type ErdEntity,
  type ErdGraphPayload,
  type ErdGraphvizLayout,
  type ErdGroup,
} from "./buildDotSource.ts";

/**
 * A box in the drawing's units, as Graphviz writes them: ``top`` is the larger y, ``bottom`` the smaller. The SVG's y
 * grows downward, so on screen ``bottom`` is the box's upper edge and ``top`` its lower one.
 */
export type Box = { left: number; right: number; top: number; bottom: number };

const boxW = (box: Box) => box.right - box.left;
const boxH = (box: Box) => box.top - box.bottom;
const boxCx = (box: Box) => (box.left + box.right) / 2;
const boxCy = (box: Box) => (box.top + box.bottom) / 2;

/** A frame the composer draws. */
type Frame = {
  name: string;
  /** The frame's place in its view's order: its disk slot's number, as ``buildDotSource`` numbers it. */
  index: number;
  id: string;
  label: string;
  colour: string;
  resource: string | null;
  members: ErdEntity[];
  groups: ErdGroup[];
  folded: boolean;
  tooltip: string;
};

/** Lays a DOT string out through the chosen engine. */
export type ErdComposeLayout = (dot: string, engine: string) => string;

function escHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escDot(s: string): string {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** All numbers of a path ``d`` or polygon ``points``, in their written order. */
function numbers(source: string): number[] {
  return (source.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/** The box a path ``d`` or polygon ``points`` spans, or ``null``. */
function boxOf(coords: string): Box | null {
  const values = numbers(coords);
  const xs: number[] = [];
  const ys: number[] = [];
  values.forEach((value, i) => (i % 2 === 0 ? xs.push(value) : ys.push(value)));
  if (!xs.length || !ys.length) return null;
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.max(...ys), bottom: Math.min(...ys) };
}

function unionBox(boxes: readonly Box[]): Box | null {
  if (!boxes.length) return null;
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    right: Math.max(...boxes.map((box) => box.right)),
    top: Math.max(...boxes.map((box) => box.top)),
    bottom: Math.min(...boxes.map((box) => box.bottom)),
  };
}

const NODE_START = /<g id="node\d+" class="node"[^>]*>/g;
/** An edge's group: its id, and its classes after ``edge`` (a "same entity" line is ``edge erd-same``). */
const EDGE_START = /<g id="([^"]+)" class="edge([^"]*)">/g;

/** The box of every shape in ``body``, united. */
function bodyBox(body: string): Box | null {
  return unionBox([...body.matchAll(/\b(?:d|points)="([^"]+)"/g)].map((match) => boxOf(match[1]!)).filter((box): box is Box => box !== null));
}

/** Where the ``<g>`` opened at ``start`` closes: the index just past its own ``</g>``, nested groups counted. */
function groupEnd(svg: string, start: number): number {
  const tag = /<(\/?)g\b[^>]*?(\/?)>/g;
  tag.lastIndex = start;
  let depth = 0;
  for (let match = tag.exec(svg); match; match = tag.exec(svg)) {
    if (match[2] === "/") continue;
    depth += match[1] === "/" ? -1 : 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return svg.length;
}

/** The full markup of every node and its box, by its ``<title>`` (the node's id): the node's group and nothing after it. */
function nodeMarkups(svg: string): Map<string, { markup: string; box: Box }> {
  const found = new Map<string, { markup: string; box: Box }>();
  for (const match of svg.matchAll(NODE_START)) {
    const start = match.index ?? 0;
    const markup = svg.slice(start, groupEnd(svg, start));
    const title = /<title>([^<]*)<\/title>/.exec(markup)?.[1];
    if (!title) continue;
    const box = bodyBox(markup);
    if (box) found.set(title, { markup, box });
  }
  return found;
}

/** The box of every node, by its ``<title>`` (the node's id). */
function nodeBoxes(svg: string): Map<string, Box> {
  return new Map([...nodeMarkups(svg)].map(([title, { box }]) => [title, box]));
}

/** Every edge's stroke, dash and classes, by its ``id``: read from its whole group, a tooltip's link inside it too. */
function edgeStyles(svg: string): Map<string, { stroke: string; dash: string | null; classes: string }> {
  const found = new Map<string, { stroke: string; dash: string | null; classes: string }>();
  for (const match of svg.matchAll(EDGE_START)) {
    const id = match[1]!;
    const start = match.index ?? 0;
    const body = svg.slice(start, groupEnd(svg, start));
    const stroke = /<path[^>]*stroke="([^"]+)"/.exec(body)?.[1];
    if (!stroke) continue;
    const dash = /<path[^>]*stroke-dasharray="([^"]+)"/.exec(body)?.[1] ?? null;
    found.set(id, { stroke, dash, classes: match[2]!.replace(/&#45;/g, "-") });
  }
  return found;
}

/** The domain an entity names, or the empty string. */
function domainOf(entity: ErdEntity): string {
  return entity.domain_qualname?.trim() || "";
}

/** The groups whose every table lies in ``members`` and at least one does. */
function groupsIn(members: readonly ErdEntity[], groups: readonly ErdGroup[] | undefined, entities: readonly ErdEntity[]): ErdGroup[] {
  const here = new Set(members.map((entity) => entity.id));
  const known = new Set(entities.map((entity) => entity.id));
  return (groups ?? []).filter((group) => group.members.some((id) => here.has(id)) && group.members.filter((id) => known.has(id)).every((id) => here.has(id)));
}

/** The ordered frames of ``data``, as ``buildDotSource`` frames them. */
function framesOf(data: ErdGraphPayload): Frame[] {
  const entities = data.entities ?? [];
  if (data.model !== "physical" && data.model !== "logical") return [];
  const plan = foldPlan(data);
  if (data.model === "physical") {
    const frames: Frame[] = [];
    const resources = data.resource_ids ?? [];
    resources.forEach((resource, index) => {
      const members = entities.filter((entity) => tableResource(entity) === resource);
      const id = `${CONTOUR_ID_PREFIX}${resource}`;
      frames.push({
        name: `cluster_resource_${index}`,
        index,
        id,
        label: data.resource_labels?.[resource] ?? (resource.split(".").pop() || resource),
        colour: erdResourceFrameColour(resource),
        resource,
        members,
        groups: groupsIn(members, data.groups, entities),
        folded: plan.counts.has(id),
        tooltip: resource,
      });
    });
    const unstored = entities.filter((entity) => tableResource(entity) === null);
    if (unstored.length) {
      frames.push({
        name: `cluster_resource_${resources.length}`,
        index: resources.length,
        id: `cluster_resource_${resources.length}`,
        label: "Not stored",
        colour: FRAME_GREY,
        resource: null,
        members: unstored,
        groups: groupsIn(unstored, data.groups, entities),
        folded: false,
        tooltip: "Entities no resource keeps",
      });
    }
    return frames;
  }
  const quals = [...new Set(entities.map(domainOf))].sort();
  return quals.map((qual, index) => {
    const members = entities.filter((entity) => domainOf(entity) === qual);
    return {
      name: `cluster_domain_${index}`,
      index,
      id: `${DOMAIN_CONTOUR_ID_PREFIX}${qual}`,
      label: data.domain_labels?.[qual] ?? (qual.split(".").pop() || qual),
      colour: erdDomainFrameColour(qual, data.domain_colors),
      resource: null,
      members,
      groups: groupsIn(members, data.groups, entities),
      folded: plan.counts.has(`${DOMAIN_CONTOUR_ID_PREFIX}${qual}`),
      tooltip: qual,
    };
  });
}

/** The padding round a frame's tables, in points, as a Dot frame's ``margin``; the title stands above them. */
const FRAME_PAD = 20;
/** The space between a frame's outline and its title, above and below the title. */
const TITLE_GAP = 8;
/** The padding a specialization block's box keeps round its tables, and the room above them for its label. */
const GROUP_PAD = 12;
const GROUP_LABEL = 14;
/** Extra separation the frame-layout boxes get, so no two composed frames touch after overlap removal. */
const FRAME_LAYOUT_GAP = 64;
/** A frame with no table still stands, this size. */
const EMPTY_WIDTH = 140;
const EMPTY_HEIGHT = 60;
/** The corner radius of a rounded frame, as Graphviz draws it. */
const FRAME_RADIUS = 12;
/** The padding round the whole drawing in the viewBox. */
const VIEW_PAD = 8;

/** The rounded-rectangle path Graphviz writes for a ``style="rounded"`` frame. */
function roundedRectPath(box: Box): string {
  const { left, right, top, bottom } = box;
  const r = FRAME_RADIUS;
  const xr0 = left + r;
  const xr1 = right - r;
  const yr0 = top - r;
  const yr1 = bottom + r;
  const h = r / 2;
  return (
    `M${xr0},${top} ` +
    `C${xr0},${top} ${xr1},${top} ${xr1},${top} ` +
    `${xr1 + h},${top} ${right},${top - h} ${right},${yr0} ` +
    `${right},${yr0} ${right},${yr1} ${right},${yr1} ` +
    `${right},${yr1 - h} ${xr1 + h},${bottom} ${xr1},${bottom} ` +
    `${xr1},${bottom} ${xr0},${bottom} ${xr0},${bottom} ` +
    `${xr0 - h},${bottom} ${left},${yr1 - h} ${left},${yr1} ` +
    `${left},${yr1} ${left},${yr0} ${left},${yr0} ` +
    `${left},${yr0 + h} ${xr0 - h},${top} ${xr0},${top}`
  );
}

/** A frame's title as Graphviz lays it out: its markup, the box it spans, and that box's size. */
type Title = { markup: string; box: Box };

/** The HTML label of a frame's title — the very label a Dot frame carries, so both draw the same disk and name. */
function titleLabel(frame: Frame): string {
  const ink = frameInk(frame.colour);
  if (frame.resource === null && frame.id.startsWith("cluster_")) return `<TABLE BORDER="0" CELLPADDING="0"><TR><TD><FONT POINT-SIZE="15" COLOR="${ink}"><B>${escHtml(frame.label)}</B></FONT></TD></TR></TABLE>`;
  const kind = frame.id.startsWith(DOMAIN_CONTOUR_ID_PREFIX) ? "domain" : "resource";
  return frameTitleLabel({ kind, slot: frame.index, name: frame.label, disk: ink, ink, tooltip: frame.tooltip });
}

/**
 * Every frame's title laid out once, by Graphviz itself: a box node per title, its outline transparent. The composer
 * moves each title onto its frame, so the disk and the name keep the places and sizes Graphviz gives a Dot frame's.
 */
function layOutTitles(frames: readonly Frame[], layoutFn: ErdComposeLayout): Map<string, Title> {
  const lines = ["digraph TITLES {", '  node [shape=box margin=0 color=transparent fontname="Helvetica" fontsize=15];'];
  for (const frame of frames) lines.push(`  "${escDot(frame.name)}" [label=<${titleLabel(frame)}>];`);
  lines.push("}");
  const titles = new Map<string, Title>();
  for (const [name, { markup, box }] of nodeMarkups(layoutFn(lines.join("\n"), "dot"))) {
    // The node's own group, title and transparent outline go; what is left is the title's disk slot and text.
    const inner = markup
      .replace(/^<g id="node\d+" class="node"[^>]*>/, "")
      .replace(/<title>[^<]*<\/title>/, "")
      .replace(/<polygon fill="none" stroke="(?:none|transparent)"[^>]*\/>/, "")
      .replace(/<\/g>\s*$/, "")
      .trim();
    titles.set(name, { markup: inner, box });
  }
  return titles;
}

/** The ``g.cluster`` markup of one frame, as Graphviz writes it, in the drawing's own units: the title centred on top. */
function frameCluster(frame: Frame, box: Box, title: Title | undefined, dashed: boolean): string {
  const dashes = dashed ? ' stroke-dasharray="5,2"' : "";
  const dx = title ? boxCx(box) - boxCx(title.box) : 0;
  const dy = title ? box.bottom + TITLE_GAP - title.box.bottom : 0;
  return (
    `<g id="${escHtml(frame.id)}" class="cluster">` +
    `<title>${escHtml(frame.name)}</title>` +
    `<path fill="none" stroke="${frame.colour}" stroke-width="2"${dashes} d="${roundedRectPath(box)}"/>` +
    (title ? `<g transform="translate(${dx.toFixed(2)},${dy.toFixed(2)})">${title.markup}</g>` : "") +
    `</g>`
  );
}

/**
 * The ``g.cluster`` markup of a specialization block inside a frame, as Dot draws it: dashed, faintly filled outside
 * Diff, its label at its top over the room kept for it.
 */
function groupCluster(id: string, name: string, label: string, box: Box, inDiff: boolean): string {
  return (
    `<g id="${escHtml(id)}" class="cluster">` +
    `<title>${escHtml(name)}</title>` +
    `<path fill="${inDiff ? "none" : "#0f172a0d"}" stroke="${FRAME_GREY}" stroke-width="${inDiff ? 3 : 2}" stroke-dasharray="5,2" d="${roundedRectPath(box)}"/>` +
    `<text xml:space="preserve" text-anchor="middle" x="${boxCx(box).toFixed(2)}" y="${(box.bottom + GROUP_PAD + 4).toFixed(2)}" font-family="Helvetica,sans-Serif" font-size="10.00" fill="#64748b">${escHtml(label)}</text>` +
    `</g>`
  );
}

/** The frame-layout DOT: each frame a fixed-size box, one line per pair of linked frames. */
function frameLayoutDot(frames: readonly Frame[], sizes: ReadonlyMap<string, { width: number; height: number }>, data: ErdGraphPayload): string {
  const home = new Map<string, string>();
  for (const frame of frames) for (const member of frame.members) home.set(member.id, frame.name);
  const pairs = new Set<string>();
  for (const relation of data.relations ?? []) {
    const from = home.get(relation.source);
    const to = home.get(relation.target);
    if (!from || !to || from === to) continue;
    pairs.add([from, to].sort().join("\u0000"));
  }
  const lines = [
    "digraph FRAMES {",
    '  graph [fontname="Helvetica" bgcolor=transparent pad="0.8" overlap=prism sep="+90,+70" start=1];',
    '  node [shape=box fixedsize=true fontname="Helvetica"];',
  ];
  for (const frame of frames) {
    const size = sizes.get(frame.name) ?? { width: EMPTY_WIDTH, height: EMPTY_HEIGHT };
    lines.push(`  "${escDot(frame.name)}" [width="${((size.width + FRAME_LAYOUT_GAP) / 72).toFixed(3)}" height="${((size.height + FRAME_LAYOUT_GAP) / 72).toFixed(3)}" label=""];`);
  }
  for (const pair of pairs) {
    const [from, to] = pair.split("\u0000");
    lines.push(`  "${escDot(from!)}" -> "${escDot(to!)}" [arrowhead=none];`);
  }
  lines.push("}");
  return lines.join("\n");
}

/** Where the line from ``centre`` toward ``toward`` leaves ``box``: the straight line is clipped at the card's outline. */
function borderPoint(box: Box, centre: { x: number; y: number }, toward: { x: number; y: number }): { x: number; y: number } {
  const dx = toward.x - centre.x;
  const dy = toward.y - centre.y;
  if (dx === 0 && dy === 0) return centre;
  const halfW = boxW(box) / 2;
  const halfH = boxH(box) / 2;
  const tx = dx !== 0 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const ty = dy !== 0 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(tx, ty);
  return { x: centre.x + dx * t, y: centre.y + dy * t };
}

/** Move a box from one centre to another. */
function place(inner: Box, fromCentre: Box, toCentre: Box): Box {
  const dx = boxCx(toCentre) - boxCx(fromCentre);
  const dy = boxCy(toCentre) - boxCy(fromCentre);
  return { left: inner.left + dx, right: inner.right + dx, top: inner.top + dy, bottom: inner.bottom + dy };
}

/** Lay out fixed-size boxes and the lines between them with ``engine``, without overlap: each box's centre, by name. */
function packBoxes(
  boxes: ReadonlyArray<{ name: string; width: number; height: number }>,
  links: ReadonlyArray<readonly [string, string]>,
  engine: string,
  layoutFn: ErdComposeLayout,
): Map<string, { x: number; y: number }> {
  const lines = ["digraph PACK {", '  graph [bgcolor=transparent overlap=false sep="+28" start=1];', '  node [shape=box fixedsize=true label=""];'];
  for (const box of boxes) lines.push(`  "${escDot(box.name)}" [width="${(box.width / 72).toFixed(3)}" height="${(box.height / 72).toFixed(3)}"];`);
  for (const [from, to] of links) lines.push(`  "${escDot(from)}" -> "${escDot(to)}" [arrowhead=none];`);
  lines.push("}");
  return new Map([...nodeBoxes(layoutFn(lines.join("\n"), engine))].map(([name, box]) => [name, { x: boxCx(box), y: boxCy(box) }]));
}

/** Move ``box`` by ``dx``, ``dy``. */
function shifted(box: Box, dx: number, dy: number): Box {
  return { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy };
}

/**
 * The places of one unfolded frame's tables and specialization blocks, in one coordinate system. A frame with no block
 * is laid out at once. With blocks, each block's tables are laid out alone, which gives the block its size, and then
 * the frame is laid out with each block as one box among its other tables: a block holds its own tables and no other,
 * as a Dot cluster does (spec 071).
 */
function layOutFrame(
  frame: Frame,
  data: ErdGraphPayload,
  layout: ErdGraphvizLayout,
  engine: string,
  blockWidths: ReadonlyMap<string, number> | undefined,
  layoutFn: ErdComposeLayout,
): { nodes: Map<string, Box>; groupBoxes: Map<string, Box> } {
  const alone = (members: readonly ErdEntity[]) =>
    nodeBoxes(layoutFn(buildDotSource({ ...data, entities: [...members], relations: [], groups: [], same: [], folded_contours: new Set() }, layout, blockWidths), engine));
  const all = alone(frame.members);
  const blocks = frame.groups.filter((group) => group.members.filter((id) => all.has(id)).length > 1);
  if (!blocks.length) return { nodes: all, groupBoxes: new Map() };

  // Each block alone: its tables' places inside it, and its outline round them with the room for its label on top.
  const inBlock = new Map<string, string>();
  const blockLayouts = blocks.map((group) => {
    const name = `cluster_${group.group_id}`;
    const tables = alone(frame.members.filter((member) => group.members.includes(member.id)));
    const content = unionBox([...tables.values()])!;
    const outline = { left: content.left - GROUP_PAD, right: content.right + GROUP_PAD, top: content.top + GROUP_PAD, bottom: content.bottom - GROUP_PAD - GROUP_LABEL };
    for (const id of tables.keys()) inBlock.set(id, name);
    return { name, tables, outline };
  });
  // The frame: its free tables at their own sizes, each block as one box; a relation inside the frame is a link.
  const unit = (id: string) => inBlock.get(id) ?? id;
  const items = [
    ...[...all].filter(([id]) => !inBlock.has(id)).map(([id, box]) => ({ name: id, width: boxW(box), height: boxH(box) })),
    ...blockLayouts.map((block) => ({ name: block.name, width: boxW(block.outline), height: boxH(block.outline) })),
  ];
  const links = new Set<string>();
  for (const relation of data.relations ?? []) {
    if (!all.has(relation.source) || !all.has(relation.target)) continue;
    const [from, to] = [unit(relation.source), unit(relation.target)];
    if (from !== to) links.add([from, to].sort().join("\u0000"));
  }
  const centres = packBoxes(items, [...links].map((pair) => pair.split("\u0000") as [string, string]), engine, layoutFn);
  const nodes = new Map<string, Box>();
  const groupBoxes = new Map<string, Box>();
  for (const [id, box] of all) {
    if (inBlock.has(id)) continue;
    const at = centres.get(id) ?? { x: boxCx(box), y: boxCy(box) };
    nodes.set(id, shifted(box, at.x - boxCx(box), at.y - boxCy(box)));
  }
  for (const block of blockLayouts) {
    const at = centres.get(block.name) ?? { x: boxCx(block.outline), y: boxCy(block.outline) };
    const [dx, dy] = [at.x - boxCx(block.outline), at.y - boxCy(block.outline)];
    groupBoxes.set(block.name, shifted(block.outline, dx, dy));
    for (const [id, box] of block.tables) nodes.set(id, shifted(box, dx, dy));
  }
  return { nodes, groupBoxes };
}

/**
 * The composed SVG of ``data`` in a non-Dot layout (research R2). ``layoutFn`` lays a DOT string out
 * through ``@hpcc-js/wasm-graphviz``.
 */
export function erdCompose(data: ErdGraphPayload, layout: ErdGraphvizLayout, layoutFn: ErdComposeLayout): string {
  const engine = erdGraphvizEngine(layout);
  const frames = framesOf(data);
  const needsWidths = (data.groups ?? []).some((group) => group.members.length > 1) || [...(data.folds?.values() ?? [])].some((fold) => fold.collapsed);
  const blockWidths = needsWidths ? erdBlockWidths(data, layoutFn(buildBlockMeasureDot(data), "dot")) : undefined;

  // 0. The titles, laid out once: a frame is at least as wide as its title and keeps the title's height above its tables.
  const titles = layOutTitles(frames, layoutFn);
  const titleRoom = (frame: Frame) => {
    const title = titles.get(frame.name);
    return { width: title ? boxW(title.box) + FRAME_PAD * 2 : 0, height: title ? boxH(title.box) + TITLE_GAP * 2 : TITLE_GAP };
  };

  // 1. Each frame's tables alone: their places inside the frame, and the frame's size.
  const inner = new Map<string, { nodes: Map<string, Box>; groups: Map<string, Box>; centre: Box; size: { width: number; height: number }; shift: number }>();
  for (const frame of frames) {
    if (frame.folded) {
      // The box alone, in its own view: a resource's box among that resource's copies, a domain's among its entities.
      const foldData: ErdGraphPayload = { ...data, entities: frame.members, relations: [], groups: [], same: [], ...(frame.resource !== null ? { resource_ids: [frame.resource] } : {}) };
      const foldSvg = layoutFn(buildDotSource(foldData, layout, blockWidths), engine);
      const box = nodeBoxes(foldSvg).get(frame.id);
      // A folded frame draws no outline of its own: its box is the frame, so it keeps only the spacing round it.
      const size = box ? { width: boxW(box) + FRAME_PAD * 2, height: boxH(box) + FRAME_PAD * 2 } : { width: EMPTY_WIDTH, height: EMPTY_HEIGHT };
      inner.set(frame.name, { nodes: new Map(), groups: new Map(), centre: box ?? { left: 0, right: size.width, top: 0, bottom: -size.height }, size, shift: 0 });
      continue;
    }
    const { nodes, groupBoxes } = layOutFrame(frame, data, layout, engine, blockWidths, layoutFn);
    const content = unionBox([...nodes.values(), ...groupBoxes.values()]) ?? { left: 0, right: EMPTY_WIDTH, top: 0, bottom: -EMPTY_HEIGHT };
    const room = titleRoom(frame);
    const width = Math.max(boxW(content) + FRAME_PAD * 2, room.width);
    const height = boxH(content) + room.height + FRAME_PAD;
    // The tables stand under the title: their centre is below the frame's by half the title's room less the bottom pad.
    inner.set(frame.name, { nodes, groups: groupBoxes, centre: content, size: { width, height }, shift: (room.height - FRAME_PAD) / 2 });
  }

  // 2. The frames as boxes.
  const sizes = new Map([...inner].map(([name, entry]) => [name, entry.size]));
  const frameSvg = layoutFn(frameLayoutDot(frames, sizes, data), engine);
  const frameNodes = nodeBoxes(frameSvg);

  // 3. One full layout, for every table's card and every edge's style — never for a place: the composer moves every
  // card to its own. It is laid out by Dot, which gives the same markup every time; FDP gave each load its own raw
  // coordinates, which the moves made up for, so one picture came with a different markup and layout hash (spec 071).
  const fullDot = buildDotSource({ ...data, groups: [] }, layout, blockWidths).replace("splines=false", "splines=true");
  const fullSvg = layoutFn(fullDot, "dot");
  const markups = nodeMarkups(fullSvg);
  const styles = edgeStyles(fullSvg);

  // 4. The composed centre of every table and folded box.
  const centres = new Map<string, { x: number; y: number }>();
  for (const frame of frames) {
    const entry = inner.get(frame.name)!;
    const frameBox = frameNodes.get(frame.name) ?? { left: 0, right: 0, top: 0, bottom: 0 };
    const fc = { x: boxCx(frameBox), y: boxCy(frameBox) };
    if (frame.folded) {
      centres.set(frame.id, fc);
      continue;
    }
    for (const member of frame.members) {
      const node = entry.nodes.get(member.id);
      if (!node) continue;
      const moved = place(node, entry.centre, { left: fc.x, right: fc.x, top: fc.y + entry.shift, bottom: fc.y + entry.shift });
      centres.set(member.id, { x: boxCx(moved), y: boxCy(moved) });
    }
  }

  // 5. Assemble: frame and group clusters, the moved table cards, and straight lines between them.
  const parts: string[] = [];
  const drawn: Box[] = [];
  /** Every drawn table's and folded box's box, so its lines leave from its border, not its centre. */
  const finalBoxes = new Map<string, Box>();
  const frameBox = (fc: { x: number; y: number }, size: { width: number; height: number }): Box => ({ left: fc.x - size.width / 2, right: fc.x + size.width / 2, top: fc.y + size.height / 2, bottom: fc.y - size.height / 2 });
  for (const frame of frames) {
    const entry = inner.get(frame.name)!;
    const frameNode = frameNodes.get(frame.name) ?? { left: 0, right: 0, top: 0, bottom: 0 };
    const fc = { x: boxCx(frameNode), y: boxCy(frameNode) };
    const box = frameBox(fc, entry.size);
    // A folded frame draws no outline of its own: its tables are folded into one box, the markup placed below.
    if (!frame.folded) parts.push(frameCluster(frame, box, titles.get(frame.name), frame.resource === null && data.model === "physical"));
    drawn.push(box);
    if (frame.folded) finalBoxes.set(frame.id, box);
    for (const group of frame.groups) {
      const groupName = `cluster_${group.group_id}`;
      const groupBox = entry.groups.get(groupName);
      if (!groupBox) continue;
      const moved = place(groupBox, entry.centre, { left: fc.x, right: fc.x, top: fc.y + entry.shift, bottom: fc.y + entry.shift });
      parts.push(groupCluster(specializationId(group.group_id, frame.resource === null && data.model === "physical" ? null : frame.id), groupName, group.label, moved, (data.entities ?? []).some((entity) => entity.diff !== undefined)));
      drawn.push(moved);
    }
  }
  for (const [id, { markup, box }] of markups) {
    const centre = centres.get(id);
    if (!centre) continue;
    const dx = centre.x - boxCx(box);
    const dy = centre.y - boxCy(box);
    parts.push(dx === 0 && dy === 0 ? markup : `<g transform="translate(${dx.toFixed(2)},${dy.toFixed(2)})">${markup}</g>`);
    const moved = { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy };
    finalBoxes.set(id, moved);
    drawn.push(moved);
  }
  // Straight lines, one per drawn end pair, in the order buildDotSource writes them.
  const plan = foldPlan(data);
  const line = (id: string, source: string, target: string) => {
    const from = centres.get(source);
    const to = centres.get(target);
    if (!from || !to) return;
    // The line leaves and enters at the cards' outlines, as Graphviz's own routing does — never at their centres.
    const fromBox = finalBoxes.get(source);
    const toBox = finalBoxes.get(target);
    const start = fromBox ? borderPoint(fromBox, from, to) : from;
    const end = toBox ? borderPoint(toBox, to, from) : to;
    const style = styles.get(id) ?? { stroke: "#94a3b8", dash: null, classes: "" };
    parts.push(`<g id="${id}" class="edge${style.classes}"><title>${escHtml(`${source}->${target}`)}</title><path fill="none" stroke="${style.stroke}"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""} d="M ${start.x.toFixed(2)},${start.y.toFixed(2)} L ${end.x.toFixed(2)},${end.y.toFixed(2)}"/></g>`);
  };
  (data.relations ?? []).forEach((relation, k) => {
    if (relation.relationship_kind === "specialization") return;
    if (plan.holder.has(relation.source) || plan.holder.has(relation.target)) return;
    line(`re${k}`, relation.source, relation.target);
    if (relation.previous_target && relation.previous_target !== relation.target) line(`rp${k}`, relation.source, relation.previous_target);
  });
  (data.same ?? []).forEach((ids, k) => {
    for (let i = 1; i < ids.length; i += 1) if (!plan.holder.has(ids[i - 1]!) && !plan.holder.has(ids[i]!)) line(`se${k}_${i}`, ids[i - 1]!, ids[i]!);
  });
  for (const bundle of plan.bundles) line(bundle.id, bundle.source, bundle.target);

  // 6. Wrap in a graph element whose viewBox fits everything drawn.
  const bbox = unionBox(drawn) ?? { left: 0, right: EMPTY_WIDTH, top: 0, bottom: -EMPTY_HEIGHT };
  const width = boxW(bbox) + VIEW_PAD * 2;
  const height = boxH(bbox) + VIEW_PAD * 2;
  const tx = (VIEW_PAD - bbox.left).toFixed(2);
  const ty = (VIEW_PAD - bbox.bottom).toFixed(2);
  return (
    `<svg width="${width.toFixed(2)}pt" height="${height.toFixed(2)}pt" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
    `<g id="graph0" class="graph" transform="scale(1 1) rotate(0) translate(${tx} ${ty})">` +
    parts.join("") +
    `</g></svg>`
  );
}
