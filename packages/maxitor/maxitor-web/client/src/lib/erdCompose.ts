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
  FRAME_GREY,
  tableResource,
  type ErdEntity,
  type ErdGraphPayload,
  type ErdGraphvizLayout,
  type ErdGroup,
} from "./buildDotSource.ts";

/** A box in the drawing's units, y growing upward: ``top`` is the larger y, ``bottom`` the smaller. */
export type Box = { left: number; right: number; top: number; bottom: number };

const boxW = (box: Box) => box.right - box.left;
const boxH = (box: Box) => box.top - box.bottom;
const boxCx = (box: Box) => (box.left + box.right) / 2;
const boxCy = (box: Box) => (box.top + box.bottom) / 2;

/** A frame the composer draws. */
type Frame = {
  name: string;
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
const GROUP_START = /<g id="[^"]+" class="(?:node|edge|cluster)"/g;
const EDGE_START = /<g id="([^"]+)" class="edge">/g;

/** The box of every shape in ``body``, united. */
function bodyBox(body: string): Box | null {
  return unionBox([...body.matchAll(/\b(?:d|points)="([^"]+)"/g)].map((match) => boxOf(match[1]!)).filter((box): box is Box => box !== null));
}

/** The box of every node, by its ``<title>`` (the node's id). */
function nodeBoxes(svg: string): Map<string, Box> {
  const starts = [...svg.matchAll(NODE_START)].map((match) => match.index ?? 0);
  const found = new Map<string, Box>();
  starts.forEach((start, i) => {
    const next = starts[i + 1] ?? svg.length;
    GROUP_START.lastIndex = start + 1;
    const following = GROUP_START.exec(svg)?.index ?? svg.length;
    const body = svg.slice(start, Math.min(following, next));
    const title = /<title>([^<]*)<\/title>/.exec(body)?.[1];
    if (!title) return;
    const box = bodyBox(body);
    if (box) found.set(title, box);
  });
  return found;
}

/** The full markup of every node and its box, by its ``<title>``. */
function nodeMarkups(svg: string): Map<string, { markup: string; box: Box }> {
  const starts = [...svg.matchAll(NODE_START)].map((match) => match.index ?? 0);
  const found = new Map<string, { markup: string; box: Box }>();
  starts.forEach((start, i) => {
    const next = starts[i + 1] ?? svg.length;
    GROUP_START.lastIndex = start + 1;
    const following = GROUP_START.exec(svg)?.index ?? svg.length;
    const markup = svg.slice(start, Math.min(following, next));
    const title = /<title>([^<]*)<\/title>/.exec(markup)?.[1];
    if (!title) return;
    const box = bodyBox(markup);
    if (box) found.set(title, { markup, box });
  });
  return found;
}

/** Every edge's stroke and dash, by its ``id``. */
function edgeStyles(svg: string): Map<string, { stroke: string; dash: string | null }> {
  const found = new Map<string, { stroke: string; dash: string | null }>();
  for (const match of svg.matchAll(EDGE_START)) {
    const id = match[1]!;
    const body = svg.slice(match.index ?? 0, svg.indexOf("</g>", (match.index ?? 0) + 1) + 4);
    const stroke = /stroke="([^"]+)"/.exec(body)?.[1];
    if (!stroke) continue;
    const dash = /stroke-dasharray="([^"]+)"/.exec(body)?.[1] ?? null;
    found.set(id, { stroke, dash });
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
        id,
        label: data.resource_labels?.[resource] ?? (resource.split(".").pop() || resource),
        colour: erdResourceFrameColour(resource, data.resource_colors),
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
      id: `${DOMAIN_CONTOUR_ID_PREFIX}${qual}`,
      label: data.domain_labels?.[qual] ?? (qual.split(".").pop() || qual),
      colour: erdDomainFrameColour(qual, data.domain_colors),
      resource: null,
      members,
      groups: groupsIn(members, data.groups, entities),
      folded: false,
      tooltip: qual,
    };
  });
}

