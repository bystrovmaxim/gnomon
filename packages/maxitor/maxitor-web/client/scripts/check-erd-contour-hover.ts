// scripts/check-erd-contour-hover.ts
/**
 * The ERD drawing check of spec 064 — hovering a resource contour, on the SVG the page shows.
 *
 * It lays out the physical view of a shop — a storefront, a support desk and a billing database — through the WASM
 * Graphviz build the client loads, with the production passes, puts the SVG in a DOM, binds the production hover, and
 * asserts what the reader sees: each resource's frame is named by its resource and carries its full id as its hover
 * label; the invisible spacing is named by nothing; hovering the storefront's border lights the
 * one line that leaves it, keeps the copies at its ends bright and dims the rest; the billing frame, with no line out,
 * dims everything; leaving gives the drawing back (spec 064, spec 070).
 *
 * Exit codes: 0 all assertions passed; 1 an assertion failed; 2 the environment cannot run it.
 */

import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { JSDOM } from "jsdom";
import { buildDotSource, ERD_CARD_RADIUS, ERD_CARD_STROKE, setErdPaint, type ErdEntity, type ErdGraphPayload } from "../src/lib/buildDotSource.ts";
import { containNodeFills } from "../src/lib/containNodeFills.ts";
import { addContourHitAreas, addEdgeHitAreas, bindLineHover, drawErdCards } from "../src/lib/erdPostPass.ts";
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

const STOREFRONT = "shop.StorefrontDatabase";
const SUPPORT = "shop.SupportDatabase";
const BILLING = "shop.BillingDatabase";
const table = (id: string, resource: string, fields: ErdEntity["fields"] = []): ErdEntity => ({
  id,
  label: id.split(".")[1],
  fields: [{ name: "id", type: "str", primary_key: true }, ...(fields ?? [])],
  color: "#3b82f6",
  domain_qualname: "shop.ShopDomain",
  resource_ids: [resource],
});

