// src/lib/erdViews.test.ts
import { describe, expect, it } from "vitest";
import { copyEntity, copyId, copyResource, viewLayout } from "@/lib/erdViews";

describe("a copy's id (spec 070)", () => {
  it("names the entity and the resource, and the Not stored copy with no resource", () => {
    expect([copyEntity(copyId("shop.Order", "shop.Db")), copyResource(copyId("shop.Order", "shop.Db"))]).toEqual(["shop.Order", "shop.Db"]);
    expect([copyEntity(copyId("shop.Order", null)), copyResource(copyId("shop.Order", null))]).toEqual(["shop.Order", null]);
    expect([copyEntity("shop.Order"), copyResource("shop.Order")]).toEqual(["shop.Order", null]);
  });
});

describe("the layout of a view (spec 070)", () => {
  it("frames both views under Dot", () => {
    expect(viewLayout("logical", "gv-dot-tb")).toEqual({ layout: "gv-dot-tb", framed: true });
    expect(viewLayout("physical", "gv-dot-lr")).toEqual({ layout: "gv-dot-lr", framed: true });
  });

  it("keeps another engine for the logical view, with no frame", () => {
    expect(viewLayout("logical", "gv-fdp")).toEqual({ layout: "gv-fdp", framed: false });
  });

  it("draws the physical view in Dot whatever was chosen", () => {
    expect(viewLayout("physical", "gv-fdp")).toEqual({ layout: "gv-dot-lr", framed: true });
    expect(viewLayout("physical", "gv-circo")).toEqual({ layout: "gv-dot-lr", framed: true });
  });
});
