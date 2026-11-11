// @maxitor/panel — what a page of the panel reads and asks for. A page builds its view from its address alone.
"use client";

import { useEffect } from "react";

import { usePanel } from "./PanelProvider";
import type { Query } from "./protocol";

type Change = { path?: string; query: Query };

/**
 * The panel's router. One `push` is one history entry in the window's address; `replace` changes it in place, for a
 * change that goes on (typing a search, dragging). Inside the frame the address is only replaced.
 */
export function usePanelRouter() {
  const panel = usePanel();
  const go = (mode: "push" | "replace") => (change: Change) => {
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
