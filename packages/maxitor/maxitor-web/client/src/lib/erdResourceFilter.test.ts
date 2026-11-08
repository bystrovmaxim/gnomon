// src/lib/erdResourceFilter.test.ts
import { describe, expect, it } from "vitest";
import type { ErdEntity } from "@/lib/buildDotSource";
import { resourcesOnDiagram } from "@/lib/erdResourceFilter";

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
