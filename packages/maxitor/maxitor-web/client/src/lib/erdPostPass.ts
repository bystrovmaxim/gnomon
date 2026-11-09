// src/lib/erdPostPass.ts
/**
 * ERD post-pass on Graphviz's SVG: what the DOT source reserves, this draws.
 *
 * ``buildDotSource`` gives every table's header a kind slot — a cell with an ``ID`` and a ``TOOLTIP``,
 * filled with the header colour so Graphviz emits its box as ``<g id="a_ks<table>">`` — beside the name
 * cell. Graphviz stretches the name cell to the header and centres the name in it; this pass puts the
 * glyph at the header's left, after a small inset, and the name right after it — the header of spec 028
 * (FR-110; mockup screen 21), left-aligned like the field names below. The slot reserves the room and gives the
 * height; the glyph is drawn white inside the slot's link element, so its tooltip (the kind's name)
 * still covers it.
 *
 * Like ``containNodeFills`` it works on the markup, not on the DOM, and imports no value, so the
 * drawing check runs this very function in plain Node; the glyph drawing is passed in.
 */

// Relative, with its extension: the ERD checks in ``scripts/`` run this module under plain Node, which knows no ``@/``.
import { CONTOUR_ID_PREFIX, DOMAIN_CONTOUR_ID_PREFIX, ERD_DIFF_COLOUR, erdHeadInk, isPaintStandIn, painted, FRAME_DISK_SLOT_PREFIX, frameOfCluster, isContourId, tableResource, type ErdBundle, type ErdEntity, type ErdFold } from "./buildDotSource.ts";
import { svgDataUriForGraphNodeIcon } from "./icons/graph_node_disk_icons.ts";

/** Draws a kind's glyph in a 24-unit box: ``(word, ink, strokeWidth) => inner SVG``. */
export type KindGlyphDrawer = (word: string, ink: string, strokeWidth: number) => string;

/** Stroke width of a header glyph, in the glyph's own 24-unit box. */
const HEADER_GLYPH_STROKE = 2.4;
/** Space between the glyph and the name, in points (the spacer cell of the header). */
const HEADER_GLYPH_GAP = 4;
/** Space between the header's left edge and the glyph, in points (the mockup's 12 of a 250 card). */
export const HEADER_INSET_PT = 10;
/**
 * Half the height of a capital of Helvetica, as a share of the font size (its cap height is 0.718 em):
 * how far above its baseline a name's visual middle stands.
 */
export const CAP_HALF_EM = 0.359;

/**
 * The box of a cell's ``points`` polygon inside its ``<g id="a_<id>">``, or ``null``. A cell that holds a
 * nested table (the header) is closed by its last ``</a>`` before the next cell's group, hence ``outer``.
 */
/**
 * Where each cell's group ``<g id="a_<cell>">`` starts in ``markup``, read in one pass. The post-pass looks up several
 * cells of every table: searching the whole drawing for each made a model of a thousand tables cost seconds (#85).
 */
function cellStarts(markup: string): Map<string, number> {
  const starts = new Map<string, number>();
  for (const match of markup.matchAll(/<g id="a_([^"]+)">/g)) if (!starts.has(match[1]!)) starts.set(match[1]!, match.index ?? 0);
  return starts;
}

/** ``markup`` with every edit made, in one pass: each edit replaces ``remove`` characters at ``at`` with ``text``. */
function applyEdits(markup: string, edits: ReadonlyArray<{ at: number; remove: number; text: string }>): string {
  const sorted = [...edits].sort((one, other) => one.at - other.at);
  const parts: string[] = [];
  let from = 0;
  for (const { at, remove, text } of sorted) {
    parts.push(markup.slice(from, at), text);
    from = at + remove;
  }
  parts.push(markup.slice(from));
  return parts.join("");
}

function cellBox(
  markup: string,
  cellId: string,
  outer = false,
  starts?: ReadonlyMap<string, number>,
): { x: number; y: number; right: number; bottom: number; size: number; end: number } | null {
  const start = starts ? (starts.get(cellId) ?? -1) : markup.indexOf(`<g id="a_${cellId}">`);
  if (start < 0) return null;
  const close = markup.indexOf("</a>", start);
  const match = /points="([^"]+)"/.exec(markup.slice(start, outer ? markup.indexOf("</g>", start) : close));
  if (!match) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const pair of match[1]!.trim().split(/\s+/)) {
    const [x, y] = pair.split(",").map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x!);
      ys.push(y!);
    }
  }
  if (!xs.length) return null;
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const size = Math.min(Math.max(...xs) - x, Math.max(...ys) - y);
  return { x, y, right: Math.max(...xs), bottom: Math.max(...ys), size, end: close };
}

type Attribute = { at: number; length: number };

/** The first ``<text>`` inside ``<g id="a_<id>">``: where its ``x`` and ``y`` attributes sit, and its font size. */
function textPlace(markup: string, cellId: string, starts?: ReadonlyMap<string, number>): { x: Attribute; y: Attribute; fontSize: number } | null {
  const start = starts ? (starts.get(cellId) ?? -1) : markup.indexOf(`<g id="a_${cellId}">`);
  if (start < 0) return null;
  // Searched from the cell on, never by copying the rest of the drawing.
  const textTag = /<text\b[^>]*>/g;
  textTag.lastIndex = start;
  const tag = textTag.exec(markup);
  if (!tag) return null;
  const find = (name: string): Attribute | null => {
    const attr = new RegExp(` ${name}="[-\\d.]+"`).exec(tag[0]);
    return attr ? { at: tag.index + attr.index, length: attr[0].length } : null;
  };
  const x = find("x");
  const y = find("y");
  const fontSize = Number(/ font-size="([\d.]+)"/.exec(tag[0])?.[1]);
  return x && y && fontSize > 0 ? { x, y, fontSize } : null;
}

/**
 * The control that collapses a table, at the right of its header (spec 043): a chevron up on a whole table, down on a
 * collapsed one, over a larger clear square that takes the click. It stays inside the cell's group, which names the table.
 */