/** The padding round a frame's tables, in points: the top holds the label. */
const FRAME_PAD = 20;
const FRAME_TOP_PAD = 36;
/** The padding a specialization group's box keeps round its tables. */
const GROUP_PAD = 12;
/** Extra separation the frame-layout boxes get, so no two composed frames touch after overlap removal. */
const FRAME_LAYOUT_GAP = 48;
/** A frame with no table still stands, this size. */
const EMPTY_WIDTH = 140;
const EMPTY_HEIGHT = 60;
/** The corner radius of a rounded frame, as Graphviz draws it. */
const FRAME_RADIUS = 12;
/** The padding round the whole drawing in the viewBox. */
const VIEW_PAD = 8;

/** The outline's font colour: the frame's own when it paints, the dark grey otherwise. */
function frameInk(colour: string): string {
  return colour === FRAME_GREY ? "#475569" : colour;
}

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
    `${xr0 - h},${bottom} ${left},${yr1 + h} ${left},${yr1} ` +
    `${left},${yr1} ${left},${yr0} ${left},${yr0} ` +
    `${left},${yr0 + h} ${xr0 - h},${top} ${xr0},${top}`
  );
}

/** The ``g.cluster`` markup of one frame, as Graphviz writes it, in the drawing's own units. */
function frameCluster(frame: Frame, box: Box, dashed: boolean): string {
  const cx = boxCx(box);
  const dashes = dashed ? ' stroke-dasharray="5,2"' : "";
  return (
    `<g id="${escHtml(frame.id)}" class="cluster">` +
    `<title>${escHtml(frame.name)}</title>` +
    `<path fill="none" stroke="${frame.colour}" stroke-width="2"${dashes} d="${roundedRectPath(box)}"/>` +
    `<text xml:space="preserve" text-anchor="middle" x="${cx.toFixed(2)}" y="${(box.top - 12).toFixed(2)}" font-family="Helvetica,sans-Serif" font-weight="bold" font-size="15.00" fill="${frameInk(frame.colour)}">${escHtml(frame.label)}</text>` +
    `</g>`
  );
}

