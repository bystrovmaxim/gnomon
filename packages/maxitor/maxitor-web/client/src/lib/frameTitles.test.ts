// src/lib/frameTitles.test.ts
/**
 * The titles of frames and folded boxes (spec 071), laid out by the real WASM Graphviz: the disk and the name on one
 * axis, the disk where Graphviz kept its slot, the title centred on its frame, the same padding on both sides of a
 * folded box, the composed frames well formed with even corners, and the use cases' boundaries folded with every role
 * still linked.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { buildDotSource, frameOfCluster, frameTitleLabel, setErdPaint, type ErdEntity, type ErdGraphPayload, type ErdGraphvizLayout } from "@/lib/buildDotSource";
import { buildDomainUseCaseDotBundle } from "@/lib/buildDomainUseCaseDotSource";
import { erdCompose } from "@/lib/erdCompose";
import { addFrameIcons, clickFolds } from "@/lib/erdPostPass";
import type { DomainUseCaseDiagramPayload } from "@/model/domainUseCaseDiagram";

let gv: Awaited<ReturnType<typeof Graphviz.load>>;
beforeAll(async () => {
  gv = await Graphviz.load();
});
const layoutFn = (dot: string, engine: string) => gv.layout(dot, "svg", engine as never);

type Box = { left: number; right: number; top: number; bottom: number };
const numbers = (text: string) => (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
function boxOf(text: string): Box {
  const values = numbers(text);
  const xs = values.filter((_, i) => i % 2 === 0);
  const ys = values.filter((_, i) => i % 2 === 1);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

/** Every ``translate(x,y)`` on the way from ``element`` up to the root, summed: where its own coordinates land. */
function offsetOf(element: Element): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let at: Element | null = element.parentElement; at; at = at.parentElement) {
    const move = /translate\(\s*(-?[\d.]+)[ ,]\s*(-?[\d.]+)\s*\)/.exec(at.getAttribute("transform") ?? "");
    if (move && !at.classList.contains("graph")) {
      x += Number(move[1]);
      y += Number(move[2]);
    }
  }
  return { x, y };
}

function parse(svg: string): Document {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  return doc;
}

/** What the post-pass put in one frame or folded box: its outline, its disk and its name, in the drawing's units. */
function title(group: Element) {
  // The first shape is the outline: the disk slot is an image by now, and Graphviz draws the outline before the label.
  const outline = group.querySelector("path, polygon")!;
  const disk = group.querySelector("image.frame-disk")!;
  const name = [...group.querySelectorAll("text")].find((text) => text.getAttribute("font-weight") === "bold")!;
  const at = offsetOf(disk);
  const nameAt = offsetOf(name);
  const box = boxOf(outline.getAttribute("d") ?? outline.getAttribute("points") ?? "");
  const outlineAt = offsetOf(outline);
  return {
    box: { left: box.left + outlineAt.x, right: box.right + outlineAt.x, top: box.top + outlineAt.y, bottom: box.bottom + outlineAt.y },
    disk: { x: Number(disk.getAttribute("x")) + at.x, y: Number(disk.getAttribute("y")) + at.y, size: Number(disk.getAttribute("width")), href: disk.getAttribute("href") ?? "" },
    name: { x: Number(name.getAttribute("x")) + nameAt.x, baseline: Number(name.getAttribute("y")) + nameAt.y, size: Number(name.getAttribute("font-size")), anchor: name.getAttribute("text-anchor"), face: name.getAttribute("font-family") },
  };
}

