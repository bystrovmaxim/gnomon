// scripts/check-erd-physical-view.ts
/**
 * The ERD drawing check of spec 070 and spec 071 — the physical view in the SVG the page shows, in
 * all five layouts.
 *
 * It lays a shop out through the same WASM Graphviz build the client loads, in Dot left to right, Dot
 * top to bottom, Neato, FDP and Circo, and asserts what the reader sees in each: a frame per resource
 * of the model headed by its name — the archive, which keeps nothing, an empty frame —, the invoice
 * kept by two databases drawn in both and marked ×2 with a dashed "same entity" line between its
 * copies, the relation from the billing copy to the order dashed because it crosses databases, the
 * legacy table in "Not stored", a specialization block inside the frame that holds all its tables, no
 * frame inside another, no two frame boxes overlapping, every table's box inside its own frame and no
 * other, and the frames and headers in their resource's colour when resources paint. Plain Node.
 *
 * Exit codes: 0 all assertions passed; 1 an assertion failed; 2 the environment cannot run it.
 */

import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { buildDotSource, setErdPaint, type ErdEntity, type ErdGraphPayload, type ErdGraphvizLayout } from "../src/lib/buildDotSource.ts";
import { erdCompose } from "../src/lib/erdCompose.ts";
import { copyId, physicalDrawing } from "../src/lib/erdViews.ts";

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

const ARCHIVE = "shop.ArchiveDatabase";
const BILLING = "shop.BillingDatabase";
const STOREFRONT = "shop.StorefrontDatabase";
const STORE = "shop.StoreDomain";
const MONEY = "shop.MoneyDomain";
const COLOURS = { [ARCHIVE]: "#64748b", [BILLING]: "#0ea5e9", [STOREFRONT]: "#f97316" };
const table = (id: string, domain: string, ...resource_ids: string[]): ErdEntity => ({ id, label: id.split(".")[1], fields: [{ name: "id", type: "str", primary_key: true }], color: "#3b82f6", domain_qualname: domain, resource_ids });

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

/** The box of a polygon's points or a path's ``d`` (letters dropped). */
function boxOfPoints(points: string): Box {
  const pairs = points.trim().split(/\s+/).map((pair) => pair.split(",").map(Number) as [number, number]);
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  return { left: Math.min(...xs), top: Math.max(...ys), right: Math.max(...xs), bottom: Math.min(...ys) };
}

/** Each frame of the SVG by its title: its outline's box, its stroke and dash, its id and its label's text. */
function clustersOf(svg: string): Map<string, { box: Box; stroke: string; dashed: boolean; id: string; label: string }> {
  const found = new Map<string, { box: Box; stroke: string; dashed: boolean; id: string; label: string }>();
  for (const match of svg.matchAll(/<g id="([^"]+)" class="cluster">\s*<title>([^<]+)<\/title>([\s\S]*?)<\/g>/g)) {
    const body = match[3]!;
    const path = /<(?:polygon|path)[^>]*stroke="([^"]+)"[^>]*(?:points="([^"]+)"|d="([^"]+)")/.exec(body);
    const coords = path?.[2] ?? (path?.[3] ?? "").replace(/[MCLZ]/g, " ").trim().replace(/\s+/g, " ");
    const label = [...body.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((text) => text[1]).join(" ");
    found.set(match[2]!, { box: boxOfPoints(coords), stroke: path?.[1] ?? "", dashed: /stroke-dasharray/.test(body.split("<text")[0]!), id: match[1]!, label });
  }
  return found;
}

/** The box of a table node, by its id: the card's backdrop, moved by its ``translate`` wrapper if the composer wrapped it. */
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

/** An edge group's markup, by its id. */
function edgeOf(svg: string, id: string): string {
  const start = svg.indexOf(`<g id="${id}" class="edge`);
  return start < 0 ? "" : svg.slice(start, svg.indexOf("</g>", start));
}

const inside = (inner: Box, outer: Box) => inner.left >= outer.left && inner.right <= outer.right && inner.top <= outer.top && inner.bottom >= outer.bottom;
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top > b.bottom && b.top > a.bottom;

/** Lay ``data`` out in ``layout``, as the page's layout does; the card post-passes are proven elsewhere. */
function render(data: ErdGraphPayload, layout: ErdGraphvizLayout): string {
  return layout === "gv-dot-lr" || layout === "gv-dot-tb"
    ? gv.layout(buildDotSource(data, layout), "svg", "dot")
    : erdCompose(data, layout, (dot, eng) => gv.layout(dot, "svg", eng));
}

