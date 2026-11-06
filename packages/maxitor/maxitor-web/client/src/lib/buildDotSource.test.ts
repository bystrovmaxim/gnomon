// src/lib/buildDotSource.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { buildDotSource, bundleWidth, foldPlan, setErdPaint, type ErdEntity, type ErdGraphPayload } from "@/lib/buildDotSource";

const STOREFRONT = "shop.StorefrontDatabase";
const BILLING = "shop.BillingDatabase";
const labels = { [STOREFRONT]: "StorefrontDatabase", [BILLING]: "BillingDatabase" };
const table = (id: string, resource_id?: string): ErdEntity => ({ id, label: id.split(".")[1], fields: [], color: "#3b82f6", ...(resource_id ? { resource_id } : {}) });

const shop = (boundary: boolean): ErdGraphPayload => ({
  entities: [table("shop.Order", STOREFRONT), table("shop.OrderLine", STOREFRONT), table("shop.Invoice", BILLING)],
  relations: [{ source: "shop.Order", target: "shop.OrderLine", source_field: "lines", relationship_kind: "composition" }],
  boundary,
  resource_labels: labels,
});

/**
 * The tables each cluster of the text holds directly, by its name: a nested cluster's tables are its own. The invisible
 * ``_room`` cluster that keeps a contour apart from the next is not a contour, and is left out.
 */
function clusters(dot: string): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  const stack: string[] = [];
  for (const line of dot.split("\n")) {
    const open = /subgraph "([^"]+)"/.exec(line);
    if (open) {
      stack.push(open[1]!);
      found[open[1]!] = [];
    } else if (line.trim() === "}" && stack.length) stack.pop();
    else {
      const node = /^\s*"([^"]+)" \[label=</.exec(line);
      if (node && stack.length) found[stack.at(-1)!]!.push(node[1]!);
    }
  }
  return Object.fromEntries(Object.entries(found).filter(([name]) => !name.endsWith("_room")));
}

afterEach(() => setErdPaint("domain", {}));

