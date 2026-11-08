// src/lib/erdResourceSettings.test.tsx
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useErdResourceSettings } from "@/lib/erdResourceSettings";
import { PageSettingsProvider, clearLocalPageSettings, type RoomSettings } from "@/lib/pageSettings";

const ERD = "view=domain-erd&domain=shop";

afterEach(() => clearLocalPageSettings());

function inRoom(room: RoomSettings) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PageSettingsProvider page={ERD} room={room}>
      {children}
    </PageSettingsProvider>
  );
  return renderHook(() => useErdResourceSettings(), { wrapper });
}

describe("the ERD's view and resource settings in a room (spec 061, spec 070)", () => {
  it("sends a resource switched off to the room as the whole new list", () => {
    const set = vi.fn();
    const view = inRoom({ settings: { [ERD]: { disabled_resources: ["shop.ArchiveDatabase"] } }, set });
    act(() => view.result.current.toggleResource("shop.BillingDatabase"));
    expect(set).toHaveBeenCalledWith(ERD, "disabled_resources", ["shop.ArchiveDatabase", "shop.BillingDatabase"]);
  });

  it("sends the view chosen to the room", () => {
    const set = vi.fn();
    const view = inRoom({ settings: {}, set });
    act(() => view.result.current.setModel("physical"));
    expect(set).toHaveBeenCalledWith(ERD, "model", "physical");
  });

  it("gives a member who joins later the room's resources and view", () => {
    const view = inRoom({ settings: { [ERD]: { disabled_resources: ["shop.BillingDatabase"], model: "physical" } }, set: vi.fn() });
    expect([...view.result.current.disabledResources]).toEqual(["shop.BillingDatabase"]);
    expect(view.result.current.model).toBe("physical");
  });

  it("starts with every resource on and the logical view", () => {
    const view = inRoom({ settings: {}, set: vi.fn() });
    expect([view.result.current.disabledResources.size, view.result.current.model]).toEqual([0, "logical"]);
  });

  it("reads anything but the physical view as the logical one", () => {
    const view = inRoom({ settings: { [ERD]: { model: "boundary" } }, set: vi.fn() });
    expect(view.result.current.model).toBe("logical");
  });
});
