// @maxitor/panel — the page's side of the panel protocol. It sends panel.ready once the page is mounted, rebuilds the
// page from panel.location without answering it, and hands panel.watermark to the page. The page's own frame
// address is only ever replaced: the history entry lives in the window's address, which the core keeps.
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

import { coreMessage, trusted, type PageMessage, type Query } from "./protocol";

type Panel = {
  /** The page's path inside its owner, without the organization: "/items/4f1c". */
  path: string;
  query: Query;
  at: string | null;
  send: (message: PageMessage) => void;
  /** Replace the frame's own address with a page path and its parameters; never a history entry. */
  show: (path: string, query: Query, at: string | null) => void;
  onWatermark: (listener: (at: string) => void) => () => void;
};

const PanelContext = createContext<Panel | null>(null);

export function usePanel(): Panel {
  const panel = useContext(PanelContext);
  if (!panel) throw new Error("@maxitor/panel: a page of the panel is drawn inside PanelDocument");
  return panel;
}

function search(query: Query, at: string | null): string {
  const params = new URLSearchParams(query);
  if (at) params.set("at", at);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function PanelProvider({
  build,
  surface,
  prefixSegments,
  children,
}: {
  build: string;
  surface: "document" | "canvas";
  /** How many segments of the route stand before the page's path: the organization, for a plugin. */
  prefixSegments: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const listeners = useRef(new Set<(at: string) => void>());

  const segments = pathname.split("/").filter(Boolean);
  const prefix = `/${segments.slice(0, prefixSegments).join("/")}`;
  const path = `/${segments.slice(prefixSegments).join("/")}`;
  const query = useMemo(() => {
    const found: Query = {};
    params.forEach((value, name) => {
      if (name !== "at") found[name] = value;
    });
    return found;
  }, [params]);
  const at = params.get("at");

  const send = useCallback((message: PageMessage) => {
    if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
  }, []);

  const show = useCallback(
    (to: string, values: Query, moment: string | null) => router.replace(`${prefix}${to === "/" ? "" : to}${search(values, moment)}`, { scroll: false }),
    [prefix, router],
  );

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!trusted(event, window.parent)) return;
      const message = coreMessage(event.data);
      if (!message) return;
      // The address changed by Back, the tree, a control or the moment: rebuild from it, and say nothing back.
      if (message.type === "panel.location") show(message.path, message.query, message.at);
      else listeners.current.forEach((listener) => listener(message.at));
    };
    window.addEventListener("message", receive);
    send({ type: "panel.ready", build, surface });
    return () => window.removeEventListener("message", receive);
  }, [build, send, show, surface]);

  const onWatermark = useCallback((listener: (at: string) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(() => ({ path, query, at, send, show, onWatermark }), [path, query, at, send, show, onWatermark]);
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}
