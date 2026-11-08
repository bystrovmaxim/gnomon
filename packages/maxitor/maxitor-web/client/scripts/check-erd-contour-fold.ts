// scripts/check-erd-contour-fold.ts
/**
 * The ERD drawing check of spec 065 — folding contours, on the SVG the page shows.
 *
 * It lays out the physical view of a shop — a storefront, a support desk and a billing database — through the WASM
 * Graphviz build the client loads, with the production passes, and asserts what the reader sees: a folded resource is
 * one box with its counts and no copy of its own; each link of a copy still drawn keeps a line of its own to the box;
 * the links between two folded boxes are one line, wider, with its count on a plate; every resource's frame carries a
 * minus in its corner and every box a plus (spec 065, spec 070).
 *
 * Exit codes: 0 all assertions passed; 1 an assertion failed; 2 the environment cannot run it.
 */

import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { JSDOM } from "jsdom";
import { buildDotSource, ERD_CARD_RADIUS, ERD_CARD_STROKE, setErdPaint, type ErdEntity, type ErdGraphPayload } from "../src/lib/buildDotSource.ts";
import { containNodeFills } from "../src/lib/containNodeFills.ts";
import { addFoldControls, drawErdCards } from "../src/lib/erdPostPass.ts";
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
const table = (id: string, resource: string): ErdEntity => ({ id, label: id.split(".")[1], fields: [{ name: "id", type: "str", primary_key: true }], color: "#3b82f6", domain_qualname: "shop.ShopDomain", resource_ids: [resource] });
const link = (source: string, target: string, field: string) => ({ source, target, source_field: field, relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one" });

const drawing = physicalDrawing(
  [table("shop.Order", STOREFRONT), table("shop.OrderLine", STOREFRONT), table("shop.Ticket", SUPPORT), table("shop.Note", SUPPORT), table("shop.Invoice", BILLING)],
  [link("shop.OrderLine", "shop.Order", "order"), link("shop.Ticket", "shop.Order", "order"), link("shop.Note", "shop.Order", "order"), link("shop.Note", "shop.OrderLine", "line")],
);
const shop = (folded: string[]): ErdGraphPayload => ({
  entities: drawing.entities,
  relations: drawing.relations,
  model: "physical",
  resource_ids: [BILLING, STOREFRONT, SUPPORT],
  resource_labels: { [STOREFRONT]: "StorefrontDatabase", [SUPPORT]: "SupportDatabase", [BILLING]: "BillingDatabase" },
  folded_contours: new Set(folded),
});

setErdPaint("domain", {});
/** The drawing as the page holds it, in a DOM, its fold controls placed. */
function draw(folded: string[]): Document {
  const markup = drawErdCards(containNodeFills(gv.layout(buildDotSource(shop(folded), "gv-dot-lr"), "svg", "dot")), ERD_CARD_RADIUS, ERD_CARD_STROKE);
  const { document } = new JSDOM(`<div id="root">${markup.slice(markup.indexOf("<svg"))}</div>`).window;
  (globalThis as { document?: Document }).document = document;
  addFoldControls(document.getElementById("root")!);
  return document;
}
const titles = (doc: Document) => [...doc.querySelectorAll("g.node > title")].map((title) => title.textContent ?? "");
const lines = (doc: Document) =>
  [...doc.querySelectorAll('g.edge[id^="rb"]')].map((edge) => ({
    id: edge.id,
    ends: edge.querySelector("title")?.textContent ?? "",
    width: Number(edge.querySelector("path")?.getAttribute("stroke-width") ?? "1"),
    plate: edge.querySelector("text")?.textContent ?? "",
  }));

const one = draw([`rc:${STOREFRONT}`]);
check("a folded resource is one box, its copies not drawn", titles(one).includes(`rc:${STOREFRONT}`) && !titles(one).includes(copyId("shop.Order", STOREFRONT)) && !titles(one).includes(copyId("shop.OrderLine", STOREFRONT)), titles(one).join(", "));
check("the box says what it stands for", one.body.textContent!.includes("2 tables · 1 relation inside"));
const fromTables = lines(one);
check("each link of a copy still drawn has a line of its own to the box", fromTables.length === 3 && fromTables.every((line) => line.width === 1 && line.plate === ""), JSON.stringify(fromTables));
const controls = [...one.querySelectorAll(".erd-fold-control")].map((control) => `${control.getAttribute("data-fold")}=${control.getAttribute("data-folded")}`).sort();
check("every resource's frame has a minus and the box a plus", JSON.stringify(controls) === JSON.stringify([`rc:${BILLING}=0`, `rc:${STOREFRONT}=1`, `rc:${SUPPORT}=0`]), controls.join(", "));

const two = draw([`rc:${STOREFRONT}`, `rc:${SUPPORT}`]);
const between = lines(two);
check("the links between two folded boxes are one line", between.length === 1, JSON.stringify(between));
check("that line is wider and plated with its count", between[0]?.width === 4.4 && between[0]?.plate === "×3", JSON.stringify(between[0]));


if (failures > 0) {
  console.error(`${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("ERD contour fold: folded boxes, a line per table link, bundles between boxes, fold controls");
