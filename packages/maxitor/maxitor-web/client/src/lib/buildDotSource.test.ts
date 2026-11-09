// src/lib/buildDotSource.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { buildDotSource, bundleWidth, foldPlan, setErdPaint, type ErdEntity, type ErdGraphPayload, type ErdRelation } from "@/lib/buildDotSource";
import { copyId, physicalDrawing } from "@/lib/erdViews";

const STOREFRONT = "shop.StorefrontDatabase";
const BILLING = "shop.BillingDatabase";
const ARCHIVE = "shop.ArchiveDatabase";
const STORE = "shop.StoreDomain";
const MONEY = "shop.MoneyDomain";
const resourceLabels = { [STOREFRONT]: "StorefrontDatabase", [BILLING]: "BillingDatabase", [ARCHIVE]: "ArchiveDatabase" };
const domainLabels = { [STORE]: "Store", [MONEY]: "Money" };
const table = (id: string, domain: string, resources: string[] = []): ErdEntity => ({ id, label: id.split(".")[1], fields: [], color: "#3b82f6", domain_qualname: domain, resource_ids: resources });

// Order and OrderLine in the storefront, Invoice kept by billing and by the storefront too, Legacy kept by none; the
// archive keeps nothing.
const entities = [
  table("shop.Order", STORE, [STOREFRONT]),
  table("shop.OrderLine", STORE, [STOREFRONT]),
  table("shop.Invoice", MONEY, [BILLING, STOREFRONT]),
  table("shop.Legacy", MONEY),
];
const relations: ErdRelation[] = [
  { source: "shop.OrderLine", target: "shop.Order", source_field: "order", relationship_kind: "composition" },
  { source: "shop.Invoice", target: "shop.Order", source_field: "order", relationship_kind: "association" },
];

const logical = (): ErdGraphPayload => ({ entities, relations, model: "logical", domain_labels: domainLabels });

function physical(folded: string[] = [], off: ReadonlySet<string> = new Set()): ErdGraphPayload {
  const drawing = physicalDrawing(entities, relations, off);
  return {
    entities: drawing.entities,
    relations: drawing.relations,
    same: drawing.same,
    model: "physical",
    domain_labels: domainLabels,
    resource_ids: [ARCHIVE, BILLING, STOREFRONT].filter((resource) => !off.has(resource)),
    resource_labels: resourceLabels,
    folded_contours: new Set(folded),
  };
}

