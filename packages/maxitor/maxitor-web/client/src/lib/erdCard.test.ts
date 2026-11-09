import { describe, expect, it } from "vitest";
import type { ErdEntity, ErdRelation } from "@/lib/buildDotSource";
import type { CompareResult } from "@/api/compare";
import { erdSubject, fromAfar, litBy, resourceLine } from "@/lib/erdCard";
import { markErd } from "@/lib/erdDiff";
import { physicalDrawing } from "@/lib/erdViews";

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

describe("a table's card says its domain and where it lies (spec 070)", () => {
  const BILLING = "shop.BillingDatabase";
  const STOREFRONT = "shop.StorefrontDatabase";
  const invoice: ErdEntity = { id: "shop.Invoice", label: "Invoice", fields: [], domain_qualname: "shop.MoneyDomain", resource_ids: [BILLING] };
  const labels = { [BILLING]: "BillingDatabase", [STOREFRONT]: "StorefrontDatabase" };
  const domains = { "shop.MoneyDomain": "Money" };
  const detail = (entity: ErdEntity, storageKnown = true) => erdSubject({ kind: "table", id: entity.id }, [entity], root, [], labels, [], domains, storageKnown)?.detail;

  it("reads the domain and every resource that keeps the table", () => {
    expect(detail(invoice)).toBe("Domain: Money · Resources: BillingDatabase");
    expect(detail({ ...invoice, resource_ids: [BILLING, STOREFRONT] })).toBe("Domain: Money · Resources: BillingDatabase, StorefrontDatabase");
  });

  it("says Not stored when no resource keeps it", () => {
    expect(detail({ ...invoice, resource_ids: [] })).toBe("Domain: Money · Not stored");
  });

  it("reads the domain alone for a graph that does not say where tables lie", () => {
    expect(detail({ ...invoice, resource_ids: [] }, false)).toBe("Domain: Money");
    expect(erdSubject({ kind: "table", id: "a.Lot" }, entities, root, [], labels)?.detail).toBe("");
  });

  it("in Diff names where a table was kept before", () => {
    expect(detail({ ...invoice, resource_ids: [STOREFRONT], previous_resource_ids: [BILLING] })).toBe("Domain: Money · Resources: BillingDatabase → StorefrontDatabase");
  });

  it("names no data source", () => {
    expect(resourceLine(invoice, labels, domains)).not.toMatch(/data source/i);
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
    const subject = erdSubject({ kind: "edge", id: "rb0" }, shopEntities, document.body, shopRelations, { "shop.Orders": "OrdersResource" }, bundles)!;
    expect(subject.title).toBe("Ticket ↔ OrdersResource");
    expect(subject.fieldNoun).toBe("relation");
    expect(subject.fields).toEqual([
      { name: "Ticket.order → Order", type: "association · 0..* → 1", description: "The order it is about" },
      { name: "Ticket.line → Line", type: "association", description: undefined },
    ]);
  });

  it("leaves an ordinary line's card as it was", () => {
    document.body.innerHTML = "<div></div>";
    expect(erdSubject({ kind: "edge", id: "re0" }, shopEntities, document.body, shopRelations, {}, bundles)!.title).toBe("Ticket.order → Order");
  });
});

describe("the card of a resource's frame and of its folded box (spec 068, spec 070)", () => {
  const ORDERS = "shop.OrdersResource";
  const SUPPORT = "shop.SupportResource";
  const ARCHIVE = "shop.ArchiveResource";
  const copy = (entity: string, resource: string, entity_kind = "core"): ErdEntity => ({ ...physicalDrawing([{ id: entity, label: entity.split(".")[1], resource_ids: [resource], entity_kind, fields: [] }], []).entities[0]! });
  const drawn = [copy("shop.Order", ORDERS), copy("shop.Line", ORDERS, "detail"), copy("shop.Ticket", SUPPORT)];
  const labels = { [ORDERS]: "OrdersResource", [SUPPORT]: "SupportResource", [ARCHIVE]: "ArchiveResource" };
  const card = (ref: { kind: "contour" | "table"; id: string }) => erdSubject(ref, drawn, document.createElement("div"), [], labels);

  it("gives a resource's frame its icon, name and copies — their count only on the fold — and the full id to copy", () => {
    const subject = card({ kind: "contour", id: `rc:${ORDERS}` })!;
    expect([subject.title, subject.detail, subject.nodeId, subject.copy, subject.fieldNoun]).toEqual(["OrdersResource", "Resource", ORDERS, ORDERS, "table"]);
    expect(subject.fields).toEqual([{ name: "Line", type: "detail" }, { name: "Order", type: "core" }]);
    expect(decodeURIComponent(subject.icon!)).toContain("#7570B3");
  });

  it("gives a folded resource box the same card as its frame", () => {
    expect(card({ kind: "table", id: `rc:${ORDERS}` })!.fields).toEqual(card({ kind: "contour", id: `rc:${ORDERS}` })!.fields);
  });

  it("gives an empty resource's frame a card that says it keeps nothing", () => {
    expect(card({ kind: "contour", id: `rc:${ARCHIVE}` })).toMatchObject({ title: "ArchiveResource", detail: "Resource · keeps no entity", fields: [] });
  });

  it("has no card for a frame of a resource the graph does not have", () => {
    expect(card({ kind: "contour", id: "rc:shop.Gone" })).toBeNull();
  });

  it("gives a domain's frame its name and tables", () => {
    const store = { id: "shop.Order", label: "Order", domain_qualname: "shop.StoreDomain", entity_kind: "core", fields: [] };
    const subject = erdSubject({ kind: "contour", id: "dc:shop.StoreDomain" }, [store], document.createElement("div"), [], {}, [], { "shop.StoreDomain": "StoreDomain" })!;
    expect([subject.title, subject.detail, subject.fieldNoun]).toEqual(["StoreDomain", "Domain", "table"]);
    expect(subject.fields).toEqual([{ name: "Order", type: "core" }]);
  });

  it("reads a copy's card as its entity's, naming the entity for the full graph", () => {
    expect(erdSubject({ kind: "table", id: drawn[0]!.id }, drawn, document.createElement("div"), [], labels)).toMatchObject({ title: "Order", nodeId: "shop.Order" });
  });
});
