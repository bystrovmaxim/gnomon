// src/lib/dotWrap.test.ts
/**
 * The parts of a Dot drawing no line joins, wrapped into columns (spec 071): a model of many unlinked tables or frames
 * is drawn about as wide as tall, not as one thread; every table stays in its frame and every line is drawn.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { buildDotSource, setErdPaint, type ErdEntity, type ErdGraphPayload } from "@/lib/buildDotSource";
import { dotParts, wrapParts } from "@/lib/dotWrap";

let gv: Awaited<ReturnType<typeof Graphviz.load>>;
beforeAll(async () => {
  gv = await Graphviz.load();
});

const table = (id: string, domain: string): ErdEntity => ({ id, label: id.split(".").pop()!, fields: [{ name: "id", type: "str", primary_key: true }], color: "#3b82f6", domain_qualname: domain });
/** The drawing's width over its height, from its viewBox. */
function aspect(svg: string): number {
  const [, , width, height] = (/viewBox="([^"]+)"/.exec(svg)?.[1] ?? "0 0 1 1").split(/\s+/).map(Number);
  return width! / height!;
}

describe("the parts of a drawing", () => {
  it("are its nodes joined by lines and by what holds them together, in the order of their first node", () => {
    const parts = dotParts(["a", "b", "c", "d", "e"], [["a", "c"]], [["d", "e"]]);
    expect(parts.map((part) => part.nodes)).toEqual([["a", "c"], ["b"], ["d", "e"]]);
  });

  it("are not wrapped when there are too few to make a column", () => {
    expect(wrapParts(dotParts(["a", "b"], [], []), [])).toEqual([]);
  });

  it("are wrapped through invisible points only: nothing new is drawn", () => {
    const lines = wrapParts(dotParts(["a", "b", "c", "d", "e", "f", "g", "h", "i"], [], []), []);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toMatch(/style=invis/);
  });
});

describe("a Dot ERD of unlinked tables (spec 071)", () => {
  const many = Array.from({ length: 36 }, (_, k) => table(`shop.T${k}`, `shop.D${k % 4}`));
  const payload = (model?: "logical"): ErdGraphPayload => ({ entities: many, relations: [{ source: "shop.T1", target: "shop.T0", source_field: "t0", relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one" }], ...(model ? { model, domain_labels: {}, domain_colors: {} } : {}) });

  it.each(["gv-dot-lr", "gv-dot-tb"] as const)("%s without frames is drawn about as wide as tall, with every line", (layout) => {
    setErdPaint("domain", {});
    const svg = gv.layout(buildDotSource(payload(), layout), "svg", "dot");
    expect(aspect(svg)).toBeGreaterThan(0.4);
    expect(aspect(svg)).toBeLessThan(2.5);
    expect(svg.match(/<g id="re0" class="edge">/g)).toHaveLength(1);
    expect(svg.match(/class="node"/g)).toHaveLength(36);
  });

  it("without frames, with folds in the address, still draws every table, wrapped about as wide as tall (#89)", () => {
    setErdPaint("domain", {});
    const folded = { ...payload(), folded_contours: new Set(["dc:shop.D0", "dc:shop.D1", "dc:shop.D2"]) };
    const svg = gv.layout(buildDotSource(folded, "gv-dot-lr"), "svg", "dot");
    expect(aspect(svg)).toBeGreaterThan(0.4);
    expect(aspect(svg)).toBeLessThan(2.5);
    expect(svg.match(/class="node"/g)).toHaveLength(36);
    expect(svg).not.toContain("<title>dc:");
  });

  it("with frames wraps the tables inside each frame too, and keeps each table in its own frame", () => {
    setErdPaint("domain", {});
    const svg = gv.layout(buildDotSource(payload("logical"), "gv-dot-lr"), "svg", "dot");
    expect(aspect(svg)).toBeGreaterThan(0.4);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const boxOf = (text: string) => {
      const values = (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      const xs = values.filter((_, i) => i % 2 === 0);
      const ys = values.filter((_, i) => i % 2 === 1);
      return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
    };
    const frames = new Map([...doc.querySelectorAll('g.cluster[id^="dc:"]')].map((cluster) => [cluster.id.slice(3), boxOf(cluster.querySelector("path")!.getAttribute("d")!)]));
    expect(frames.size).toBe(4);
    for (const frame of frames.values()) expect((frame.right - frame.left) / (frame.bottom - frame.top)).toBeGreaterThan(0.3);
    for (const node of doc.querySelectorAll("g.node")) {
      const id = node.querySelector("title")!.textContent!;
      const domain = many.find((each) => each.id === id)!.domain_qualname!;
      const box = boxOf(node.querySelector("path, polygon")!.getAttribute("d") ?? node.querySelector("polygon")!.getAttribute("points")!);
      const frame = frames.get(domain)!;
      expect(box.left >= frame.left && box.right <= frame.right && box.top >= frame.top && box.bottom <= frame.bottom, `${id} lies in its frame`).toBe(true);
    }
  });
});