function collapseChevron(x: number, axis: number, size: number, ink: string, collapsed: boolean): string {
  const half = size * 0.3;
  const rise = (collapsed ? half : -half) / 2;
  const middle = x + size / 2;
  const reach = size / 2 + 4;
  return (
    `<rect class="erd-collapse-hit" x="${(middle - reach).toFixed(2)}" y="${(axis - reach).toFixed(2)}" width="${(reach * 2).toFixed(2)}" height="${(reach * 2).toFixed(2)}" fill="transparent"/>` +
    `<path class="erd-collapse-chevron" pointer-events="none" d="M${(middle - half).toFixed(2)} ${(axis - rise).toFixed(2)} L${middle.toFixed(2)} ${(axis + rise).toFixed(2)} L${(middle + half).toFixed(2)} ${(axis - rise).toFixed(2)}" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

/**
 * The colours ``placeKindIcons`` paints a kind glyph and a fold chevron with, given their stand-ins: a repaint that
 * keeps the drawing reads them without placing the glyphs again (#85).
 */
export function paintKindIcons(entities: readonly ErdEntity[]): void {
  for (const entity of entities) painted(`glyph-ink:${entity.id}`, erdHeadInk(entity));
}

/**
 * Draw each table's kind glyph at the left of its header, after the inset, and its name right after it,
 * both on one axis — the middle of the header band: the glyph's centre on it, and the name's capitals
 * centred on it (spec 029, FR-033). ``entities`` is the list the DOT was built from (its order gives the
 * cell ids).
 */
export function placeKindIcons(markup: string, entities: readonly ErdEntity[], drawGlyph: KindGlyphDrawer, folds?: ReadonlyMap<string, ErdFold>): string {
  const edits: Array<{ at: number; remove: number; text: string }> = [];
  const starts = cellStarts(markup);
  entities.forEach((entity, table) => {
    const slot = cellBox(markup, `ks${table}`, false, starts);
    const header = cellBox(markup, `hd${table}`, true, starts);
    const nameCell = cellBox(markup, `hn${table}`, true, starts);
    const name = textPlace(markup, `hn${table}`, starts);
    if (!slot || slot.size <= 0 || !header || !nameCell || !name) return;
    const iconX = header.x + HEADER_INSET_PT;
    const textX = iconX + slot.size + HEADER_GLYPH_GAP;
    const axis = (header.y + header.bottom) / 2;
    const iconY = axis - slot.size / 2;
    const textY = axis + CAP_HALF_EM * name.fontSize;
    const kind = entity.entity_kind?.trim() || "unknown";
    edits.push({ at: name.y.at, remove: name.y.length, text: ` y="${textY.toFixed(2)}"` });
    edits.push({ at: name.x.at, remove: name.x.length, text: ` x="${textX.toFixed(2)}"` });
    edits.push({
      at: slot.end,
      remove: 0,
      text:
        `<g class="erd-kind-icon" pointer-events="none" transform="translate(${iconX.toFixed(2)},${iconY.toFixed(2)}) ` +
        `scale(${(slot.size / 24).toFixed(4)})">${drawGlyph(kind, painted(`glyph-ink:${entity.id}`, erdHeadInk(entity)), HEADER_GLYPH_STROKE)}</g>`,
    });
    const control = cellBox(markup, `cl${table}`, false, starts);
    if (control) edits.push({ at: control.end, remove: 0, text: collapseChevron(header.right - HEADER_INSET_PT - slot.size, axis, slot.size, painted(`glyph-ink:${entity.id}`, erdHeadInk(entity)), folds?.get(entity.id)?.collapsed === true) });
  });
  return applyEdits(markup, edits);
}

// ── Line hover ──────────────────────────────────────────────────────────────
// The rest of this module works on the live SVG once it is on the page: a wide invisible stroke so a
// 1 px line is easy to catch, the hovered look as a class (styled by the canvas), and the rows a line
// stands for marked by their text only — never their fill, border or size.

/** What the post-pass needs of a relation: its ends and the fields at them (``ErdRelation`` fits). */
export type ErdLineInfo = {
  source: string;
  target: string;
  relationship_kind?: string;
  source_field?: string | null;
  target_field?: string | null;
};

/** How long a hover waits before acting: a pointer passing over the drawing changes nothing. */
export const HOVER_INTENT_MS = 100;

/** How low a row may stand on screen and still be read or aimed at, in CSS px; a finger needs more than a pointer. */
export const ROW_READABLE_PX = 10;
export const ROW_TAPPABLE_PX = 20;

/**
 * Whether a table is seen from afar: its rows stand lower on screen than a pointer can aim at. Then the table is one
 * thing — its card is the table's (spec 043, FR-001a), and a hover anywhere on it lights all its lines (spec 071).
 */
export function seenFromAfar(node: Element, touch = false): boolean {
  const row = node.querySelector('g[id^="a_fn"]') ?? node.querySelector('g[id^="a_hd"]');
  const height = row ? rowOnScreen(row) : Infinity;
  return height > 0 && height < (touch ? ROW_TAPPABLE_PX : ROW_READABLE_PX);
}

/**
 * Per drawing: the zoom it is shown at, as ``setErdDetail`` is told it, and the height of a field row and of a header
 * in the drawing's own units, each measured once. A hover reads them instead of asking the browser where a row is,
 * which laid the whole drawing out first whenever anything had changed since — a tenth of a second on 1 000 tables (#85).
 */
const DRAWING_ZOOM = new WeakMap<Element, { scale: number; rows: Map<string, number> }>();

/** How tall ``row`` stands on screen, in CSS px. */
function rowOnScreen(row: Element): number {
  const svg = row.closest("svg");
  const zoom = svg ? DRAWING_ZOOM.get(svg) : undefined;
  if (!zoom || !("getBBox" in row)) return row.getBoundingClientRect().height;
  const kind = row.id.slice(2, 4);
  let height = zoom.rows.get(kind);
  if (height === undefined) {
    height = (row as SVGGraphicsElement).getBBox().height;
    zoom.rows.set(kind, height);
  }
  return height * zoom.scale;
}

/** The class the hovered look hangs on. */
export const EDGE_HOVER_CLASS = "is-hovered";
const MARK_NAME_FILL = "#0f172a";
const MARK_TYPE_FILL = "#334155";

/** Give every edge an invisible stroke about 10 px wide along its path, so the pointer catches it. */
export function addEdgeHitAreas(root: ParentNode): void {
  root.querySelectorAll("g.edge").forEach((edge) => {
    if (edge.querySelector("path.erd-hit")) return;
    const path = edge.querySelector("path");
    if (!path) return;
    const hit = path.cloneNode(false) as Element;
    hit.setAttribute("class", "erd-hit");
    hit.setAttribute("fill", "none");
    hit.setAttribute("stroke", "transparent");
    hit.setAttribute("stroke-width", "10");
    hit.setAttribute("pointer-events", "stroke");
    path.parentNode!.insertBefore(hit, path);
  });
}

/** The resource a cluster group names — a resource contour (spec 064) — or ``null`` for any other group. */
export function contourResource(group: Element): string | null {
  const frame = contourId(group);
  return frame?.startsWith(CONTOUR_ID_PREFIX) ? frame.slice(CONTOUR_ID_PREFIX.length) : null;
}

/**
 * The frame a cluster group stands for — a resource's (``rc:``) or a domain's (``dc:``), or the frame a specialization
 * block lies in — or ``null`` for any other group.
 */
export function contourId(group: Element): string | null {
  return group.classList.contains("cluster") ? frameOfCluster(group.id) : null;
}

/**
 * What a click on ``target`` folds (research R4): the frame whose empty space it hit, or the folded box it landed on.
 * ``stayed`` is whether the pointer moved less than the click slop between down and up, so a pan that starts inside a
 * frame does not fold it. ``null`` folds nothing.
 */
