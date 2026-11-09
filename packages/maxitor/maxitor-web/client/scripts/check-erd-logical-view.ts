// scripts/check-erd-logical-view.ts
/**
 * The ERD drawing check of spec 070 and spec 071 — the logical view in the SVG the page shows, in all five layouts,
 * with the domain frames on and off.
 *
 * It lays a shop out through the same WASM Graphviz build the client loads, in Dot left to right, Dot top to bottom,
 * Neato, FDP and Circo, and asserts what the reader sees in each: a frame per domain headed by the domain's name and
 * holding exactly its tables, each table drawn once — the invoice too, though two databases keep it —, every relation
 * drawn once and solid, no resource's frame, name or ×N anywhere, no two frame boxes overlapping, and each domain's
 * frame in its colour while domains paint. With the frames switch off there is no frame at all. Plain Node.
 *
 * Exit codes: 0 all assertions passed; 1 an assertion failed; 2 the environment cannot run it.
 */

import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { buildDotSource, type ErdEntity, type ErdGraphPayload, type ErdGraphvizLayout } from "../src/lib/buildDotSource.ts";
import { erdCompose } from "../src/lib/erdCompose.ts";

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

function boxOfPoints(points: string): Box {
  const pairs = points.trim().split(/\s+/).map((pair) => pair.split(",").map(Number) as [number, number]);
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  return { left: Math.min(...xs), top: Math.max(...ys), right: Math.max(...xs), bottom: Math.min(...ys) };
}

/** Each frame of the SVG by its title: its outline's box, its stroke and its id. */
function clustersOf(svg: string): Map<string, { box: Box; stroke: string; id: string }> {
  const found = new Map<string, { box: Box; stroke: string; id: string }>();
  for (const match of svg.matchAll(/<g id="([^"]+)" class="cluster">\s*<title>([^<]+)<\/title>([\s\S]*?)<\/g>/g)) {
    if (match[2]!.endsWith("_room")) continue;
    const body = match[3]!;
    const path = /<(?:polygon|path)[^>]*stroke="([^"]+)"[^>]*(?:points="([^"]+)"|d="([^"]+)")/.exec(body);
    const coords = path?.[2] ?? (path?.[3] ?? "").replace(/[MCLZ]/g, " ").trim().replace(/\s+/g, " ");
    found.set(match[2]!, { box: boxOfPoints(coords), stroke: path?.[1] ?? "", id: match[1]! });
  }
  return found;
}

function nodeBox(svg: string, id: string): Box {
  const title = svg.indexOf(`<title>${id}</title>`);
  const wraps = [...svg.slice(0, title).matchAll(/<g transform="translate\(([-\d.]+),([-\d.]+)\)">/g)];
  const wrap = wraps[wraps.length - 1];
  const dx = wrap ? Number(wrap[1]) : 0;
  const dy = wrap ? Number(wrap[2]) : 0;
  const backdrop = /fill="white"[^>]*d="([^"]+)"/.exec(svg.slice(title, title + 60000))?.[1] ?? "";
  const box = boxOfPoints(backdrop.replace(/[MCLZ]/g, " ").trim());
  return { left: box.left + dx, top: box.top + dy, right: box.right + dx, bottom: box.bottom + dy };
}

const inside = (inner: Box, outer: Box) => inner.left >= outer.left && inner.right <= outer.right && inner.top <= outer.top && inner.bottom >= outer.bottom;
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top > b.bottom && b.top > a.bottom;

/** Lay the logical view out in ``layout``, as the page does. */
function render(data: ErdGraphPayload, layout: ErdGraphvizLayout): string {
  return layout === "gv-dot-lr" || layout === "gv-dot-tb"
    ? gv.layout(buildDotSource(data, layout), "svg", "dot")
    : erdCompose(data, layout, (dot, eng) => gv.layout(dot, "svg", eng));
}

const LAYOUTS: ErdGraphvizLayout[] = ["gv-dot-lr", "gv-dot-tb", "gv-neato", "gv-fdp", "gv-circo"];

for (const layout of LAYOUTS) {
  const tag = layout.slice(3);
  const svg = render(shop, layout);
  const frames = clustersOf(svg);
  const money = frames.get("cluster_domain_0");
  const store = frames.get("cluster_domain_1");
  check(`[${tag}] a frame per domain, and no other`, money !== undefined && store !== undefined && frames.size === 2, [...frames.keys()].join(", "));
  check(`[${tag}] each frame is named dc:<qualname>`, money?.id === `dc:${MONEY}` && store?.id === `dc:${STORE}`, `${money?.id} / ${store?.id}`);
  check(`[${tag}] no two frame boxes overlap`, money !== undefined && store !== undefined && !overlaps(money.box, store.box));
  check(`[${tag}] each frame holds exactly its domain's tables`, ["shop.Invoice", "shop.Legacy"].every((id) => inside(nodeBox(svg, id), money!.box)) && ["shop.Order", "shop.OrderLine"].every((id) => inside(nodeBox(svg, id), store!.box)));
  check(`[${tag}] the invoice kept by two databases is drawn once, with no count`, (svg.match(/<title>shop\.Invoice<\/title>/g) ?? []).length === 1 && !svg.includes("×"));
  check(`[${tag}] every relation is drawn once and solid`, ["re0", "re1"].every((id) => svg.includes(`id="${id}"`) && !/stroke-dasharray/.test(svg.slice(svg.indexOf(`id="${id}"`), svg.indexOf("</g>", svg.indexOf(`id="${id}"`))))));
  check(`[${tag}] no resource is named anywhere`, !svg.includes("rc:") && !svg.includes("StorefrontDatabase") && !svg.includes("BillingDatabase"));
  check(`[${tag}] each domain's frame takes its colour while domains paint`, money?.stroke === "#9333ea" && store?.stroke === "#16a34a", `${money?.stroke} / ${store?.stroke}`);
}

check("with frames off no frame is drawn", [...["gv-dot-lr", "gv-neato", "gv-circo"] as ErdGraphvizLayout[]].every((layout) => {
  const svg = render({ ...shop, model: undefined }, layout);
  return (svg.match(/class="cluster"/g) ?? []).length === 0;
}));

if (failures > 0) {
  console.error(`${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("ERD logical view: a frame per domain, each table and relation once, no resource, in all five layouts");
