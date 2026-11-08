// scripts/check-erd-logical-view.ts
/**
 * The ERD drawing check of spec 070 — the logical view in the SVG the page shows.
 *
 * It lays a shop out through the same WASM Graphviz build the client loads, with the production passes, and asserts
 * what the reader sees: a frame per domain headed by the domain's name and holding exactly its tables, each table
 * drawn once — the invoice too, though two databases keep it —, every relation drawn once and solid, no resource's
 * frame, name or ×N anywhere, and each domain's frame in its colour while domains paint. Plain Node.
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

const BILLING = "shop.BillingDatabase";
const STOREFRONT = "shop.StorefrontDatabase";
const STORE = "shop.StoreDomain";
const MONEY = "shop.MoneyDomain";
const table = (id: string, domain: string, ...resource_ids: string[]): ErdEntity => ({ id, label: id.split(".")[1], fields: [{ name: "id", type: "str", primary_key: true }], color: "#3b82f6", domain_qualname: domain, resource_ids });

const shop: ErdGraphPayload = {
  entities: [table("shop.Order", STORE, STOREFRONT), table("shop.OrderLine", STORE, STOREFRONT), table("shop.Invoice", MONEY, BILLING, STOREFRONT), table("shop.Legacy", MONEY)],
  relations: [
    { source: "shop.OrderLine", target: "shop.Order", source_field: "order", relationship_kind: "composition", source_cardinality: "zero_many", target_cardinality: "one" },
    { source: "shop.Invoice", target: "shop.Order", source_field: "order", relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one" },
  ],
  model: "logical",
  domain_labels: { [STORE]: "Store", [MONEY]: "Money" },
  domain_colors: { [STORE]: "#16a34a", [MONEY]: "#9333ea" },
};

type Box = { left: number; top: number; right: number; bottom: number };

/** The box of a polygon's points. */
function boxOfPoints(points: string): Box {
  const pairs = points.trim().split(/\s+/).map((pair) => pair.split(",").map(Number) as [number, number]);
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

/** Each frame of the SVG by its title: its outline's box, its stroke and dash, its id and its label's text. */
function clustersOf(svg: string): Map<string, { box: Box; stroke: string; dashed: boolean; id: string; label: string }> {
  const found = new Map<string, { box: Box; stroke: string; dashed: boolean; id: string; label: string }>();
  for (const match of svg.matchAll(/<g id="([^"]+)" class="cluster">\s*<title>([^<]+)<\/title>([\s\S]*?)<\/g>/g)) {
    // The invisible ``_room`` cluster only keeps a frame apart from the next: it is not a frame.
    if (match[2]!.endsWith("_room")) continue;
    const body = match[3]!;
    const path = /<(?:polygon|path)[^>]*stroke="([^"]+)"[^>]*(?:points="([^"]+)"|d="([^"]+)")/.exec(body);
    const coords = path?.[2] ?? (path?.[3] ?? "").replace(/[MCLZ]/g, " ").trim().replace(/\s+/g, " ");
    const label = [...body.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((text) => text[1]).join(" ");
    found.set(match[2]!, { box: boxOfPoints(coords), stroke: path?.[1] ?? "", dashed: /stroke-dasharray/.test(body.split("<text")[0]!), id: match[1]!, label });
  }
  return found;
}

/** The box of a table node, by its id. */
function nodeBox(svg: string, id: string): Box {
  const start = svg.indexOf(`<title>${id}</title>`);
  const polygon = /points="([^"]+)"/.exec(svg.slice(start, svg.indexOf("</g>", start)))?.[1] ?? "";
  return boxOfPoints(polygon);
}

/** An edge group's markup, by its id. */
function edgeOf(svg: string, id: string): string {
  const start = svg.indexOf(`<g id="${id}" class="edge`);
  return start < 0 ? "" : svg.slice(start, svg.indexOf("</g>", start));
}

const inside = (inner: Box, outer: Box) => inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;
const render = (data: ErdGraphPayload) => drawErdCards(containNodeFills(gv.layout(buildDotSource(data, "gv-dot-lr"), "svg", "dot")), ERD_CARD_RADIUS, ERD_CARD_STROKE);

setErdPaint("domain", {});
const svg = render(shop);
const frames = clustersOf(svg);
const money = frames.get("cluster_domain_0");
const store = frames.get("cluster_domain_1");
check("a frame per domain, and no other", money !== undefined && store !== undefined && frames.size === 2, [...frames.keys()].join(", "));
check("each frame is headed by its domain's name", money?.label === "Money" && store?.label === "Store", `${money?.label} / ${store?.label}`);
check("each frame holds exactly its domain's tables", ["shop.Invoice", "shop.Legacy"].every((id) => inside(nodeBox(svg, id), money!.box)) && ["shop.Order", "shop.OrderLine"].every((id) => inside(nodeBox(svg, id), store!.box)));
check("the invoice kept by two databases is drawn once, with no count", (svg.match(/<title>shop\.Invoice<\/title>/g) ?? []).length === 1 && !svg.includes("×"));
check("every relation is drawn once and solid", ["re0", "re1"].every((id) => edgeOf(svg, id) !== "" && !/stroke-dasharray/.test(edgeOf(svg, id).split("<text")[0]!)));
check("no resource is named anywhere", !svg.includes("rc:") && !svg.includes("StorefrontDatabase") && !svg.includes("BillingDatabase"));
check("each domain's frame takes its colour while domains paint", money?.stroke === "#9333ea" && store?.stroke === "#16a34a", `${money?.stroke} / ${store?.stroke}`);

setErdPaint("kind", {});
const grey = clustersOf(render(shop));
check("the frames are grey while another section paints", grey.get("cluster_domain_0")?.stroke === "#94a3b8");

if (failures > 0) {
  console.error(`${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("ERD logical view: a frame per domain, each table and relation once, no resource");
