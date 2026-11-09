// src/lib/erdRepaint.test.ts
/** A repaint sets the colours of the drawing on the page and touches nothing else (#85). */
import { describe, expect, it } from "vitest";
import { GREEK_NAME_CLASS } from "@/lib/erdPostPass";
import { indexPaint, paintDrawing } from "@/lib/erdRepaint";
import { svgDataUriForGraphNodeIcon } from "@/lib/icons/graph_node_disk_icons";

const HEAD = "#0b0001";
const INK = "#0b0002";
const FRAME = "#0b0003";

function drawing(): SVGSVGElement {
  document.body.innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg"><g class="graph">` +
    `<g class="cluster"><path fill="none" stroke="${FRAME}" d="M0,0"/><image class="frame-disk" data-paint="${FRAME}" data-disk="Resource" href="x"/></g>` +
    `<g class="node"><polygon fill="${HEAD}" stroke="${FRAME}" points="0,0"/><text fill="${INK}">Order</text><text fill="#64748b">str</text></g>` +
    `</g></svg>`;
  return document.querySelector("svg")!;
}

describe("a repaint on the drawing in place (#85)", () => {
  it("gives every stand-in its colour, and a new paint its new colours, on the same elements", () => {
    const svg = drawing();
    const elements = [...svg.querySelectorAll("*")];
    const index = indexPaint(svg);
    expect(index.attributes).toHaveLength(4);
    paintDrawing(svg, index, new Map([[HEAD, "#ea580c"], [INK, "white"], [FRAME, "#94a3b8"]]));
    expect(svg.querySelector("polygon")!.getAttribute("fill")).toBe("#ea580c");
    expect(svg.querySelector("polygon")!.getAttribute("stroke")).toBe("#94a3b8");
    expect(svg.querySelector("text")!.getAttribute("fill")).toBe("white");
    expect(svg.querySelector("image")!.getAttribute("href")).toBe(svgDataUriForGraphNodeIcon("#94a3b8", "Resource"));
    paintDrawing(svg, index, new Map([[HEAD, "#3b82f6"], [INK, "#334155"], [FRAME, "#10b981"]]));
    expect(svg.querySelector("polygon")!.getAttribute("fill")).toBe("#3b82f6");
    expect(svg.querySelector("path")!.getAttribute("stroke")).toBe("#10b981");
    expect(svg.querySelector("text")!.getAttribute("fill")).toBe("#334155");
    expect(svg.querySelector("image")!.getAttribute("href")).toBe(svgDataUriForGraphNodeIcon("#10b981", "Resource"));
    // A colour no paint gives stays; nothing is placed again.
    expect(svg.querySelectorAll("text")[1]!.getAttribute("fill")).toBe("#64748b");
    expect([...svg.querySelectorAll("*")]).toEqual(elements);
  });

  it("gives a table's name drawn as a bar from afar its text's new colour", () => {
    const svg = drawing();
    const index = indexPaint(svg);
    paintDrawing(svg, index, new Map([[INK, "white"]]));
    const name = svg.querySelector("text")!;
    const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bar.setAttribute("class", GREEK_NAME_CLASS);
    bar.setAttribute("fill", "white");
    name.parentNode!.insertBefore(bar, name);
    paintDrawing(svg, index, new Map([[INK, "#334155"]]));
    expect(bar.getAttribute("fill")).toBe("#334155");
  });
});
