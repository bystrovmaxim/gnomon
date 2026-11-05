// src/lib/buildDotSource.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { buildDotSource, setErdPaint, type ErdEntity, type ErdGraphPayload } from "@/lib/buildDotSource";

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

/** The tables each cluster of the text holds directly, by its name: a nested cluster's tables are its own. */
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
  return found;
}

afterEach(() => setErdPaint("domain", {}));

describe("Boundary: one contour per resource (spec 061)", () => {
  it("draws one rounded contour per resource, headed by its name and holding exactly its tables", () => {
    const dot = buildDotSource(shop(true), "gv-dot-lr");
    expect(clusters(dot)).toEqual({ cluster_resource_0: ["shop.Invoice"], cluster_resource_1: ["shop.Order", "shop.OrderLine"] });
    expect(dot).toContain("label=<<B>BillingDatabase</B>>;");
    expect(dot).toContain("label=<<B>StorefrontDatabase</B>>;");
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
