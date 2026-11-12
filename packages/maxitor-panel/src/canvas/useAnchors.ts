// @maxitor/panel — the canvas's side of anchors (spec 079, FR-021 – FR-024): it tells the core the chain under the
// pointer, at most once a frame, and what was chosen; it lights the deepest anchor of a chain it holds when the core
// asks (panel.mark), brings it into view keeping the zoom (panel.bring), and says what it did (panel.shown).
"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { usePanelOrNull } from "../PanelProvider";
import { centreOn, type Bounds, type Camera } from "./camera";
import { ANCHOR_ATTRIBUTE, chainOf, deepestHeld, inView, sameChain } from "./anchors";
import { viewOf } from "../content/list";
import { MAX_ANCHOR, MAX_CHAIN } from "../protocol";

const LIMITS = { chain: MAX_CHAIN, anchor: MAX_ANCHOR };

type Canvas = { camera: Camera; viewport: { width: number; height: number }; locate: (anchor: string) => Bounds | null; toCanvas: (screen: { x: number; y: number }) => { x: number; y: number } };

/** The attribute the lit element carries; @maxitor/panel's marks.css draws it. */
export const MARKED_ATTRIBUTE = "data-marked";

export function useAnchors({
  field,
  panel,
  api,
  size,
  glideTo,
  touch,
}: {
  field: RefObject<HTMLDivElement | null>;
  panel: ReturnType<typeof usePanelOrNull>;
  api: Canvas;
  size: () => { width: number; height: number };
  glideTo: (camera: Camera) => void;
  touch: () => void;
}) {
  const last = useRef<string[] | null>(null);
  const frame = useRef(0);
  const [marked, setMarked] = useState<string | null>(null);
  const latest = useRef(api);
  latest.current = api;

  // The pointer's chain, sent once a frame and only when it changed.
  const over = useCallback(
    (element: Element | null) => {
      if (!panel) return;
      const chain = element ? chainOf(element, LIMITS) : [];
      const next = chain.length ? chain : null;
      if (sameChain(next, last.current)) return;
      last.current = next;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => panel.send({ type: "panel.pointer", chain: next }));
    },
    [panel],
  );
  const chose = useCallback(
    (element: Element | null) => {
      const chain = element ? chainOf(element, LIMITS) : [];
      if (panel && chain.length) panel.send({ type: "panel.choose", chain });
    },
    [panel],
  );

  // Where an anchor lies on the canvas: as its content registered it — a list's rows, drawn or not —, else as its
  // element is drawn.
  const where = useCallback(
    (anchor: string): Bounds | null => {
      const canvas = latest.current;
      const registered = canvas.locate(anchor);
      if (registered) return registered;
      const box = field.current;
      const element = box?.querySelector(`[${ANCHOR_ATTRIBUTE}="${CSS.escape(anchor)}"]`);
      if (!box || !element) return null;
      const origin = box.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const corner = canvas.toCanvas({ x: rect.left - origin.left, y: rect.top - origin.top });
      return { x: corner.x, y: corner.y, width: rect.width / canvas.camera.zoom, height: rect.height / canvas.camera.zoom };
    },
    [field],
  );

  // The core's panel.mark and panel.bring: the deepest anchor this page holds, lit, brought into view when asked.
  useEffect(() => {
    if (!panel) return;
    return panel.onCore((message) => {
      if (message.type !== "panel.mark" && message.type !== "panel.bring") return;
      if (message.chain === null) {
        setMarked(null);
        return;
      }
      const canvas = latest.current;
      const { anchor, deepest } = deepestHeld(message.chain, (name) => where(name) !== null);
      const hidden = message.chain.some((name) => panel.hidden().has(name)) && !deepest;
      let brought = false;
      if (anchor) {
        const bounds = where(anchor) as Bounds;
        const seen = inView(bounds, viewOf(canvas.camera, canvas.viewport));
        if (message.type === "panel.bring" && !seen) {
          const { width, height } = size();
          touch();
          glideTo(centreOn(canvas.camera, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, width, height));
          brought = true;
        }
        setMarked(seen || brought ? anchor : null);
      } else setMarked(null);
      panel.send({ type: "panel.shown", chain: message.chain, anchor, held: deepest, hidden, brought });
    });
  }, [glideTo, panel, size, touch, where]);

  // The lit element carries the mark while it is drawn; a row drawn only after a bring gets it when it appears.
  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.querySelectorAll(`[${MARKED_ATTRIBUTE}]`).forEach((node) => {
      if (node.getAttribute(ANCHOR_ATTRIBUTE) !== marked) node.removeAttribute(MARKED_ATTRIBUTE);
    });
    if (marked) element.querySelector(`[${ANCHOR_ATTRIBUTE}="${CSS.escape(marked)}"]`)?.setAttribute(MARKED_ATTRIBUTE, "");
  });

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // The page's own step: bring an anchor it holds to the middle and light it.
  const bring = useCallback(
    (anchor: string) => {
      const bounds = where(anchor);
      if (!bounds) return false;
      const { width, height } = size();
      touch();
      glideTo(centreOn(latest.current.camera, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, width, height));
      setMarked(anchor);
      return true;
    },
    [glideTo, size, touch, where],
  );
  return { over, chose, bring };
}
