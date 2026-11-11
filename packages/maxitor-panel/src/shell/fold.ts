// @maxitor/panel — when a phone's bottom bar folds the page's sections into one "⋯" menu (spec 078, FR-009).
import type { BarSection } from "./types";

/** How many items after the zoom a phone's bar holds before the sections fold into "⋯". */
export const PHONE_BAR_ITEMS = 3;

/** How many buttons a section takes in the bar. */
export function itemsOf(section: BarSection): number {
  if (section.kind === "choice") return section.options.length;
  if (section.kind === "button") return section.items.length;
  return 1;
}

/** Whether a phone's bar folds the page's sections into one menu. */
export function foldsOnPhone(sections: readonly BarSection[]): boolean {
  return sections.reduce((n, section) => n + itemsOf(section), 0) > PHONE_BAR_ITEMS;
}