export function clickFolds(target: Element | null, stayed: boolean): string | null {
  if (!target?.closest || !stayed) return null;
  const frame = target.closest("g.cluster");
  const frameId = frame ? contourId(frame) : null;
  if (frameId) return frameId;
  const box = target.closest("g.node");
  const boxTitle = box?.querySelector(":scope > title")?.textContent?.trim() ?? "";
  return isContourId(boxTitle) ? boxTitle : null;
}

/**
 * Give every frame — a resource's and a domain's — a hit area over its whole outline, filled transparent, so a click
 * anywhere on its empty space folds it; tables and lines are drawn after it, so they stay on top and keep their own
 * hover and card (research R4).
 */
export function addContourHitAreas(root: ParentNode): void {
  root.querySelectorAll("g.cluster").forEach((cluster) => {
    if (contourId(cluster) === null || cluster.querySelector("path.erd-hit")) return;
    const path = cluster.querySelector("path");
    if (!path) return;
    const hit = path.cloneNode(false) as Element;
    hit.setAttribute("class", "erd-hit");
    hit.setAttribute("fill", "transparent");
    hit.setAttribute("stroke", "none");
    hit.setAttribute("pointer-events", "all");
    path.parentNode!.insertBefore(hit, path);
  });
}

/**
 * The relations that leave ``resource``: one end on a copy in it, the other on a copy in another resource
 * (spec 064, FR-001; spec 070). A copy in "Not stored" is in none, so a line to it is not one.
 */
export function crossLines(resource: string, relations: readonly ErdLineInfo[], entities: readonly ErdEntity[]): number[] {
  const home = new Map(entities.map((entity) => [entity.id, tableResource(entity)]));
  return relations.flatMap((line, k) => {
    const [from, to] = [home.get(line.source) ?? null, home.get(line.target) ?? null];
    return from !== null && to !== null && from !== to && (from === resource || to === resource) ? [k] : [];
  });
}

/** The class of the plate under a line's end label. */
export const END_LABEL_CLASS = "erd-end-label";

/**
 * Put a white plate under every label of a line — the field names at its ends — so a label reads over a
 * table it crosses (spec 029, FR-042). The labels and their plates show only while the line is hovered
 * (``erdEndLabelSx``); a line's own hover, a row's hover and a follower's replayed hover all set it.
 */
export function addEndLabelBadges(root: ParentNode, edges?: Iterable<Element>): void {
  const labels = (edges ? [...edges].flatMap((edge) => [...edge.querySelectorAll<SVGTextElement>("text")]) : [...root.querySelectorAll<SVGTextElement>("g.edge text")]).filter(
    (label) => !label.previousElementSibling?.classList.contains(END_LABEL_CLASS),
  );
  if (!labels.length) return;
  let tables = BADGE_TABLES.get(root);
  if (!tables) {
    tables = [...root.querySelectorAll<SVGGraphicsElement>("g.node")].map((node) => node.getBBox());
    BADGE_TABLES.set(root, tables);
  }
  labels.forEach((label) => {
    const box = label.getBBox();
    if (!(box.width > 0)) return;
    const size = { width: box.width + 6, height: box.height + 2 };
    let place: Box = { x: box.x - 3, y: box.y - 1, ...size };
    // Graphviz sets a label at its line's end, often on the table there; it moves along the line, clear. A bundle's
    // count stays in the middle, where Graphviz put it (spec 065).
    const edge = label.closest("g.edge");
    const line = edge?.id.startsWith("rb") ? null : edge?.querySelector<SVGPathElement>("path:not(.erd-hit)");
    if (line && typeof line.getTotalLength === "function") {
      const length = line.getTotalLength();
      const start = line.getPointAtLength(0);
      const end = line.getPointAtLength(length);
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const atEnd = Math.hypot(centre.x - end.x, centre.y - end.y) < Math.hypot(centre.x - start.x, centre.y - start.y);
      place = placeEndLabel((d) => line.getPointAtLength(atEnd ? length - d : d), length, size, tables);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("x", String(place.x + place.width / 2));
      // The baseline that centres the text on its plate: the middle plus a third of the font size.
      const fontSize = Number(label.getAttribute("font-size")) || box.height * 0.8;
      label.setAttribute("y", String(place.y + place.height / 2 + fontSize * 0.35));
    }
    const plate = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    plate.setAttribute("class", END_LABEL_CLASS);
    plate.setAttribute("x", String(place.x));
    plate.setAttribute("y", String(place.y));
    plate.setAttribute("width", String(place.width));
    plate.setAttribute("height", String(place.height));
    plate.setAttribute("rx", "3");
    label.parentNode!.insertBefore(plate, label);
  });
}

/** Each drawing's tables as boxes, read once for the plates of its labels. */
const BADGE_TABLES = new WeakMap<ParentNode, Box[]>();
/** How many lines get their plates in one idle moment. */
const BADGE_LINES_PER_IDLE = 40;

/**
 * The plates of a drawing's labels (``addEndLabelBadges``), made when they are needed rather than with the drawing:
 * a bundle's count, on view at all times, at once; any other line's labels show only while it is lit, so a line gets
 * its plates when it is first lit, and the rest a few lines at a time while the page is idle. Measuring every label
 * of 1 000 tables with the drawing held each new picture back by half a second (#85).
 */
export function addEndLabelBadgesLazily(root: ParentNode, signal: AbortSignal): void {
  addEndLabelBadges(root, root.querySelectorAll('g.edge[id^="rb"]'));
  const rest = [...root.querySelectorAll('g.edge:not([id^="rb"])')];
  const idle = (work: () => void) =>
    typeof requestIdleCallback === "function" ? requestIdleCallback(work, { timeout: 2000 }) : setTimeout(work, 50);
  const next = () => {
    if (signal.aborted || !rest.length) return;
    addEndLabelBadges(root, rest.splice(0, BADGE_LINES_PER_IDLE));
    idle(next);
  };
  idle(next);
}

/** A box in the drawing's units. */
export type Box = { x: number; y: number; width: number; height: number };

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Space between a label's plate and its line, and the step it moves along the line, in drawing units. */
const LABEL_OFFSET = 4;
const LABEL_STEP = 3;

/**
 * Where an end label's plate goes (spec 029, FR-042): walking along its line from the end it names
 * (``pointAt(0)`` is that end, ``pointAt(length)`` the other), the first place where the plate — set
 * beside the line, off it, on whichever side is clear — touches none of ``tables``. Not past the line's
 * middle; when nowhere is clear, the last place tried.
 */
