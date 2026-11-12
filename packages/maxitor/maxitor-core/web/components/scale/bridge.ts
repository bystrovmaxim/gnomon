// packages/maxitor/maxitor-core/web/components/scale/bridge.ts
// What the frame and the page's frame share for the scale (spec 079, FR-002 – FR-005): the organization's watermark,
// read here once for the whole screen, and the way back from the page — its history and the keys pressed in it.
"use client";

import type { PageHistory, StepKeyName } from "@maxitor/panel/protocol";
import { createContext, useContext, useEffect, useState } from "react";

/** What the screen shows: one moment, or two compared (spec 079, FR-018). */
export type Mode = "one" | "diff" | "side_by_side";

/** How often the frame asks whether "now" moved. */
const WATERMARK_MS = 5000;

export type ScaleBridge = {
  /** The organization's watermark — "now" —, null until it is first read. */
  watermark: string | null;
  /** The open page gave its history, or closed: null. */
  giveHistory: (history: PageHistory | null) => void;
  /** Shift and an arrow were pressed in the page. */
  pressed: (key: StepKeyName) => void;
  /** The screen's moments: B as `at` (null is now), the mode, and A as `from` in a comparison. */
  moment: { at: string | null; mode: Mode; from: string | null };
  /** The id of the page's milestone a moment stands on exactly; null for none. */
  milestoneOn: (moment: string | null) => string | null;
  /** The page counted its comparison: the pill shows it. */
  counts: (counts: { added: number; removed: number; changed: number } | null) => void;
  /** The panels take Shift + ↑ ↓ while they are drawn: they pass them on to the page as panel.step. */
  connectStepper: (step: (delta: -1 | 1) => void) => () => void;
};

const NOTHING: ScaleBridge = {
  watermark: null,
  giveHistory: () => undefined,
  pressed: () => undefined,
  moment: { at: null, mode: "one", from: null },
  milestoneOn: () => null,
  counts: () => undefined,
  connectStepper: () => () => undefined,
};

export const ScaleContext = createContext<ScaleBridge>(NOTHING);

export function useScale(): ScaleBridge {
  return useContext(ScaleContext);
}

/** The organization's watermark, asked every 5 seconds; it never moves back. */
export function useWatermark(code: string): string | null {
  const [watermark, setWatermark] = useState<string | null>(null);
  useEffect(() => {
    let stopped = false;
    const ask = async () => {
      try {
        const answer = await fetch(`/api/v1/organizations/${encodeURIComponent(code)}/watermark`, { cache: "no-store" });
        if (!answer.ok || stopped) return;
        const { at } = (await answer.json()) as { at: string | null };
        if (at && !stopped) setWatermark((was) => (was && was >= at ? was : at));
      } catch {
        // The next question asks again.
      }
    };
    void ask();
    const timer = window.setInterval(ask, WATERMARK_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [code]);
  return watermark;
}