/** The ``g.cluster`` markup of a specialization group inside a frame. */
function groupCluster(name: string, label: string, box: Box): string {
  const cx = boxCx(box);
  return (
    `<g id="${escHtml(name)}" class="cluster">` +
    `<title>${escHtml(name)}</title>` +
    `<path fill="none" stroke="${FRAME_GREY}" stroke-width="2" stroke-dasharray="5,2" d="${roundedRectPath(box)}"/>` +
    `<text xml:space="preserve" text-anchor="middle" x="${cx.toFixed(2)}" y="${(box.top - 10).toFixed(2)}" font-family="Helvetica,sans-Serif" font-size="10.00" fill="#64748b">${escHtml(label)}</text>` +
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
    '  graph [fontname="Helvetica" bgcolor=transparent pad="0.5" overlap=false start=1];',
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

/** Move a box from one centre to another. */
function place(inner: Box, fromCentre: Box, toCentre: Box): Box {
  const dx = boxCx(toCentre) - boxCx(fromCentre);
  const dy = boxCy(toCentre) - boxCy(fromCentre);
  return { left: inner.left + dx, right: inner.right + dx, top: inner.top + dy, bottom: inner.bottom + dy };
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

  // 1. Each frame's tables alone: their places inside the frame, and the frame's size.
  const inner = new Map<string, { nodes: Map<string, Box>; groups: Map<string, Box>; centre: Box; size: { width: number; height: number } }>();
  for (const frame of frames) {
    if (frame.folded) {
      const resource = frame.resource ?? frame.id.slice(CONTOUR_ID_PREFIX.length);
      const foldData: ErdGraphPayload = { ...data, entities: frame.members, relations: [], groups: [], same: [], resource_ids: [resource], model: "physical" };
      const foldSvg = layoutFn(buildDotSource(foldData, layout, blockWidths), engine);
      const box = nodeBoxes(foldSvg).get(frame.id);
      const size = box ? { width: boxW(box) + FRAME_PAD * 2, height: boxH(box) + FRAME_TOP_PAD + FRAME_PAD } : { width: EMPTY_WIDTH, height: EMPTY_HEIGHT };
      inner.set(frame.name, { nodes: new Map(), groups: new Map(), centre: box ?? { left: 0, right: size.width, top: 0, bottom: -size.height }, size });
      continue;
    }
    const subData: ErdGraphPayload = { ...data, entities: frame.members, relations: [], groups: [], same: [], folded_contours: new Set() };
    const subSvg = layoutFn(buildDotSource(subData, layout, blockWidths), engine);
    const nodes = nodeBoxes(subSvg);
    const groupBoxes = new Map<string, Box>();
    for (const group of frame.groups) {
      const box = unionBox(group.members.map((id) => nodes.get(id)).filter((box): box is Box => box !== undefined));
      if (box) groupBoxes.set(`cluster_${group.group_id}`, { left: box.left - GROUP_PAD, right: box.right + GROUP_PAD, top: box.top + GROUP_PAD, bottom: box.bottom - GROUP_PAD });
    }
    const content = unionBox([...nodes.values(), ...groupBoxes.values()]) ?? { left: 0, right: EMPTY_WIDTH, top: 0, bottom: -EMPTY_HEIGHT };
    const width = boxW(content) + FRAME_PAD * 2;
    const height = boxH(content) + FRAME_TOP_PAD + FRAME_PAD;
    inner.set(frame.name, { nodes, groups: groupBoxes, centre: content, size: { width, height } });
  }

  // 2. The frames as boxes.
  const sizes = new Map([...inner].map(([name, entry]) => [name, entry.size]));
  const frameSvg = layoutFn(frameLayoutDot(frames, sizes, data), engine);
  const frameNodes = nodeBoxes(frameSvg);

  // 3. One full layout, for every table's card and every edge's style.
  const fullDot = buildDotSource({ ...data, groups: [] }, layout, blockWidths).replace("splines=false", "splines=true");
  const fullSvg = layoutFn(fullDot, engine);
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
      const moved = place(node, entry.centre, { left: fc.x, right: fc.x, top: fc.y, bottom: fc.y });
      centres.set(member.id, { x: boxCx(moved), y: boxCy(moved) });
    }
  }

  // 5. Assemble: frame and group clusters, the moved table cards, and straight lines between them.
  const parts: string[] = [];
  const drawn: Box[] = [];
  const frameBox = (fc: { x: number; y: number }, size: { width: number; height: number }): Box => ({ left: fc.x - size.width / 2, right: fc.x + size.width / 2, top: fc.y + size.height / 2, bottom: fc.y - size.height / 2 });
  for (const frame of frames) {
    const entry = inner.get(frame.name)!;
    const frameNode = frameNodes.get(frame.name) ?? { left: 0, right: 0, top: 0, bottom: 0 };
    const fc = { x: boxCx(frameNode), y: boxCy(frameNode) };
    const box = frameBox(fc, entry.size);
    parts.push(frameCluster(frame, box, frame.resource === null && data.model === "physical"));
    drawn.push(box);
    for (const group of frame.groups) {
      const groupName = `cluster_${group.group_id}`;
      const groupBox = entry.groups.get(groupName);
      if (!groupBox) continue;
      const moved = place(groupBox, entry.centre, { left: fc.x, right: fc.x, top: fc.y, bottom: fc.y });
      parts.push(groupCluster(groupName, group.label, moved));
      drawn.push(moved);
    }
  }
  for (const [id, { markup, box }] of markups) {
    const centre = centres.get(id);
    if (!centre) continue;
    const dx = centre.x - boxCx(box);
    const dy = centre.y - boxCy(box);
    parts.push(dx === 0 && dy === 0 ? markup : `<g transform="translate(${dx.toFixed(2)},${dy.toFixed(2)})">${markup}</g>`);
    drawn.push({ left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy });
  }
  // Straight lines, one per drawn end pair, in the order buildDotSource writes them.
  const plan = foldPlan(data);
  const line = (id: string, source: string, target: string) => {
    const from = centres.get(source);
    const to = centres.get(target);
    if (!from || !to) return;
    const style = styles.get(id) ?? { stroke: "#94a3b8", dash: null };
    parts.push(`<g id="${id}" class="edge"><title>${escHtml(`${source}->${target}`)}</title><path fill="none" stroke="${style.stroke}"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""} d="M ${from.x.toFixed(2)},${from.y.toFixed(2)} L ${to.x.toFixed(2)},${to.y.toFixed(2)}"/></g>`);
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