export function placeEndLabel(
  pointAt: (distance: number) => { x: number; y: number },
  length: number,
  plate: { width: number; height: number },
  tables: readonly Box[],
): Box {
  const half = Math.max(plate.width, plate.height) / 2 + LABEL_OFFSET;
  let last: Box | null = null;
  for (let along = half; along <= Math.max(half, length / 2); along += LABEL_STEP) {
    const p = pointAt(along);
    const q = pointAt(Math.min(length, along + 1));
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const norm = Math.hypot(dx, dy) || 1;
    // Off the line: the plate's centre moved across it by half the plate's extent plus a gap.
    const across = Math.abs((plate.width / 2) * (dy / norm)) + Math.abs((plate.height / 2) * (dx / norm)) + LABEL_OFFSET;
    for (const side of [1, -1]) {
      const cx = p.x + side * (-dy / norm) * across;
      const cy = p.y + side * (dx / norm) * across;
      const box = { x: cx - plate.width / 2, y: cy - plate.height / 2, width: plate.width, height: plate.height };
      last = box;
      if (!tables.some((table) => overlaps(box, table))) return box;
    }
  }
  return last ?? { x: pointAt(0).x - plate.width / 2, y: pointAt(0).y - plate.height / 2, ...plate };
}

/** The ink a hovered grey line takes. */
const HOVERED_LINE_INK = "#475569";

/**
 * The canvas's style for a hovered line (or every line of a hovered row): thicker, a grey one darker. A line painted by
 * its change in Diff keeps its colour — the hover never says a removed line is something else (spec 038).
 */
export const erdLineHoverSx = {
  "& g.edge path": { transition: "stroke-width 100ms ease, stroke 100ms ease" },
  [`& g.edge.${EDGE_HOVER_CLASS} path:not(.erd-hit)`]: { stroke: HOVERED_LINE_INK, strokeWidth: 2.4 },
  [`& g.edge.${EDGE_HOVER_CLASS} polygon`]: { stroke: HOVERED_LINE_INK },
  [`& g.edge.${EDGE_HOVER_CLASS} polygon:not([fill='none'])`]: { fill: HOVERED_LINE_INK },
  [`& g.edge.${EDGE_HOVER_CLASS} text`]: { fill: "#334155", fontWeight: 700 },
  ...Object.fromEntries(
    Object.values(ERD_DIFF_COLOUR).flatMap((colour) => [
      [`& g.edge.${EDGE_HOVER_CLASS} path[stroke='${colour}']:not(.erd-hit), & g.edge.${EDGE_HOVER_CLASS} polygon[stroke='${colour}']`, { stroke: colour }],
      [`& g.edge.${EDGE_HOVER_CLASS} polygon[fill='${colour}']`, { fill: colour }],
    ]),
  ),
} as const;

/** The canvas's style for a hovered resource contour: a wider border, in the colour it was drawn with (spec 064). */
export const erdContourHoverSx = {
  "& g.cluster path": { transition: "stroke-width 100ms ease" },
  [`& g.cluster.${EDGE_HOVER_CLASS} path:not(.erd-hit)`]: { strokeWidth: 3.5 },
} as const;

/** The canvas's style for a bundle's count (spec 065): on its plate at all times, not only while hovered. */
export const erdBundleSx = {
  [`& g.edge[id^='rb'] text, & g.edge[id^='rb'] rect.${END_LABEL_CLASS}`]: { visibility: "visible" },
} as const;

/**
 * The level of detail, as a map has (spec 071): below these zooms a row's text, then a table's name, stands a pixel or
 * two high on screen — a smear no one reads, and still the most costly thing to paint, glyph by glyph. There each text
 * is drawn as a bar of its own length, place and colour instead ("greeking"), so a pan or a zoom repaints one shape
 * per text and the picture from afar looks the same: the tables keep their lines of text, never turn blank.
 */
export const FAR_ROWS_SCALE = 0.15;
export const FAR_NAMES_SCALE = 0.08;
export const FAR_ROWS_CLASS = "erd-far-rows";
export const FAR_NAMES_CLASS = "erd-far-names";
/** The class of a text's bar, and of the bar of a table's name. */
export const GREEK_CLASS = "erd-greek";
export const GREEK_NAME_CLASS = "erd-greek-name";
/** Helvetica's mean advance and the height a bar takes, in ems of the text's size. */
const GREEK_ADVANCE_EM = 0.55;
const GREEK_HEIGHT_EM = 0.42;

/**
 * A bar for every text of every table in ``svg``, once per drawing, hidden until the drawing is seen from afar. The bar
 * is measured from the text's own attributes — its length from its characters, its place from its anchor and baseline
 * — so making them lays nothing out. A table's name is a bar of its own, painted as the name is; the bars of its rows
 * are one shape per colour: some twenty thousand elements fewer on 1 000 tables, the same picture (#85).
 */
export function addGreekText(svg: Element): void {
  if (svg.querySelector(`.${GREEK_CLASS}`)) return;
  for (const node of svg.querySelectorAll("g.node")) {
    const rows = new Map<string, string[]>();
    for (const text of node.querySelectorAll("text")) {
      const size = Number(text.getAttribute("font-size") ?? 14);
      const x = Number(text.getAttribute("x"));
      const y = Number(text.getAttribute("y"));
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const width = (text.textContent ?? "").length * size * GREEK_ADVANCE_EM;
      const anchor = text.getAttribute("text-anchor");
      const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
      const height = size * GREEK_HEIGHT_EM;
      const top = y - size * 0.36 - height / 2;
      const fill = text.getAttribute("fill") ?? "#0f172a";
      if (text.closest("g[id^='a_hn']") !== null) {
        const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bar.setAttribute("class", `${GREEK_CLASS} ${GREEK_NAME_CLASS}`);
        bar.setAttribute("x", left.toFixed(2));
        bar.setAttribute("y", top.toFixed(2));
        bar.setAttribute("width", width.toFixed(2));
        bar.setAttribute("height", height.toFixed(2));
        bar.setAttribute("rx", (height / 2).toFixed(2));
        bar.setAttribute("fill", fill);
        bar.setAttribute("opacity", "0.55");
        text.parentNode?.insertBefore(bar, text);
        continue;
      }
      if (!(width > 0)) continue;
      // The bar a rounded rectangle would be: straight sides, a half circle at each end.
      const r = Math.min(height, width) / 2;
      const part = `M${(left + r).toFixed(2)},${top.toFixed(2)}h${(width - 2 * r).toFixed(2)}a${r.toFixed(2)},${r.toFixed(2)} 0 0 1 0,${(2 * r).toFixed(2)}h${(2 * r - width).toFixed(2)}a${r.toFixed(2)},${r.toFixed(2)} 0 0 1 0,${(-2 * r).toFixed(2)}z`;
      const parts = rows.get(fill);
      if (parts) parts.push(part);
      else rows.set(fill, [part]);
    }
    for (const [fill, parts] of rows) {
      const bars = document.createElementNS("http://www.w3.org/2000/svg", "path");
      bars.setAttribute("class", GREEK_CLASS);
      bars.setAttribute("d", parts.join(""));
      bars.setAttribute("fill", fill);
      bars.setAttribute("opacity", "0.55");
      node.appendChild(bars);
    }
  }
}

/** Mark ``svg`` with the detail its ``scale`` shows; only a crossing of a threshold changes a class. */
export function setErdDetail(svg: Element, scale: number): void {
  const zoom = DRAWING_ZOOM.get(svg);
  if (zoom) zoom.scale = scale;
  else DRAWING_ZOOM.set(svg, { scale, rows: new Map() });
  const far = scale < FAR_ROWS_SCALE;
  if (far) addGreekText(svg);
  svg.classList.toggle(FAR_ROWS_CLASS, far);
  svg.classList.toggle(FAR_NAMES_CLASS, scale < FAR_NAMES_SCALE);
}

