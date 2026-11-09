// src/lib/erdResourceFilter.test.ts
import { describe, expect, it } from "vitest";
import type { ErdEntity } from "@/lib/buildDotSource";
import { physicalViewAvailable, resourcesOfDiagram, resourcesOnDiagram } from "@/lib/erdResourceFilter";

const table = (id: string, ...resource_ids: string[]): ErdEntity => ({ id, label: id, fields: [], resource_ids });

describe("the Resources section of the physical view (spec 061, spec 070)", () => {
  it("lists each resource that keeps a table once, by id — one table kept by two counts for both", () => {
    const entities = [table("Order", "shop.StorefrontDatabase"), table("Invoice", "shop.BillingDatabase", "shop.StorefrontDatabase"), table("Legacy")];
    expect(resourcesOnDiagram(entities)).toEqual(["shop.BillingDatabase", "shop.StorefrontDatabase"]);
  });

  it("lists nothing for a graph that does not say where tables lie", () => {
    expect(resourcesOnDiagram([{ id: "Lot", fields: [] }, table("Offer")])).toEqual([]);
  });
});

describe("the resources a diagram frames (#78)", () => {
  const all = ["shop.ArchiveDatabase", "shop.BillingDatabase", "shop.StorefrontDatabase"];
  const entities = [table("Order", "shop.StorefrontDatabase"), table("Legacy")];

  it("frames every resource of the model on the ERD of all domains, an empty one too", () => {
    expect(resourcesOfDiagram(all, entities, true)).toEqual(all);
  });

  it("frames only the resources of its tables on the ERD of one domain", () => {
    expect(resourcesOfDiagram(all, entities, false)).toEqual(["shop.StorefrontDatabase"]);
  });

  it("keeps the model's order", () => {
    expect(resourcesOfDiagram(all, [table("Invoice", "shop.StorefrontDatabase", "shop.ArchiveDatabase")], false)).toEqual(["shop.ArchiveDatabase", "shop.StorefrontDatabase"]);
  });
});

describe("whether the physical view is offered (spec 071)", () => {
  it("is offered when the graph says where entities lie and a base table is kept", () => {
    expect(physicalViewAvailable(true, [table("Order", "shop.StorefrontDatabase")])).toBe(true);
  });

  it("is not offered for a graph that does not say where entities lie", () => {
    expect(physicalViewAvailable(false, [table("Order")])).toBe(false);
    expect(physicalViewAvailable(false, [table("Order", "shop.StorefrontDatabase")])).toBe(false);
  });

  it("is not offered when no table of the base is kept by a resource", () => {
    expect(physicalViewAvailable(true, [table("Order"), table("Invoice")])).toBe(false);
    expect(physicalViewAvailable(true, [])).toBe(false);
  });
});
