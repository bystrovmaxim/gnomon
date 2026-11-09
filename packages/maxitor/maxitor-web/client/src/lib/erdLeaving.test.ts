// src/lib/erdLeaving.test.ts
/** What leaves the drawing leaves at once, before the new picture is laid out (#85). */
import { describe, expect, it } from "vitest";
import { foldedBoxOf, hideWhatLeaves, nodesOfDot } from "@/lib/erdLeaving";

const svg = () => {
  document.body.innerHTML =
    `<svg><g class="graph">` +
    `<g class="node"><title>shop.Order</title></g><g class="node"><title>shop.Line</title></g><g class="node"><title>bill.Invoice</title></g>` +
    `<g class="edge"><title>shop.Line&#45;&gt;shop.Order</title></g><g class="edge"><title>bill.Invoice&#45;&gt;shop.Order</title></g>` +
    `</g></svg>`;
  return document.querySelector("svg")!;
};
const shown = (root: Element) => [...root.querySelectorAll<SVGElement>("g.node, g.edge")].filter((e) => e.style.display !== "none").map((e) => e.querySelector("title")!.textContent);

describe("a change shown on the drawing at once (#85)", () => {
  it("reads the tables and boxes a DOT declares, never the ends of its lines", () => {
    const dot = 'digraph ERD {\n  "shop.Order" [label=<x>];\n  "dc:say \\"hi\\"" [label=<y>];\n  "shop.Order" -> "bill.Invoice" [id="re0"];\n}';
    expect([...nodesOfDot(dot)]).toEqual(["shop.Order", 'dc:say "hi"']);
  });

  it("hides the tables the new picture does not hold and every line with an end among them", () => {
    const root = svg();
    expect(hideWhatLeaves(root, new Set(["shop.Order", "shop.Line", "dc:bill"]))).toBe(2);
    expect(shown(root)).toEqual(["shop.Order", "shop.Line", "shop.Line->shop.Order"]);
    // Asked again, nothing more leaves.
    expect(hideWhatLeaves(root, new Set(["shop.Order", "shop.Line"]))).toBe(0);
  });
});

describe("a step to a change inside a folded frame (#89)", () => {
  it("stands on the folded box that holds the change's table, and on nothing for a table drawn or unknown", () => {
    document.body.innerHTML = `<svg><g class="node"><title>shop.Order</title></g><g class="node" id="box"><title>dc:shop.Store</title></g></svg>`;
    const svg = document.querySelector("svg")!;
    const holder = new Map([["shop.Line", "dc:shop.Store"], ["shop.Cart", "dc:shop.Store"]]);
    expect(foldedBoxOf(svg, holder, ["shop.Line"])?.id).toBe("box");
    // A line: either end folded is enough.
    expect(foldedBoxOf(svg, holder, ["shop.Order", "shop.Cart"])?.id).toBe("box");
    expect(foldedBoxOf(svg, holder, ["shop.Order"])).toBeNull();
    expect(foldedBoxOf(svg, holder, ["shop.Gone"])).toBeNull();
  });
});