/** The canvas's style for the level of detail: from afar a row's text is its bar, then a table's name is too. */
export const erdDetailSx = {
  [`& .${GREEK_CLASS}`]: { display: "none" },
  [`& svg.${FAR_ROWS_CLASS} g.node text`]: { display: "none" },
  [`& svg.${FAR_ROWS_CLASS} .${GREEK_CLASS}`]: { display: "inline" },
  [`& svg.${FAR_ROWS_CLASS} g.node g[id^='a_hn'] text`]: { display: "inline" },
  [`& svg.${FAR_ROWS_CLASS} .${GREEK_NAME_CLASS}`]: { display: "none" },
  [`& svg.${FAR_ROWS_CLASS}.${FAR_NAMES_CLASS} g.node g[id^='a_hn'] text`]: { display: "none" },
  [`& svg.${FAR_ROWS_CLASS}.${FAR_NAMES_CLASS} .${GREEK_NAME_CLASS}`]: { display: "inline" },
} as const;

/** The canvas's style for line labels: hidden, and shown on their plates while the line is hovered. */
export const erdEndLabelSx = {
  [`& g.edge text, & g.edge rect.${END_LABEL_CLASS}`]: { visibility: "hidden" },
  [`& g.edge.${EDGE_HOVER_CLASS} text, & g.edge.${EDGE_HOVER_CLASS} rect.${END_LABEL_CLASS}`]: { visibility: "visible" },
  [`& rect.${END_LABEL_CLASS}`]: { fill: "#ffffff", stroke: "#cbd5e1", strokeWidth: 0.8 },
} as const;

/** Cell ids of the rows a relation stands for, at both ends. */
function rowsOf(line: ErdLineInfo, tables: Map<string, { index: number; fields: ErdEntity["fields"] }>): string[] {
  const cells: string[] = [];
  const add = (tableId: string, match: (field: NonNullable<ErdEntity["fields"]>[number]) => boolean) => {
    const table = tables.get(tableId);
    (table?.fields ?? []).forEach((field, row) => {
      if (match(field)) cells.push(`fn${table!.index}_${row}`, `ft${table!.index}_${row}`);
    });
  };
  if (!line.source_field) return cells;
  add(line.source, (f) => f.name === line.source_field);
  // Without an inverse, the far end is the key the field points at.
  if (line.target_field) add(line.target, (f) => f.name === line.target_field);
  else add(line.target, (f) => Boolean(f.primary_key));
  return cells;
}

/** Attributes a mark changes, saved on the text so leaving restores them exactly. */
const MARKED_ATTRIBUTES = ["font-weight", "fill", "text-anchor", "x"] as const;

/** Mark (or restore) the text of the given cells: bold and darker, the cell itself untouched. */
/** The padding Graphviz keeps between a table cell's edge and its text (``CELLPADDING``). */
const CELL_PADDING_PT = 4;

/** Where a right-aligned text of a table cell ends: its cell's right edge less the padding, or ``null``. */
function cellRight(text: Element): number | null {
  const fill = text.closest('g[id^="a_"]')?.querySelector("polygon");
  const xs = (fill?.getAttribute("points") ?? "").split(/[\s]+/).map((point) => Number(point.split(",")[0])).filter(Number.isFinite);
  return xs.length ? Math.max(...xs) - CELL_PADDING_PT : null;
}

export function markRows(root: ParentNode, cells: readonly string[], on: boolean): void {
  for (const id of cells) {
    root.querySelectorAll(`g[id="a_${id}"] text`).forEach((text) => {
      if (on) {
        if (!text.hasAttribute("data-erd-mark")) {
          text.setAttribute("data-erd-mark", JSON.stringify(MARKED_ATTRIBUTES.map((name) => text.getAttribute(name))));
          // A type sits on the right edge; bold text is wider, so it grows leftwards from that edge
          // instead of running out of the table.
          const measure = (text as SVGTextContentElement).getComputedTextLength;
          if (id.startsWith("ft") && typeof measure === "function") {
            // A text hidden from afar measures 0: its right edge is then its cell's, less the cell's padding — never its
            // own left edge, which laid the type over the field's name when the drawing was zoomed in (#89).
            const length = measure.call(text);
            const right = length > 0 ? Number(text.getAttribute("x")) + length : cellRight(text);
            if (right !== null) {
              text.setAttribute("text-anchor", "end");
              text.setAttribute("x", right.toFixed(2));
            }
          }
        }
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", id.startsWith("fn") ? MARK_NAME_FILL : MARK_TYPE_FILL);
        return;
      }
      const saved = text.getAttribute("data-erd-mark");
      if (saved === null) return;
      const values = JSON.parse(saved) as Array<string | null>;
      MARKED_ATTRIBUTES.forEach((name, i) => {
        const value = values[i];
        if (value === null || value === undefined) text.removeAttribute(name);
        else text.setAttribute(name, value);
      });
      text.removeAttribute("data-erd-mark");
    });
  }
}

/**
 * Line hover in both directions. Hovering a line gives it the hovered look, raises it above the lines it
 * crosses and marks the rows of its fields in both tables; hovering a row whose field has lines does the
 * same for every one of them. Either way the tables they join stay bright and the rest dim; on a row, the
 * hovered table's other lines stay as they are (spec 029, FR-041). Hovering a resource contour does the same for every
 * line that leaves that resource (spec 064). ``relations[k]`` is the line Graphviz wrote as ``<g id="re<k>">``.
 */
/** A table's id: the text of its node's ``<title>``. */
function tableOf(node: Element): string {
  return node.querySelector(":scope > title")?.textContent?.trim() ?? "";
}

/**
 * Keep ``tables`` bright and dim every other table; keep bright the lines in ``lines`` — or, when none are
 * given, every line touching a kept table — and dim the rest. The look of a hovered table, a hovered key
 * row and a hovered line alike (spec 029, FR-040, FR-041).
 */
type HoverIndex = { nodes: SVGElement[]; edges: SVGElement[]; titles: Map<SVGElement, string> };
/** One index per drawing, keyed by its SVG: a new drawing gets a new SVG, so a stale index is dropped with it. */
const HOVER_INDEXES = new WeakMap<Element, HoverIndex>();

/** The drawing's tables and lines, read once — a hover must not walk the whole SVG on every mouse move (spec 071). */
function hoverIndex(root: ParentNode): HoverIndex {
  const holder = root as unknown as { matches?: (selector: string) => boolean; querySelector?: (selector: string) => Element | null };
  const svg = holder.matches?.("svg") ? (root as unknown as Element) : (holder.querySelector?.("svg") ?? null);
  if (!svg) return { nodes: [], edges: [], titles: new Map() };
  let index = HOVER_INDEXES.get(svg);
  if (!index) {
    const nodes = [...svg.querySelectorAll<SVGElement>("g.node")];
    const edges = [...svg.querySelectorAll<SVGElement>("g.edge")];
    const titles = new Map<SVGElement, string>();
    for (const element of [...nodes, ...edges]) titles.set(element, element.querySelector(":scope > title")?.textContent?.trim() ?? "");
    index = { nodes, edges, titles };
    HOVER_INDEXES.set(svg, index);
  }
  return index;
}

