// src/lib/erdResourceFilter.test.ts
import { describe, expect, it } from "vitest";
import type { ErdEntity, ErdGraphPayload } from "@/lib/buildDotSource";
import { filterGraphByResources, resourcesOnDiagram } from "@/lib/erdResourceFilter";

const table = (id: string, resource_id?: string): ErdEntity => ({ id, label: id, fields: [], ...(resource_id ? { resource_id } : {}) });

const shop = (): ErdGraphPayload => ({
  entities: [table("Order", "shop.StorefrontDatabase"), table("OrderLine", "shop.StorefrontDatabase"), table("Invoice", "shop.BillingDatabase"), table("Legacy")],
  relations: [{ source: "Order", target: "OrderLine", relationship_kind: "composition" }],
});

describe("the Resources section of the ERD (spec 061)", () => {
  it("lists each resource of the diagram once, by id", () => {
    expect(resourcesOnDiagram(shop().entities)).toEqual(["shop.BillingDatabase", "shop.StorefrontDatabase"]);
  });

  it("lists nothing for a graph older than 1.6", () => {
    expect(resourcesOnDiagram([table("Lot"), table("Offer")])).toEqual([]);
  });

  it("hides exactly the tables of a resource switched off, and their lines", () => {
    const left = filterGraphByResources(shop(), new Set(["shop.StorefrontDatabase"]));
    expect(left.entities.map((entity) => entity.id)).toEqual(["Invoice", "Legacy"]);
    expect(left.relations).toEqual([]);
  });

  it("never hides a table that has no resource", () => {
    const left = filterGraphByResources(shop(), new Set(["shop.StorefrontDatabase", "shop.BillingDatabase"]));
    expect(left.entities.map((entity) => entity.id)).toEqual(["Legacy"]);
  });
});
