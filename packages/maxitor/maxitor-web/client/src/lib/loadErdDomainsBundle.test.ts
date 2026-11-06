// src/lib/loadErdDomainsBundle.test.ts
import { describe, expect, it } from "vitest";
import { dataSourceMaps, resourceMaps } from "@/lib/loadErdDomainsBundle";

const billing = { id: "shop.BillingDatabase", label: "BillingDatabase", color: "#111111" };
const storefront = { id: "shop.StorefrontDatabase", label: "StorefrontDatabase", color: "#222222" };

describe("the colours of resources in the ERD bundle (spec 061)", () => {
  it("keeps the server's colour and name of each resource", () => {
    expect(resourceMaps([billing, storefront])).toEqual({
      resource_colors: { "shop.BillingDatabase": "#111111", "shop.StorefrontDatabase": "#222222" },
      resource_labels: { "shop.BillingDatabase": "BillingDatabase", "shop.StorefrontDatabase": "StorefrontDatabase" },
      resource_data_sources: {},
    });
  });

  it("in Diff takes the newer version's colour, and the older's only for a resource the newer lacks", () => {
    const olderBilling = { ...billing, color: "#999999" };
    const gone = { id: "shop.ArchiveDatabase", label: "ArchiveDatabase", color: "#333333" };
    const { resource_colors } = resourceMaps([billing, storefront], [olderBilling, gone]);
    expect(resource_colors).toEqual({ "shop.BillingDatabase": "#111111", "shop.StorefrontDatabase": "#222222", "shop.ArchiveDatabase": "#333333" });
  });

  it("has no resources for a graph of 1.0–1.5", () => {
    expect(resourceMaps([])).toEqual({ resource_colors: {}, resource_labels: {}, resource_data_sources: {} });
  });
});

describe("the data sources in the ERD bundle (spec 063)", () => {
  it("keeps each resource's data source and each data source's colour and name", () => {
    const shop = { id: "shop.ShopDataSource", label: "ShopDataSource", color: "#444444" };
    expect(resourceMaps([{ ...storefront, data_source_id: shop.id }, { ...billing, data_source_id: null }]).resource_data_sources).toEqual({
      "shop.StorefrontDatabase": "shop.ShopDataSource",
    });
    expect(dataSourceMaps([shop])).toEqual({ data_source_colors: { "shop.ShopDataSource": "#444444" }, data_source_labels: { "shop.ShopDataSource": "ShopDataSource" } });
  });

  it("has no data source for a graph of 1.0–1.6", () => {
    expect(dataSourceMaps([])).toEqual({ data_source_colors: {}, data_source_labels: {} });
  });
});