const CAP_MIDDLE = 0.359;
const entity = (id: string, domain: string, ...resource_ids: string[]): ErdEntity => ({ id, label: id.split(".")[1], fields: [{ name: "id", type: "str", primary_key: true }], color: "#3b82f6", domain_qualname: domain, resource_ids });
const DOMAINS = ["shop.Store", "shop.Money", "shop.People", "shop.Stock", "shop.Ship", "shop.Mail"];
const COLOURS = ["#ea580c", "#f59e0b", "#dc2626", "#16a34a", "#0891b2", "#8b5cf6"];
const tables = DOMAINS.flatMap((domain, d) => Array.from({ length: d + 1 }, (_, k) => entity(`${domain}T${k}.${domain.split(".")[1]}Table${k}`, domain)));
const links = tables.slice(1).map((one, k) => ({ source: one.id, target: tables[k]!.id, source_field: "ref", relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one" }));
const logical = (folded: string[] = []): ErdGraphPayload => ({
  entities: tables,
  relations: links,
  model: "logical",
  domain_labels: Object.fromEntries(DOMAINS.map((domain) => [domain, `${domain.split(".")[1]}Domain`])),
  domain_colors: Object.fromEntries(DOMAINS.map((domain, d) => [domain, COLOURS[d]!])),
  folded_contours: new Set(folded),
});

describe("a frame's title: the disk in Graphviz's slot, on the axis of the name (spec 071)", () => {
  it("is one HTML label: a fixed slot for the disk, a gap, the name in Helvetica; lines below start under the name", () => {
    const label = frameTitleLabel({ kind: "domain", slot: 3, name: "StoreDomain", disk: "#ea580c", ink: "#ea580c", tooltip: "shop.Store", below: ["2 tables"] });
    expect(label).toContain('ID="fdd3"');
    expect(label).toContain('BGCOLOR="#ea580c" WIDTH="16" HEIGHT="16" FIXEDSIZE="TRUE"');
    expect(label).toContain('<FONT FACE="Helvetica" POINT-SIZE="15" COLOR="#ea580c"><B>StoreDomain</B>');
    expect(label).toContain('<TR><TD COLSPAN="2"></TD><TD ALIGN="LEFT"><FONT FACE="Helvetica">2 tables</FONT></TD></TR>');
    expect(frameTitleLabel({ kind: "resource", slot: 0, name: "Db", disk: "#000", ink: "#000", tooltip: "x" })).toContain('ID="fdr0"');
  });

  for (const layout of ["gv-dot-lr", "gv-dot-tb", "gv-neato", "gv-fdp", "gv-circo"] as ErdGraphvizLayout[]) {
    it(`${layout}: every frame and folded box has its disk centred on its name's capitals and its title centred`, () => {
      setErdPaint("domain", {});
      const data = logical([`dc:${DOMAINS[1]}`, `dc:${DOMAINS[4]}`]);
      const raw = layout.startsWith("gv-dot") ? layoutFn(buildDotSource(data, layout), layout === "gv-dot-lr" || layout === "gv-dot-tb" ? "dot" : layout) : erdCompose(data, layout, layoutFn);
      const doc = parse(addFrameIcons(raw));
      const groups = [...doc.querySelectorAll("g.cluster, g.node")].filter((group) => group.querySelector("image.frame-disk"));
      expect(groups).toHaveLength(DOMAINS.length);
      expect(doc.querySelector('[id^="a_fd"]')).toBeNull();
      for (const group of groups) {
        const { box, disk, name } = title(group);
        // One axis: the disk's middle on the middle of the capitals.
        expect(disk.y + disk.size / 2).toBeCloseTo(name.baseline - name.size * CAP_MIDDLE, 1);
        expect(disk.size).toBe(16);
        // The disk before the name, the gap Graphviz kept between them.
        expect(name.anchor).toBe("start");
        expect(name.x - (disk.x + disk.size)).toBeCloseTo(6, 0);
        expect(name.face).toMatch(/^Helvetica/);
        // The disk takes its domain's colour.
        const colour = COLOURS[DOMAINS.findIndex((domain) => group.id === `dc:${domain}` || group.querySelector("title")?.textContent === `dc:${domain}`)]!;
        expect(decodeURIComponent(disk.href)).toContain(`fill="${colour}"`);
        // Never on the outline, and inside it.
        expect(disk.x - box.left).toBeGreaterThanOrEqual(8);
        expect(disk.y - box.top).toBeGreaterThanOrEqual(4);
      }
    });
  }

  it("a folded box keeps the same space left of its disk and right of its widest line", () => {
    setErdPaint("domain", {});
    const dot = buildDotSource(logical(DOMAINS.map((domain) => `dc:${domain}`)), "gv-dot-lr");
    // No empty cell is left at the right end of the title row: that was the room of the corner controls.
    expect(dot).not.toMatch(/<\/B><\/FONT><\/TD><TD WIDTH/);
    const doc = parse(addFrameIcons(layoutFn(dot, "dot")));
    for (const group of [...doc.querySelectorAll("g.node")].filter((node) => node.querySelector("image.frame-disk"))) {
      const { box, disk } = title(group);
      const left = disk.x - box.left;
      // The widest line is the counts line or the name: both start where the name starts.
      expect(left).toBeGreaterThan(12);
      expect(left).toBeLessThan(24);
    }
  });
});

describe("the composed frames (research R2)", () => {
  for (const layout of ["gv-neato", "gv-fdp", "gv-circo"] as ErdGraphvizLayout[]) {
    it(`${layout}: the markup is well formed and every frame and table is a child of the graph, not of another frame`, () => {
      setErdPaint("domain", {});
      const doc = parse(erdCompose(logical([`dc:${DOMAINS[2]}`]), layout, layoutFn));
      const graph = doc.querySelector("g.graph")!;
      for (const cluster of doc.querySelectorAll('g.cluster[id^="dc:"]')) expect(cluster.parentElement).toBe(graph);
      for (const node of doc.querySelectorAll("g.node")) expect(node.closest("g.cluster")).toBeNull();
    });

    it(`${layout}: every corner of every frame is rounded the same way`, () => {
      setErdPaint("domain", {});
      const doc = parse(erdCompose(logical(), layout, layoutFn));
      for (const cluster of doc.querySelectorAll('g.cluster[id^="dc:"]')) {
        const d = cluster.querySelector("path")!.getAttribute("d")!;
        const box = boxOf(d);
        const values = numbers(d);
        // How far each point on the left and right edges stands from the nearer corner: 0 at a corner, the radius
        // where the straight edge starts, half the radius at a curve's control point — never more on one corner.
        const offsets = new Set<number>();
        for (let i = 0; i < values.length; i += 2) {
          const [x, y] = [values[i]!, values[i + 1]!];
          if (Math.abs(x - box.left) > 0.01 && Math.abs(x - box.right) > 0.01) continue;
          offsets.add(Number(Math.min(y - box.top, box.bottom - y).toFixed(2)));
        }
        expect([...offsets].sort((a, b) => a - b)).toEqual([6, 12]);
      }
    });

    it(`${layout}: folded and unfolded frames keep their padding apart`, () => {
      setErdPaint("domain", {});
      const folded = DOMAINS.map((domain) => `dc:${domain}`).filter((_, k) => k % 2 === 1);
      const doc = parse(erdCompose(logical(folded), layout, layoutFn));
      const boxes: Box[] = [];
      for (const cluster of doc.querySelectorAll('g.cluster[id^="dc:"]')) boxes.push(boxOf(cluster.querySelector("path")!.getAttribute("d")!));
      for (const node of [...doc.querySelectorAll("g.node")].filter((each) => each.querySelector("title")?.textContent?.startsWith("dc:"))) {
        const outline = node.querySelector("path, polygon")!;
        const at = offsetOf(outline);
        const box = boxOf(outline.getAttribute("d") ?? outline.getAttribute("points")!);
        boxes.push({ left: box.left + at.x, right: box.right + at.x, top: box.top + at.y, bottom: box.bottom + at.y });
      }
      expect(boxes).toHaveLength(DOMAINS.length);
      // Each frame keeps its padding round it on every side: two frames or boxes stand at least two paddings apart.
      const PAD = 20;
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const [a, b] = [boxes[i]!, boxes[j]!];
          const gap = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
          expect(gap, `boxes ${i} and ${j} stand ${gap.toFixed(1)} apart`).toBeGreaterThanOrEqual(2 * PAD);
        }
      }
    });
  }

  it("a frame is never narrower than its title", () => {
    setErdPaint("domain", {});
    const wide: ErdGraphPayload = { ...logical(), entities: [entity("x.One.Tiny", "x.One")], relations: [], domain_labels: { "x.One": "AnExceptionallyLongDomainNameThatOutgrowsItsTable" }, domain_colors: { "x.One": "#000000" } };
    const doc = parse(addFrameIcons(erdCompose(wide, "gv-neato", layoutFn)));
    const { box, disk } = title(doc.querySelector('g.cluster[id^="dc:"]')!);
    const right = box.right - (disk.x - box.left);
    // The title is centred: the space before the disk is matched by as much after the name, inside the outline.
    expect(right).toBeGreaterThan(disk.x);
    expect(disk.x - box.left).toBeGreaterThanOrEqual(19);
  });
});

describe("the use cases' boundaries (spec 071)", () => {
  const action = (id: string, domain: string, colour: string) => ({ id, label: id, short_label: id.split(".")[1]!, domain_id: domain, domain_short_label: `${domain}Domain`, accent_color: colour, role_ids: [] });
  const data: DomainUseCaseDiagramPayload = {
    domain: { id: "all", label: "All", short_label: "All", accent_color: "#64748b" },
    actions: [action("a.Pay", "Money", "#f59e0b"), action("a.Refund", "Money", "#f59e0b"), action("a.Order", "Store", "#ea580c")],
    roles: [
      { id: "r.Clerk", label: "Clerk", short_label: "Clerk" },
      { id: "r.Senior", label: "Senior", short_label: "Senior" },
    ],
    edges: [
      { id: "e1", edge_kind: "association", source_id: "a.Pay", target_id: "r.Clerk" },
      { id: "e2", edge_kind: "association", source_id: "a.Refund", target_id: "r.Clerk" },
      { id: "e3", edge_kind: "role_generalization", source_id: "r.Senior", target_id: "r.Clerk" },
      { id: "e4", edge_kind: "include", source_id: "a.Order", target_id: "a.Pay" },
      { id: "e5", edge_kind: "include", source_id: "a.Order", target_id: "a.Refund" },
      { id: "e6", edge_kind: "include", source_id: "a.Pay", target_id: "a.Refund" },
    ],
  };
  const build = (boundary: boolean, foldedAll: boolean) => buildDomainUseCaseDotBundle(data, "LR", { roleActorImageUrl: "actor.svg" }, { boundary, foldedAll }).dot;

  it("unfolded: one boundary per domain, in its colour, titled with its disk and name", () => {
    const dot = build(true, false);
    expect(dot).toContain('id="dc:Money"');
    expect(dot).toContain('color="#f59e0b"');
    expect(dot).toContain('ID="fddO"'.replace("O", "0"));
    expect(dot).toContain("<B>MoneyDomain</B>");
  });

  it("folded: a box per domain, a role linked once to each box it reaches, its generalization kept, links between domains counted", () => {
    const dot = build(true, true);
    expect(dot).not.toContain("subgraph");
    expect(dot.match(/\[id="dc:/g)).toHaveLength(2);
    expect(dot).toContain("2 use cases");
    // The clerk reaches Money through two use cases: one arrow.
    expect(dot.match(/r_r_Clerk -> domain_\d/g)).toHaveLength(1);
    // The senior role is linked only by its generalization: it must not stand alone.
    expect(dot).toMatch(/r_r_Senior -> r_r_Clerk/);
    // Two includes go from Store to Money; the one inside Money is hidden with its use cases.
    expect(dot).toMatch(/domain_\d -> domain_\d \[dir=none[^\]]*label="×2"/);
    expect(dot).not.toContain("a_a_Pay");
  });

  it("with Boundary off nothing is folded, whatever the fold switch says", () => {
    const dot = build(false, true);
    expect(dot).not.toContain('id="dc:');
    expect(dot).toContain("a_a_Pay");
    expect(dot).toContain("a_a_Order -> a_a_Pay");
  });

  it("the folded boxes are laid out with the disk on the name's axis and the name inside the box", () => {
    const doc = parse(addFrameIcons(layoutFn(build(true, true), "dot")));
    const boxes = [...doc.querySelectorAll("g.node")].filter((node) => node.querySelector("image.frame-disk"));
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      const t = title(box);
      expect(t.disk.y + t.disk.size / 2).toBeCloseTo(t.name.baseline - t.name.size * CAP_MIDDLE, 1);
      expect(t.name.face).toMatch(/^Helvetica/);
      expect(t.disk.x - t.box.left).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("a specialization block inside a frame (spec 071)", () => {
  const head = entity("shop.Store.Payment.Payment", "shop.Store", "shop.Db");
  const card = entity("shop.Store.Card.CardPayment", "shop.Store", "shop.Db");
  const bank = entity("shop.Store.Bank.BankPayment", "shop.Store", "shop.Db");
  const other = entity("shop.Money.Ledger.Ledger", "shop.Money", "shop.Db");
  const groups = [{ group_id: "shop.Payment:kind", label: "kind (by type)", members: [card.id, bank.id] }];
  const logicalShop: ErdGraphPayload = { entities: [head, card, bank, other], relations: [], groups, model: "logical", domain_labels: { "shop.Store": "Store", "shop.Money": "Money" }, domain_colors: { "shop.Store": "#ea580c", "shop.Money": "#f59e0b" } };
  const physicalShop: ErdGraphPayload = { ...logicalShop, entities: logicalShop.entities.map((each) => ({ ...each, copy_resource: "shop.Db" }) as ErdEntity), model: "physical", resource_ids: ["shop.Db"], resource_labels: { "shop.Db": "Db" } };

  for (const [view, data] of [["logical", logicalShop], ["physical", physicalShop]] as const) {
    for (const layout of ["gv-dot-lr", "gv-neato"] as ErdGraphvizLayout[]) {
      it(`${view}, ${layout}: every id of the drawing is its own, and the block names the frame it lies in`, () => {
        setErdPaint(view === "physical" ? "resource" : "domain", { "shop.Db": "#0ea5e9" });
        const svg = layout === "gv-dot-lr" ? layoutFn(buildDotSource(data, layout), "dot") : erdCompose(data, layout, layoutFn);
        const ids = [...svg.matchAll(/<g id="([^"]+)"/g)].map((match) => match[1]!);
        expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toEqual([]);
        const frame = view === "logical" ? "dc:shop.Store" : "rc:shop.Db";
        expect(ids).toContain(`sg:shop.Payment:kind@${frame}`);
        const doc = parse(svg);
        const block = [...doc.querySelectorAll("g.cluster")].find((cluster) => cluster.id.startsWith("sg:"))!;
        // A click on the block's empty space folds the frame round it; a pan that starts there folds nothing.
        expect(clickFolds(block.querySelector("path"), true)).toBe(frame);
        expect(clickFolds(block.querySelector("path"), false)).toBeNull();
        expect(frameOfCluster(block.id)).toBe(frame);
      });
    }
  }

  for (const layout of ["gv-neato", "gv-fdp", "gv-circo"] as ErdGraphvizLayout[]) {
    it(`${layout}: a block holds its own tables and no other, however the tables of its frame are linked`, () => {
      setErdPaint("domain", {});
      // The head and a dictionary are linked to both variants: laid out freely they land between them.
      const kind = entity("shop.Store.Kind.PaymentKind", "shop.Store", "shop.Db");
      const link = (source: string, target: string) => ({ source, target, source_field: "ref", relationship_kind: "association", source_cardinality: "zero_many", target_cardinality: "one" });
      const data: ErdGraphPayload = { ...logicalShop, entities: [head, card, bank, kind, other], relations: [link(card.id, head.id), link(bank.id, head.id), link(head.id, kind.id), link(card.id, kind.id), link(bank.id, kind.id)] };
      const doc = parse(erdCompose(data, layout, layoutFn));
      const block = boxOf([...doc.querySelectorAll("g.cluster")].find((cluster) => cluster.id.startsWith("sg:"))!.querySelector("path")!.getAttribute("d")!);
      const inside = (id: string) => {
        const node = [...doc.querySelectorAll("g.node")].find((each) => each.querySelector("title")?.textContent === id)!;
        const outline = node.querySelector("path, polygon")!;
        const at = offsetOf(outline);
        const box = boxOf(outline.getAttribute("d") ?? outline.getAttribute("points")!);
        const [left, right, top, bottom] = [box.left + at.x, box.right + at.x, box.top + at.y, box.bottom + at.y];
        const overlaps = left < block.right && right > block.left && top < block.bottom && bottom > block.top;
        const within = left >= block.left && right <= block.right && top >= block.top && bottom <= block.bottom;
        return within ? "within" : overlaps ? "overlaps" : "outside";
      };
      expect([inside(card.id), inside(bank.id)]).toEqual(["within", "within"]);
      expect([inside(head.id), inside(kind.id), inside(other.id)]).toEqual(["outside", "outside", "outside"]);
    });
  }

  it("a block outside every frame stands for no frame", () => {
    expect(frameOfCluster("sg:shop.Payment:kind")).toBeNull();
    expect(frameOfCluster("cluster_domain_0")).toBeNull();
    expect(frameOfCluster("dc:shop.Store")).toBe("dc:shop.Store");
  });
});
