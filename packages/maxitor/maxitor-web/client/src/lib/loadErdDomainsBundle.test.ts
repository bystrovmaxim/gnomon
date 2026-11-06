// src/lib/loadErdDomainsBundle.test.ts
import { describe, expect, it } from "vitest";
import { dataSourceMaps, resourceMaps, scopeErdBundle, type ErdDomainsBundle } from "@/lib/loadErdDomainsBundle";
import { diagramSelectionForRow } from "@/lib/sidebarNavigation";
import { deepLinkToSelection, selectionToParams } from "@/lib/urlState";

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

describe("the ERD of a data source or of a resource (spec 065)", () => {
  // Shop: Order (Storefront) and Ticket (Support) share ShopDataSource; Invoice (Billing) names none; Legacy has no resource.
  const bundle = (): ErdDomainsBundle => ({
    domains: {
      shop: {
        entities: [
          { id: "shop.Order", resource_id: "shop.Storefront" },
          { id: "shop.Ticket", resource_id: "shop.Support" },
          { id: "shop.Legacy" },
        ],
        relations: [{ source: "shop.Ticket", target: "shop.Order" }, { source: "shop.Legacy", target: "shop.Order" }],
      },
      billing: { entities: [{ id: "billing.Invoice", resource_id: "shop.Billing" }], relations: [] },
    },
    domain_qualifiers: { shop: "d.Shop", billing: "d.Billing" },
    domain_tab_labels: { shop: "Shop", billing: "Billing" },
    domain_qualifier_colors: {},
    domain_qualifier_labels: {},
    relations: [{ source: "shop.Ticket", target: "shop.Order" }, { source: "billing.Invoice", target: "shop.Order" }],
    resource_colors: {},
    resource_labels: {},
    resource_data_sources: { "shop.Storefront": "shop.ShopDataSource", "shop.Support": "shop.ShopDataSource" },
    data_source_colors: {},
    data_source_labels: {},
  });
  const ids = (scoped: ErdDomainsBundle) => Object.values(scoped.domains).flatMap((slice) => (slice.entities as { id: string }[]).map((e) => e.id));

  it("keeps the tables of a data source's resources and the lines between them, and drops emptied domains", () => {
    const scoped = scopeErdBundle(bundle(), { data_source: "shop.ShopDataSource" });
    expect(ids(scoped)).toEqual(["shop.Order", "shop.Ticket"]);
    expect(Object.keys(scoped.domains)).toEqual(["shop"]);
    expect(scoped.domains.shop!.relations).toEqual([{ source: "shop.Ticket", target: "shop.Order" }]);
    expect(scoped.relations).toEqual([{ source: "shop.Ticket", target: "shop.Order" }]);
    expect(scoped.first_domain_label).toBe("Shop");
  });

  it("keeps a resource's own tables only", () => {
    expect(ids(scopeErdBundle(bundle(), { resource: "shop.Billing" }))).toEqual(["billing.Invoice"]);
    expect(ids(scopeErdBundle(bundle(), { resource: "shop.Support" }))).toEqual(["shop.Ticket"]);
  });

  it("opens from a row of the panel and from the address it writes", () => {
    const fromRow = diagramSelectionForRow({ id: "erd_data_source:shop.ShopDataSource", parent_id: "shop.ShopDataSource", label: "ERD — ShopDataSource view", type: "erd_data_source" });
    expect(fromRow).toEqual({ kind: "erd", qualifier: null, data_source: "shop.ShopDataSource" });
    expect(selectionToParams(fromRow!)).toEqual({ view: "domain-erd", data_source: "shop.ShopDataSource" });
    const resource = diagramSelectionForRow({ id: "erd_resource:shop.Billing", parent_id: "no_data_source", label: "ERD — Billing view", type: "erd_resource" });
    expect(deepLinkToSelection({ source: null, view: "domain-erd", domain: null, resource: "shop.Billing", node: null, host: null, room: null })).toEqual(resource);
  });
});
