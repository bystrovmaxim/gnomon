// src/lib/erdCompose.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { erdCompose } from "@/lib/erdCompose";
import { type ErdEntity, type ErdGraphPayload, type ErdGraphvizLayout } from "@/lib/buildDotSource";
import { physicalDrawing } from "@/lib/erdViews";

let gv: Awaited<ReturnType<typeof Graphviz.load>>;

beforeAll(async () => {
  gv = await Graphviz.load();
});

const layoutFn = (dot: string, engine: string) => gv.layout(dot, "svg", engine as never);

const ARCHIVE = "shop.ArchiveDatabase";
const BILLING = "shop.BillingDatabase";
const STOREFRONT = "shop.StorefrontDatabase";
const STORE = "shop.StoreDomain";
const MONEY = "shop.MoneyDomain";

const table = (id: string, domain: string, ...resource_ids: string[]): ErdEntity => ({
  id,
  label: id.split(".")[1],
  fields: [{ name: "id", type: "str", primary_key: true }],
  color: "#3b82f6",
  domain_qualname: domain,
  resource_ids,
});

const entities = [
  table("shop.Order", STORE, STOREFRONT),
  table("shop.OrderLine", STORE, STOREFRONT),
  table("shop.Invoice", MONEY, BILLING, STOREFRONT),
  table("shop.CardPayment", MONEY, BILLING),
  table("shop.BankPayment", MONEY, BILLING),
  table("shop.Legacy", MONEY),
];
const relations = [
  { source: "shop.OrderLine", target: "shop.Order", source_field: "order", relationship_kind: "composition", source_cardinality: "zero_many", target_cardinality: "one" },
  { source: "shop.Invoice", target: "shop.Order", source_field: "order", relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one" },
];
const drawing = physicalDrawing(entities, relations, new Set(), [{ group_id: "shop.Invoice:payment", label: "payment (by kind)", members: ["shop.BankPayment", "shop.CardPayment"] }]);
const shop: ErdGraphPayload = {
  entities: drawing.entities,
  relations: drawing.relations,
  groups: drawing.groups,
  same: drawing.same,
  model: "physical",
  domain_labels: { [STORE]: "Store", [MONEY]: "Money" },
  resource_ids: [ARCHIVE, BILLING, STOREFRONT],
  resource_labels: { [ARCHIVE]: "ArchiveDatabase", [BILLING]: "BillingDatabase", [STOREFRONT]: "StorefrontDatabase" },
};

type Box = { left: number; top: number; right: number; bottom: number };

function boxOfPoints(points: string): Box {
  const pairs = points.trim().split(/\s+/).map((pair) => pair.split(",").map(Number) as [number, number]);
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  return { left: Math.min(...xs), top: Math.max(...ys), right: Math.max(...xs), bottom: Math.min(...ys) };
}

/** Every frame's box and id, keyed by its title (the subgraph name). */
function clustersOf(svg: string): Map<string, { box: Box; id: string }> {
  const found = new Map<string, { box: Box; id: string }>();
  for (const match of svg.matchAll(/<g id="([^"]+)" class="cluster">\s*<title>([^<]+)<\/title>([\s\S]*?)<\/g>/g)) {
    const body = match[3]!;
    const path = /<(?:polygon|path)[^>]*(?:points="([^"]+)"|d="([^"]+)")/.exec(body);
    const coords = path?.[1] ?? (path?.[2] ?? "").replace(/[MCLZ]/g, " ").trim().replace(/\s+/g, " ");
    found.set(match[2]!, { box: boxOfPoints(coords), id: match[1]! });
  }
  return found;
}

function nodeBox(svg: string, id: string): Box {
  const title = svg.indexOf(`<title>${id}</title>`);
  const wraps = [...svg.slice(0, title).matchAll(/<g transform="translate\(([-\d.]+),([-\d.]+)\)">/g)];
  const wrap = wraps[wraps.length - 1];
  const dx = wrap ? Number(wrap[1]) : 0;
  const dy = wrap ? Number(wrap[2]) : 0;
  const backdrop = /fill="white"[^>]*d="([^"]+)"/.exec(svg.slice(title, title + 30000))?.[1] ?? "";
  const box = boxOfPoints(backdrop.replace(/[MCLZ]/g, " ").trim());
  return { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy };
}

const inside = (inner: Box, outer: Box) => inner.left >= outer.left && inner.right <= outer.right && inner.top <= outer.top && inner.bottom >= outer.bottom;
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top > b.bottom && b.top > a.bottom;

describe("the composed frames of the three non-Dot engines (research R2)", () => {
  for (const layout of ["gv-neato", "gv-fdp", "gv-circo"] as ErdGraphvizLayout[]) {
    describe(layout, () => {
      const svg = () => erdCompose(shop, layout, layoutFn);

      it("gives one frame per resource, and Not stored, none nested", () => {
        const clusters = clustersOf(svg());
        const frames = [0, 1, 2, 3].map((index) => clusters.get(`cluster_resource_${index}`));
        expect(frames.every(Boolean)).toBe(true);
        expect(clusters.get("cluster_resource_0")?.id).toBe(`rc:${ARCHIVE}`);
        expect(clusters.get("cluster_resource_1")?.id).toBe(`rc:${BILLING}`);
        expect(clusters.get("cluster_resource_2")?.id).toBe(`rc:${STOREFRONT}`);
        const boxes = frames.map((frame) => frame!.box);
        for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) expect(inside(boxes[i]!, boxes[j]!)).toBe(false);
      });

      it("draws no two frame boxes overlapping", () => {
        const clusters = clustersOf(svg());
        const boxes = [0, 1, 2, 3].map((index) => clusters.get(`cluster_resource_${index}`)!.box);
        for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) expect(overlaps(boxes[i]!, boxes[j]!)).toBe(false);
      });

      it("holds every table in its own frame and no other", () => {
        const svgText = svg();
        const clusters = clustersOf(svgText);
        const home: Record<string, string> = {
          [ARCHIVE]: "cluster_resource_0",
          [BILLING]: "cluster_resource_1",
          [STOREFRONT]: "cluster_resource_2",
        };
        for (const copy of drawing.entities) {
          const resource = copy.copy_resource;
          const ownName = resource === null ? "cluster_resource_3" : home[resource]!;
          const own = clusters.get(ownName)!.box;
          const box = nodeBox(svgText, copy.id);
          expect(inside(box, own)).toBe(true);
          for (const [name, other] of clusters) {
            if (name === ownName || !name.startsWith("cluster_resource_")) continue;
            expect(inside(box, other.box)).toBe(false);
          }
        }
      });

      it("lays the same input out to the same bits twice", () => {
        expect(svg()).toBe(svg());
      });
    });
  }
});
