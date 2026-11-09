// src/lib/erdRepaint.ts
/**
 * A repaint on the drawing in place (#85). The ERD is placed on the page with the paint's stand-ins
 * (``withPaintStandIns``) for colours; this finds, once per drawing, every attribute and frame disk that carries one, and
 * gives each the colour the paint has for it. A new paint then sets those attributes again: the drawing — some fifty
 * thousand elements on 1 000 tables — is neither laid out nor placed again.
 */
import { GREEK_NAME_CLASS } from "./erdPostPass.ts";
import { isPaintStandIn } from "./buildDotSource.ts";
import { svgDataUriForGraphNodeIcon } from "./icons/graph_node_disk_icons.ts";

const PAINTED_ATTRIBUTES = ["fill", "stroke"] as const;

/** Where a placed drawing carries the paint: an element's attribute and its stand-in, and each frame's disk. */
export type ErdPaintIndex = {
  attributes: ReadonlyArray<{ element: Element; name: string; standIn: string }>;
  disks: ReadonlyArray<{ element: Element; standIn: string; kind: "Domain" | "Resource" }>;
};

/** Every place of ``svg`` a stand-in stands in, read while the drawing still carries them. */
export function indexPaint(svg: Element): ErdPaintIndex {
  const attributes: Array<{ element: Element; name: string; standIn: string }> = [];
  for (const element of svg.querySelectorAll('[fill^="#0b"], [stroke^="#0b"]')) {
    for (const name of PAINTED_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value && isPaintStandIn(value)) attributes.push({ element, name, standIn: value });
    }
  }
  const disks = [...svg.querySelectorAll("image.frame-disk[data-paint]")].map((element) => ({
    element,
    standIn: element.getAttribute("data-paint") ?? "",
    kind: element.getAttribute("data-disk") === "Resource" ? ("Resource" as const) : ("Domain" as const),
  }));
  return { attributes, disks };
}

/**
 * Every place of ``index`` in its colour of ``colours``; a stand-in ``colours`` does not know keeps what it has. A
 * table's name drawn as a bar from afar takes its text's new colour.
 */
export function paintDrawing(svg: Element, index: ErdPaintIndex, colours: ReadonlyMap<string, string>): void {
  for (const { element, name, standIn } of index.attributes) {
    const colour = colours.get(standIn);
    if (colour !== undefined && element.getAttribute(name) !== colour) element.setAttribute(name, colour);
  }
  for (const { element, standIn, kind } of index.disks) {
    const colour = colours.get(standIn);
    if (colour === undefined || element.getAttribute("data-colour") === colour) continue;
    element.setAttribute("href", svgDataUriForGraphNodeIcon(colour, kind));
    element.setAttribute("data-colour", colour);
  }
  for (const bar of svg.querySelectorAll(`.${GREEK_NAME_CLASS}`)) {
    const fill = bar.nextElementSibling?.getAttribute("fill");
    if (fill && bar.getAttribute("fill") !== fill) bar.setAttribute("fill", fill);
  }
}
