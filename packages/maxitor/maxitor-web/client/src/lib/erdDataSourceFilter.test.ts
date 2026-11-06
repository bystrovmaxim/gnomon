import { describe, expect, it } from "vitest";
import type { ErdEntity, ErdGraphPayload } from "@/lib/buildDotSource";
import { dataSourcesOnDiagram, filterGraphByDataSources, NO_DATA_SOURCE } from "@/lib/erdDataSourceFilter";

const table = (id: string, resource_id: string | null): ErdEntity => ({ id, label: id, resource_id, fields: [] }) as unknown as ErdEntity;
const order = table("shop.Order", "shop.Storefront");
const ticket = table("shop.Ticket", "shop.Support");
const invoice = table("shop.Invoice", "shop.Billing");
const old = table("shop.Old", null);
const shares = { "shop.Storefront": "shop.ShopDataSource", "shop.Support": "shop.ShopDataSource" };

describe("the Data sources section of the ERD (spec 063)", () => {
  it("lists the data sources of the diagram, then one row for the resources that name none", () => {
    expect(dataSourcesOnDiagram([order, ticket, invoice, old], shares)).toEqual(["shop.ShopDataSource", NO_DATA_SOURCE]);
  });

  it("has no row at all without a data source", () => {
    expect(dataSourcesOnDiagram([invoice, old], {})).toEqual([]);
  });

  it("hides the tables of a data source switched off, and those of resources naming none", () => {
    const data = { entities: [order, ticket, invoice, old], relations: [] } as ErdGraphPayload;
    expect(filterGraphByDataSources(data, new Set(["shop.ShopDataSource"]), shares).entities.map((e) => e.id)).toEqual(["shop.Invoice", "shop.Old"]);
    expect(filterGraphByDataSources(data, new Set([NO_DATA_SOURCE]), shares).entities.map((e) => e.id)).toEqual(["shop.Order", "shop.Ticket", "shop.Old"]);
  });
});
