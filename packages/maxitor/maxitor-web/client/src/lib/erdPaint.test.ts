// src/lib/erdPaint.test.ts
import { describe, expect, it } from "vitest";
import { buildDotSource, ERD_DIFF_COLOUR, erdDiffMarks, type ErdDiff, type ErdEntity } from "@/lib/buildDotSource";
import { tagErdPaint } from "@/lib/erdPostPass";
import { defaultPaint, ERD_PAINT_GREY, erdPaintCss, paintSettingName, paintSource } from "@/lib/erdPaint";

const DOMAIN = "#e11d48";
const KIND = "#3b82f6";

const table = (id: string, diff?: ErdDiff, rowDiff?: ErdDiff, kind = "core"): ErdEntity =>
  ({ id, label: id, color: DOMAIN, entity_kind: kind, diff, fields: [{ name: "id", type: "str", primary_key: true, diff: rowDiff }] }) as unknown as ErdEntity;

/** A table's header and frame painted by ``selector``. */
function headerRule(selector: string, colour: string): string[] {
  return [
    `${selector} g[id^="a_hd"] polygon, ${selector} g[id^="a_ks"] polygon, ${selector} g[id^="a_hn"] polygon { fill: ${colour}; }`,
    `${selector} rect[fill="none"] { stroke: ${colour}; }`,
  ];
}

describe("the CSS that paints the ERD (spec 071)", () => {
  it("paints each table's header and frame by its kind, and greys the frames", () => {
    const entities = [table("One", undefined, undefined, "core"), table("Two", undefined, undefined, "detail")];
    const css = erdPaintCss("kinds", entities, { kinds: { core: KIND, detail: "#f97316" } });
    expect(css).toContain(headerRule('g.node[data-kind="core"]', KIND).join("\n"));
    expect(css).toContain(headerRule('g.node[data-kind="detail"]', "#f97316").join("\n"));
    expect(css).toContain(`g.cluster path:not(.erd-hit) { stroke: ${ERD_PAINT_GREY}; }`);
  });

  it("paints by resource, and greys the domain frames", () => {
    const entities = [{ ...table("One"), copy_resource: "shop.BillingDatabase" } as ErdEntity];
    const css = erdPaintCss("resources", entities, { resources: { "shop.BillingDatabase": "#0ea5e9" } });
    expect(css).toContain(headerRule('g.node[data-resource="shop.BillingDatabase"]', "#0ea5e9").join("\n"));
    expect(css).toContain(`g.cluster[data-domain] path:not(.erd-hit) { stroke: ${ERD_PAINT_GREY}; }`);
  });

  it("paints by the change in Diff, and greys the frames", () => {
    const css = erdPaintCss("changes", [table("Added", "added")], {});
    expect(css).toContain(headerRule('g.node[data-change="added"]', ERD_DIFF_COLOUR.added).join("\n"));
    expect(css).toContain(`g.cluster path:not(.erd-hit) { stroke: ${ERD_PAINT_GREY}; }`);
  });

  it("leaves the DOMAIN colours the DOT already has, greying only a resource frame's outline", () => {
    const css = erdPaintCss("domains", [table("One")], {});
    expect(css).toContain(`g.cluster[data-resource] path:not(.erd-hit) { stroke: ${ERD_PAINT_GREY}; }`);
    expect(css).not.toContain("a_hd");
  });
});

describe("what the post-pass marks in Diff", () => {
  const tables = [table("Added", "added"), table("Inside", "unchanged", "changed"), table("Same", "unchanged")];

  it("fades the tables that did not change", () => {
    expect([...erdDiffMarks(tables).faded]).toEqual(["Same"]);
  });

  it("lays a halo under every table that changed", () => {
    expect([...erdDiffMarks(tables).halo]).toEqual([
      ["Added", ERD_DIFF_COLOUR.added],
      ["Inside", ERD_DIFF_COLOUR.changed],
    ]);
  });
});

describe("the choice of what paints", () => {
  it("is a page setting of its own in One and in Diff, Diff starting by changes and One by domains", () => {
    expect([paintSettingName(false), paintSettingName(true)]).toEqual(["paint", "paint_diff"]);
    expect([defaultPaint(false), defaultPaint(true)]).toEqual(["domains", "changes"]);
  });

  it("falls back to the first section when the diagram does not offer the one chosen", () => {
    expect(paintSource(["domains", "kinds", "changes"], "kinds")).toBe("kinds");
    expect(paintSource(["domains"], "changes")).toBe("domains");
  });
});

describe("the paint by resource (spec 061)", () => {
  it("is offered when the diagram has a resource, and kept when chosen", () => {
    expect(paintSource(["domains", "resources"], "resources")).toBe("resources");
    expect(paintSource(["domains"], "resources")).toBe("domains");
  });

  it("does not change what a page starts with", () => {
    expect([defaultPaint(false), defaultPaint(true)]).toEqual(["domains", "changes"]);
  });
});

describe("the paint leaves the layout alone (spec 071)", () => {
  it("keeps the paint out of the layout's input: the DOT carries the table's own domain colour only", () => {
    const dot = buildDotSource({ entities: [table("One")], relations: [] }, "gv-dot-lr");
    expect(dot).toContain(`BGCOLOR="${DOMAIN}"`);
    expect(dot).not.toContain(KIND);
  });

  it("tags each table with what paints it", () => {
    const markup = '<svg><g id="node1" class="node"><title>One</title><g id="a_hd0"><a><polygon/></a></g></g></svg>';
    const tagged = tagErdPaint(markup, [table("One")], "logical");
    expect(tagged).toContain('data-kind="core"');
    expect(tagged).toContain('data-change="unchanged"');
  });
});