/**
 * The tables each cluster of the text holds directly, by its name: a nested cluster's tables are its own. The invisible
 * ``_room`` cluster that keeps a frame apart from the next is not a frame, and is left out.
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

afterEach(() => setErdPaint("domain", {}));

describe("the logical view (spec 070)", () => {
  it("frames each domain round its tables, headed by the domain's name, with no resource anywhere", () => {
    const dot = buildDotSource(logical(), "gv-dot-lr");
    expect(clusters(dot)).toEqual({ cluster_domain_0: ["shop.Invoice", "shop.Legacy"], cluster_domain_1: ["shop.Order", "shop.OrderLine"] });
    expect(dot).toContain("<B>Money</B>");
    expect(dot).toContain("<B>Store</B>");
    expect(dot).not.toContain("rc:");
    expect(dot).not.toContain("×");
  });

  it("draws each relation once", () => {
    const dot = buildDotSource(logical(), "gv-dot-lr");
    expect(dot.match(/id="re\d+"/g)).toEqual(['id="re0"', 'id="re1"']);
  });

  it("outlines a domain's frame in its colour while domains paint, grey otherwise", () => {
    const coloured = { ...logical(), domain_colors: { [STORE]: "#123456", [MONEY]: "#654321" } };
    expect(buildDotSource(coloured, "gv-dot-lr")).toContain('color="#123456";');
    setErdPaint("kind", {});
    expect(buildDotSource(coloured, "gv-dot-lr")).not.toContain('color="#123456";');
  });

  it("without a view draws today's text: no frame", () => {
    const { model: _model, ...plain } = logical();
    expect(buildDotSource(plain, "gv-dot-lr")).not.toContain("subgraph");
  });
});

describe("the physical view (spec 070)", () => {
  it("frames every resource — an empty one too — round its tables directly, and gathers the unstored in Not stored", () => {
    const dot = buildDotSource(physical(), "gv-dot-lr");
    expect(parents(dot)).toEqual({
      cluster_resource_0: null,
      cluster_resource_1: null,
      cluster_resource_2: null,
      cluster_resource_3: null,
    });
    expect(clusters(dot)).toEqual({
      cluster_resource_0: [],
      cluster_resource_1: [copyId("shop.Invoice", BILLING)],
      cluster_resource_2: [copyId("shop.Order", STOREFRONT), copyId("shop.OrderLine", STOREFRONT), copyId("shop.Invoice", STOREFRONT)],
      cluster_resource_3: [copyId("shop.Legacy", null)],
    });
    expect(dot).toContain('"rc_empty_0" [shape=point style=invis');
    expect(dot).toContain("<B>ArchiveDatabase</B>");
    expect(dot).toContain("<B>Not stored</B>");
  });

  it("marks each copy of an entity kept twice ×2 and joins them by a dashed same-entity line that ranks nothing", () => {
    const dot = buildDotSource(physical(), "gv-dot-lr");
    expect(dot.match(/Invoice ×2/g)?.length).toBeGreaterThanOrEqual(2);
    expect(dot).not.toContain("Order ×");
    expect(dot).toContain(`"${copyId("shop.Invoice", BILLING)}" -> "${copyId("shop.Invoice", STOREFRONT)}" [id="se0_1" class="erd-same" style=dashed color="#94a3b8" penwidth=1.2 arrowhead=none constraint=false]`);
  });

  it("draws a relation between every pair of copies, dashed when they lie in two databases", () => {
    const drawing = physicalDrawing(entities, relations);
    expect(drawing.relations.map((line) => [line.source, line.target, line.across])).toEqual([
      [copyId("shop.OrderLine", STOREFRONT), copyId("shop.Order", STOREFRONT), false],
      [copyId("shop.Invoice", BILLING), copyId("shop.Order", STOREFRONT), true],
      [copyId("shop.Invoice", STOREFRONT), copyId("shop.Order", STOREFRONT), false],
    ]);
    const dot = buildDotSource(physical(), "gv-dot-lr");
    expect(dot).toMatch(/\[id="re1" style=dashed /);
    expect(dot).not.toMatch(/\[id="re2" style=dashed /);
  });

  it("drops the frames and the copies of a resource switched off, never the copy left elsewhere", () => {
    const drawing = physicalDrawing(entities, relations, new Set([BILLING]));
    expect(drawing.entities.map((copy) => copy.id)).toEqual([copyId("shop.Order", STOREFRONT), copyId("shop.OrderLine", STOREFRONT), copyId("shop.Invoice", STOREFRONT), copyId("shop.Legacy", null)]);
    expect(drawing.entities.find((copy) => copy.copy_of === "shop.Invoice")!.copies).toBe(2);
    expect(buildDotSource(physical([], new Set([BILLING])), "gv-dot-lr")).not.toContain("BillingDatabase");
  });

  it("gives a resource's frame the id rc:<resource> and its full id as the tooltip; the spacing none", () => {
    const dot = buildDotSource(physical(), "gv-dot-lr");
    expect(dot).toContain(`  subgraph "cluster_resource_1" {\n    id="rc:${BILLING}";\n    tooltip="${BILLING}";`);
    expect(dot).toContain('subgraph "cluster_resource_0_room" {\n    style=invis;\n    label="";\n    id="";\n    tooltip="";');
    expect(dot).not.toContain('id="rc:";');
  });

  it("escapes a quote in a resource id inside the DOT string", () => {
    const odd = 'shop."Odd"';
    const drawing = physicalDrawing([table("shop.Order", STORE, [odd])], []);
    const data: ErdGraphPayload = { entities: drawing.entities, relations: [], model: "physical", resource_ids: [odd], resource_labels: {} };
    expect(buildDotSource(data, "gv-dot-lr")).toContain('id="rc:shop.\\"Odd\\"";');
  });

  it("puts a specialization container where every one of its tables has a copy", () => {
    const parts = [table("shop.Invoice", MONEY, [BILLING]), table("shop.CardPayment", MONEY, [BILLING]), table("shop.BankPayment", MONEY, [BILLING])];
    const drawing = physicalDrawing(parts, [], new Set(), [{ group_id: "shop.Invoice:payment", label: "payment (by kind)", members: ["shop.BankPayment", "shop.CardPayment"] }]);
    const dot = buildDotSource({ entities: drawing.entities, relations: [], groups: drawing.groups, model: "physical", resource_ids: [BILLING], resource_labels: resourceLabels }, "gv-dot-lr");
    expect(parents(dot)[`cluster_${copyId("shop.Invoice:payment", BILLING)}`]).toBe("cluster_resource_0");
    expect(dot.match(new RegExp(`"${copyId("shop.CardPayment", BILLING)}" \\[label=<`, "g"))).toHaveLength(1);
  });
});

describe("painting by resource (spec 061, spec 070)", () => {
  it("gives each copy's header, and its resource's frame, the resource's colour", () => {
    setErdPaint("resource", { [BILLING]: "#111111", [STOREFRONT]: "#222222" });
    const dot = buildDotSource(physical(), "gv-dot-lr");
    expect(dot).toMatch(new RegExp(`"${copyId("shop.Invoice", BILLING)}" \\[label=<[^\\n]*BGCOLOR="#111111"`));
    expect(dot).toMatch(new RegExp(`"${copyId("shop.Invoice", STOREFRONT)}" \\[label=<[^\\n]*BGCOLOR="#222222"`));
    expect(dot).toContain('color="#111111";');
  });

  it("leaves a copy in Not stored grey", () => {
    setErdPaint("resource", { [BILLING]: "#111111" });
    expect(buildDotSource(physical(), "gv-dot-lr")).toMatch(new RegExp(`"${copyId("shop.Legacy", null)}" \\[label=<[^\\n]*BGCOLOR="#64748b"`));
  });

  it("keeps the frames grey while another section paints", () => {
    setErdPaint("domain", {});
    expect(buildDotSource(physical(), "gv-dot-lr")).not.toContain('color="#111111";');
  });
});

describe("folding a resource frame (spec 065, spec 070)", () => {
  it("draws a folded resource's copies in its box; each link of a copy still drawn keeps a line of its own", () => {
    const plan = foldPlan(physical([`rc:${STOREFRONT}`]));
    expect([...plan.holder.keys()]).toEqual([copyId("shop.Order", STOREFRONT), copyId("shop.OrderLine", STOREFRONT), copyId("shop.Invoice", STOREFRONT)]);
    expect(plan.bundles).toEqual([{ id: "rb0", source: copyId("shop.Invoice", BILLING), target: `rc:${STOREFRONT}`, relations: [1] }]);
    expect(plan.counts.get(`rc:${STOREFRONT}`)).toEqual({ tables: 3, inside: 2, resources: 1, changed: 0 });
  });

  it("bundles the relations between two folded boxes into one line", () => {
    const plan = foldPlan(physical([`rc:${STOREFRONT}`, `rc:${BILLING}`]));
    expect(plan.bundles).toEqual([{ id: "rb0", source: `rc:${BILLING}`, target: `rc:${STOREFRONT}`, relations: [1] }]);
  });

  it("writes the box, no copy inside it, and no same-entity line to a folded copy", () => {
    const dot = buildDotSource(physical([`rc:${STOREFRONT}`]), "gv-dot-lr");
    expect(dot).toContain(`"rc:${STOREFRONT}" [shape=box style="rounded,filled"`);
    expect(dot).toContain("3 tables · 2 relations inside");
    expect(dot).not.toContain(`"${copyId("shop.Order", STOREFRONT)}" [label=<`);
    expect(dot).not.toContain('id="se0_1"');
  });

  it("folds an empty resource into a box that keeps nothing", () => {
    expect(buildDotSource(physical([`rc:${ARCHIVE}`]), "gv-dot-lr")).toContain("0 tables · 0 relations inside");
  });

  it("folds a domain frame in the logical view, and ignores an id that names no frame", () => {
    expect(foldPlan({ ...logical(), folded_contours: new Set([`rc:${STOREFRONT}`]) }).holder.size).toBe(0);
    expect(buildDotSource(physical(["rc:shop.Nowhere"]), "gv-dot-lr")).toBe(buildDotSource(physical([]), "gv-dot-lr"));
    const plan = foldPlan({ ...logical(), folded_contours: new Set([`dc:${STORE}`]) });
    expect([...plan.holder.keys()]).toEqual(["shop.Order", "shop.OrderLine"]);
    expect(plan.counts.get(`dc:${STORE}`)).toEqual({ tables: 2, inside: 1, resources: 1, changed: 0 });
    expect(plan.bundles).toEqual([{ id: "rb0", source: "shop.Invoice", target: `dc:${STORE}`, relations: [1] }]);
  });

  it("marks a folded box whose copies changed, in Diff", () => {
    const marked = physical([`rc:${STOREFRONT}`]);
    marked.entities = marked.entities.map((entity) => ({ ...entity, diff: entity.id === copyId("shop.Order", STOREFRONT) ? ("changed" as const) : ("unchanged" as const) }));
    expect(foldPlan(marked).counts.get(`rc:${STOREFRONT}`)!.changed).toBe(1);
    expect(buildDotSource(marked, "gv-dot-lr")).toContain("~ 1 changed");
  });

  it("widens a bundle with its count, relative to the widest of the drawing", () => {
    expect([bundleWidth(1, 5), bundleWidth(3, 5), bundleWidth(5, 5), bundleWidth(2, 2)]).toEqual([1, 2.7, 4.4, 4.4]);
  });
});

describe("Boundary off folds nothing (spec 071, edge cases; #89)", () => {
  // The logical view with its frames off draws no frame, so the folds in the address have nothing to act on.
  const unframed = (): ErdGraphPayload => ({
    entities,
    relations,
    domain_labels: domainLabels,
    folded_contours: new Set([`dc:${STORE}`, `dc:${MONEY}`, `rc:${STOREFRONT}`]),
  });

  it("has no folded box, no bundle and no table held, whatever the address folds", () => {
    const plan = foldPlan(unframed());
    expect(plan.counts.size).toBe(0);
    expect(plan.bundles).toHaveLength(0);
  });

  for (const layout of ["gv-dot-lr", "gv-dot-tb", "gv-neato", "gv-fdp", "gv-circo"] as const) {
    it(`${layout}: draws every table and every line, and no dc: or rc: node`, () => {
      const dot = buildDotSource(unframed(), layout);
      for (const entity of entities) expect(dot).toContain(`"${entity.id}" [`);
      expect(dot).not.toMatch(/"(?:dc|rc):/);
      expect(dot).toContain('"shop.OrderLine" -> "shop.Order"');
      expect(dot).toContain('"shop.Invoice" -> "shop.Order"');
    });
  }
});