export function focusTables(root: ParentNode, tables: ReadonlySet<string>, lines?: ReadonlySet<Element>): void {
  const { nodes, edges, titles } = hoverIndex(root);
  for (const node of nodes) node.style.opacity = tables.has(titles.get(node) ?? "") ? "1" : "0.35";
  for (const edge of edges) {
    const kept = lines ? lines.has(edge) : [...tables].some((table) => (titles.get(edge) ?? "").includes(table));
    edge.style.opacity = kept ? "1" : "0.2";
  }
}

/** The drawings whose highlight is held: the pointer is on the card of what is lit (#89). */
const HELD_FOCUS = new WeakSet<Element>();

function drawingOf(root: ParentNode): Element | null {
  const holder = root as unknown as { matches?: (selector: string) => boolean; querySelector?: (selector: string) => Element | null };
  return holder.matches?.("svg") ? (root as unknown as Element) : (holder.querySelector?.("svg") ?? null);
}

/**
 * Hold the highlight of ``root``'s drawing while the pointer is on the card of what is lit: leaving a table for its card
 * must not take the light off it while its card stays. Released, the drawing is drawn again as it was.
 */
export function holdTableFocus(root: ParentNode, held: boolean): void {
  const svg = drawingOf(root);
  if (!svg) return;
  if (held) {
    HELD_FOCUS.add(svg);
    return;
  }
  HELD_FOCUS.delete(svg);
  clearTableFocus(root);
}

/** Every table and line as drawn again — a table Diff fades stays faded. */
export function clearTableFocus(root: ParentNode): void {
  const svg = drawingOf(root);
  if (svg && HELD_FOCUS.has(svg)) return;
  const { nodes, edges } = hoverIndex(root);
  for (const element of [...nodes, ...edges]) element.style.opacity = "";
}

export function bindLineHover(
  root: ParentNode,
  relations: readonly ErdLineInfo[],
  entities: readonly ErdEntity[],
  signal: AbortSignal,
  bundles: readonly ErdBundle[] = [],
): void {
  const tables = new Map(entities.map((e, index) => [e.id, { index, fields: e.fields }]));
  const edgeRows = relations.map((line) => rowsOf(line, tables));
  const show = (edges: Element[], on: boolean) => {
    if (on) addEndLabelBadges(root, edges);
    for (const edge of edges) {
      const k = Number(edge.id.slice(2));
      edge.classList.toggle(EDGE_HOVER_CLASS, on);
      if (on && edge.parentNode && edge.parentNode.lastElementChild !== edge) edge.parentNode.appendChild(edge);
      markRows(root, edgeRows[k] ?? [], on);
    }
  };
  const edgesById = (ids: number[]) => ids.map((k) => root.querySelector(`g[id="re${k}"]`)).filter((e): e is Element => e !== null);
  // Every line one of whose ends is ``table``.
  const touching = (table: string) =>
    new Set(edgesById(relations.flatMap((line, k) => (line.source === table || line.target === table ? [k] : []))));
  // The tables a set of lines joins: both ends of each.
  // A hover that acted on every mouse move flashed the drawing and worked the main thread; the light waits
  // ``HOVER_INTENT_MS``, and a further move resets it, so a pointer passing over the drawing changes nothing.
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  const later = (action: () => void, trusted = true) => {
    // A synthetic event (a check, a test) acts at once; the browser's own pointer waits, so a pass over the drawing
    // never flashes it.
    if (!trusted) return action();
    if (hoverTimer !== null) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(action, HOVER_INTENT_MS);
  };
  signal.addEventListener("abort", () => {
    if (hoverTimer !== null) clearTimeout(hoverTimer);
  });

  const joined = (edges: Element[]) => new Set(edges.flatMap((edge) => {
    const line = relations[Number(edge.id.slice(2))];
    return line ? [line.source, line.target] : [];
  }));

  root.querySelectorAll('g.edge[id^="re"]').forEach((edge) => {
    edge.addEventListener("mouseenter", (event: Event) => later(() => {
      show([edge], true);
      focusTables(root, joined([edge]), new Set([edge]));
    }, event.isTrusted), { signal });
    edge.addEventListener("mouseleave", (event: Event) => later(() => {
      show([edge], false);
      clearTableFocus(root);
    }, event.isTrusted), { signal });
  });

  // A row's lines: every line one of whose ends is this row.
  const rowLines = new Map<string, number[]>();
  edgeRows.forEach((cells, k) => {
    for (const cell of cells) {
      const row = cell.slice(2);
      rowLines.set(row, [...(rowLines.get(row) ?? []), k]);
    }
  });
  // A table seen from afar is one thing: a hover anywhere on it lights every line it has, bold, and every table they join
  // — as a key row lights its own lines close up (spec 071).
  const lightTable = (own: string) => {
    const edges = [...touching(own)];
    show(edges, true);
    focusTables(root, new Set([own, ...joined(edges)]), new Set(edges));
    return edges;
  };
  root.querySelectorAll("g.node").forEach((node) => {
    const own = tableOf(node);
    if (!own || isContourId(own) || !relations.some((line) => line.source === own || line.target === own)) return;
    let lit: Element[] = [];
    node.addEventListener("mouseenter", (event: Event) => {
      if (!seenFromAfar(node)) return;
      later(() => (lit = lightTable(own)), event.isTrusted);
    }, { signal });
    node.addEventListener("mouseleave", (event: Event) => {
      if (!lit.length && !seenFromAfar(node)) return;
      later(() => {
        show(lit, false);
        lit = [];
        clearTableFocus(root);
      }, event.isTrusted);
    }, { signal });
  });

  root.querySelectorAll('g[id^="a_fn"], g[id^="a_ft"]').forEach((cell) => {
    const lines = rowLines.get(cell.id.slice(4)) ?? [];
    if (!lines.length) return;
    // The row's own table stays the hovered one; its lines and every table they join are lit with it.
    const own = tableOf(cell.closest("g.node") ?? cell);
    cell.addEventListener("mouseenter", (event: Event) => later(() => {
      // From afar the row is too small to aim at: the table's hover lights all its lines instead.
      if (seenFromAfar(cell.closest("g.node") ?? cell)) return void lightTable(own);
      const edges = edgesById(lines);
      // Scenario 2 (maintainer, 2026-10-27): the field's lines go bold (``show``); the tables they join
      // stay bright; the hovered table's other lines stay as they are; every other line and table dims.
      show(edges, true);
      focusTables(root, new Set([own, ...joined(edges)]), touching(own));
    }, event.isTrusted), { signal });
    cell.addEventListener("mouseleave", (event: Event) => later(() => {
      if (seenFromAfar(cell.closest("g.node") ?? cell)) return;
      show(edgesById(lines), false);
      focusTables(root, new Set([own]));
    }, event.isTrusted), { signal });
  });

  // Bundles (spec 065): a bundle is lit as a line is, every row of its relations marked; its ends stay bright.
  const bundleEdge = (bundle: ErdBundle) => root.querySelector(`g[id="${bundle.id}"]`);
  const showBundles = (list: readonly ErdBundle[], on: boolean) => {
    for (const bundle of list) {
      const edge = bundleEdge(bundle);
      if (!edge) continue;
      edge.classList.toggle(EDGE_HOVER_CLASS, on);
      if (on && edge.parentNode && edge.parentNode.lastElementChild !== edge) edge.parentNode.appendChild(edge);
      for (const k of bundle.relations) markRows(root, edgeRows[k] ?? [], on);
    }
  };
  const bundleEdges = (list: readonly ErdBundle[]) => list.map(bundleEdge).filter((edge): edge is Element => edge !== null);
  const bundleEnds = (list: readonly ErdBundle[]) => list.flatMap((bundle) => [bundle.source, bundle.target]);
  for (const bundle of bundles) {
    const edge = bundleEdge(bundle);
    if (!edge) continue;
    edge.addEventListener("mouseenter", (event: Event) => later(() => {
      showBundles([bundle], true);
      focusTables(root, new Set(bundleEnds([bundle])), new Set([edge]));
    }, event.isTrusted), { signal });
    edge.addEventListener("mouseleave", (event: Event) => later(() => {
      showBundles([bundle], false);
      clearTableFocus(root);
    }, event.isTrusted), { signal });
  }
  // A folded box: its bundles are lit, the tables and boxes at their other ends stay bright, the rest dims.
  root.querySelectorAll("g.node").forEach((node) => {
    const box = tableOf(node);
    if (!isContourId(box)) return;
    const own = bundles.filter((bundle) => bundle.source === box || bundle.target === box);
    node.addEventListener("mouseenter", (event: Event) => later(() => {
      showBundles(own, true);
      focusTables(root, new Set([box, ...bundleEnds(own)]), new Set(bundleEdges(own)));
    }, event.isTrusted), { signal });
    node.addEventListener("mouseleave", (event: Event) => later(() => {
      showBundles(own, false);
      clearTableFocus(root);
    }, event.isTrusted), { signal });
  });

  // A resource contour (spec 064): its lines to other resources are lit as a hovered line is, the tables at their
  // ends stay bright, its border widens, and everything else dims — everything, when it has no such line. Its
  // bundles to folded boxes are lit the same way (spec 065).
  // A frame's empty space — a resource's (spec 064) or a domain's (spec 071) — lights the whole frame, every table
  // inside it, and every line one of those tables touches, inside the frame and out. A folded frame has no tables:
  // it lights only its lines to other frames (the bundles), so its inside stays one box.
  root.querySelectorAll("g.cluster").forEach((cluster) => {
    const frameId = contourId(cluster);
    if (frameId === null) return;
    // The frame's tables, by what it holds: a resource's copies, or a domain's entities (the markup nests them, but the
    // data says the same and does not depend on the nesting).
    const memberOf = (entity: ErdEntity) =>
      frameId.startsWith(DOMAIN_CONTOUR_ID_PREFIX) ? (entity.domain_qualname ?? "") === frameId.slice(DOMAIN_CONTOUR_ID_PREFIX.length) : tableResource(entity) === frameId.slice(CONTOUR_ID_PREFIX.length);
    const inside = new Set(entities.filter(memberOf).map((entity) => entity.id));
    const own = bundles.filter((bundle) => bundle.source === frameId || bundle.target === frameId);
    // Inside tables: every line they touch. Folded: the bundles stand for them, so no table line is lit.
    const lineIds = inside.size ? relations.flatMap((line, k) => (inside.has(line.source) || inside.has(line.target) ? [k] : [])) : [];
    cluster.addEventListener("mouseenter", (event: Event) => later(() => {
      const edges = edgesById(lineIds);
      cluster.classList.add(EDGE_HOVER_CLASS);
      show(edges, true);
      showBundles(own, true);
      focusTables(root, new Set([...inside, ...joined(edges), ...bundleEnds(own)]), new Set([...edges, ...bundleEdges(own)]));
    }, event.isTrusted), { signal });
    cluster.addEventListener("mouseleave", (event: Event) => later(() => {
      cluster.classList.remove(EDGE_HOVER_CLASS);
      show(edgesById(lineIds), false);
      showBundles(own, false);
      clearTableFocus(root);
    }, event.isTrusted), { signal });
  });
}

