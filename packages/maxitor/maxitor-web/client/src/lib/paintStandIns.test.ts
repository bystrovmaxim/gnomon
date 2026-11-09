// src/lib/paintStandIns.test.ts
/**
 * A repaint lays nothing out (#85): the ERD's layout is made with stand-ins for the paint's colours, and a layout made
 * under one paint, recoloured for another, is the very picture a layout made under that other paint gives — in every
 * layout, in both views, with tables that changed and folded frames. Laid out by the real WASM Graphviz.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { Graphviz } from "@hpcc-js/wasm-graphviz";
import {
  buildErdDot,
  erdPaintColours,
  standInColoursOf,
  paintEveryFrame,
  painted,
  recolour,
  setErdPaint,
  withPaintStandIns,
  type ErdEntity,
  type ErdGraphPayload,
  type ErdGraphvizLayout,
  type ErdPaintSource,
} from "@/lib/buildDotSource";
import { erdCompose } from "@/lib/erdCompose";
import { layOutErd } from "@/lib/erdLayout";

let gv: Awaited<ReturnType<typeof Graphviz.load>>;
beforeAll(async () => {
  gv = await Graphviz.load();
});
const layoutFn = (dot: string, engine: string) => gv.layout(dot, "svg", engine as never);

const DOMAINS = ["shop.Store", "shop.Money", "shop.People"];
const RESOURCES = ["db.Orders", "db.Ledger"];
const entity = (id: string, domain: string, kind: string, resource: string | null, diff?: ErdEntity["diff"]): ErdEntity => ({
  id,
  label: id.split(".")[1],
  fields: [
    { name: "id", type: "str", primary_key: true },
    { name: "note", type: "str" },
    { name: "owner", type: "str", foreign_key: true },
  ],
  color: "#3b82f6",
  domain_qualname: domain,
  entity_kind: kind,
  resource_ids: resource ? [resource] : [],
  ...(diff ? { diff } : {}),
});
const tables = [
  entity("shop.Order", DOMAINS[0]!, "entity", RESOURCES[0]!),
  entity("shop.Line", DOMAINS[0]!, "entity", RESOURCES[0]!, "added"),
  entity("shop.Account", DOMAINS[1]!, "ledger", RESOURCES[1]!, "changed"),
  entity("shop.Entry", DOMAINS[1]!, "ledger", RESOURCES[1]!),
  entity("shop.Person", DOMAINS[2]!, "entity", null, "unchanged"),
];
const relations = tables.slice(1).map((one, k) => ({ source: one.id, target: tables[k]!.id, source_field: "owner", relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one" }));
const data = (model: "logical" | "physical", folded: string[] = []): ErdGraphPayload => ({
  entities: tables,
  relations,
  model,
  domain_labels: Object.fromEntries(DOMAINS.map((domain) => [domain, `${domain.split(".")[1]}Domain`])),
  domain_colors: { [DOMAINS[0]!]: "#ea580c", [DOMAINS[1]!]: "#16a34a", [DOMAINS[2]!]: "#8b5cf6" },
  resource_ids: RESOURCES,
  resource_labels: { [RESOURCES[0]!]: "Orders", [RESOURCES[1]!]: "Ledger" },
  folded_contours: new Set(folded),
});
const PAINTS: ReadonlyArray<[ErdPaintSource, Record<string, string>]> = [
  ["domain", {}],
  ["kind", { entity: "#3b82f6", ledger: "#f97316" }],
  ["resource", { [RESOURCES[0]!]: "#10b981", [RESOURCES[1]!]: "#a855f7" }],
  ["change", {}],
];

/** The ERD's picture as the canvas lays it out: Dot draws frames as clusters, the other engines are composed. */
function laidOut(payload: ErdGraphPayload, layout: ErdGraphvizLayout): string {
  const source = buildErdDot(payload, layout, (dot) => layoutFn(dot, "dot"));
  return layout.startsWith("gv-dot") ? layoutFn(source, "dot") : erdCompose(payload, layout, layoutFn);
}

/** The DOT and the colours of ``paint``, as the canvas reads them before it looks for a kept layout. */
function standInSource(payload: ErdGraphPayload, layout: ErdGraphvizLayout) {
  return withPaintStandIns(() => {
    paintEveryFrame(payload);
    return buildErdDot(payload, layout, (dot) => layoutFn(dot, "dot"));
  });
}

describe("a repaint recolours the layout it has (#85)", () => {
  it("a slot is its colour outside a layout, and one stand-in, the same each time, inside", () => {
    expect(painted("head:x", "#123456")).toBe("#123456");
    const first = withPaintStandIns(() => painted("head:x", "#123456"));
    const again = withPaintStandIns(() => painted("head:x", "#abcdef"));
    expect(first.value).toBe(again.value);
    expect(first.value).toMatch(/^#0b[0-9a-f]{4}$/);
    expect(recolour(`fill="${first.value}"`, again.colours)).toBe('fill="#abcdef"');
  });

  for (const layout of ["gv-dot-lr", "gv-dot-tb", "gv-neato", "gv-circo"] as ErdGraphvizLayout[]) {
    for (const [model, folded] of [["logical", []], ["physical", []], ["logical", [`dc:${DOMAINS[1]}`]], ["physical", [`rc:${RESOURCES[0]}`]]] as const) {
      it(`${layout}, ${model}${folded.length ? ", one frame folded" : ""}: one layout, recoloured, is every paint's own picture`, () => {
        const payload = data(model, [...folded]);
        setErdPaint("domain", {});
        const kept = standInSource(payload, layout);
        const keptLayout = withPaintStandIns(() => laidOut(payload, layout)).value;
        for (const [source, colours] of PAINTS) {
          setErdPaint(source, colours);
          const now = standInSource(payload, layout);
          // The text Graphviz is given is the same in every paint: the layout is kept under it.
          expect(now.value).toBe(kept.value);
          expect(recolour(keptLayout, now.colours)).toBe(laidOut(payload, layout));
        }
        setErdPaint("domain", {});
      });
    }
  }

  for (const layout of ["gv-dot-lr", "gv-neato"] as ErdGraphvizLayout[]) {
    for (const model of ["logical", "physical"] as const) {
      it(`${layout}, ${model}: the page reads every colour of a repaint from the slots, as the layout gave them`, async () => {
        const payload = { ...data(model, [`dc:${DOMAINS[2]}`]), folds: new Map([[tables[0]!.id, { collapsed: true, hidden: new Set([1]) }]]) };
        for (const [source, colours] of PAINTS) {
          const picture = await layOutErd({ data: payload, layout, paint: { source, colours } }, async () => gv);
          setErdPaint(source, colours);
          expect(standInColoursOf(picture.slots, erdPaintColours(payload))).toEqual(picture.colours);
        }
        setErdPaint("domain", {});
      });
    }
  }
});