// Order–OrderLine stays inside the storefront; Ticket→Order leaves the support desk for the storefront.
const entities = [
  table("shop.Order", STOREFRONT),
  table("shop.OrderLine", STOREFRONT, [{ name: "order", type: "OrderEntity", foreign_key: true }]),
  table("shop.Ticket", SUPPORT, [{ name: "order", type: "OrderEntity", foreign_key: true }]),
  table("shop.Invoice", BILLING),
];
const drawing = physicalDrawing(entities, [
  { source: "shop.OrderLine", target: "shop.Order", source_field: "order", relationship_kind: "composition", source_cardinality: "zero_many", target_cardinality: "one" },
  { source: "shop.Ticket", target: "shop.Order", source_field: "order", relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one" },
]);
const shop: ErdGraphPayload = {
  entities: drawing.entities,
  relations: drawing.relations,
  model: "physical",
  resource_ids: [BILLING, STOREFRONT, SUPPORT],
  resource_labels: { [STOREFRONT]: "StorefrontDatabase", [SUPPORT]: "SupportDatabase", [BILLING]: "BillingDatabase" },
};

setErdPaint("domain", {});
const markup = drawErdCards(containNodeFills(gv.layout(buildDotSource(shop, "gv-dot-lr"), "svg", "dot")), ERD_CARD_RADIUS, ERD_CARD_STROKE);
const dom = new JSDOM(`<div id="root">${markup.slice(markup.indexOf("<svg"))}</div>`);
const { document, MouseEvent, AbortController: DomAbortController } = dom.window;
// jsdom lays nothing out: every element is a box of one size, as a lit line's label plate asks for one (#85).
(globalThis as { document?: unknown }).document = document;
Object.defineProperty(dom.window.SVGElement.prototype, "getBBox", { configurable: true, value: () => ({ x: 0, y: 0, width: 40, height: 9 }) });
const root = document.getElementById("root")!;
addEdgeHitAreas(root);
addContourHitAreas(root);
bindLineHover(root, shop.relations, shop.entities, new DomAbortController().signal);

const contours = [...root.querySelectorAll("g.cluster")];
const named = contours.filter((cluster) => cluster.id.startsWith("rc:")).map((cluster) => cluster.id).sort();
check("each resource contour is named by its resource", JSON.stringify(named) === JSON.stringify([`rc:${BILLING}`, `rc:${STOREFRONT}`, `rc:${SUPPORT}`]), named.join(", "));
const titleOf = (cluster: Element) => cluster.querySelector("title")?.textContent ?? "";
const others = contours.filter((cluster) => !cluster.id.startsWith("rc:")).map(titleOf);
check("the invisible spacing is named by nothing", others.every((title) => title.endsWith("_room")), others.join(", "));

const contour = (resource: string) => contours.find((cluster) => cluster.id === `rc:${resource}`)!;
const label = contour(STOREFRONT).querySelector("a")?.getAttribute("xlink:title");
check("the hover label is the resource's full id", label === STOREFRONT, label ?? "none");
const hit = contour(STOREFRONT).querySelector("path.erd-hit");
const border = contour(STOREFRONT).querySelector("path:not(.erd-hit)");
check("the frame's whole outline — border, name and empty space — is one transparent hit area", hit?.getAttribute("d") === border?.getAttribute("d") && hit?.getAttribute("fill") === "transparent" && hit?.getAttribute("pointer-events") === "all");

const hover = (element: Element, on: boolean) => element.dispatchEvent(new MouseEvent(on ? "mouseenter" : "mouseleave"));
const tableTitle = (node: Element) => node.querySelector("title")?.textContent ?? "";
const bright = () => [...root.querySelectorAll<HTMLElement>("g.node")].filter((node) => node.style.opacity === "1").map(tableTitle).sort();
const dimmed = () => [...root.querySelectorAll<HTMLElement>("g.node")].filter((node) => node.style.opacity === "0.35").map(tableTitle).sort();
const lit = () => [...root.querySelectorAll("g.edge.is-hovered")].map((edge) => edge.id).sort();

hover(contour(STOREFRONT), true);
// The whole frame, every table in it, and every line those tables touch — the storefront's own OrderLine→Order stays
// lit with the line to the support desk (spec 071).
check("the storefront lights every line its tables touch, inside the frame and out", JSON.stringify(lit()) === JSON.stringify(["re0", "re1"]), lit().join(", "));
check("the copies inside the frame and at the lines' far ends stay bright", JSON.stringify(bright()) === JSON.stringify([copyId("shop.OrderLine", STOREFRONT), copyId("shop.Order", STOREFRONT), copyId("shop.Ticket", SUPPORT)]), bright().join(", "));
check("every other copy dims", JSON.stringify(dimmed()) === JSON.stringify([copyId("shop.Invoice", BILLING)]), dimmed().join(", "));
check("the hovered border widens", contour(STOREFRONT).classList.contains("is-hovered"));
hover(contour(STOREFRONT), false);
check("leaving gives the drawing back", lit().length === 0 && [...root.querySelectorAll<HTMLElement>("g.node, g.edge")].every((element) => element.style.opacity === "") && root.querySelectorAll(".is-hovered").length === 0);

hover(contour(BILLING), true);
check("billing, with no line out, keeps its own copy bright and dims every line", JSON.stringify(bright()) === JSON.stringify([copyId("shop.Invoice", BILLING)]) && dimmed().length === 3 && lit().length === 0 && [...root.querySelectorAll<HTMLElement>("g.edge")].every((edge) => edge.style.opacity === "0.2"));
hover(contour(BILLING), false);

// A domain frame in the logical view carries the same hit area over its whole outline (spec 071).
const logical = gv.layout(buildDotSource({ entities: shop.entities.map((copy) => ({ ...copy, id: copy.copy_of })), relations: [{ source: "shop.Ticket", target: "shop.Order", source_field: "order", relationship_kind: "association" }], model: "logical", domain_labels: { "shop.ShopDomain": "Shop" } }, "gv-dot-lr"), "svg", "dot");
const logicalDom = new JSDOM(`<div id="root">${logical.slice(logical.indexOf("<svg"))}</div>`).window.document;
const logicalRoot = logicalDom.getElementById("root")!;
addContourHitAreas(logicalRoot);
const domain = logicalRoot.querySelector('g[id="dc:shop.ShopDomain"]');
const domainHit = domain?.querySelector("path.erd-hit");
const domainBorder = domain?.querySelector("path:not(.erd-hit)");
check("a domain frame's whole outline is one transparent hit area", domainHit?.getAttribute("d") === domainBorder?.getAttribute("d") && domainHit?.getAttribute("pointer-events") === "all");

if (failures > 0) {
  console.error(`${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("ERD contour hover: a frame's whole outline is one hit area, for a resource and a domain");