/** The middle of Helvetica's capitals above the baseline, in ems: half its cap height (0.718). */
const FRAME_CAP_MIDDLE = 0.359;

/**
 * The disk before every frame's name — a domain's or a resource's, the same folded and unfolded, on the ERD and on the
 * use cases (spec 071). Graphviz drops an ``<IMG>`` inside an HTML label, so ``frameTitleLabel`` keeps a slot for the
 * disk: Graphviz writes it as ``<g id="a_fdd<n>">`` (a domain's) or ``<g id="a_fdr<n>">`` (a resource's) round a
 * polygon filled with the disk's colour. Each slot becomes the disk, drawn in that colour over the slot's box; nothing
 * else of the drawing moves.
 */
export function addFrameIcons(markup: string): string {
  const slot = new RegExp(`<g id="a_${FRAME_DISK_SLOT_PREFIX}([dr])\\d+">\\s*<a\\b[^>]*>\\s*<polygon fill="([^"]+)"[^>]*points="([^"]+)"[^>]*/>\\s*</a>\\s*</g>`, "g");
  return markup.replace(slot, (whole, kind: string, fill: string, points: string, at: number) => {
    const values = (points.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const xs = values.filter((_, i) => i % 2 === 0);
    const ys = values.filter((_, i) => i % 2 === 1);
    if (!xs.length || !ys.length) return whole;
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const width = Math.max(...xs) - left;
    const height = Math.max(...ys) - top;
    const size = Math.min(width, height);
    // The disk's middle stands on the middle of the name's capitals, where the eye reads the line's axis — not on the
    // middle of the row, which the descenders pull down. Without a name after it, the row's middle.
    const name = /<text\b[^>]*\by="(-?[\d.]+)"[^>]*font-size="([\d.]+)"/.exec(markup.slice(at + whole.length, at + whole.length + 600));
    const middle = name ? Number(name[1]) - Number(name[2]) * FRAME_CAP_MIDDLE : top + height / 2;
    const icon = svgDataUriForGraphNodeIcon(fill, kind === "d" ? "Domain" : "Resource");
    // A disk painted by a stand-in keeps it, so a repaint can draw the disk again in the new colour (#85).
    const paint = isPaintStandIn(fill) ? ` data-paint="${fill}" data-disk="${kind === "d" ? "Domain" : "Resource"}"` : "";
    return `<image class="frame-disk"${paint} href="${icon}" x="${(left + (width - size) / 2).toFixed(2)}" y="${(middle - size / 2).toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}"/>`;
  });
}

// ── The card as designed ─────────────────────────────────────────────────

/** A node's markup: from its ``<g id="node…" class="node">`` to the next node or edge group. */
const NODE_START = /<g id="node\d+" class="node"[^>]*>/g;
const BACKDROP = /<path fill="white" stroke="none" d="([^"]+)"\/?>(?:<\/path>)?/;
const GROUP_START = /<g id="[^"]+" class="(?:node|edge|cluster)"/g;
const NUMBER = /-?\d+(?:\.\d+)?/g;

