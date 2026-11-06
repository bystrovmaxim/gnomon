// scripts/check-erd-data-sources.ts
/**
 * The ERD drawing check of spec 063 — what a data source around its resources looks like in the SVG the page shows.
 *
 * It lays out a shop whose storefront and support desk share one database, and a billing database of its own, through
 * the WASM Graphviz build the client loads, with the production passes, and asserts what the reader sees: one outer
 * contour per data source, headed by its name — written once — holding the contours of exactly its resources; the relation between
 * tables of those resources inside it; a resource without a data source outside it; the outer contour and the headers
 * in the data source's colour when data sources paint; and a graph with no data source drawn as before.
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
const SUPPORT = "shop.SupportDatabase";
const BILLING = "shop.BillingDatabase";
const SHOP_DB = "shop.ShopDataSource";
const table = (id: string, resource_id: string): ErdEntity => ({ id, label: id.split(".")[1], fields: [{ name: "id", type: "str", primary_key: true }], color: "#3b82f6", resource_id });

const shop: ErdGraphPayload = {
  entities: [table("shop.Order", STOREFRONT), table("shop.Ticket", SUPPORT), table("shop.Invoice", BILLING)],
  relations: [{ source: "shop.Ticket", target: "shop.Order", source_field: "order", relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one" }],
  boundary: true,
  resource_labels: { [STOREFRONT]: "StorefrontDatabase", [SUPPORT]: "SupportDatabase", [BILLING]: "BillingDatabase" },
  resource_data_sources: { [STOREFRONT]: SHOP_DB, [SUPPORT]: SHOP_DB },
  data_source_labels: { [SHOP_DB]: "ShopDataSource" },
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

/** Every point of the relation lines' paths. */
function edgePoints(svg: string): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (const match of svg.matchAll(/<g id="[^"]+" class="edge">[\s\S]*?<path[^>]* d="([^"]+)"/g)) {
    const numbers = match[1]!.replace(/[MC]/g, " ").trim().split(/[\s,]+/).map(Number);
    for (let i = 0; i + 1 < numbers.length; i += 2) points.push({ x: numbers[i]!, y: numbers[i + 1]! });
  }
  return points;
}


setErdPaint("domain", {});
const svg = render(shop);
const clusters = clustersOf(svg);
const source = clusters.get("cluster_data_source_0");
const billing = clusters.get("cluster_resource_0");
const storefront = clusters.get("cluster_resource_1");
const support = clusters.get("cluster_resource_2");
check("one outer contour for the data source, one contour per resource", source !== undefined && billing !== undefined && storefront !== undefined && support !== undefined && clusters.size === 4, `clusters: ${[...clusters.keys()].join(", ")}`);
check("the outer contour is headed by the data source's name", source?.label === "ShopDataSource", source?.label);
const nameCount = [...svg.matchAll(/<text[^>]*>ShopDataSource<\/text>/g)].length;
check("the data source's name is drawn once, in its header (spec 065)", nameCount === 1, `${nameCount} times`);
const named = [...svg.matchAll(/<g id="(dc:[^"]+)" class="cluster">/g)].map((match) => match[1]);
check("only the data source's own contour carries its id (spec 065)", named.length === 1 && named[0] === `dc:${SHOP_DB}`, named.join(", "));
check("the outer contour holds the contours of exactly its resources", inside(storefront!.box, source!.box) && inside(support!.box, source!.box) && !inside(billing!.box, source!.box));
check("each resource contour holds its table", inside(nodeBox(svg, "shop.Order"), storefront!.box) && inside(nodeBox(svg, "shop.Ticket"), support!.box) && inside(nodeBox(svg, "shop.Invoice"), billing!.box));
const pad = 1;
const within = (point: { x: number; y: number }, box: Box) => point.x >= box.left - pad && point.x <= box.right + pad && point.y >= box.top - pad && point.y <= box.bottom + pad;
const line = edgePoints(svg);
check("the relation across the two resources stays inside the data source's contour", line.length > 0 && line.every((point) => within(point, source!.box)), `${line.length} points`);

setErdPaint("data_source", { [SHOP_DB]: "#7c3aed" });
const painted = render(shop);
check("the outer contour takes the data source's colour", clustersOf(painted).get("cluster_data_source_0")?.stroke === "#7c3aed", clustersOf(painted).get("cluster_data_source_0")?.stroke);
const headerOf = (markup: string, id: string) => {
  const start = markup.indexOf(`<title>${id}</title>`);
  return /fill="(#[0-9a-f]{6})"/.exec(markup.slice(start, markup.indexOf("</g>", start)))?.[1];
};
check("the tables of its resources take its colour, the others stay grey", headerOf(painted, "shop.Order") === "#7c3aed" && headerOf(painted, "shop.Ticket") === "#7c3aed" && headerOf(painted, "shop.Invoice") === "#64748b", `${headerOf(painted, "shop.Order")} / ${headerOf(painted, "shop.Invoice")}`);

setErdPaint("domain", {});
const { resource_data_sources: _map, data_source_labels: _labels, ...plain } = shop;
check("a graph with no data source draws as before", render({ ...plain, resource_data_sources: {}, data_source_labels: {} }) === render(plain));

if (failures > 0) {
  console.error(`${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("ERD data sources: one outer contour per data source, named, holding its resources and their relations, painted");
