import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardSubject } from "./ElementCard";

const fetchElementCard = vi.fn();
const getActiveBase = vi.fn();
vi.mock("@/api/elementCard", () => ({ fetchElementCard }));
vi.mock("@/api/client", () => ({ getActiveBase }));
vi.mock("./LifecycleMiniature", () => ({ LifecycleMiniature: ({ lifecycleId, dimmed, onSettled }: { lifecycleId: string; dimmed?: boolean; onSettled?: (width: number) => void }) => <div data-testid="miniature" data-dimmed={dimmed} onClick={() => onSettled?.(100)}>{lifecycleId}</div> }));
vi.mock("@/components/history/DiffCard", () => ({ DiffBody: () => <div data-testid="diff-body" />, StatusIcon: ({ status }: { status: string }) => <img alt={status} /> }));

const { ElementCard } = await import("./ElementCard");
const { focusToSend } = await import("@/rooms/focusStore");

const subject: CardSubject = { key: "k", ref: { kind: "row", id: "fn0_0" }, title: "price", detail: "int", nodeId: "a:price", change: null, at: { x: 0, y: 0 } };
const show = (over: Partial<CardSubject> = {}) => render(<ElementCard subject={{ ...subject, ...over }} newer="B" onEnter={() => undefined} onLeave={() => undefined} onClose={() => undefined} />);

