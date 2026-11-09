// src/lib/erdPaint.ts
/**
 * Which filter section paints the ERD's headers — Domains, Kinds, Resources (spec 061; the physical view only) or, in Diff,
 * Changes (spec 038) — and the CSS that paints them (spec 071).
 *
 * The paint is not in the DOT: the tables and frames carry ``data-domain``, ``data-kind``, ``data-resource`` and
 * ``data-change`` (``tagErdPaint``), and the colours are CSS set on the SVG's root, so a repaint lays nothing out.
 * The choice is a page setting like a filter — ``paint`` in One, ``paint_diff`` in Diff, each kept apart —, so a room
 * shares it and the address carries it; the gear shift at the foot of the filter panel sets it.
 */
import { ERD_DIFF_COLOUR, tableResource, type ErdEntity } from "./buildDotSource.ts";

/** A filter section that can paint the diagram. */
export type PaintSection = "domains" | "kinds" | "resources" | "changes";

/** The page setting that holds the choice: One's and Diff's are kept apart. */
export function paintSettingName(diff: boolean): "paint" | "paint_diff" {
  return diff ? "paint_diff" : "paint";
}

/** The choice a page starts with: Diff painted by its changes, One by its domains. */
export function defaultPaint(diff: boolean): PaintSection {
  return diff ? "changes" : "domains";
}

/** The section that paints: the one chosen when the diagram offers it, else the diagram's first section. */
export function paintSource(sections: readonly PaintSection[], chosen: PaintSection): PaintSection {
  return sections.includes(chosen) ? chosen : (sections[0] ?? "domains");
}

/** The grey an unpainted table and frame keep. */
export const ERD_PAINT_GREY = "#94a3b8";

/** The colours a section paints with, by the row it names: a domain's qualname, a kind's word, a resource's id. */
export type ErdPaintColours = {
  kinds?: Readonly<Record<string, string>>;
  resources?: Readonly<Record<string, string>>;
  domains?: Readonly<Record<string, string>>;
};

/**
 * The CSS that paints the drawing's tables and frames by ``section`` (spec 071). The DOT carries the table's own domain
 * colour; this overrides the header, the card's frame and the frames of the drawing when another section paints.
 * Empty for Domains — the DOT already shows it — apart from greying a resource frame's outline.
 */
export function erdPaintCss(section: PaintSection, entities: readonly ErdEntity[], colours: ErdPaintColours): string {
  const rules: string[] = [];
  /** A table's header band and its card's frame, painted by ``selector``. */
  const table = (selector: string, colour: string): string[] => [
    `${selector} g[id^="a_hd"] polygon, ${selector} g[id^="a_ks"] polygon, ${selector} g[id^="a_hn"] polygon { fill: ${colour}; }`,
    `${selector} rect[fill="none"] { stroke: ${colour}; }`,
  ];
  const greyFrames = (selector: string) => `${selector} path:not(.erd-hit) { stroke: ${ERD_PAINT_GREY}; }`;
  if (section === "kinds") {
    const kinds = [...new Set(entities.map((entity) => entity.entity_kind?.trim() || "unknown"))].sort();
    for (const kind of kinds) rules.push(...table(`g.node[data-kind="${kind}"]`, colours.kinds?.[kind] ?? ERD_PAINT_GREY));
    rules.push(greyFrames("g.cluster"));
  } else if (section === "resources") {
    const resources = [...new Set(entities.flatMap((entity) => (tableResource(entity) ? [tableResource(entity)!] : [])))].sort();
    for (const resource of resources) rules.push(...table(`g.node[data-resource="${resource}"]`, colours.resources?.[resource] ?? ERD_PAINT_GREY));
    rules.push(greyFrames("g.cluster[data-domain]"));
  } else if (section === "changes") {
    for (const change of ["added", "removed", "changed"] as const) rules.push(...table(`g.node[data-change="${change}"]`, ERD_DIFF_COLOUR[change]));
    rules.push(greyFrames("g.cluster"));
  } else {
    // Domains: the DOT already has each table's and each domain frame's colour; only a resource frame's outline greys.
    rules.push(greyFrames("g.cluster[data-resource]"));
  }
  return rules.join("\n");
}