const LAYOUTS: ErdGraphvizLayout[] = ["gv-dot-lr", "gv-dot-tb", "gv-neato", "gv-fdp", "gv-circo"];

setErdPaint("domain", {});
for (const layout of LAYOUTS) {
  const tag = layout.slice(3);
  const svg = render(shop, layout);
  const frames = clustersOf(svg);
  const [archive, billing, storefront, unstored] = [0, 1, 2, 3].map((index) => frames.get(`cluster_resource_${index}`));
  check(`[${tag}] a frame per resource of the model, an empty one too, and Not stored`, [archive, billing, storefront, unstored].every(Boolean), [...frames.keys()].join(", "));
  check(`[${tag}] each resource's frame is headed by its name and named rc:<resource>`, archive?.label === "ArchiveDatabase" && billing?.id === `rc:${BILLING}` && storefront?.label.startsWith("StorefrontDatabase") === true, `${archive?.label} / ${billing?.id} / ${storefront?.label}`);
  check(`[${tag}] the empty archive's frame holds no table`, entities.every((entity) => drawing.entities.filter((copy) => copy.copy_of === entity.id).every((copy) => !archive || !inside(nodeBox(svg, copy.id), archive.box))));
  check(`[${tag}] no frame stands inside another`, [...frames.keys()].filter((name) => name.startsWith("cluster_resource_") || name.startsWith("cluster_domain_")).every((name, i, names) => names.every((other, j) => i === j || !inside(frames.get(name)!.box, frames.get(other)!.box))));
  check(`[${tag}] no two frame boxes overlap`, [archive, billing, storefront, unstored].every((frame, i) => [archive, billing, storefront, unstored].slice(i + 1).every((other) => !overlaps(frame!.box, other!.box))));
  check(`[${tag}] every table's box stands inside its own frame and no other`, drawing.entities.every((copy) => {
    const resource = copy.copy_resource;
    const own = resource === null ? unstored : resource === ARCHIVE ? archive : resource === BILLING ? billing : storefront;
    const others = [archive, billing, storefront, unstored].filter((frame) => frame !== own);
    return own !== undefined && inside(nodeBox(svg, copy.id), own.box) && others.every((other) => !inside(nodeBox(svg, copy.id), other!.box));
  }));
  check(`[${tag}] the invoice kept by two databases is drawn in both`, inside(nodeBox(svg, copyId("shop.Invoice", BILLING)), billing!.box) && inside(nodeBox(svg, copyId("shop.Invoice", STOREFRONT)), storefront!.box));
  check(`[${tag}] each copy of the invoice says ×2`, (svg.match(/Invoice ×2/g) ?? []).length >= 2);
  check(`[${tag}] its copies are joined by a dashed same-entity line`, /stroke-dasharray/.test(edgeOf(svg, "se0_1")), edgeOf(svg, "se0_1").slice(0, 80));
  const crossing = drawing.relations.findIndex((line) => line.across);
  check(`[${tag}] the relation from the billing copy to the order crosses databases and is dashed`, crossing >= 0 && /stroke-dasharray/.test(edgeOf(svg, `re${crossing}`)));
  const local = drawing.relations.findIndex((line) => !line.across);
  check(`[${tag}] a relation inside one database is solid`, local >= 0 && !/stroke-dasharray/.test(edgeOf(svg, `re${local}`).split("<text")[0]!));
  check(`[${tag}] the table no resource keeps stands in Not stored, a dashed frame`, unstored !== undefined && unstored.label === "Not stored" && unstored.dashed && inside(nodeBox(svg, copyId("shop.Legacy", null)), unstored.box), unstored?.label);
  const block = frames.get(`cluster_${copyId("shop.Invoice:payment", BILLING)}`);
  check(`[${tag}] a specialization block stands inside the frame that holds all its tables`, block !== undefined && inside(block.box, billing!.box));
  check(`[${tag}] the frames are grey while domains paint`, billing?.stroke === "#94a3b8" && storefront?.stroke === "#94a3b8", `${billing?.stroke} / ${storefront?.stroke}`);
}

setErdPaint("resource", COLOURS);
for (const layout of ["gv-dot-lr", "gv-neato", "gv-circo"] as ErdGraphvizLayout[]) {
  const tag = layout.slice(3);
  const painted = clustersOf(render(shop, layout));
  check(`[${tag}] painted by resource, each frame takes its resource's colour`, painted.get("cluster_resource_1")?.stroke === COLOURS[BILLING] && painted.get("cluster_resource_2")?.stroke === COLOURS[STOREFRONT]);
}

if (failures > 0) {
  console.error(`${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("ERD physical view: a frame per resource, copies of a twice-kept entity, dashed lines across databases, in all five layouts");