describe("ElementCard", () => {
  beforeEach(() => {
    localStorage.setItem("maxitor:cardFieldsOpen", "1");
    fetchElementCard.mockReset().mockResolvedValue({ id: "a:price", type: "field", label: "price", description: null, lifecycle_id: null });
    getActiveBase.mockReset().mockReturnValue(null);
  });
  afterEach(cleanup);

  it("in One has no status", async () => {
    show();
    await waitFor(() => expect(fetchElementCard).toHaveBeenCalled());
    expect(screen.queryByAltText("unchanged")).toBeNull();
  });

  it("in a comparison gives an unchanged element the shape of a changed one", () => {
    getActiveBase.mockReturnValue({ source: "a", key: "" });
    show();
    expect(screen.getByAltText("unchanged")).toBeTruthy();
  });

  it("does not call a changed element unchanged", () => {
    getActiveBase.mockReturnValue({ source: "a", key: "" });
    show({ change: { title: "price", status: "added", elements: [] } });
    expect(screen.queryByAltText("unchanged")).toBeNull();
    expect(screen.getByAltText("added")).toBeTruthy();
    expect(screen.getByTestId("diff-body")).toBeTruthy();
  });

  it("shows a description and leaves it out when there is none", async () => {
    fetchElementCard.mockResolvedValue({ id: "t", type: "entity", label: "T", description: "One row", lifecycle_id: null });
    show();
    expect((await screen.findByTestId("card-description")).textContent).toBe("One row");
    cleanup();
    fetchElementCard.mockResolvedValue({ id: "t", type: "entity", label: "T", description: null, lifecycle_id: null });
    show();
    await waitFor(() => expect(fetchElementCard).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("card-description")).toBeNull();
  });

  it("keeps a table's list to names, and shows the pointed field's type and description below", () => {
    show({ nodeId: null, fields: [{ name: "id", type: "str", description: "Lot id" }, { name: "plain", type: "int" }] });
    expect(screen.getAllByTestId("card-field").map((each) => each.textContent)).toEqual(["id", "plain"]);
    expect(screen.getByTestId("card-field-shown").textContent).toBe("Hover a field");
    fireEvent.mouseEnter(screen.getAllByTestId("card-field")[0]!);
    expect(screen.getByTestId("card-field-shown").textContent).toBe("strLot id");
    // Leaving the list keeps the last row's foot (#89).
    fireEvent.mouseLeave(screen.getByTestId("card-fields"));
    expect(screen.getByTestId("card-field-shown").textContent).toBe("strLot id");
  });

  it("marks the pointed name by weight and colour", () => {
    show({ nodeId: null, fields: [{ name: "id" }] });
    const name = screen.getByTestId("card-field-name");
    expect(getComputedStyle(name).fontWeight).not.toBe("600");
    fireEvent.mouseEnter(screen.getByTestId("card-field"));
    expect(getComputedStyle(name).fontWeight).toBe("600");
  });

  it("shows a pointed field on a tap too", () => {
    show({ nodeId: null, fields: [{ name: "id", type: "str" }] });
    fireEvent.click(screen.getByTestId("card-field"));
    expect(screen.getByTestId("card-field-shown").textContent).toBe("str");
  });

  it("shows a changed type with what it was in the same place, never in the list", () => {
    show({ nodeId: null, fields: [{ name: "id", type: "int", previousType: "str" }] });
    expect(screen.getByTestId("card-field").textContent).toBe("id");
    fireEvent.mouseEnter(screen.getByTestId("card-field"));
    expect(screen.getByTestId("card-field-shown").textContent).toBe("str → int");
  });

  it("stays unseen until what it reads has come", async () => {
    let answer: (value: unknown) => void = () => undefined;
    fetchElementCard.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    show();
    expect(screen.getByTestId("element-card").style.visibility === "visible" || getComputedStyle(screen.getByTestId("element-card")).visibility).toBe("hidden");
    answer(null);
    await waitFor(() => expect(getComputedStyle(screen.getByTestId("element-card")).visibility).toBe("visible"));
  });

  it("waits for a lifecycle's picture too", async () => {
    show({ nodeId: null, lifecycleIds: ["a:lifecycle:s"] });
    expect(getComputedStyle(screen.getByTestId("element-card")).visibility).toBe("hidden");
    fireEvent.click(screen.getByTestId("miniature"));
    await waitFor(() => expect(getComputedStyle(screen.getByTestId("element-card")).visibility).toBe("visible"));
  });

  it("lights a field's lifecycle and dims the others", () => {
    show({ nodeId: null, lifecycleIds: ["a:lifecycle:s", "a:lifecycle:t"], fields: [{ name: "s", lifecycleId: "a:lifecycle:s" }, { name: "plain" }] });
    const dimmed = () => screen.getAllByTestId("miniature").map((each) => each.dataset.dimmed);
    expect(dimmed()).toEqual(["false", "false"]);
    fireEvent.mouseEnter(screen.getAllByTestId("card-field")[0]!);
    expect(dimmed()).toEqual(["false", "true"]);
    fireEvent.mouseEnter(screen.getAllByTestId("card-field")[1]!);
    expect(dimmed()).toEqual(["false", "false"]);
  });

  it("hides a table's fields at first, and remembers a choice for the next card", () => {
    localStorage.removeItem("maxitor:cardFieldsOpen");
    const fields = [{ name: "id" }, { name: "plain" }];
    show({ nodeId: null, fields });
    expect(screen.queryAllByTestId("card-field")).toEqual([]);
    expect(screen.getByTestId("card-fields-toggle").textContent).toBe("2 fields");
    fireEvent.click(screen.getByTestId("card-fields-toggle"));
    expect(screen.getAllByTestId("card-field")).toHaveLength(2);
    cleanup();
    show({ key: "other", nodeId: null, fields });
    expect(screen.getAllByTestId("card-field")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("card-fields-toggle"));
    cleanup();
    show({ nodeId: null, fields });
    expect(screen.queryAllByTestId("card-field")).toEqual([]);
  });

  it("hides every field with the list hidden, and counts what changed", () => {
    localStorage.setItem("maxitor:cardFieldsOpen", "0");
    show({ nodeId: null, fields: [{ name: "same" }, { name: "new", status: "added" }, { name: "typed", status: "changed", previousType: "str", type: "int" }] });
    expect(screen.queryAllByTestId("card-field")).toEqual([]);
    expect(screen.getAllByTestId("card-fields-count").map((each) => each.textContent)).toEqual(["+1", "~1"]);
  });

  it("reports what happens inside it, for a follower", () => {
    show({ nodeId: null, fields: [{ name: "id" }, { name: "plain" }] });
    fireEvent.mouseEnter(screen.getAllByTestId("card-field")[1]!);
    expect(focusToSend("p").panels.card).toEqual({ ref: subject.ref, fields: true, field: 1, scroll: 0, at: null });
    cleanup();
    expect(focusToSend("p").panels.card).toBeNull();
  });

  it("tells two rows of one name apart", () => {
    show({ nodeId: null, fields: [{ name: "currency", type: "str" }, { name: "currency", type: "Enum" }] });
    fireEvent.mouseEnter(screen.getAllByTestId("card-field")[1]!);
    expect(screen.getByTestId("card-field-shown").textContent).toBe("Enum");
  });

  it("hides the list of a table that came whole", () => {
    localStorage.setItem("maxitor:cardFieldsOpen", "0");
    show({ nodeId: null, fields: [{ name: "id", status: "added" }, { name: "new", status: "added" }] });
    expect(screen.queryAllByTestId("card-field")).toEqual([]);
    expect(screen.queryAllByTestId("card-fields-count")).toEqual([]);
    fireEvent.click(screen.getByTestId("card-fields-toggle"));
    expect(screen.getAllByTestId("card-field")).toHaveLength(2);
  });

  it("draws every lifecycle of a table", () => {
    show({ nodeId: null, lifecycleIds: ["a:lifecycle:s", "a:lifecycle:t"] });
    expect(screen.getAllByTestId("miniature").map((each) => each.textContent)).toEqual(["a:lifecycle:s", "a:lifecycle:t"]);
  });

  it("keeps what it knows when the read fails", async () => {
    fetchElementCard.mockRejectedValue(new Error("no"));
    show();
    expect((await screen.findByTestId("card-unread")).textContent).toContain("could not be read");
    expect(screen.getByTestId("card-detail").textContent).toBe("int");
  });

  it("draws a relation as a table's card is drawn: its name, what it is, its description, then its two ends labelled (spec 071)", () => {
    show({
      nodeId: null,
      title: "Lot.offer → Offer",
      detail: "",
      description: "Upstream outbox linkage",
      relation: {
        name: "outbox_row",
        kind: "Association",
        shape: "many to one",
        kindIcon: "data:kind",
        from: { table: "MsgOutboxWebhookCorrelateCoreEntity", field: "outbox_row", count: "zero or more (0..*)", icon: "data:many" },
        to: { table: "OutboxMessageCoreEntity", count: "exactly one (1)", icon: "data:one" },
      },
    });
    expect(screen.getByTestId("card-icon").getAttribute("src")).toBe("data:kind");
    expect(screen.getByTestId("element-card").textContent).toMatch(/^outbox_rowAssociation · many to oneUpstream outbox linkageFrom/);
    expect(screen.getByTestId("card-detail").textContent).toBe("Association · many to one");
    const ends = screen.getAllByTestId("card-relation-end");
    expect(ends).toHaveLength(2);
    expect(ends[0]!.textContent).toBe("FromMsgOutboxWebhookCorrelateCoreEntityoutbox_row · zero or more (0..*)");
    expect(ends[1]!.textContent).toBe("ToOutboxMessageCoreEntityexactly one (1)");
    expect([...ends[0]!.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual(["data:many"]);
    // A long name breaks between its words, never inside one.
    expect(ends[0]!.querySelectorAll("wbr")).toHaveLength(5 + 1);
  });

  it("reads the description of the table a frame's row points at, and shows it at the card's foot (spec 071)", async () => {
    fetchElementCard.mockImplementation(async (id: string) => ({ id, type: id === "shop.Store" ? "domain" : "entity", label: id, description: id === "shop.Store" ? "Where orders are taken" : `About ${id}`, lifecycle_id: null }));
    show({ nodeId: "shop.Store", title: "StoreDomain", detail: "Domain", fieldNoun: "table", fields: [{ name: "Order", type: "core", nodeId: "shop.Order" }, { name: "Line", type: "detail", nodeId: "shop.Line" }] });
    expect((await screen.findByTestId("card-description")).textContent).toBe("Where orders are taken");
    fireEvent.mouseEnter(screen.getAllByTestId("card-field")[1]!);
    expect((await screen.findByTestId("card-field-description")).textContent).toBe("About shop.Line");
    expect(fetchElementCard).toHaveBeenCalledWith("shop.Line");
  });

  it("asks nothing for a line and shows a lifecycle named by the row", () => {
    show({ nodeId: null, lifecycleIds: ["a:lifecycle:s"] });
    expect(fetchElementCard).not.toHaveBeenCalled();
    expect(screen.getByTestId("miniature").textContent).toBe("a:lifecycle:s");
  });
});

describe("drawnWidth", () => {
  it("reads a drawing's width from its viewBox", async () => {
    const { drawnWidth } = await vi.importActual<typeof import("./LifecycleMiniature")>("./LifecycleMiniature");
    expect(drawnWidth('<svg viewBox="0.00 0.00 612.50 90.00">')).toBe(612.5);
    expect(drawnWidth(null)).toBe(0);
  });
});

describe("links on a card", () => {
  it("shows each group and leads on", () => {
    const open = vi.fn();
    render(<ElementCard subject={{ ...subject, nodeId: null, links: [{ group: "Emitted by", label: "Pay · finish", onOpen: open }, { group: "Domains", label: "Shop", onOpen: () => undefined }] }} newer="B" onEnter={() => undefined} onLeave={() => undefined} onClose={() => undefined} />);
    expect(screen.getAllByTestId("card-links")).toHaveLength(2);
    fireEvent.click(screen.getByText("Pay · finish"));
    expect(open).toHaveBeenCalledOnce();
  });
});

describe("an icon beside the title (spec 068)", () => {
  it("draws the icon it is given before the title, and none without one", () => {
    show({ icon: "data:image/svg+xml,%3Csvg%2F%3E", nodeId: null });
    expect(screen.getByTestId("card-icon").getAttribute("src")).toBe("data:image/svg+xml,%3Csvg%2F%3E");
    cleanup();
    show({ nodeId: null });
    expect(screen.queryByTestId("card-icon")).toBeNull();
  });
});

describe("a frame's card keeps the pointed table's block in view, at one height (#89)", () => {
  const tables = [
    { name: "Short", type: "Core", nodeId: "shop.Short" },
    { name: "Long", type: "Core", nodeId: "shop.Long" },
    { name: "Plain", type: "Core", nodeId: "shop.Plain" },
  ];
  const descriptions: Record<string, string> = { "shop.Short": "One line", "shop.Long": "A description long enough to take three lines in the card's foot", "shop.Plain": "" };

  beforeEach(() => {
    localStorage.setItem("maxitor:cardFieldsOpen", "1");
    getActiveBase.mockReset().mockReturnValue(null);
    fetchElementCard.mockReset().mockImplementation(async (id: string) => ({ id, type: "entity", label: id, description: descriptions[id] ?? null, lifecycle_id: null }));
  });

  afterEach(cleanup);

  it("keeps the foot at the card's bottom while the list scrolls", () => {
    show({ nodeId: null, fieldNoun: "table", fields: tables });
    expect(getComputedStyle(screen.getByTestId("card-field-hint")).position).toBe("sticky");
  });

  it("keeps the last row's foot when the pointer leaves the list, so a foot that grows over the pointer never shakes the list", async () => {
    show({ nodeId: null, fieldNoun: "table", fields: tables });
    const shown = () => screen.getByTestId("card-field-shown").textContent;
    expect(shown()).toBe("Hover a table");
    const rows = screen.getAllByTestId("card-field");
    fireEvent.mouseEnter(rows[1]!);
    await waitFor(() => expect(shown()).toBe(`Core${descriptions["shop.Long"]}`));
    // The foot has grown over the pointer: the pointer is on the foot now, off the list.
    fireEvent.mouseLeave(screen.getByTestId("card-fields"));
    expect(shown()).toBe(`Core${descriptions["shop.Long"]}`);
    // Only the row's own description is read, when the row is pointed at.
    expect(fetchElementCard.mock.calls.map(([id]) => id)).toEqual(["shop.Long"]);
    fireEvent.mouseEnter(rows[0]!);
    await waitFor(() => expect(shown()).toBe("CoreOne line"));
  });
});