/** A number as the markup writes it: at most two decimals. */
function fixed(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** The rectangle a Graphviz rounded outline spans, from its path. */
function spanOf(d: string): { x0: number; y0: number; x1: number; y1: number } | null {
  const values = (d.match(NUMBER) ?? []).map(Number);
  const xs = values.filter((_, i) => i % 2 === 0);
  const ys = values.filter((_, i) => i % 2 === 1);
  if (!xs.length || !ys.length) return null;
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Move a fill's edges that stop just inside the card onto the card's edges, so nothing is left between them. */
function reachEdges(points: string, span: { x0: number; y0: number; x1: number; y1: number }, inset: number): string {
  const near = (value: number, edge: number) => Math.abs(value - edge) <= inset + 0.01;
  const values = (points.match(NUMBER) ?? []).map(Number);
  return values
    .map((value, i) => {
      if (i % 2 === 0) return fixed(near(value, span.x0) ? span.x0 : near(value, span.x1) ? span.x1 : value);
      return fixed(near(value, span.y0) ? span.y0 : near(value, span.y1) ? span.y1 : value);
    })
    .reduce<string[]>((pairs, value, i, all) => (i % 2 === 0 ? [...pairs, `${value},${all[i + 1]}`] : pairs), [])
    .join(" ");
}

/** The opacity of a table that did not change, in Diff (spec 038, FR-022). */
export const ERD_FADED_OPACITY = 0.32;

/** The dash of a removed table's frame, in Diff. */
export const ERD_REMOVED_DASH = "5 3";

/** What Diff adds to the cards, by table id: the tables to fade and those whose frame is dashed. */
export type ErdCardMarks = { faded: ReadonlySet<string>; dashed: ReadonlySet<string>; halo?: ReadonlyMap<string, string> };

/** One node's markup drawn as the designed card, or as it was when it is not a card. */
function drawCard(node: string, radius: number, stroke: number, dashed = false): string {
  const backdrop = BACKDROP.exec(node);
  const span = backdrop ? spanOf(backdrop[1]!) : null;
  if (!backdrop || !span) return node;
  const d = backdrop[1]!;
  const box = `x="${fixed(span.x0)}" y="${fixed(span.y0)}" width="${fixed(span.x1 - span.x0)}" height="${fixed(span.y1 - span.y0)}" rx="${radius}"`;
  // Graphviz keeps its fills one unit inside its own outline.
  const inset = 1;
  let out = node.replace(backdrop[0], `<rect fill="white" stroke="none" ${box}/>`);
  out = out.replace(/(<clipPath id="[^"]+">)<rect [^>]*\/>/, `$1<rect ${box}/>`);
  const clip = /<clipPath id="([^"]+)">/.exec(out)?.[1];
  out = out.replace(/<polygon\b([^>]*)\bpoints="([^"]+)"/g, (_whole, attributes: string, points: string) => {
    const clipped = clip && !attributes.includes("clip-path") ? ` clip-path="url(#${clip})"` : "";
    return `<polygon${clipped}${attributes}points="${reachEdges(points, span, inset)}"`;
  });
  const outline = new RegExp(`<path fill="none" stroke="([^"]+)" d="${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\/?>(?:<\\/path>)?`);
  const dash = dashed ? ` stroke-dasharray="${ERD_REMOVED_DASH}"` : "";
  return out.replace(outline, (_, colour: string) => `<rect fill="none" stroke="${colour}" stroke-width="${stroke}"${dash} ${box}/>`);
}

/** The table id a node's markup draws: its ``<title>``, unescaped. */
function titleOf(node: string): string {
  return (/<title>([^<]*)<\/title>/.exec(node)?.[1] ?? "").replace(/&#45;/g, "-").replace(/&amp;/g, "&");
}

/**
 * Draw every ERD table as the card of spec 029 (FR-032): Graphviz's rounded outline and backdrop give
 * way to one rounded rectangle of ``radius`` (the mockup's 9) with a ``stroke``-wide outline in the
 * domain colour; the header and the row tints reach the card's edge and are trimmed to the same
 * rounded shape, so the header fills right up to the outline with no gap. Graphviz's layout — every
 * cell's place and size — is left as it is. Run after ``containNodeFills``. In Diff (spec 038) ``marks`` fades the
 * tables that did not change and dashes the frame of those that are gone.
 */
export function drawErdCards(svg: string, radius: number, stroke: number, marks?: ErdCardMarks): string {
  const starts = [...svg.matchAll(NODE_START)].map((m) => m.index ?? 0);
  if (!starts.length) return svg;
  let out = svg.slice(0, starts[0]);
  starts.forEach((start, i) => {
    const next = starts[i + 1] ?? svg.length;
    // A card ends where the next group of the drawing begins — a line (``re<k>``), a cluster or a node.
    GROUP_START.lastIndex = start + 1;
    const following = GROUP_START.exec(svg)?.index ?? svg.length;
    const end = Math.min(following, next);
    const node = svg.slice(start, end);
    const table = marks ? titleOf(node) : "";
    let drawn = drawCard(node, radius, stroke, marks?.dashed.has(table) ?? false);
    if (marks?.faded.has(table)) drawn = drawn.replace(/^<g id="node\d+" class="node"/, (head) => `${head} opacity="${ERD_FADED_OPACITY}"`);
    // a soft halo in the status colour under a table that changed, drawn first so the card stands on it.
    const haloColour = marks?.halo?.get(table);
    const card = haloColour ? /<rect fill="white" stroke="none" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(drawn) : null;
    if (haloColour && card) {
      const [x, y, w, h] = card.slice(1).map(Number);
      const pad = 40;
      const haloRect = `<rect x="${x - pad}" y="${y - pad}" width="${w + 2 * pad}" height="${h + 2 * pad}" rx="${pad + 6}" fill="${haloColour}" fill-opacity="0.16" filter="url(#erd-halo)"/>`;
      drawn = drawn.replace(/^(<g id="node\d+" class="node"[^>]*>)/, `$1${haloRect}`);
    }
    out += drawn + svg.slice(end, next);
  });
  // the halo's blur, once per drawing.
  return marks?.halo?.size ? out.replace(/(<svg\b[^>]*>)/, `$1<defs><filter id="erd-halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter></defs>`) : out;
}
