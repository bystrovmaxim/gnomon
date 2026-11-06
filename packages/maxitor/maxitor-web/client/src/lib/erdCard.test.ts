import { describe, expect, it } from "vitest";
import type { ErdEntity, ErdRelation } from "@/lib/buildDotSource";
import type { CompareResult } from "@/api/compare";
import { erdSubject, fromAfar, litBy, resourceLine } from "@/lib/erdCard";
import { markErd } from "@/lib/erdDiff";

const entities: ErdEntity[] = [
  { id: "a.Lot", label: "Lot", entity_kind_label: "Core", fields: [{ name: "id", type: "str", primary_key: true, description: "Lot id" }] },
  { id: "a.Offer", label: "Offer", diff: "changed", fields: [{ name: "price", type: "int", diff: "unchanged" }, { name: "chosen", type: "str", diff: "changed", annotation: "Optional[str]" }, { name: "status", type: "S", lifecycle_id: "a.Offer:lifecycle:status" }] },
];
const root = document.createElement("div");

describe("erdSubject", () => {
  it("gives an unchanged row its name and type, and no change", () => {
    const subject = erdSubject({ kind: "row", id: "fn1_0" }, entities, root);
    expect(subject).toMatchObject({ title: "price", detail: "int", nodeId: null, change: null, lifecycleIds: [], copy: "price" });
  });

  it("gives a changed row every element it stands for", () => {
    const subject = erdSubject({ kind: "row", id: "ft1_1" }, entities, root);
    expect(subject?.change?.elements.map((element) => element.id)).toEqual(["a.Offer:chosen", "a.Offer|entity_field|a.Offer:chosen", "a.Offer|entity_relation|chosen"]);
    expect(subject?.detail).toBe("Optional[str]");
  });

  it("gives a row its description", () => {
    const table: ErdEntity = { id: "t", fields: [{ name: "owner", foreign_key: true, description: "Who owns it" }] };
    expect(erdSubject({ kind: "row", id: "fn0_0" }, [table], root)?.description).toBe("Who owns it");
    expect(erdSubject({ kind: "table", id: "t" }, [table], root)?.fields?.[0]?.description).toBe("Who owns it");
  });

  it("names a row's lifecycle", () => {
    expect(erdSubject({ kind: "row", id: "fn1_2" }, entities, root)?.lifecycleIds).toEqual(["a.Offer:lifecycle:status"]);
  });

  it("lists a table's fields, keys marked", () => {
    expect(erdSubject({ kind: "table", id: "a.Lot" }, entities, root)).toMatchObject({ detail: "", nodeId: "a.Lot", change: null, fields: [{ name: "id", type: "str", key: "PK", description: "Lot id" }] });
  });

  it("shows a table's lifecycles", () => {
    expect(erdSubject({ kind: "table", id: "a.Offer" }, entities, root)?.lifecycleIds).toEqual(["a.Offer:lifecycle:status"]);
    expect(erdSubject({ kind: "table", id: "a.Lot" }, entities, root)?.lifecycleIds).toEqual([]);
  });

  it("tells a changed table", () => {
    expect(erdSubject({ kind: "table", id: "a.Offer" }, entities, root)?.change).toEqual({ title: "Offer", status: "changed", elements: [{ kind: "node", id: "a.Offer" }] });
  });

  it("tells a line in the model's words, with no paths", () => {
    const relations = [{ source: "a.Lot", target: "a.Offer", source_field: "offer", target_field: "lots", relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one", description: "The offer it came from", diff: "added" }] as ErdRelation[];
    expect(erdSubject({ kind: "edge", id: "re0" }, entities, root, relations)).toMatchObject({ title: "Lot.offer → Offer.lots", detail: "Association · 0..* → 1", description: "The offer it came from", change: { status: "added" } });
  });

  it("has nothing for a line it does not know or an unknown table", () => {
    expect(erdSubject({ kind: "edge", id: "re1" }, entities, root)).toBeNull();
    expect(erdSubject({ kind: "table", id: "a.None" }, entities, root)).toBeNull();
  });
});

describe("a row from afar (spec 043)", () => {
  const cell = (height: number) => ({ getBoundingClientRect: () => ({ height }) }) as Element;
  const row = { kind: "row", id: "fn1_0" } as const;

  it("stands for its table when it cannot be read", () => {
    expect(fromAfar(row, cell(9), entities, false)).toEqual({ kind: "table", id: "a.Offer" });
  });

  it("stays a row when it can", () => expect(fromAfar(row, cell(10), entities, false)).toBe(row));

  it("asks more of a finger", () => {
    expect(fromAfar(row, cell(15), entities, true)).toEqual({ kind: "table", id: "a.Offer" });
    expect(fromAfar(row, cell(20), entities, true)).toBe(row);
  });
});

describe("a table's card in Diff", () => {
  it("marks a table whose fields changed, though it did not", () => {
    const table: ErdEntity = { id: "t", diff: "unchanged", fields: [{ name: "same", diff: "unchanged" }, { name: "typed", diff: "changed" }] };
    expect(erdSubject({ kind: "table", id: "t" }, [table], root)?.change).toMatchObject({ status: "changed", note: "Its fields changed." });
  });

  it("says a table changed through its lifecycle and lists what changed in it", () => {
    const part = { kind: "edge" as const, id: "x", label: "provisioned → closed", type: "Transition", group: "Transitions", status: "added" as const, differences: [] };
    const table: ErdEntity = { id: "t", diff: "unchanged", fields: [{ name: "lifecycle", diff: "changed", lifecycle_id: "t:lifecycle:lifecycle", lifecycle_parts: [part] }] };
    expect(erdSubject({ kind: "table", id: "t" }, [table], root)?.change).toMatchObject({ status: "changed", note: "Its lifecycle changed.", parts: [part] });
  });

  it("leaves a table of no change unmarked", () => {
    expect(erdSubject({ kind: "table", id: "t" }, [{ id: "t", diff: "unchanged", fields: [{ name: "same", diff: "unchanged" }] }], root)?.change).toBeNull();
  });

  it("says a table moved to another domain", () => {
    const table: ErdEntity = { id: "t", diff: "changed", movedDomain: true, fields: [] };
    expect(erdSubject({ kind: "table", id: "t" }, [table], root)?.change?.note).toBe("Moved to another domain.");
  });

  it("puts what changed first, with its mark and earlier type", () => {
    const table: ErdEntity = { id: "t", fields: [{ name: "same", diff: "unchanged" }, { name: "new", diff: "added" }, { name: "typed", type: "int", previous_type: "str", diff: "changed" }] };
    const fields = erdSubject({ kind: "table", id: "t" }, [table], root)?.fields;
    expect(fields?.map((field) => [field.name, field.status])).toEqual([["new", "added"], ["typed", "changed"], ["same", undefined]]);
    expect(fields?.[1]?.previousType).toBe("str");
  });
});

describe("a table that changed domain (spec 043)", () => {
  it("is marked changed though its own properties are not", () => {
    const compared: CompareResult = { counts: { nodes: { added: 0, removed: 0, changed: 0 }, edges: { added: 1, removed: 1, changed: 0 } }, nodes: {}, edges: { "t|domain|a": "removed", "t|domain|b": "added" } };
    const [moved, still] = markErd({ entities: [{ id: "t" }, { id: "u" }] }, compared).entities!;
    expect([moved?.diff, moved?.movedDomain]).toEqual(["changed", true]);
    expect([still?.diff, still?.movedDomain]).toEqual(["unchanged", false]);
  });
});

describe("litBy", () => {
  const tables: ErdEntity[] = [{ id: "a", fields: [{ name: "owner" }, { name: "plain" }] }, { id: "b" }, { id: "c" }];
  const lines = [{ source: "a", target: "b", source_field: "owner" }, { source: "c", target: "a", source_field: "ref", target_field: "plain" }, { source: "a", target: "a", source_field: "peer" }] as ErdRelation[];

  it("of a table: every table it joins, never itself, and all its lines", () => {
    expect(litBy({ kind: "table", id: "a" }, tables, lines)).toEqual({ tables: ["b", "c"], lines: [0, 1, 2] });
  });

  it("of a row: only what its own lines reach", () => {
    expect(litBy({ kind: "row", id: "fn0_0" }, tables, lines)).toEqual({ tables: ["b"], lines: [0] });
    expect(litBy({ kind: "row", id: "fn0_1" }, tables, lines)).toEqual({ tables: ["c"], lines: [1] });
  });

  it("of a line: its two ends and itself", () => {
    expect(litBy({ kind: "edge", id: "re0" }, tables, lines)).toEqual({ tables: ["a", "b"], lines: [0] });
  });
});

describe("a table's card names its resource (spec 061)", () => {
  const invoice: ErdEntity = { id: "shop.Invoice", label: "Invoice", fields: [], resource_id: "shop.BillingDatabase", resource_label: "BillingDatabase" };
  const labels = { "shop.BillingDatabase": "BillingDatabase", "shop.StorefrontDatabase": "StorefrontDatabase" };

  it("reads the resource under the table's name", () => {
    expect(erdSubject({ kind: "table", id: "shop.Invoice" }, [invoice], root, [], labels)?.detail).toBe("Resource: BillingDatabase");
  });

  it("has no resource line for a table of a graph older than 1.6", () => {
    expect(erdSubject({ kind: "table", id: "a.Lot" }, entities, root, [], labels)?.detail).toBe("");
  });

  it("in Diff names where a moved table was stored before", () => {
    const moved: ErdEntity = { ...invoice, resource_id: "shop.StorefrontDatabase", resource_label: "StorefrontDatabase", previous_resource_id: "shop.BillingDatabase" };
    expect(erdSubject({ kind: "table", id: "shop.Invoice" }, [moved], root, [], labels)?.detail).toBe("Resource: BillingDatabase → StorefrontDatabase");
  });
});

describe("the data source on a table's card (spec 063)", () => {
  it("names the data source of the table's resource, or that it names none", () => {
    const entity = { id: "shop.Order", label: "Order", resource_id: "shop.Storefront", fields: [] } as never;
    const labels = { "shop.Storefront": "Storefront", "shop.Billing": "Billing" };
    const sources = { "shop.ShopDataSource": "ShopDataSource" };
    expect(resourceLine(entity, labels, { "shop.Storefront": "shop.ShopDataSource" }, sources)).toBe("Resource: Storefront · Data source: ShopDataSource");
    expect(resourceLine({ ...(entity as object), resource_id: "shop.Billing" } as never, labels, {}, sources)).toBe("Resource: Billing · No data source");
    expect(resourceLine(entity, labels)).toBe("Resource: Storefront");
  });
});

describe("a bundle's card (spec 065)", () => {
  const shopEntities: ErdEntity[] = [{ id: "shop.Ticket", label: "Ticket" }, { id: "shop.Order", label: "Order" }, { id: "shop.Line", label: "Line" }];
  const shopRelations: ErdRelation[] = [
    { source: "shop.Ticket", target: "shop.Order", source_field: "order", relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one", description: "The order it is about" },
    { source: "shop.Ticket", target: "shop.Line", source_field: "line", relationship_kind: "association" },
  ];
  const bundles = [{ id: "rb0", source: "shop.Ticket", target: "rc:shop.Orders", relations: [0, 1] }];

  it("names its two ends and lists each relation it stands for", () => {
    document.body.innerHTML = "<div></div>";
    const subject = erdSubject({ kind: "edge", id: "rb0" }, shopEntities, document.body, shopRelations, { "shop.Orders": "OrdersResource" }, {}, {}, bundles)!;
    expect(subject.title).toBe("Ticket ↔ OrdersResource");
    expect(subject.fieldNoun).toBe("relation");
    expect(subject.fields).toEqual([
      { name: "Ticket.order → Order", type: "association · 0..* → 1", description: "The order it is about" },
      { name: "Ticket.line → Line", type: "association", description: undefined },
    ]);
  });

  it("leaves an ordinary line's card as it was", () => {
    document.body.innerHTML = "<div></div>";
    expect(erdSubject({ kind: "edge", id: "re0" }, shopEntities, document.body, shopRelations, {}, {}, {}, bundles)!.title).toBe("Ticket.order → Order");
  });
});

describe("the card of a contour and of a folded box (spec 068)", () => {
  const ORDERS = "shop.OrdersResource";
  const SUPPORT = "shop.SupportResource";
  const SHOP = "shop.ShopDataSource";
  const table = (id: string, resource_id: string, entity_kind = "core"): ErdEntity => ({ id, label: id.split(".")[1], resource_id, entity_kind, fields: [] });
  const entities = [table("shop.Order", ORDERS), table("shop.Line", ORDERS, "detail"), table("shop.Ticket", SUPPORT)];
  const labels = { [ORDERS]: "OrdersResource", [SUPPORT]: "SupportResource" };
  const sources = { [ORDERS]: SHOP, [SUPPORT]: SHOP };
  const sourceLabels = { [SHOP]: "ShopDataSource" };
  const card = (ref: { kind: "contour" | "table"; id: string }) => erdSubject(ref, entities, document.createElement("div"), [], labels, sources, sourceLabels);

  it("gives a resource contour its icon, name, data source and tables — their count only on the fold — and the full id to copy", () => {
    const subject = card({ kind: "contour", id: ORDERS })!;
    expect([subject.title, subject.detail, subject.nodeId, subject.copy, subject.fieldNoun]).toEqual([
      "OrdersResource",
      "Resource · Data source: ShopDataSource",
      ORDERS,
      ORDERS,
      "table",
    ]);
    expect(subject.fields).toEqual([{ name: "Line", type: "detail" }, { name: "Order", type: "core" }]);
    expect(subject.icon).toMatch(/^data:image\/svg\+xml,/);
    expect(decodeURIComponent(subject.icon!)).toContain("#7570B3");
  });

  it("gives a folded resource box the same card as its contour", () => {
    expect(card({ kind: "table", id: `rc:${ORDERS}` })!.fields).toEqual(card({ kind: "contour", id: ORDERS })!.fields);
  });

  it("gives a folded data source box its own icon, its resources and tables, each table with its resource", () => {
    const subject = card({ kind: "table", id: `dc:${SHOP}` })!;
    expect([subject.title, subject.detail, subject.nodeId]).toEqual(["ShopDataSource", "Data source · 2 resources", SHOP]);
    expect(subject.fields).toEqual([
      { name: "Line", type: "OrdersResource" },
      { name: "Order", type: "OrdersResource" },
      { name: "Ticket", type: "SupportResource" },
    ]);
    expect(decodeURIComponent(subject.icon!)).toContain("#0F766E");
  });

  it("has no card for a contour of nothing on the diagram", () => {
    expect(card({ kind: "contour", id: "shop.Gone" })).toBeNull();
  });
});
