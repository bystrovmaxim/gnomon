// scripts/check-erd-contour-hover.ts
/**
 * The ERD drawing check of spec 064 — hovering a resource contour, on the SVG the page shows.
 *
 * It lays out a shop whose storefront and support desk share one database, and a billing database of its own, through
 * the WASM Graphviz build the client loads, with the production passes, puts the SVG in a DOM, binds the production
 * hover, and asserts what the reader sees: each resource contour is named by its resource and carries its full id as
 * its hover label; the data source contour and the invisible spacing are named by nothing; hovering the storefront's
 * border lights the one line that leaves it, keeps the tables at its ends bright and dims the rest; the billing
 * contour, with no line out, dims everything; leaving gives the drawing back.
 *
 * Exit codes: 0 all assertions passed; 1 an assertion failed; 2 the environment cannot run it.
 */

import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { JSDOM } from "jsdom";
import { buildDotSource, ERD_CARD_RADIUS, ERD_CARD_STROKE, setErdPaint, type ErdEntity, type ErdGraphPayload } from "../src/lib/buildDotSource.ts";
import { containNodeFills } from "../src/lib/containNodeFills.ts";
import { addContourHitAreas, addEdgeHitAreas, bindLineHover, drawErdCards } from "../src/lib/erdPostPass.ts";

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
const table = (id: string, resource_id: string, fields: ErdEntity["fields"] = []): ErdEntity => ({
  id,
  label: id.split(".")[1],
  fields: [{ name: "id", type: "str", primary_key: true }, ...(fields ?? [])],
  color: "#3b82f6",
  resource_id,
});

// Order–OrderLine stays inside the storefront; Ticket→Order leaves the support desk for the storefront.
const shop: ErdGraphPayload = {
  entities: [
    table("shop.Order", STOREFRONT),
    table("shop.OrderLine", STOREFRONT, [{ name: "order", type: "OrderEntity", foreign_key: true }]),
    table("shop.Ticket", SUPPORT, [{ name: "order", type: "OrderEntity", foreign_key: true }]),
    table("shop.Invoice", BILLING),
  ],
  relations: [
    { source: "shop.OrderLine", target: "shop.Order", source_field: "order", relationship_kind: "composition", source_cardinality: "zero_many", target_cardinality: "one" },
    { source: "shop.Ticket", target: "shop.Order", source_field: "order", relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one" },
  ],
  boundary: true,
  resource_labels: { [STOREFRONT]: "StorefrontDatabase", [SUPPORT]: "SupportDatabase", [BILLING]: "BillingDatabase" },
  resource_data_sources: { [STOREFRONT]: SHOP_DB, [SUPPORT]: SHOP_DB },
  data_source_labels: { [SHOP_DB]: "ShopDataSource" },
};

setErdPaint("domain", {});
const markup = drawErdCards(containNodeFills(gv.layout(buildDotSource(shop, "gv-dot-lr"), "svg", "dot")), ERD_CARD_RADIUS, ERD_CARD_STROKE);
const dom = new JSDOM(`<div id="root">${markup.slice(markup.indexOf("<svg"))}</div>`);
const { document, MouseEvent, AbortController: DomAbortController } = dom.window;
const root = document.getElementById("root")!;
addEdgeHitAreas(root);
addContourHitAreas(root);
bindLineHover(root, shop.relations, shop.entities, new DomAbortController().signal);

const contours = [...root.querySelectorAll("g.cluster")];
const named = contours.filter((cluster) => cluster.id.startsWith("rc:")).map((cluster) => cluster.id).sort();
check("each resource contour is named by its resource", JSON.stringify(named) === JSON.stringify([`rc:${BILLING}`, `rc:${STOREFRONT}`, `rc:${SUPPORT}`]), named.join(", "));
const titleOf = (cluster: Element) => cluster.querySelector("title")?.textContent ?? "";
const others = contours.filter((cluster) => !cluster.id.startsWith("rc:")).map(titleOf);
check("the data source contour and the spacing are named by nothing", others.includes("cluster_data_source_0") && others.every((title) => title.startsWith("cluster_data_source_") || title.endsWith("_room")), others.join(", "));

const contour = (resource: string) => contours.find((cluster) => cluster.id === `rc:${resource}`)!;
const label = contour(STOREFRONT).querySelector("a")?.getAttribute("xlink:title");
check("the hover label is the resource's full id", label === STOREFRONT, label ?? "none");
const hit = contour(STOREFRONT).querySelector("path.erd-hit");
const border = contour(STOREFRONT).querySelector("path:not(.erd-hit)");
check("the border has a 10 px hit stroke along it, catching only the stroke", hit?.getAttribute("d") === border?.getAttribute("d") && hit?.getAttribute("stroke-width") === "10" && hit?.getAttribute("pointer-events") === "stroke");

const hover = (element: Element, on: boolean) => element.dispatchEvent(new MouseEvent(on ? "mouseenter" : "mouseleave"));
const tableTitle = (node: Element) => node.querySelector("title")?.textContent ?? "";
const bright = () => [...root.querySelectorAll<HTMLElement>("g.node")].filter((node) => node.style.opacity === "1").map(tableTitle).sort();
const dimmed = () => [...root.querySelectorAll<HTMLElement>("g.node")].filter((node) => node.style.opacity === "0.35").map(tableTitle).sort();
const lit = () => [...root.querySelectorAll("g.edge.is-hovered")].map((edge) => edge.id).sort();

hover(contour(STOREFRONT), true);
check("the storefront lights only its line to the support desk", JSON.stringify(lit()) === JSON.stringify(["re1"]), lit().join(", "));
check("the tables at that line's ends stay bright", JSON.stringify(bright()) === JSON.stringify(["shop.Order", "shop.Ticket"]), bright().join(", "));
check("every other table dims", JSON.stringify(dimmed()) === JSON.stringify(["shop.Invoice", "shop.OrderLine"]), dimmed().join(", "));
check("the hovered border widens", contour(STOREFRONT).classList.contains("is-hovered"));
hover(contour(STOREFRONT), false);
check("leaving gives the drawing back", lit().length === 0 && [...root.querySelectorAll<HTMLElement>("g.node, g.edge")].every((element) => element.style.opacity === "") && root.querySelectorAll(".is-hovered").length === 0);

hover(contour(BILLING), true);
check("billing, with no line out, dims every table and line", bright().length === 0 && dimmed().length === 4 && lit().length === 0 && [...root.querySelectorAll<HTMLElement>("g.edge")].every((edge) => edge.style.opacity === "0.2"));
hover(contour(BILLING), false);

if (failures > 0) {
  console.error(`${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("ERD contour hover: a resource contour lights its links to other resources and dims the rest");