describe("Boundary: one contour per resource (spec 061)", () => {
  it("draws one rounded contour per resource, headed by its name and holding exactly its tables", () => {
    const dot = buildDotSource(shop(true), "gv-dot-lr");
    expect(clusters(dot)).toEqual({ cluster_resource_0: ["shop.Invoice"], cluster_resource_1: ["shop.Order", "shop.OrderLine"] });
    expect(dot).toContain('label=<<TABLE BORDER="0" CELLPADDING="10"><TR><TD><B>BillingDatabase</B></TD></TR></TABLE>>;');
    expect(dot).toContain('label=<<TABLE BORDER="0" CELLPADDING="10"><TR><TD><B>StorefrontDatabase</B></TD></TR></TABLE>>;');
  });

  it("keeps each contour apart from the next inside an invisible cluster", () => {
    const dot = buildDotSource(shop(true), "gv-dot-lr");
    expect(dot).toContain('subgraph "cluster_resource_0_room" {\n    style=invis;\n    label="";\n    id="";\n    tooltip="";\n    margin=36;\n  subgraph "cluster_resource_0" {');
  });

  it("off, draws today's text: no contour", () => {
    const { boundary: _boundary, resource_labels: _labels, ...today } = shop(false);
    expect(buildDotSource(shop(false), "gv-dot-lr")).toBe(buildDotSource(today, "gv-dot-lr"));
    expect(buildDotSource(shop(false), "gv-dot-lr")).not.toContain("cluster_resource");
  });

  it("nests a specialization block inside its resource's contour, each table declared once", () => {
    const data: ErdGraphPayload = {
      ...shop(true),
      entities: [...shop(true).entities, table("shop.CardPayment", BILLING), table("shop.BankPayment", BILLING)],
      groups: [{ group_id: "shop.Invoice:payment", label: "payment (by kind)", members: ["shop.BankPayment", "shop.CardPayment"] }],
    };
    const dot = buildDotSource(data, "gv-dot-lr");
    const found = clusters(dot);
    expect(found["cluster_shop.Invoice:payment"]).toEqual(["shop.BankPayment", "shop.CardPayment"]);
    expect(found.cluster_resource_0).toEqual(["shop.Invoice"]);
    expect(dot.indexOf('subgraph "cluster_shop.Invoice:payment"')).toBeGreaterThan(dot.indexOf('subgraph "cluster_resource_0"'));
    expect(dot.indexOf('subgraph "cluster_shop.Invoice:payment"')).toBeLessThan(dot.indexOf('subgraph "cluster_resource_1"'));
    expect(dot.match(/"shop.CardPayment" \[label=</g)).toHaveLength(1);
  });

  it("leaves a table without a resource outside every contour", () => {
    const data = { ...shop(true), entities: [...shop(true).entities, table("shop.Legacy")] };
    const found = clusters(buildDotSource(data, "gv-dot-lr"));
    expect(Object.values(found).flat()).not.toContain("shop.Legacy");
    expect(buildDotSource(data, "gv-dot-lr")).toContain('"shop.Legacy" [label=<');
  });
});

describe("painting by resource (spec 061)", () => {
  it("gives each table's header, and each contour, its resource's colour", () => {
    setErdPaint("resource", { [BILLING]: "#111111", [STOREFRONT]: "#222222" });
    const dot = buildDotSource(shop(true), "gv-dot-lr");
    expect(dot).toMatch(/"shop.Invoice" \[label=<[^\n]*BGCOLOR="#111111"/);
    expect(dot).toMatch(/"shop.Order" \[label=<[^\n]*BGCOLOR="#222222"/);
    expect(dot).toContain('color="#111111";');
  });

  it("leaves a table without a resource grey", () => {
    setErdPaint("resource", { [BILLING]: "#111111" });
    const dot = buildDotSource({ entities: [table("shop.Legacy")], relations: [] }, "gv-dot-lr");
    expect(dot).toMatch(/"shop.Legacy" \[label=<[^\n]*BGCOLOR="#64748b"/);
  });

  it("keeps the contours grey while another section paints", () => {
    setErdPaint("domain", {});
    expect(buildDotSource(shop(true), "gv-dot-lr")).toContain('color="#94a3b8";');
  });
});

describe("Boundary on older graphs and on all domains (spec 061, FR-010, FR-013)", () => {
  it("draws a graph older than 1.6 as today, Boundary on or not", () => {
    const old: ErdGraphPayload = { entities: [table("a.Lot"), table("a.Offer")], relations: [] };
    expect(buildDotSource({ ...old, boundary: true, resource_labels: {} }, "gv-dot-lr")).toBe(buildDotSource(old, "gv-dot-lr"));
  });

  it("on \"ERD all domains\" draws a contour per resource of every domain", () => {
    const all: ErdGraphPayload = {
      entities: [table("shop.Order", STOREFRONT), table("shop.Invoice", BILLING), table("crm.Customer", "crm.CrmDatabase")],
      relations: [],
      boundary: true,
      resource_labels: { ...labels, "crm.CrmDatabase": "CrmDatabase" },
    };
    expect(Object.keys(clusters(buildDotSource(all, "gv-dot-lr")))).toEqual(["cluster_resource_0", "cluster_resource_1", "cluster_resource_2"]);
  });
});

describe("Boundary around data sources (spec 063)", () => {
  const SUPPORT = "shop.SupportDatabase";
  const SHOP_DB = "shop.ShopDataSource";
  const shared = (): ErdGraphPayload => ({
    entities: [table("shop.Order", STOREFRONT), table("shop.Ticket", SUPPORT), table("shop.Invoice", BILLING)],
    relations: [{ source: "shop.Ticket", target: "shop.Order", source_field: "order", relationship_kind: "association" }],
    boundary: true,
    resource_labels: { ...labels, [SUPPORT]: "SupportDatabase" },
    resource_data_sources: { [STOREFRONT]: SHOP_DB, [SUPPORT]: SHOP_DB },
    data_source_labels: { [SHOP_DB]: "ShopDataSource" },
  });

  /** The cluster each cluster sits in directly, by name; the invisible ``_room`` clusters are looked through. */
  function parents(dot: string): Record<string, string | null> {
    const found: Record<string, string | null> = {};
    const stack: string[] = [];
    for (const line of dot.split("\n")) {
      const open = /subgraph "([^"]+)"/.exec(line);
      if (open) {
        const real = stack.filter((name) => !name.endsWith("_room"));
        if (!open[1]!.endsWith("_room")) found[open[1]!] = real.at(-1) ?? null;
        stack.push(open[1]!);
      } else if (line.trim() === "}" && stack.length) stack.pop();
    }
    return found;
  }

  it("draws the resources of one data source inside one outer contour headed by its name", () => {
    const dot = buildDotSource(shared(), "gv-dot-lr");
    expect(parents(dot)).toEqual({
      cluster_data_source_0: null,
      cluster_resource_1: "cluster_data_source_0",
      cluster_resource_2: "cluster_data_source_0",
      cluster_resource_0: null,
    });
    expect(clusters(dot)).toMatchObject({ cluster_resource_0: ["shop.Invoice"], cluster_resource_1: ["shop.Order"], cluster_resource_2: ["shop.Ticket"] });
    expect(dot).toContain("<B>ShopDataSource</B>");
  });

  it("without a data source draws the resource contours as before", () => {
    const { resource_data_sources: _map, data_source_labels: _labels, ...plain } = shared();
    expect(buildDotSource(plain, "gv-dot-lr")).not.toContain("cluster_data_source");
  });

  it("paints a table and its data source's contour in the data source's colour", () => {
    setErdPaint("data_source", { [SHOP_DB]: "#123456" });
    const dot = buildDotSource(shared(), "gv-dot-lr");
    expect(dot).toContain('color="#123456"');
  });
});

describe("a resource contour is named by its resource (spec 064)", () => {
  /** The ``id`` and ``tooltip`` lines each cluster declares directly, by name. */
  function named(dot: string): Record<string, string[]> {
    const found: Record<string, string[]> = {};
    const stack: string[] = [];
    for (const line of dot.split("\n")) {
      const open = /subgraph "([^"]+)"/.exec(line);
      if (open) {
        stack.push(open[1]!);
        found[open[1]!] = [];
      } else if (line.trim() === "}" && stack.length) stack.pop();
      else if (/^\s*(id|tooltip)=/.test(line) && stack.length) found[stack.at(-1)!]!.push(line.trim());
    }
    return found;
  }

  it("gives each resource contour the id rc:<resource> and the resource's full id as its tooltip", () => {
    const found = named(buildDotSource(shop(true), "gv-dot-lr"));
    expect(found.cluster_resource_0).toEqual([`id="rc:${BILLING}";`, `tooltip="${BILLING}";`]);
    expect(found.cluster_resource_1).toEqual([`id="rc:${STOREFRONT}";`, `tooltip="${STOREFRONT}";`]);
    expect(found.cluster_resource_0_room).toEqual(['id="";', 'tooltip="";']);
  });

  it("names a data source contour dc:<data source>, never rc:, so it never takes a resource's hover (spec 065)", () => {
    const SHOP_DB = "shop.ShopDataSource";
    const data = { ...shop(true), resource_data_sources: { [STOREFRONT]: SHOP_DB, [BILLING]: SHOP_DB }, data_source_labels: { [SHOP_DB]: "ShopDataSource" } };
    const found = named(buildDotSource(data, "gv-dot-lr"));
    expect(found.cluster_data_source_0).toEqual([`id="dc:${SHOP_DB}";`, `tooltip="${SHOP_DB}";`]);
    expect(found.cluster_resource_0).toContain(`id="rc:${BILLING}";`);
  });

  it("gives every invisible spacing frame an empty label, so no name is drawn twice (spec 065)", () => {
    const SHOP_DB = "shop.ShopDataSource";
    const data = { ...shop(true), resource_data_sources: { [STOREFRONT]: SHOP_DB, [BILLING]: SHOP_DB }, data_source_labels: { [SHOP_DB]: "ShopDataSource" } };
    const dot = buildDotSource(data, "gv-dot-lr");
    const frames = [...dot.matchAll(/subgraph "(cluster_[^"]+_room)" \{\n    style=invis;\n    (label="";)?/g)];
    expect(frames.map((frame) => frame[1]).sort()).toEqual(["cluster_data_source_0_room", "cluster_resource_0_room", "cluster_resource_1_room"]);
    expect(frames.every((frame) => frame[2] === 'label="";')).toBe(true);
  });

  it("escapes a quote in a resource id inside the DOT string", () => {
    const odd = 'shop."Odd"';
    const data: ErdGraphPayload = { entities: [table("shop.Order", odd)], relations: [], boundary: true, resource_labels: {} };
    expect(buildDotSource(data, "gv-dot-lr")).toContain('id="rc:shop.\\"Odd\\"";');
  });
});

