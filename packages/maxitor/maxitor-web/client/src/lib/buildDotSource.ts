// src/lib/buildDotSource.ts
/**
 * Graphviz DOT source for ERD tables — port of the legacy inline ``buildDotSource`` helper
 * (Graphviz renderer only; other engines omitted).
 */

import type { ChangedPart } from "../api/compare";

/** What happened to a table, a row or a line between two versions (spec 038); absent while one version is drawn. */
/** A table in the drawing: the rows a collapse hides, and whether it is collapsed. */
export type ErdFold = { hidden: ReadonlySet<number>; collapsed: boolean };

export type ErdDiff = "added" | "removed" | "changed" | "unchanged";

export type ErdField = {
  /** In a comparison: this row as A had it, and where (spec 044). */
  was?: ErdField;
  wasAt?: number;
  name: string;
  type?: string;
  primary_key?: boolean;
  foreign_key?: boolean;
  /** Interchange qualname of the closed dictionary this field references, when it references one. */
  reference_qualname?: string | null;
  /** The full annotation, for the type cell's tooltip; absent from a service on an older aoa-action-machine. */
  annotation?: string | null;
  /** What the field is for; a graph older than protocol 1.2 has none. */
  description?: string | null;
  /** The lifecycle this row is, when it is one: its interchange id. */
  lifecycle_id?: string | null;
  /** In Diff: what happened to the row. */
  diff?: ErdDiff;
  /** In Diff: the row's type in A, when it differs from B's — written struck through before it. */
  previous_type?: string;
  /** In Diff, on a lifecycle's row: the states and transitions of that lifecycle that changed, for its card. */
  lifecycle_parts?: readonly ChangedPart[];
};

export type ErdEntity = {
  /** In a comparison: this table as A had it, and where (spec 044). */
  was?: ErdEntity;
  wasAt?: number;
  id: string;
  label?: string;
  color?: string;
  /** The kind word the graph states for this table (``unknown`` when it states none). */
  entity_kind?: string;
  /** The kind's display name, from ``list-entity-kinds``; the header icon's tooltip. */
  entity_kind_label?: string;
  /**
   * The values a closed dictionary declares, in declaration order — carried by the payload
   * and by the graph for every consumer; the card does not draw them.
   */
  values?: ErdValue[];
  /** Interchange domain qualname (for legend / filter when 1-hop adds neighbors). */
  domain_qualname?: string;
  /** Every resource that keeps the table, by id (protocol 1.6); empty or absent when none does, or in an older graph. */
  resource_ids?: string[];
  /** In Diff: the resources A gave it, set only when A's set and B's differ. */
  previous_resource_ids?: string[];
  fields?: ErdField[];
  /** In Diff: it stands in another domain than it did in A. */
  movedDomain?: boolean;
  /** In Diff: what happened to the table itself — its own properties, not its rows. */
  diff?: ErdDiff;
};

/** One value of a closed dictionary, as the entity card shows it. */
export type ErdValue = {
  code: string;
  display_name: string;
  properties?: { name: string; value: string }[];
};

export type ErdRelation = {
  /** In a comparison: this line as A had it, and where (spec 044). */
  was?: ErdRelation;
  wasAt?: number;
  source: string;
  target: string;
  label?: string;
  /** `specialization` marks the line into an axis container; `generalization` marks an extension's inheritance line into its head; anything else is an ordinary link. */
  relationship_kind?: string;
  /** Cardinality of the source end — `one`, `zero_one`, `one_many` or `zero_many` — drawn as its crow's-foot end. */
  source_cardinality?: string;
  /** Cardinality of the target end. */
  target_cardinality?: string;
  /** The field on the source table that points at the target: the role written at the target's end. */
  source_field?: string | null;
  /** Its declared inverse on the target table, or null: the role written at the source's end. */
  target_field?: string | null;
  /** What the relation is for, as its model declares it. */
  description?: string | null;
  /** In Diff: what happened to the line. */
  diff?: ErdDiff;
  /** In Diff: where the line pointed in A, when its field now points elsewhere — drawn thin and dashed. */
  previous_target?: string;
};

/** Id Graphviz writes on the ``k``-th relation's edge group, so the post-pass finds its fields. */
export const erdEdgeId = (k: number) => `re${k}`;

/**
 * Prefix of the id Graphviz writes on a resource frame's group: ``rc:<resource id>`` (spec 064). Only a resource frame
 * has one, so the post-pass and the room tell it from a domain frame and from the invisible spacing.
 */
/** The disk beside a frame's name: a domain's or a resource's, the same folded and unfolded (spec 071). */


export const CONTOUR_ID_PREFIX = "rc:";
/** Prefix of a domain frame's id in the logical view: ``dc:<domain qualname>`` (spec 071). */
export const DOMAIN_CONTOUR_ID_PREFIX = "dc:";

/** Id of the ``i``-th "same entity" line of the ``k``-th entity drawn more than once (spec 070). */
export const erdSameId = (k: number, i: number) => `se${k}_${i}`;

/** Id of the thin dashed line to where the ``k``-th relation pointed in A (spec 038, FR-024). */
export const erdPreviousEdgeId = (k: number) => `rp${k}`;

/**
 * The marks of Diff (spec 038, FR-022): added green, removed red, changed amber, each with its sign as well as
 * its colour; what did not change is faded.
 */
export const ERD_DIFF_COLOUR: Readonly<Record<Exclude<ErdDiff, "unchanged">, string>> = { added: "#16a34a", removed: "#dc2626", changed: "#d97706" };
export const ERD_DIFF_SIGN: Readonly<Record<Exclude<ErdDiff, "unchanged">, string>> = { added: "+", removed: "−", changed: "~" };
/** The ink of an unchanged row's name and of an unchanged line in Diff. */
export const ERD_FADED_COLOUR = "#94a3b8";
/** The alpha appended to a status colour for a marked row's tint: 0x24 / 0xff ≈ 14 %. */
export const ERD_DIFF_TINT_ALPHA = "24";

/** A status that marks something, or ``null`` for unchanged and for one version. */
// how Diff paints the ERD — the chosen variant "2 + 3": the body is neutral (grey frame,
// grey zebra), the filter's gear shift chooses what paints the headers, and a halo lies under every table that changed.
export type ErdPaintSource = "domain" | "kind" | "resource" | "change";
let paintSource: ErdPaintSource = "change";
let paintColours: Readonly<Record<string, string>> = {};
/**
 * what paints the headers now, and the colours when kinds or resources do — by kind word or by resource id; the
 * canvas sets it before it draws.
 */
