// packages/maxitor/maxitor-core/web/components/scale/bridge.ts
// What the frame and the page's frame share for the scale (spec 079, FR-002 – FR-005): the organization's watermark,
// read here once for the whole screen, and the way back from the page — its history and the keys pressed in it.
"use client";

import type { PageHistory, StepKeyName } from "@maxitor/panel/protocol";
import { createContext, useContext, useEffect, useState } from "react";

/** How often the frame asks whether "now" moved. */
const WATERMARK_MS = 5000;

export type ScaleBridge = {
  /** The organization's watermark — "now" —, null until it is first read. */
  watermark: string | null;
  /** The open page gave its history, or closed: null. */
  giveHistory: (history: PageHistory | null) => void;
  /** Shift and an arrow were pressed in the page. */
  pressed: (key: StepKeyName) => void;
};

const NOTHING: ScaleBridge = { watermark: null, giveHistory: () => undefined, pressed: () => undefined };

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
