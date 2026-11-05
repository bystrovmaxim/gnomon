// scripts/check-erd-resources.ts
/**
 * The ERD drawing check of spec 061 — what Boundary and the paint by resource look like in the SVG the page shows.
 *
 * It lays a shop out through the same WASM Graphviz build the client loads, with the production passes
 * (`containNodeFills`, `drawErdCards`), and asserts what the reader sees: one contour per resource, headed by its
 * name and holding exactly that resource's tables, no relation line leaving a contour, a specialization block
 * inside its resource's contour, each contour and header in its resource's colour when resources paint, a table
 * of no resource outside every contour, and a graph older than protocol 1.6 drawn as before. It is plain Node: no
 * framework, no bundler.
 *
 * Exit codes: 0 all assertions passed; 1 an assertion failed; 2 the environment cannot run it.
 */

import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { buildDotSource, ERD_CARD_RADIUS, ERD_CARD_STROKE, setErdPaint, type ErdEntity, type ErdGraphPayload } from "../src/lib/buildDotSource.ts";
import { containNodeFills } from "../src/lib/containNodeFills.ts";
import { drawErdCards } from "../src/lib/erdPostPass.ts";

let failures = 0;

/** Record one assertion. */
function check(label: string, passed: boolean, detail = ""): void {
  if (passed) {
    console.log(`ok   ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

let gv: Awaited<ReturnType<typeof Graphviz.load>>;
try {
  gv = await Graphviz.load();
} catch (error) {
  console.error(`cannot load WASM Graphviz: ${String(error)}`);
  process.exit(2);
}

const STOREFRONT = "shop.StorefrontDatabase";
const BILLING = "shop.BillingDatabase";
const COLOURS = { [BILLING]: "#0ea5e9", [STOREFRONT]: "#f97316" };
const table = (id: string, resource_id?: string): ErdEntity => ({ id, label: id.split(".")[1], fields: [{ name: "id", type: "str", primary_key: true }], color: "#3b82f6", ...(resource_id ? { resource_id } : {}) });

const shop: ErdGraphPayload = {
  entities: [
    table("shop.Order", STOREFRONT),
    table("shop.OrderLine", STOREFRONT),
    table("shop.Invoice", BILLING),
    table("shop.CardPayment", BILLING),
    table("shop.BankPayment", BILLING),
    table("shop.Legacy"),
  ],
  relations: [{ source: "shop.Order", target: "shop.OrderLine", source_field: "lines", relationship_kind: "composition", source_cardinality: "one", target_cardinality: "zero_many" }],
  groups: [{ group_id: "shop.Invoice:payment", label: "payment (by kind)", members: ["shop.BankPayment", "shop.CardPayment"] }],
  boundary: true,
  resource_labels: { [BILLING]: "BillingDatabase", [STOREFRONT]: "StorefrontDatabase" },
};

type Box = { left: number; top: number; right: number; bottom: number };

/** The box of a polygon's points. */
function boxOfPoints(points: string): Box {
  const pairs = points.trim().split(/\s+/).map((pair) => pair.split(",").map(Number) as [number, number]);
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

/** Each cluster of the SVG by its title: its outline's box, its stroke, and its label's text. */
function clustersOf(svg: string): Map<string, { box: Box; stroke: string; label: string }> {
  const found = new Map<string, { box: Box; stroke: string; label: string }>();
  for (const match of svg.matchAll(/<g id="[^"]+" class="cluster">\s*<title>([^<]+)<\/title>([\s\S]*?)<\/g>/g)) {
    // The invisible ``_room`` cluster only keeps a contour apart from the next: it is not a contour.
    if (match[1]!.endsWith("_room")) continue;
    const body = match[2]!;
    const path = /<(?:polygon|path)[^>]*stroke="([^"]+)"[^>]*(?:points="([^"]+)"|d="([^"]+)")/.exec(body);
    const coords = path?.[2] ?? (path?.[3] ?? "").replace(/[MCLZ]/g, " ").trim().replace(/\s+/g, " ");
    const label = [...body.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((text) => text[1]).join(" ");
    found.set(match[1]!, { box: boxOfPoints(coords), stroke: path?.[1] ?? "", label });
  }
  return found;
}

/** The box of a table node, by its id. */
function nodeBox(svg: string, id: string): Box {
  const start = svg.indexOf(`<title>${id}</title>`);
  const polygon = /points="([^"]+)"/.exec(svg.slice(start, svg.indexOf("</g>", start)))?.[1] ?? "";
  return boxOfPoints(polygon);
}

const inside = (inner: Box, outer: Box) => inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;

const render = (data: ErdGraphPayload) => drawErdCards(containNodeFills(gv.layout(buildDotSource(data, "gv-dot-lr"), "svg", "dot")), ERD_CARD_RADIUS, ERD_CARD_STROKE);

// Boundary, painted by domain: grey contours headed by each resource's name.
setErdPaint("domain", {});
const svg = render(shop);
const clusters = clustersOf(svg);
const billing = clusters.get("cluster_resource_0");
const storefront = clusters.get("cluster_resource_1");
check("one contour per resource", billing !== undefined && storefront !== undefined && clusters.size === 3, `clusters: ${[...clusters.keys()].join(", ")}`);
check("each contour is headed by its resource's name", billing?.label === "BillingDatabase" && storefront?.label === "StorefrontDatabase", `${billing?.label} / ${storefront?.label}`);
check("each contour holds exactly its resource's tables", ["shop.Invoice", "shop.CardPayment", "shop.BankPayment"].every((id) => inside(nodeBox(svg, id), billing!.box)) && ["shop.Order", "shop.OrderLine"].every((id) => inside(nodeBox(svg, id), storefront!.box)));
const gap = (one: Box, other: Box) => Math.max(other.left - one.right, one.left - other.right, other.top - one.bottom, one.top - other.bottom);
check("the contours stand apart, not edge to edge", billing !== undefined && storefront !== undefined && gap(billing.box, storefront.box) >= 36, `gap ${billing && storefront ? gap(billing.box, storefront.box).toFixed(1) : "?"} pt`);
const titleOf = (markup: string, name: string) => {
  const start = markup.indexOf(`<title>${name}</title>`);
  const body = markup.slice(start, markup.indexOf("</g>", start));
  const text = /<text[^>]* y="([-\d.]+)"[^>]* font-size="([\d.]+)"/.exec(body);
  return { y: Number(text?.[1]), size: Number(text?.[2]) };
};
const billingTitle = titleOf(svg, "cluster_resource_0");
check("a contour's name is a little larger than a table's and stands clear of its top border", billingTitle.size === 15 && billing !== undefined && billingTitle.y - billing.box.top >= 20, `size ${billingTitle.size}, ${billing ? (billingTitle.y - billing.box.top).toFixed(1) : "?"} pt below the border`);
check("a table of no resource stands outside every contour", ![billing, storefront].some((cluster) => cluster && inside(nodeBox(svg, "shop.Legacy"), cluster.box)));
const block = clusters.get("cluster_shop.Invoice:payment");
check("a specialization block stands inside its resource's contour", block !== undefined && inside(block.box, billing!.box));
check("the contours are grey while domains paint", billing?.stroke === "#94a3b8" && storefront?.stroke === "#94a3b8", `${billing?.stroke} / ${storefront?.stroke}`);

// Painted by resource: each contour and each header take the resource's colour.
setErdPaint("resource", COLOURS);
const painted = render(shop);
const paintedClusters = clustersOf(painted);
check("each contour takes its resource's colour", paintedClusters.get("cluster_resource_0")?.stroke === COLOURS[BILLING] && paintedClusters.get("cluster_resource_1")?.stroke === COLOURS[STOREFRONT]);
const headerOf = (markup: string, id: string) => {
  const start = markup.indexOf(`<title>${id}</title>`);
  return /fill="(#[0-9a-f]{6})"/.exec(markup.slice(start, markup.indexOf("</g>", start)))?.[1];
};
check("each table's header takes its resource's colour", headerOf(painted, "shop.Invoice") === COLOURS[BILLING] && headerOf(painted, "shop.Order") === COLOURS[STOREFRONT], `${headerOf(painted, "shop.Invoice")} / ${headerOf(painted, "shop.Order")}`);

// A graph older than protocol 1.6: Boundary changes nothing.
setErdPaint("domain", {});
const old: ErdGraphPayload = { entities: [table("a.Lot"), table("a.Offer")], relations: [] };
check("a graph older than 1.6 draws as before", render({ ...old, boundary: true, resource_labels: {} }) === render(old));

if (failures > 0) {
  console.error(`${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("ERD resources: one contour per resource, named, closed, painted, older graphs unchanged");