export function setErdPaint(source: ErdPaintSource, colours: Readonly<Record<string, string>>): void {
  paintSource = source;
  paintColours = colours;
}
/** The grey of a table that the painting section says nothing of: a kind it does not know, a table with no resource. */
const UNPAINTED = "#64748b";
/** The grey a frame's outline takes while no section paints it. */
export const FRAME_GREY = "#94a3b8";
const paintByChange = () => paintSource === "change";
/** The colour a resource frame's outline takes (spec 064, spec 070): its resource's when resources paint, grey otherwise. */
export function erdResourceFrameColour(resource: string): string {
  return paintSource === "resource" ? (paintColours[resource] ?? UNPAINTED) : FRAME_GREY;
}
/** The colour a domain frame's outline takes: its domain's when domains paint, grey otherwise. */
export function erdDomainFrameColour(qual: string, domainColors: Readonly<Record<string, string>> | undefined): string {
  return paintSource === "domain" ? (domainColors?.[qual] ?? FRAME_GREY) : FRAME_GREY;
}
/** kinds' colours when they paint — mid tones of the whole wheel, like the domains' own. */
export const ERD_KIND_PAINT_PALETTE = ["#3b82f6", "#f97316", "#10b981", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#6366f1"];
/** What a table says at a glance, as the Changes filter sorts it: its own status, else "changed" when a row changed. */
export function erdGlance(entity: ErdEntity): ErdDiff {
  return markOf(entity.diff) ?? ((entity.fields ?? []).some((field) => markOf(field.diff)) ? "changed" : "unchanged");
}
/** the ink of a header's name and kind glyph — dark on the quiet grey header of a table that did not itself change. */
export function erdHeadInk(entity: ErdEntity): string {
  return entity.diff !== undefined && erdGlance(entity) === "unchanged" && paintByChange() ? "#334155" : "#ffffff";
}

function markOf(diff: ErdDiff | undefined): Exclude<ErdDiff, "unchanged"> | null {
  return diff && diff !== "unchanged" ? diff : null;
}

/**
 * What the SVG post-pass draws for Diff, by table id: the tables to fade — unchanged, with no marked row — and the
 * removed ones, whose frame is dashed. Empty while one version is drawn.
 */
export function erdDiffMarks(entities: readonly ErdEntity[]): { faded: Set<string>; dashed: Set<string>; halo: Map<string, string> } {
  const faded = new Set<string>();
  const dashed = new Set<string>();
  const halo = new Map<string, string>();
  for (const entity of entities) {
    if (entity.diff === undefined) continue;
    if (entity.diff === "removed") dashed.add(entity.id);
    // only painted by change are the tables that did not change faded; by domains or kinds they stay as drawn.
    if (paintByChange() && erdGlance(entity) === "unchanged") faded.add(entity.id);
    // a halo under a table that changed — its own status, else amber for a table whose rows changed.
    if (erdGlance(entity) !== "unchanged") halo.set(entity.id, ERD_DIFF_COLOUR[markOf(entity.diff) ?? "changed"]);
  }
  return { faded, dashed, halo };
}

/**
 * The crow's-foot end for a cardinality, as Graphviz arrow shapes, the first one nearest the table
 * (spec 029, FR-043): exactly one — two bars; zero or one — a bar and a ring; one or many — a crow's
 * foot and a bar; zero or many — a crow's foot and a ring; each a little way off the table. An unknown
 * value reads as zero or many.
 */
export const ERD_ENDS: Readonly<Record<string, string>> = {
  // ``none`` first leaves a few points between the table's outline and the end, so the bar nearest the
  // table does not merge with its outline (maintainer, 2026-10-27).
  one: "noneteetee",
  zero_one: "noneteeodot",
  one_many: "nonecrowtee",
  zero_many: "nonecrowodot",
};

function erdEnd(cardinality: string | undefined): string {
  return ERD_ENDS[cardinality ?? ""] ?? ERD_ENDS.zero_many!;
}

/**
 * One specialization axis, drawn as a Graphviz cluster around its alternatives.
 *
 * A group is a **drawing, not a table** — its members keep their own nodes, columns and outside
 * relations — and it belongs to the ERD only. No other diagram reads this field, and the full
 * graph has no notion of one.
 */
export type ErdGroup = {
  group_id: string;
  label: string;
  classifier_field?: string;
  members: string[];
};

export type ErdGraphPayload = {
  entities: ErdEntity[];
  relations: ErdRelation[];
  groups?: ErdGroup[];
  /** Each table's rows a collapse hides and whether it is collapsed (spec 043); absent, every table is whole with no control. */
  folds?: ReadonlyMap<string, ErdFold>;
  /**
   * The view drawn (spec 070): ``logical`` frames each domain round its tables; ``physical`` frames each resource of
   * ``resource_ids`` — an empty one too — round a frame per domain of its copies, and gathers the copies no resource
   * keeps in "Not stored". Absent, no frame at all: the drawing checks and the measuring pass draw tables alone.
   */
  model?: "logical" | "physical";
  /** Domain qualname → its name and its colour, for a domain frame's header and outline. */
  domain_labels?: Readonly<Record<string, string>>;
  domain_colors?: Readonly<Record<string, string>>;
  /** Every resource the physical view frames, in order, an empty one too. */
  resource_ids?: readonly string[];
  /** Resource id → its name, for its frame's header. */
  resource_labels?: Readonly<Record<string, string>>;
  /** Each entity drawn more than once in the physical view: its copies' ids, joined by "same entity" lines. */
  same?: readonly (readonly string[])[];
  /**
   * The resource frames drawn folded (spec 065), by their ids ``rc:<resource>``: each is one box standing for its
   * copies, its relations to the rest bundled. Used only in the physical view.
   */
  folded_contours?: ReadonlySet<string>;
};

/**
 * A line with a folded box at an end (spec 065). Between two folded boxes it stands for every relation between them;
 * from a table still drawn it stands for that one relation, so each of the table's links keeps a line of its own.
 */
export type ErdBundle = {
  /** The id Graphviz writes on its edge group: ``rb<j>``. */
  id: string;
  /** The ends as drawn: a table's id, or a folded contour's id. */
  source: string;
  target: string;
  /** The indices of the relations it stands for, in ``relations``. */
  relations: number[];
};

/** What a folded frame stands for: its tables and the relations between them. */
export type ErdFoldCount = { tables: number; inside: number; resources: number; changed: number };

/** How the folded contours of ``data`` are drawn: where each table goes, the bundles, and each box's counts. */
export type ErdFoldPlan = {
  /** Table id → the folded contour it is drawn in; a table drawn as itself is absent. */
  holder: ReadonlyMap<string, string>;
  bundles: readonly ErdBundle[];
  counts: ReadonlyMap<string, ErdFoldCount>;
};

/** Whether ``id`` names a frame — a resource's (``rc:``) or a domain's (``dc:``). */
export function isContourId(id: string): boolean {
  return id.startsWith(CONTOUR_ID_PREFIX) || id.startsWith(DOMAIN_CONTOUR_ID_PREFIX);
}

/** The resource a drawn table lies in: a copy's resource in the physical view, else none. */
export function tableResource(entity: ErdEntity): string | null {
  return (entity as { copy_resource?: string | null }).copy_resource ?? null;
}

/**
 * The fold plan of ``data`` (spec 065, spec 071): in the physical view a copy is drawn in its resource's frame when that
 * frame is folded; in the logical view an entity is drawn in its domain's frame when that frame is folded. A relation
 * between two folded boxes joins the bundle of those two boxes, whichever way it points; a relation from a table still
 * drawn to a box is a line of its own; one with both ends in one box is counted inside it. A specialization is never
 * drawn.
 */
export function foldPlan(data: ErdGraphPayload): ErdFoldPlan {
  const folded = data.folded_contours ?? new Set<string>();
  const holder = new Map<string, string>();
  const counts = new Map<string, ErdFoldCount>();
  const count = (id: string) => {
    if (!counts.has(id)) counts.set(id, { tables: 0, inside: 0, resources: 1, changed: 0 });
    return counts.get(id)!;
  };
  /** The frame a drawn table belongs to: its resource's in the physical view, its domain's in the logical one. */
  const frameOf = (entity: ErdEntity): string | null => {
    if (data.model === "physical") {
      const resource = tableResource(entity);
      return resource ? `${CONTOUR_ID_PREFIX}${resource}` : null;
    }
    const qual = entity.domain_qualname?.trim();
    return qual ? `${DOMAIN_CONTOUR_ID_PREFIX}${qual}` : null;
  };
  for (const entity of data.entities ?? []) {
    const id = frameOf(entity);
    if (!id || !folded.has(id)) continue;
    holder.set(entity.id, id);
    const box = count(id);
    box.tables += 1;
    if (entity.diff !== undefined && erdGlance(entity) !== "unchanged") box.changed += 1;
  }
  // An empty resource frame still folds: its box stands alone, its tables and relations inside are none.
  for (const id of folded) if (data.model === "physical" && id.startsWith(CONTOUR_ID_PREFIX) && (data.resource_ids ?? []).includes(id.slice(CONTOUR_ID_PREFIX.length))) count(id);
  const bundles: ErdBundle[] = [];
  const byEnds = new Map<string, ErdBundle>();
  (data.relations ?? []).forEach((relation, k) => {
    if (relation.relationship_kind === "specialization") return;
    const source = holder.get(relation.source) ?? relation.source;
    const target = holder.get(relation.target) ?? relation.target;
    if (source === relation.source && target === relation.target) return;
    if (source === target) {
      count(source).inside += 1;
      return;
    }
    // Only two folded boxes share a line: a table that is drawn keeps each of its links apart.
    const key = isContourId(source) && isContourId(target) ? [source, target].sort().join("\u0000") : `relation:${k}`;
    let bundle = byEnds.get(key);
    if (!bundle) {
      bundle = { id: `rb${bundles.length}`, source, target, relations: [] };
      byEnds.set(key, bundle);
      bundles.push(bundle);
    }
    bundle.relations.push(k);
  });
  return { holder, bundles, counts };
}

/** The width of a bundle's line: one relation is an ordinary line, the widest bundle of the drawing 4.4 (spec 065). */
export function bundleWidth(size: number, widest: number): number {
  if (size <= 1 || widest <= 1) return 1;
  return Number((1 + (3.4 * (size - 1)) / (widest - 1)).toFixed(2));
}

/**
 * Minimum width of a table's header cell, in points: a short table is as wide as the mockup's card
 * (168 px at a 9 px field font ≈ 205–212 pt at 11 pt fields and a 12 pt header), not a stub.
 */
export const ERD_TABLE_MIN_WIDTH_PT = 210;

/** Side of the square slot the header's kind icon is drawn into, in points. */
export const ERD_KIND_SLOT_PT = 13;

/**
 * The table style of spec 028 (FR-110 … FR-115; mockup screen 21), in diagram units: the header 30 and a
 * row 20 high, the key words in their colours, every second row tinted with the domain colour at 6 %.
 */
export const ERD_HEADER_HEIGHT_PT = 30;
export const ERD_ROW_HEIGHT_PT = 20;
export const ERD_PK_COLOUR = "#b45309";
export const ERD_FK_COLOUR = "#475569";
export const ERD_TYPE_COLOUR = "#64748b";
/** The alpha appended to a domain colour for a tinted row: 0x0f / 0xff ≈ 6 %. */
export const ERD_ROW_TINT_ALPHA = "0f";
/**
 * The card of spec 029 (FR-032; the mockup of spec 028, screen 21): one rounded outline of this radius
 * and width, shared by the header, which fills up to it with no gap.
 */
export const ERD_CARD_RADIUS = 9;
export const ERD_CARD_STROKE = 1.4;

/**
 * Ids of the cells the SVG post-pass looks up. Graphviz writes a cell's ``ID`` into the SVG only with a
 * ``TOOLTIP`` (or ``HREF``), as ``<g id="a_<ID>">`` around the cell's fill and text — the node name is
 * not part of it — so every id carries the table's index and is unique across the drawing.
 */
export const erdCellId = {
  header: (table: number) => `hd${table}`,
  kindSlot: (table: number) => `ks${table}`,
  headerName: (table: number) => `hn${table}`,
  fieldName: (table: number, row: number) => `fn${table}_${row}`,
  fieldType: (table: number, row: number) => `ft${table}_${row}`,
  collapse: (table: number) => `cl${table}`,
};

/** Layout presets matching the old ``activeLayout`` Graphviz branch. */
export type ErdGraphvizLayout = "gv-dot-lr" | "gv-dot-tb" | "gv-neato" | "gv-fdp" | "gv-circo";

/** A value inside a double-quoted DOT string. */
function escDot(s: string): string {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Field types as one clean name ────────────────────────────────────────
// A field's type as one clean name, from whatever a service sends (spec 029, FR-030, FR-031). A service
// on the current aoa-action-machine sends the clean name already (``str | None``, ``CurrencyEnumEntity``,
// ``X[]``) and passes through unchanged; an older one sends Python's own spelling — ``UnionType[str,
// NoneType]``, ``Optional[str]``, ``AssociationOne[X]``, ``Generalization[X]``, ``Specialization[Union[A,
// B], K]``, ``list[X]``, ``Literal[a, b]`` — which is rewritten by the same rules. Kept here, not in a
// module of its own, because the drawing checks run this file in plain Node, where it imports no value.

const ONE_RELATIONS = new Set(["AssociationOne", "CompositeOne", "AggregateOne", "Generalization"]);
const MANY_RELATIONS = new Set(["AssociationMany", "CompositeMany", "AggregateMany"]);
const COLLECTIONS = new Set(["list", "set", "frozenset", "List", "Set", "FrozenSet"]);
const UNIONS = new Set(["Union", "UnionType"]);

/** The longest label a row shows; a longer one ends with ``…`` and the tooltip holds the whole. */
export const FIELD_TYPE_MAX_CHARS = 40;

/** Split ``text`` on ``separator`` outside brackets. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "[") depth += 1;
    else if (ch === "]") depth -= 1;
    else if (depth === 0 && text.startsWith(separator, i)) {
      parts.push(text.slice(start, i));
      start = i + separator.length;
      i += separator.length - 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

/** ``Name[args]`` as its name and its top-level arguments, or ``null`` when ``text`` is not one. */
function generic(text: string): { name: string; args: string[] } | null {
  const open = text.indexOf("[");
  if (open <= 0 || !text.endsWith("]")) return null;
  return { name: text.slice(0, open).trim(), args: splitTop(text.slice(open + 1, -1), ",") };
}

/** Members of a union joined by ``|``, ``None`` once and last. */
function union(members: string[]): string {
  const clean = members.map(cleanFieldType);
  const others = clean.filter((member) => member !== "None");
  return [...others, ...(others.length < clean.length ? ["None"] : [])].join(" | ");
}

/** A literal value as a value: a number as it is, anything else quoted once. */
function literalValue(value: string): string {
  if (/^-?\d+(\.\d+)?$/.test(value) || value === "True" || value === "False" || value === "None") return value;
  return value.startsWith('"') ? value : `"${value.replace(/^'|'$/g, "")}"`;
}

/** The clean name for a generic, or ``null`` when no rule applies. */
function cleanGeneric(name: string, args: string[]): string | null {
  if (UNIONS.has(name)) return union(args);
  if (name === "Optional" && args.length === 1) return union([args[0]!, "None"]);
  if ((ONE_RELATIONS.has(name) || name === "Specialization") && args.length >= 1) return cleanFieldType(args[0]!);
  if ((MANY_RELATIONS.has(name) || COLLECTIONS.has(name)) && args.length === 1) return `${cleanFieldType(args[0]!)}[]`;
  if ((name === "tuple" || name === "Tuple") && args.length === 2 && args[1] === "...") return `${cleanFieldType(args[0]!)}[]`;
  if (name === "Literal") return args.map(literalValue).join(" | ");
  if (name === "Annotated" && args.length >= 1) return cleanFieldType(args[0]!);
  return null;
}

/** One clean name for the type string ``raw``, as a row shows it. */
export function cleanFieldType(raw: string): string {
  const text = raw.trim();
  if (text === "NoneType") return "None";
  const members = splitTop(text, "|");
  if (members.length > 1) return union(members);
  const parsed = generic(text);
  if (!parsed) return text;
  const clean = cleanGeneric(parsed.name, parsed.args);
  return clean ?? `${parsed.name}[${parsed.args.map(cleanFieldType).join(", ")}]`;
}

/** ``label`` cut to fit a row, ending with ``…`` when it was longer. */
export function fitFieldType(label: string, max = FIELD_TYPE_MAX_CHARS): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

/**
 * Parse the axis row's type cell — ``"A (code_a) | B (code_b)"`` — into its
 * alternatives (code + short name each). Returns ``null`` for rows that are
 * not a specialization axis.
 */
function parseSpecializationType(type: string): { alternatives: Array<{ code: string; name: string }> } | null {
  const parts = type.split(" | ");
  if (parts.length < 2) return null;
  const alternatives: Array<{ code: string; name: string }> = [];
  for (const part of parts) {
    const open = part.lastIndexOf(" (");
    const close = part.lastIndexOf(")");
    if (open < 0 || close < open) return null;
    alternatives.push({ name: part.slice(0, open).trim(), code: part.slice(open + 2, close).trim() });
  }
  return { alternatives };
}

/**
 * Resolve a wire short label to the full table label of the entity it names.
 */
function resolveTableLabel(name: string, entities: ErdEntity[]): string {
  for (const e of entities) {
    if (e.label === name) return e.label;
    if (e.label?.replace(/Entity$/, "") === name) return e.label;
    if (e.id.endsWith(`.${name}`)) return e.label || name;
  }
  return name;
}

/** Map UI layout preset to the Graphviz layout engine name passed to ``layout()`` */
export function erdGraphvizEngine(layout: ErdGraphvizLayout): string {
  if (layout === "gv-neato") return "neato";
  if (layout === "gv-fdp") return "fdp";
  if (layout === "gv-circo") return "circo";
  return "dot";
}

/**
 * The DOT that measures the tables whose width is set from outside: those of a specialization block, and collapsed ones,
 * which stay as wide as they are whole (spec 043). Those tables alone, whole, with no lines and no blocks around them
 * (spec 029). Laid out once, it tells each table's natural width; ``erdBlockWidths`` reads them back.
 */
export function buildBlockMeasureDot(data: ErdGraphPayload): string {
  const grouped = new Set((data.groups ?? []).filter((g) => g.members.length > 1).flatMap((g) => g.members));
  const entities = data.entities.filter((e) => grouped.has(e.id) || data.folds?.get(e.id)?.collapsed);
  const folds = data.folds && new Map([...data.folds].map(([id, fold]) => [id, { ...fold, collapsed: false }]));
  return buildDotSource({ entities, relations: [], groups: [], folds }, "gv-dot-lr");
}

/** The width of each table's header in a laid-out drawing, by table id (its node's ``<title>``). */
function headerWidths(svg: string): Map<string, number> {
  const widths = new Map<string, number>();
  for (const node of svg.split('<g id="node').slice(1)) {
    const title = /<title>([^<]*)<\/title>/.exec(node)?.[1];
    const header = /<g id="a_hd\d+">[\s\S]*?points="([^"]+)"/.exec(node)?.[1];
    if (!title || !header) continue;
    const xs = header.trim().split(/\s+/).map((pair) => Number(pair.split(",")[0]));
    widths.set(title.replace(/&#45;/g, "-").replace(/&amp;/g, "&"), Math.max(...xs) - Math.min(...xs));
  }
  return widths;
}

/**
 * One width for every table of a specialization block — its widest table's header — and a collapsed table's own width
 * when whole, read from the drawing of ``buildBlockMeasureDot``; any other table is absent, so it keeps its own.
 */
export function erdBlockWidths(data: ErdGraphPayload, measuredSvg: string): Map<string, number> {
  const natural = headerWidths(measuredSvg);
  const widths = new Map<string, number>();
  for (const group of data.groups ?? []) {
    const members = group.members.filter((id) => natural.has(id));
    if (members.length < 2) continue;
    const widest = Math.ceil(Math.max(...members.map((id) => natural.get(id)!)));
    for (const id of members) widths.set(id, widest);
  }
  for (const [id, fold] of data.folds ?? []) {
    const whole = natural.get(id);
    if (fold.collapsed && whole !== undefined && !widths.has(id)) widths.set(id, Math.ceil(whole));
  }
  return widths;
}

/**
 * The DOT the page lays out: as ``buildDotSource``, with every specialization block's tables given
 * one width. ``measure`` lays a DOT out to SVG (Graphviz's ``layout(dot, "svg", "dot")``); it runs
 * only when the diagram has a block or a collapsed table.
 */
export function buildErdDot(data: ErdGraphPayload, layout: ErdGraphvizLayout, measure: (dot: string) => string): string {
  const measured = (data.groups ?? []).some((group) => group.members.length > 1) || [...(data.folds?.values() ?? [])].some((fold) => fold.collapsed);
  return buildDotSource(data, layout, measured ? erdBlockWidths(data, measure(buildBlockMeasureDot(data))) : undefined);
}

export function buildDotSource(data: ErdGraphPayload, layout: ErdGraphvizLayout, blockWidths?: ReadonlyMap<string, number>): string {
  const { entities, relations } = data;
  const groups = data.groups ?? [];
  const isLR = layout === "gv-dot-lr";
  const isDot = layout === "gv-dot-lr" || layout === "gv-dot-tb";
  const lines: string[] = ["digraph ERD {"];

  if (layout === "gv-neato") {
    lines.push(
      '  graph [fontname="Helvetica" bgcolor=transparent pad="0.5" overlap=false splines=false sep="+40" start=1]',
    );
  } else if (layout === "gv-fdp" || layout === "gv-circo") {
    lines.push(
      '  graph [fontname="Helvetica" bgcolor=transparent pad="0.5" overlap=false start=1]',
    );
  } else {
    lines.push(
      `  graph [rankdir=${isLR ? "LR" : "TB"} fontname="Helvetica" bgcolor=transparent pad="0.5" nodesep="0.8" ranksep="1.2" start=1]`,
    );
  }
  lines.push(
    '  node  [shape=none fontname="Helvetica" fontsize=11 margin="0"]',
    '  edge  [fontname="Helvetica" fontsize=9 color="#94a3b8" arrowsize=0.7]',
    "",
  );

  // A member is declared inside its cluster and nowhere else: Graphviz gives a node to the first
  // subgraph that declares it, so declaring it twice would silently drop it out of the container.
  const grouped = new Set<string>();
  for (const group of groups) {
    for (const member of group.members) grouped.add(member);
  }
  const entityById = new Map((entities ?? []).map((e) => [e.id, e]));
  const tableIndex = new Map((entities ?? []).map((e, i) => [e.id, i]));

  const nodeSource = (nd: ErdEntity): string => {
    const own = markOf(nd.diff);
    // In Diff a table that came, went or changed itself takes its status's colour, frame and header alike.
    const domainColour = nd.color || "#3b82f6";
    const inDiff = nd.diff !== undefined;
    const neutral = inDiff;
    // painted by change, only a table that came or went whole wears its status on the header and frame;
    // a table that changed inside keeps a quiet header and frame — its rows carry the change.
    // painted by change, the header and frame say what happened to the table as a whole: green added,
    // red removed, amber changed inside (its own properties or any row); grey when nothing changed.
    const glance = inDiff ? erdGlance(nd) : "unchanged";
    const quietHead = inDiff && paintByChange() && glance === "unchanged";
    const changeHead = inDiff && paintByChange() && glance !== "unchanged" ? ERD_DIFF_COLOUR[glance] : null;
    const base =
      paintSource === "kind"
        ? (paintColours[nd.entity_kind?.trim() || "unknown"] ?? UNPAINTED)
        : paintSource === "resource"
          ? (paintColours[tableResource(nd) ?? ""] ?? UNPAINTED)
          : domainColour;
    // the header's fill, the frame and the zebra, as the painting asks. Where the filter chooses what
    // paints, the header takes that section's colour alone — a changed table's header too, when domains or kinds
    // paint; its change is then told by its frame, its sign, its rows and its halo.
    const chosenHead = inDiff && !paintByChange();
    const color = chosenHead ? base : changeHead ?? (quietHead ? "#e2e8f0" : own ? ERD_DIFF_COLOUR[own] : base);
    const frameColour = changeHead ?? (quietHead ? "#cbd5e1" : own ? ERD_DIFF_COLOUR[own] : neutral ? "#cbd5e1" : color);
    const zebraColour = neutral ? "#94a3b8" : color;
    const headInk = quietHead ? "#334155" : "white";
    // The name carries what happened to the table as a whole: ``~`` for any change inside, its own properties or a row.
    const sign = glance !== "unchanged" ? ERD_DIFF_SIGN[glance] : null;
    // A copy of an entity kept in several databases says how many there are (spec 070).
    const copies = (nd as { copies?: number }).copies ?? 1;
    const name = `${nd.label || nd.id}${copies > 1 ? ` ×${copies}` : ""}`;
    const title = sign ? `${sign} ${name}` : name;
    const table = tableIndex.get(nd.id) ?? 0;
    const kind = nd.entity_kind?.trim() || "unknown";
    const kindLabel = nd.entity_kind_label || kind.charAt(0).toUpperCase() + kind.slice(1);

    // A row keeps its index when others are hidden: cards, hovers and rooms address rows by it (spec 043).
    const fold = data.folds?.get(nd.id);
    const hides = (row: number) => fold?.collapsed === true && fold.hidden.has(row);
    const rows = (nd.fields || [])
      .map((f, row) => {
        if (hides(row)) return "";
        // Every second row carries the domain colour faintly; keys are told by their word, not by a fill. In Diff a
        // marked row is tinted with its status's colour instead.
        const rowMark = markOf(f.diff);
        const bg = rowMark ? `${ERD_DIFF_COLOUR[rowMark]}${ERD_DIFF_TINT_ALPHA}` : row % 2 === 1 ? `${zebraColour}${ERD_ROW_TINT_ALPHA}` : "#ffffff";
        const icon = f.primary_key ? "PK" : f.foreign_key ? "FK" : "";
        // in Diff the key words are grey — their colour drew the eye away from the change.
        const iconColour = inDiff ? "#94a3b8" : f.primary_key ? ERD_PK_COLOUR : ERD_FK_COLOUR;
        const iconTd = icon
          ? `<TD BGCOLOR="${bg}" ALIGN="LEFT" WIDTH="28" HEIGHT="${ERD_ROW_HEIGHT_PT}"><FONT POINT-SIZE="8.5" COLOR="${iconColour}"><B>${icon}</B></FONT></TD>`
          : `<TD BGCOLOR="${bg}" WIDTH="28" HEIGHT="${ERD_ROW_HEIGHT_PT}"></TD>`;
        // A specialization axis row collapses its alternatives into "Specialization N+"
        // and carries the full list as the cell's hover tooltip. The line already says what a field
        // references, so the type cell carries no "→ target" of its own.
        // Any other type reads as one clean name, cut to the column; the tooltip holds the full annotation
        // (spec 029, FR-030).
        const specialization = parseSpecializationType(f.type || "");
        const typeText = specialization !== null ? `Specialization ${specialization.alternatives.length}+` : fitFieldType(cleanFieldType(f.type || ""));
        // A type that changed reads ``~~old~~ → new`` when both fit the column; otherwise the card says it.
        const before = f.previous_type !== undefined && specialization === null ? cleanFieldType(f.previous_type) : null;
        const typeMarkup =
          before !== null && before.length + typeText.length + 3 <= FIELD_TYPE_MAX_CHARS
            ? `<S>${escHtml(before)}</S> → ${escHtml(typeText)}`
            : escHtml(typeText);
        // The row's name carries its sign; a removed row's is struck through; an unchanged row is faded in Diff.
        const nameText = rowMark ? `${ERD_DIFF_SIGN[rowMark]} ${f.name}` : f.name;
        const nameMarkup =
          rowMark === "removed"
            ? `<FONT COLOR="${ERD_DIFF_COLOUR.removed}"><S>${escHtml(nameText)}</S></FONT>`
            : rowMark
              ? `<FONT COLOR="${ERD_DIFF_COLOUR[rowMark]}">${escHtml(nameText)}</FONT>`
              : f.diff === "unchanged"
                ? `<FONT COLOR="${ERD_FADED_COLOUR}">${escHtml(nameText)}</FONT>`
                : escHtml(nameText);
        const tooltipAttr =
          specialization !== null
            ? ` TOOLTIP="${specialization.alternatives
                .map((alt) => `${alt.code} → ${resolveTableLabel(alt.name, entities ?? [])}`)
                .map(escHtml)
                .join("&#10;")}"`
            : ` TOOLTIP="${escHtml(f.annotation || f.type || "")}"`;
        return (
          "<TR>" +
          iconTd +
          `<TD BGCOLOR="${bg}" ALIGN="LEFT" ID="${erdCellId.fieldName(table, row)}" TOOLTIP="${escHtml(nameText)}">${nameMarkup}</TD>` +
          `<TD BGCOLOR="${bg}" ALIGN="RIGHT" ID="${erdCellId.fieldType(table, row)}"${tooltipAttr}><FONT COLOR="${ERD_TYPE_COLOUR}" POINT-SIZE="10">${typeMarkup}</FONT></TD>` +
          "</TR>"
        );
      })
      .filter(Boolean)
      .join("\n      ");
    const hiddenCount = fold?.collapsed ? fold.hidden.size : 0;
    const hiddenRow = hiddenCount
      ? `<TR><TD COLSPAN="3" ALIGN="LEFT" BGCOLOR="#ffffff" HEIGHT="${ERD_ROW_HEIGHT_PT}"><FONT COLOR="${ERD_FADED_COLOUR}" POINT-SIZE="9">${hiddenCount} field${hiddenCount === 1 ? "" : "s"} hidden</FONT></TD></TR>`
      : "";
    // The control stands only where it would hide a row (spec 043).
    const control = fold?.hidden.size
      ? `<TD WIDTH="4"></TD><TD ID="${erdCellId.collapse(table)}" TOOLTIP="${fold.collapsed ? "Show all fields" : "Hide the fields"}" BGCOLOR="${color}" WIDTH="${ERD_KIND_SLOT_PT}" HEIGHT="${ERD_KIND_SLOT_PT}" FIXEDSIZE="TRUE"></TD>`
      : "";

    return (
      `  "${nd.id}" [label=<<TABLE BGCOLOR="white" BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" STYLE="ROUNDED" COLOR="${frameColour}">` +
      // One header cell with the domain fill, flush with the frame (the card's rounding trims it);
      // inside, the kind icon slot and the name, each filled with the same colour so Graphviz emits
      // their boxes. The post-pass puts icon and name at the left, after an inset (FR-110).
      `<TR><TD COLSPAN="3" BGCOLOR="${color}" ALIGN="LEFT" WIDTH="${blockWidths?.get(nd.id) ?? ERD_TABLE_MIN_WIDTH_PT}" HEIGHT="${ERD_HEADER_HEIGHT_PT}" ` +
      `ID="${erdCellId.header(table)}" TOOLTIP="${escHtml(title)}">` +
      `<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="0"><TR>` +
      `<TD ID="${erdCellId.kindSlot(table)}" TOOLTIP="${escHtml(kindLabel)}" BGCOLOR="${color}" ` +
      `WIDTH="${ERD_KIND_SLOT_PT}" HEIGHT="${ERD_KIND_SLOT_PT}" FIXEDSIZE="TRUE"></TD>` +
      `<TD WIDTH="4"></TD>` +
      `<TD ID="${erdCellId.headerName(table)}" TOOLTIP="${escHtml(title)}" BGCOLOR="${color}">` +
      `<FONT COLOR="${headInk}" POINT-SIZE="12.5"><B>${escHtml(title)}</B></FONT></TD>${control}` +
      `</TR></TABLE></TD></TR>${rows}${hiddenRow}</TABLE>>]`
    );
  };

  const inDiffDrawing = (entities ?? []).some((entity) => entity.diff !== undefined);
  const groupSource = (group: ErdGroup): string[] => {
    const members = group.members
      .map((id) => entityById.get(id))
      .filter((nd): nd is ErdEntity => nd !== undefined);
    if (members.length < 2) return [];
    return [
      `  subgraph "cluster_${group.group_id}" {`,
      `    label="${escHtml(group.label)}";`,
      // See-through but half a tone darker than the canvas, with an outline one point wider than before.
      // In Diff no fill at all and an outline a point wider, so the container does not stand out among the faded tables.
      ...(inDiffDrawing ? ['    style="rounded,dashed";', "    penwidth=3;"] : ['    style="rounded,dashed,filled";', '    fillcolor="#0f172a0d";', "    penwidth=2;"]),
      '    color="#94a3b8";',
      '    fontsize=10;',
      '    margin=12;',
      ...members.map((nd) => nodeSource(nd)),
      "  }",
    ];
  };

  // The frames of the view (spec 070). A specialization container goes inside the innermost frame that holds all its
  // tables; a table is declared once, in its innermost cluster.
  const plan = foldPlan(data);
  const isFolded = (id: string) => plan.counts.has(id);
  /** A folded resource frame (spec 065): one box in the frame's style, its name, what it stands for, and in Diff what changed. */
  const foldNode = (id: string, name: string, colour: string, nameInk: string): string[] => {
    const box = plan.counts.get(id) ?? { tables: 0, inside: 0, resources: 1, changed: 0 };
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const what = `${plural(box.tables, "table")} · ${plural(box.inside, "relation")} inside`;
    const changed = box.changed > 0 ? `<TR><TD ALIGN="LEFT" COLSPAN="2"><FONT POINT-SIZE="10" COLOR="${ERD_DIFF_COLOUR.changed}"><B>${ERD_DIFF_SIGN.changed} ${box.changed} changed</B></FONT></TD></TR>` : "";
    return [
      `  "${escDot(id)}" [shape=box style="rounded,filled" fillcolor="white" color="${colour}" penwidth=2 margin="0.28,0.14" tooltip="${escDot(id.slice(3))}" ` +
        `label=<<TABLE BORDER="0" CELLPADDING="2" CELLSPACING="0"><TR><TD ALIGN="LEFT"><FONT POINT-SIZE="15" COLOR="${nameInk}"><B>${escHtml(name)}</B></FONT></TD><TD WIDTH="20"></TD></TR>` +
        `<TR><TD ALIGN="LEFT" COLSPAN="2"><FONT POINT-SIZE="10" COLOR="#64748b">${escHtml(what)}</FONT></TD></TR>${changed}</TABLE>>]`,
    ];
  };
  const domainOf = (nd: ErdEntity) => nd.domain_qualname?.trim() || "";
  const domainName = (qual: string) => data.domain_labels?.[qual] ?? (qual.split(".").pop() || qual);
  /** The tables of ``members`` that one frame holds, its containers inside it, as DOT lines. */
  const frameBody = (members: readonly ErdEntity[]): string[] => {
    const here = new Set(members.map((nd) => nd.id));
    const inner = groups.filter((group) => group.members.filter((id) => entityById.has(id)).every((id) => here.has(id)) && group.members.some((id) => here.has(id)));
    const held = new Set(inner.flatMap((group) => group.members));
    return [...inner.flatMap(groupSource), ...members.filter((nd) => !held.has(nd.id)).map((nd) => nodeSource(nd))];
  };
  /** A domain's frame (logical view). */
  const domainFrame = (name: string, qual: string, members: readonly ErdEntity[]): string[] => {
    const colour = paintSource === "domain" ? (data.domain_colors?.[qual] ?? FRAME_GREY) : FRAME_GREY;
    return [
      `  subgraph "${name}" {`,
      `    id="${escDot(`${DOMAIN_CONTOUR_ID_PREFIX}${qual}`)}";`,
      `    tooltip="${escDot(qual)}";`,
      `    label=<<TABLE BORDER="0" CELLPADDING="6"><TR><TD><B>${escHtml(domainName(qual))}</B></TD></TR></TABLE>>;`,
      '    style="rounded";',
      `    color="${colour}";`,
      `    fontcolor="${colour === FRAME_GREY ? "#475569" : colour}";`,
      "    penwidth=2;",
      "    fontsize=15;",
      "    margin=20;",
      ...frameBody(members),
      "  }",
    ];
  };
  const byDomain = (members: readonly ErdEntity[]) => {
    const quals = [...new Set(members.map(domainOf))].sort();
    return quals.map((qual) => ({ qual, members: members.filter((nd) => domainOf(nd) === qual) }));
  };
  const framed = new Set<string>();
  if (data.model === "logical") {
    byDomain(entities ?? []).forEach(({ qual, members }, index) => {
      const id = `${DOMAIN_CONTOUR_ID_PREFIX}${qual}`;
      const name = domainName(qual);
      const colour = paintSource === "domain" ? (data.domain_colors?.[qual] ?? FRAME_GREY) : FRAME_GREY;
      if (isFolded(id)) {
        members.forEach((nd) => framed.add(nd.id));
        lines.push(...foldNode(id, name, colour, colour === FRAME_GREY ? "#475569" : colour));
        return;
      }
      // The three engines that cannot frame reproducibly are composed by ``erdCompose`` (research R2).
      if (!isDot) return;
      members.forEach((nd) => framed.add(nd.id));
      lines.push(`  subgraph "cluster_domain_${index}_room" {`, "    style=invis;", '    label="";', '    id="";', '    tooltip="";', "    margin=36;", ...domainFrame(`cluster_domain_${index}`, qual, members), "  }");
    });
  }
  if (data.model === "physical") {
    const resourceFrame = (resource: string | null, index: number): string[] => {
      const members = (entities ?? []).filter((nd) => tableResource(nd) === resource);
      const id = resource === null ? null : `${CONTOUR_ID_PREFIX}${resource}`;
      const colour = resource !== null && paintSource === "resource" ? (paintColours[resource] ?? UNPAINTED) : FRAME_GREY;
      const name = resource === null ? "Not stored" : (data.resource_labels?.[resource] ?? (resource.split(".").pop() || resource));
      if (id && isFolded(id)) {
        members.forEach((nd) => framed.add(nd.id));
        return foldNode(id, name, colour, paintSource === "resource" ? colour : "#475569");
      }
      // The three engines that cannot frame reproducibly are composed by ``erdCompose`` (research R2): here the
      // resource frame emits no cluster, only its tables, which the composer lays out and frames itself.
      if (!isDot) return [];
      members.forEach((nd) => framed.add(nd.id));
      // An invisible frame round each frame keeps them apart: Graphviz spaces clusters only by nodesep.
      return [
        `  subgraph "cluster_resource_${index}_room" {`,
        "    style=invis;",
        // Graphviz passes a frame's label, id and tooltip down to the frames inside it: each frame says its own.
        '    label="";',
        '    id="";',
        '    tooltip="";',
        "    margin=36;",
        `  subgraph "cluster_resource_${index}" {`,
        // Spec 064: a resource's frame is named by its resource, so a hover on its border knows whose links to light.
        ...(id ? [`    id="${escDot(id)}";`, `    tooltip="${escDot(resource!)}";`] : ['    id="";', '    tooltip="Entities no resource keeps";']),
        `    label=<<TABLE BORDER="0" CELLPADDING="6"><TR><TD><B>${escHtml(name)}</B></TD></TR></TABLE>>;`,
        `    style="${resource === null ? "rounded,dashed" : "rounded"}";`,
        `    color="${colour}";`,
        `    fontcolor="${resource !== null && paintSource === "resource" ? colour : "#475569"}";`,
        "    penwidth=2;",
        "    fontsize=15;",
        "    margin=20;",
        // A frame with no table still stands, with its name: nothing of the model is hidden.
        ...(members.length ? frameBody(members) : [`    "rc_empty_${index}" [shape=point style=invis width=1.2]`]),
        "  }",
        "  }",
      ];
    };
    (data.resource_ids ?? []).forEach((resource, index) => lines.push(...resourceFrame(resource, index)));
    if ((entities ?? []).some((nd) => tableResource(nd) === null)) lines.push(...resourceFrame(null, (data.resource_ids ?? []).length));
  }
  for (const group of groups) {
    if (group.members.some((id) => framed.has(id))) continue;
    lines.push(...groupSource(group));
  }

  for (const nd of entities ?? []) {
    if (grouped.has(nd.id) || framed.has(nd.id)) continue;
    lines.push(nodeSource(nd));
  }

  lines.push("");
  (relations ?? []).forEach((ed, k) => {
    // The axis relation is already carried by the head's field row ("details (by variant_code)")
    // and by the container that holds the alternatives — no edge is drawn for it.
    if (ed.relationship_kind === "specialization") return;
    // A relation with an end in a folded contour is drawn as part of its bundle, below (spec 065).
    if (plan.holder.has(ed.source) || plan.holder.has(ed.target)) return;
    // In Diff a line takes its status's colour — removed also dashed —, an unchanged one is faded (FR-022, FR-024).
    const lineMark = markOf(ed.diff);
    const look = lineMark
      ? `color="${ERD_DIFF_COLOUR[lineMark]}" penwidth=1.6 ${lineMark === "removed" && ed.relationship_kind !== "generalization" ? "style=dashed " : ""}`
      : ed.diff === "unchanged"
        ? `color="${ERD_FADED_COLOUR}55" `
        : "";
    // A line between copies in two databases is dashed: no join is possible there, an action glues the data (spec 070).
    const across = (ed as { across?: boolean }).across === true && ed.relationship_kind !== "generalization" ? "style=dashed " : "";
    const id = `id="${erdEdgeId(k)}" ${look}${across}`;
    // A field that now points at another table is one changed line: solid to where it points in B, and thin and
    // dashed to where it pointed in A — never a red line and a green one.
    if (ed.previous_target && entityById.has(ed.previous_target) && ed.previous_target !== ed.target) {
      lines.push(
        `  "${ed.source}" -> "${ed.previous_target}" [id="${erdPreviousEdgeId(k)}" color="${ERD_DIFF_COLOUR.changed}" style=dashed penwidth=0.8 arrowhead=none constraint=false]`,
      );
    }
    if (ed.relationship_kind === "generalization" || !ed.source_field) {
      // ERD notation has no arrows (spec 029, FR-043). A generalization is dashed and ends like any
      // other line — zero or one at the variant, exactly one at the head; a row from an older server
      // keeps its middle label and is a plain line.
      const label = ed.label ? `label="${escHtml(ed.label)}" fontsize=9 ` : "";
      const ends =
        ed.relationship_kind === "generalization"
          ? `style=dashed dir=both arrowtail=${erdEnd(ed.source_cardinality)} arrowhead=${erdEnd(ed.target_cardinality)} `
          : "arrowhead=none ";
      lines.push(`  "${ed.source}" -> "${ed.target}" [${`${id}${label}${ends}`.trim()}]`);
      return;
    }
    // One association, read the ERD way: each end shows how many of the table it touches, and the
    // role that table plays is written next to it; nothing in the middle.
    const tail = ed.target_field ? ` taillabel="${escHtml(ed.target_field)}"` : "";
    lines.push(
      `  "${ed.source}" -> "${ed.target}" [${id}dir=both arrowtail=${erdEnd(ed.source_cardinality)} ` +
        `arrowhead=${erdEnd(ed.target_cardinality)} headlabel="${escHtml(ed.source_field)}"${tail} labelfontsize=9]`,
    );
  });
  // Spec 070: the copies of one entity are joined by a dashed "same entity" line, which never ranks the layout.
  (data.same ?? []).forEach((ids, k) => {
    const drawn = ids.filter((id) => entityById.has(id) && !plan.holder.has(id));
    for (let i = 1; i < drawn.length; i += 1) {
      lines.push(`  "${escDot(drawn[i - 1]!)}" -> "${escDot(drawn[i]!)}" [id="${erdSameId(k, i)}" class="erd-same" style=dashed color="#94a3b8" penwidth=1.2 arrowhead=none constraint=false]`);
    }
  });
  // Spec 065: one line per pair of drawn ends with a folded box among them, wider with the relations it stands for,
  // its count on a plate in the middle; no cardinality, since its relations differ.
  const widest = Math.max(1, ...plan.bundles.map((bundle) => bundle.relations.length));
  for (const bundle of plan.bundles) {
    const size = bundle.relations.length;
    const plate = size > 1 ? ` label="×${size}" fontsize=10 fontcolor="#334155"` : "";
    lines.push(`  "${escDot(bundle.source)}" -> "${escDot(bundle.target)}" [id="${bundle.id}" arrowhead=none penwidth=${bundleWidth(size, widest)}${plate}]`);
  }
  lines.push("}");
  return lines.join("\n");
}
