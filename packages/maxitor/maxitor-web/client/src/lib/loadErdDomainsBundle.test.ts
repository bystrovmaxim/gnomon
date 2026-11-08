// src/lib/loadErdDomainsBundle.test.ts
import { describe, expect, it } from "vitest";
import { resourceMaps } from "@/lib/loadErdDomainsBundle";
import { deepLinkToSelection } from "@/lib/urlState";

const billing = { id: "shop.BillingDatabase", label: "BillingDatabase", color: "#111111" };
const storefront = { id: "shop.StorefrontDatabase", label: "StorefrontDatabase", color: "#222222" };

describe("the resources in the ERD bundle (spec 061, spec 070)", () => {
  it("keeps the server's colour and name of each resource, and every resource's id in order", () => {
    expect(resourceMaps([storefront, billing])).toEqual({
      resource_colors: { "shop.BillingDatabase": "#111111", "shop.StorefrontDatabase": "#222222" },
      resource_labels: { "shop.BillingDatabase": "BillingDatabase", "shop.StorefrontDatabase": "StorefrontDatabase" },
      resource_ids: ["shop.BillingDatabase", "shop.StorefrontDatabase"],
    });
  });

  it("in Diff takes the newer version's colour, and the older's only for a resource the newer lacks", () => {
    const olderBilling = { ...billing, color: "#999999" };
    const gone = { id: "shop.ArchiveDatabase", label: "ArchiveDatabase", color: "#333333" };
    const { resource_colors, resource_ids } = resourceMaps([billing, storefront], [olderBilling, gone]);
    expect(resource_colors).toEqual({ "shop.BillingDatabase": "#111111", "shop.StorefrontDatabase": "#222222", "shop.ArchiveDatabase": "#333333" });
    expect(resource_ids).toEqual(["shop.ArchiveDatabase", "shop.BillingDatabase", "shop.StorefrontDatabase"]);
  });

  it("has no resources for a graph without any", () => {
    expect(resourceMaps([])).toEqual({ resource_colors: {}, resource_labels: {}, resource_ids: [] });
  });
});

describe("an old address of the ERD of a data source or of a resource (spec 070)", () => {
  it("opens the ERD of all domains", () => {
    const link = { source: null, view: "domain-erd", domain: null, node: null, host: null, room: null };
    expect(deepLinkToSelection(link)).toEqual({ kind: "erd", qualifier: null });
  });
});
