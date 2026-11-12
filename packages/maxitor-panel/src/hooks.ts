// @maxitor/panel — what a page of the panel reads and asks for. A page builds its view from its address alone.
"use client";

import { useEffect } from "react";

import { usePanel } from "./PanelProvider";
import type { MomentContext, Query } from "./protocol";
import { checkWrite } from "./shell/address";

type Change = { path?: string; query: Query };

/**
 * The panel's router. One `push` is one history entry in the window's address; `replace` changes it in place, for a
 * change that goes on (typing a search, dragging). Inside the frame the address is only replaced. A write that
 * changes one of the core's names — at, mode, from, _… — is refused and leaves the address (spec 078, FR-012).
 */
export function usePanelRouter() {
  const panel = usePanel();
  const go = (mode: "push" | "replace") => (change: Change) => {
    if (!checkWrite(change.query, panel.query, process.env.NODE_ENV === "production")) return;
    const path = change.path ?? panel.path;
    panel.send({ type: "panel.navigate", path, query: change.query, mode });
    panel.show(path, change.query, panel.at);
  };
  return { push: go("push"), replace: go("replace") };
}

/** The page's parameters as the address holds them, `at` among them when a moment is chosen. */
export function usePanelQuery(): Query & { at?: string } {
  const { query, at } = usePanel();
  return at ? { ...query, at } : query;
}

/** The page's path inside its owner, without the organization. */
export function usePanelPath(): string {
  return usePanel().path;
}

/** Called when "now" moved; a page without `at` reads its data again. */
export function useWatermark(listener: (at: string) => void): void {
  const { onWatermark } = usePanel();
  useEffect(() => onWatermark(listener), [listener, onWatermark]);
}

/** Open a page of the core or of a direct dependency at its panel address. */
export function useOpenPanel() {
  const panel = usePanel();
  return (owner: string, path: string, query: Query = {}) => panel.send({ type: "panel.open", owner, path, query });
}

/**
 * Tell the core what the page holds but its filters leave out now — the anchors of its hidden rows and elements —
 * so a pointer at one of them is shown as hidden (spec 081, FR-013). Sent again whenever the list changes.
 */
export function usePanelHidden(anchors: readonly string[]): void {
  const { send } = usePanel();
  const key = anchors.join("\n");
  useEffect(() => send({ type: "panel.hidden", anchors: [...anchors] }), [key, send]);
}

/**
 * The page's moment and what it is compared with (spec 079, FR-019): One `at` alone; Diff `at` is B and `against`
 * A; Side by side `at` is this panel's moment, `against` the other's, `side` which panel it is. A page draws one canvas
 * from this and never knows how many panels there are.
 */
export function useMoment(): MomentContext {
  return usePanel().context;
}

/** Tell the core what the comparison on screen counts: the pill shows it (spec 079, FR-026). */
export function useCounts(counts: { added: number; removed: number; changed: number } | null): void {
  const { send } = usePanel();
  // The counts are sent once per value: a new object with the same counts is not sent again.
  const key = counts ? `${counts.added}/${counts.removed}/${counts.changed}` : "";
  useEffect(() => {
    if (!key) return;
    const [added, removed, changed] = key.split("/").map(Number);
    send({ type: "panel.counts", added, removed, changed });
  }, [key, send]);
}

/** Shift + ↑ ↓ step a comparison's changes wherever the focus is: the core passes them on as panel.step. */
export function useChangeStep(listener: (delta: -1 | 1) => void): void {
  const { onCore } = usePanel();
  useEffect(() => onCore((message) => message.type === "panel.step" && listener(message.delta)), [listener, onCore]);
}

/** Ask the core for now, one moment: the moment and the comparison are the core's, so a page asks and never writes them. */
export function useBackToNow(): () => void {
  const { send } = usePanel();
  return () => send({ type: "panel.now" });
}
