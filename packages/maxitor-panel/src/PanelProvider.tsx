// @maxitor/panel — the page's side of the panel protocol. It sends panel.ready once the page is mounted, rebuilds the
// page from panel.location without answering it, and hands panel.watermark to the page. The page's own frame
// address is only ever replaced: the history entry lives in the window's address, which the core keeps.
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

import { changeStepOfKey, stepOfKey, type StepKeyName } from "./keys";
import { coreMessage, trusted, type CoreMessage, type MomentContext, type PageMessage, type Query, type Side } from "./protocol";
import { SHELL_VERSION } from "./version";

type Panel = {
  /** The page's path inside its owner, without the organization: "/items/4f1c". */
  path: string;
  query: Query;
  at: string | null;
  send: (message: PageMessage) => void;
  /** Replace the frame's own address with a page path and its parameters; never a history entry. */
  show: (path: string, query: Query, at: string | null, context?: Omit<MomentContext, "at">) => void;
  onWatermark: (listener: (at: string) => void) => () => void;
  /** What the page is compared with: `against`, `side` and the milestone `at` stands on (spec 079, FR-019). */
  context: MomentContext;
  /** Listen to the core's anchors and steps: panel.mark, panel.bring, panel.step. */
  onCore: (listener: (message: CoreMessage) => void) => () => void;
  /** The anchors the page last said its filters hide. */
  hidden: () => ReadonlySet<string>;
  /** Called by the shell while it renders: the page is drawn in the shell (spec 078, FR-020). */
  markShell: () => void;
};

const PanelContext = createContext<Panel | null>(null);

/** The panel around, or null outside one: a canvas drawn alone has no core to talk to. */
export function usePanelOrNull(): Panel | null {
  return useContext(PanelContext);
}

export function usePanel(): Panel {
  const panel = useContext(PanelContext);
  if (!panel) throw new Error("@maxitor/panel: a page of the panel is drawn inside PanelDocument");
  return panel;
}

/** The frame's own address keeps the page's context in the core's names, so a reload keeps it. */
const CONTEXT = { against: "_against", side: "_side", milestone: "_milestone" } as const;

function search(query: Query, at: string | null, context: Omit<MomentContext, "at"> = { against: null, side: null, milestone: null }): string {
  const params = new URLSearchParams(query);
  if (at) params.set("at", at);
  for (const [field, name] of Object.entries(CONTEXT)) {
    const value = context[field as keyof typeof CONTEXT];
    if (value) params.set(name, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function PanelProvider({
  build,
  prefixSegments,
  children,
}: {
  build: string;
  /** How many segments of the route stand before the page's path: the organization, for a plugin. */
  prefixSegments: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const listeners = useRef(new Set<(at: string) => void>());
  const coreListeners = useRef(new Set<(message: CoreMessage) => void>());
  const hiddenAnchors = useRef<ReadonlySet<string>>(new Set());
  const shelled = useRef(false);
  const markShell = useCallback(() => {
    shelled.current = true;
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  const prefix = `/${segments.slice(0, prefixSegments).join("/")}`;
  const path = `/${segments.slice(prefixSegments).join("/")}`;
  const query = useMemo(() => {
    const found: Query = {};
    // The core's names are not the page's parameters: the moment and the context have their own places.
    params.forEach((value, name) => {
      if (name !== "at" && !name.startsWith("_")) found[name] = value;
    });
    return found;
  }, [params]);
  const at = params.get("at");
  const sideName = params.get(CONTEXT.side);
  const context = useMemo<MomentContext>(
    () => ({ at, against: params.get(CONTEXT.against), side: sideName === "a" || sideName === "b" ? (sideName as Side) : null, milestone: params.get(CONTEXT.milestone) }),
    [at, params, sideName],
  );
  const kept = useRef(context);
  kept.current = context;

  const send = useCallback((message: PageMessage) => {
    if (message.type === "panel.hidden") hiddenAnchors.current = new Set(message.anchors);
    if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
  }, []);

  // The page's own change keeps its context; the core's panel.location brings a new one.
  const show = useCallback(
    (to: string, values: Query, moment: string | null, context: Omit<MomentContext, "at"> = kept.current) =>
      router.replace(`${prefix}${to === "/" ? "" : to}${search(values, moment, context)}`, { scroll: false }),
    [prefix, router],
  );

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!trusted(event, window.parent)) return;
      const message = coreMessage(event.data);
      if (!message) return;
      // The address changed by Back, the tree, a control or the moment: rebuild from it, and say nothing back.
      if (message.type === "panel.location") show(message.path, message.query, message.at, message);
      else if (message.type === "panel.watermark") listeners.current.forEach((listener) => listener(message.at));
      else coreListeners.current.forEach((listener) => listener(message));
    };
    window.addEventListener("message", receive);
    // The children's effects ran first: a page drawn in the shell has marked it by now.
    send({ type: "panel.ready", build, shell: shelled.current, shellVersion: shelled.current ? SHELL_VERSION : "" });
    return () => window.removeEventListener("message", receive);
  }, [build, send, show]);

  // Shift and an arrow step the scale wherever the focus is: pressed in the page, the core is told (spec 079, FR-005).
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      if (stepOfKey(event) === null && changeStepOfKey(event) === null) return;
      event.preventDefault();
      send({ type: "panel.keys", key: event.key as StepKeyName });
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, [send]);

  const onWatermark = useCallback((listener: (at: string) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const onCore = useCallback((listener: (message: CoreMessage) => void) => {
    coreListeners.current.add(listener);
    return () => {
      coreListeners.current.delete(listener);
    };
  }, []);
  const hidden = useCallback(() => hiddenAnchors.current, []);

  const value = useMemo(
    () => ({ path, query, at, send, show, onWatermark, markShell, context, onCore, hidden }),
    [path, query, at, send, show, onWatermark, markShell, context, onCore, hidden],
  );
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}