describe("folding a contour (spec 065)", () => {
  const SHOP_DB = "shop.ShopDataSource";
  const SUPPORT = "shop.SupportDatabase";
  // Order and OrderLine in the storefront, Ticket and Note in support (both of ShopDataSource), Invoice in billing.
  const data = (folded: string[], boundary = true): ErdGraphPayload => ({
    entities: [table("shop.Order", STOREFRONT), table("shop.OrderLine", STOREFRONT), table("shop.Ticket", SUPPORT), table("shop.Note", SUPPORT), table("shop.Invoice", BILLING)],
    relations: [
      { source: "shop.OrderLine", target: "shop.Order", source_field: "order", relationship_kind: "composition" },
      { source: "shop.Ticket", target: "shop.Order", source_field: "order", relationship_kind: "association" },
      { source: "shop.Note", target: "shop.Order", source_field: "order", relationship_kind: "association" },
      { source: "shop.Note", target: "shop.OrderLine", source_field: "line", relationship_kind: "association" },
    ],
    boundary,
    resource_labels: { ...labels, [SUPPORT]: "SupportDatabase" },
    resource_data_sources: { [STOREFRONT]: SHOP_DB, [SUPPORT]: SHOP_DB },
    data_source_labels: { [SHOP_DB]: "ShopDataSource" },
    folded_contours: new Set(folded),
  });

  it("draws a folded resource in its box; each link of a table still drawn keeps a line of its own to the box", () => {
    const plan = foldPlan(data([`rc:${STOREFRONT}`]));
    expect([...plan.holder]).toEqual([["shop.Order", `rc:${STOREFRONT}`], ["shop.OrderLine", `rc:${STOREFRONT}`]]);
    expect(plan.bundles).toEqual([
      { id: "rb0", source: "shop.Ticket", target: `rc:${STOREFRONT}`, relations: [1] },
      { id: "rb1", source: "shop.Note", target: `rc:${STOREFRONT}`, relations: [2] },
      { id: "rb2", source: "shop.Note", target: `rc:${STOREFRONT}`, relations: [3] },
    ]);
    expect(plan.counts.get(`rc:${STOREFRONT}`)).toEqual({ tables: 2, inside: 1, resources: 1, changed: 0 });
  });

  it("bundles the relations between two folded boxes into one line, wider and plated for more than one", () => {
    const plan = foldPlan(data([`rc:${STOREFRONT}`, `rc:${SUPPORT}`]));
    expect(plan.bundles).toEqual([{ id: "rb0", source: `rc:${SUPPORT}`, target: `rc:${STOREFRONT}`, relations: [1, 2, 3] }]);
    const dot = buildDotSource(data([`rc:${STOREFRONT}`, `rc:${SUPPORT}`]), "gv-dot-lr");
    expect(dot).toContain(`"rc:${SUPPORT}" -> "rc:${STOREFRONT}" [id="rb0" arrowhead=none penwidth=4.4 label="×3"`);
  });

  it("writes the box, no table inside it, and a line from each table's link to the box", () => {
    const dot = buildDotSource(data([`rc:${STOREFRONT}`]), "gv-dot-lr");
    expect(dot).toContain(`"rc:${STOREFRONT}" [shape=box style="rounded,filled"`);
    expect(dot).toContain("2 tables · 1 relation inside");
    expect(dot).not.toMatch(/"shop\.Order" \[label=</);
    expect(dot).not.toContain(`subgraph "cluster_resource_1" {`);
    expect(dot).toContain(`"shop.Ticket" -> "rc:${STOREFRONT}" [id="rb0" arrowhead=none penwidth=1]`);
    expect(dot).toContain(`"shop.Note" -> "rc:${STOREFRONT}" [id="rb1" arrowhead=none penwidth=1]`);
    expect(dot).toContain(`"shop.Note" -> "rc:${STOREFRONT}" [id="rb2" arrowhead=none penwidth=1]`);
    expect(dot).not.toContain("×");
    expect(dot).not.toContain('id="re1"');
  });

  it("folds a data source whole, over its folded resources, and counts its resources", () => {
    const dot = buildDotSource(data([`dc:${SHOP_DB}`, `rc:${STOREFRONT}`]), "gv-dot-lr");
    const plan = foldPlan(data([`dc:${SHOP_DB}`, `rc:${STOREFRONT}`]));
    expect(new Set(plan.holder.values())).toEqual(new Set([`dc:${SHOP_DB}`]));
    expect(plan.bundles).toEqual([]);
    expect(plan.counts.get(`dc:${SHOP_DB}`)).toEqual({ tables: 4, inside: 4, resources: 2, changed: 0 });
    expect(dot).toContain("2 resources · 4 tables");
    expect(dot).not.toContain("cluster_data_source_0");
    expect(dot).toContain('"shop.Invoice" [label=<');
  });

  it("folds nothing with Boundary off, and ignores an id that names no contour", () => {
    expect(foldPlan(data([`rc:${STOREFRONT}`], false)).holder.size).toBe(0);
    expect(buildDotSource(data(["rc:shop.Nowhere"]), "gv-dot-lr")).toBe(buildDotSource(data([]), "gv-dot-lr"));
  });

  it("marks a folded box whose tables changed, in Diff", () => {
    const marked = data([`rc:${STOREFRONT}`]);
    marked.entities = marked.entities.map((entity) => (entity.id === "shop.Order" ? { ...entity, diff: "changed" as const } : { ...entity, diff: "unchanged" as const }));
    expect(foldPlan(marked).counts.get(`rc:${STOREFRONT}`)!.changed).toBe(1);
    expect(buildDotSource(marked, "gv-dot-lr")).toContain("~ 1 changed");
  });

  it("widens a bundle with its count, relative to the widest of the drawing", () => {
    expect([bundleWidth(1, 5), bundleWidth(3, 5), bundleWidth(5, 5), bundleWidth(2, 2)]).toEqual([1, 2.7, 4.4, 4.4]);
  });
});
