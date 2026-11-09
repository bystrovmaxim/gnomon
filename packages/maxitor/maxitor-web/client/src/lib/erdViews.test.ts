// src/lib/erdViews.test.ts
import { describe, expect, it } from "vitest";
import { copyEntity, copyId, copyResource, viewLayout, erdViewSetting } from "@/lib/erdViews";
import { settingOfHalf } from "@/lib/half";

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

  it("keeps another engine in both views, with frames", () => {
    expect(viewLayout("logical", "gv-fdp")).toEqual({ layout: "gv-fdp", framed: true });
    expect(viewLayout("logical", "gv-neato")).toEqual({ layout: "gv-neato", framed: true });
    expect(viewLayout("logical", "gv-circo")).toEqual({ layout: "gv-circo", framed: true });
  });

  it("keeps another engine in the physical view too", () => {
    expect(viewLayout("physical", "gv-fdp")).toEqual({ layout: "gv-fdp", framed: true });
    expect(viewLayout("physical", "gv-circo")).toEqual({ layout: "gv-circo", framed: true });
  });
});

describe("each view keeps its own layout and collapse (#89)", () => {
  it("names the logical view's settings plainly and the physical view's apart", () => {
    expect(erdViewSetting("logical", "layout")).toBe("layout");
    expect(erdViewSetting("physical", "layout")).toBe("physical_layout");
    expect(erdViewSetting("physical", "fields_collapsed")).toBe("physical_fields_collapsed");
    expect(erdViewSetting("physical", "fields_except")).toBe("physical_fields_except");
  });

  it("gives the physical layout a half of its own in Side by side, and an address", () => {
    expect(settingOfHalf("physical_layout", { side: "a" } as never)).toBe("physical_layout_a");
    expect(settingOfHalf("physical_fields_collapsed", { side: "a" } as never)).toBe("physical_fields_collapsed");
  });
});
