// src/lib/erdPaint.ts
/**
 * Which filter section paints the ERD's headers — Domains, Kinds, Resources (spec 061; the physical view only) or, in Diff,
 * Changes (spec 038). The choice is a page
 * setting like a filter — ``paint`` in One, ``paint_diff`` in Diff, each kept apart —, so a room shares it and the
 * address carries it; the gear shift at the foot of the filter panel sets it.
 */

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

/**
 * The section that paints an ERD. A section the reader chose paints whenever the diagram offers it, in either view;
 * with no choice yet (``null``) the physical view of One paints by resource and every other view by its default
 * (spec 070, issue 73). "No choice" is kept apart from "Domains" so that choosing Domains in the physical view sticks.
 */
export function erdPaintSource(sections: readonly PaintSection[], chosen: PaintSection | null, physical: boolean, diff: boolean): PaintSection {
  if (chosen !== null) return paintSource(sections, chosen);
  return paintSource(sections, physical && !diff ? "resources" : defaultPaint(diff));
}
