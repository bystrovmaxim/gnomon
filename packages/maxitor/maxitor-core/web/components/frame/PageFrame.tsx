// packages/maxitor/maxitor-core/web/components/frame/PageFrame.tsx
// A page in the right panel's transparent frame, and the core's side of the panel protocol (spec 077, FR-019 –
// FR-026). The window's address is the only state: a change the page asks for becomes one history entry there and
// is not sent back; a change the page did not ask for reaches it as panel.location. The frame's own address changes
// only when another owner's page opens.
"use client";

import { changedReserved } from "@maxitor/panel/address";
import { coreMessage, pageMessage, trusted, type CoreMessage, type Query } from "@maxitor/panel/protocol";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { queryString, windowAddress, type PanelAddress } from "@/lib/address";

/** How long a page may take to say panel.ready before the panel says it does not answer. */
const READY_MS = 15000;
/** How often the frame asks whether "now" moved, for a page without a moment. */
const WATERMARK_MS = 5000;

type State = "waiting" | "ready" | "silent";

/** A page without the shell is marked on the local stand and in development; elsewhere it is only logged. */
const MARK_UNFRAMED = process.env.NEXT_PUBLIC_MAXITOR_MARK_UNFRAMED === "1" || process.env.NODE_ENV !== "production";

/**
 * What a page may not ask the window's address for (spec 078, FR-012): a change of the core's names, and a parameter
 * named like one of the open node's path parameters. Empty when the request may go on.
 */
export function refusedNames(next: Query, current: Query, pathNames: readonly string[]): string[] {
  const path = new Set(pathNames.map((name) => name.toLowerCase()));
  return [...changedReserved(next, current), ...Object.keys(next).filter((name) => path.has(name.toLowerCase()))];
}

/** The key of what a page shows: its path, parameters and moment. */
function keyOf(path: string, query: Record<string, string>, at: string | null): string {
  return `${path}${queryString(query, at)}`;
}

export function PageFrame({
  code,
  address,
  owner,
  base,
  title,
  canOpen,
  pathNames = [],
  onTitle,
}: {
  code: string;
  address: PanelAddress;
  /** The page's owner in the window's address: a plugin's name, or core for the core's test page. */
  owner: string;
  /** Where the page itself is served, before its path: /p/<name>/<organization>, or the core's test page. */
  base: string;
  title: string;
  /** Whether the page may open a page of this owner: the core and its plugin's direct dependencies. */
  canOpen: (owner: string) => boolean;
  /** The open node's path parameters: a page may not put them in its query. */
  pathNames?: readonly string[];
  onTitle: (title: string | null) => void;
}) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<State>("waiting");
  const [attempt, setAttempt] = useState(0);
  const [unframed, setUnframed] = useState(false);
  // The address the frame was opened at: it changes only when the owner does, or on Try again.
  const [src] = useState(() => `${base}${address.path === "/" ? "" : address.path}${queryString(address.query, address.at)}`);
  // What the page shows now: what it asked for, or what it was last told.
  const shown = useRef(keyOf(address.path, address.query, address.at));
  const watermark = useRef<string | null>(null);
  // What the page holds but its filters leave out: a pointer at one of them is shown as hidden (spec 081, FR-013).
  const hiddenAnchors = useRef<ReadonlySet<string>>(new Set());
  const [hidden, setHidden] = useState(0);

  const tell = useCallback((message: CoreMessage) => {
    frame.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  // The window's address changed: tell the page, unless it is what the page itself asked for.
  const current = useMemo(() => keyOf(address.path, address.query, address.at), [address]);
  useEffect(() => {
    if (state !== "ready" || current === shown.current) return;
    shown.current = current;
    tell({ type: "panel.location", path: address.path, query: address.query, at: address.at });
  }, [address, current, state, tell]);

  // The page's messages: only from this origin and this frame, and only of a known shape.
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!trusted(event, frame.current?.contentWindow)) return;
      const message = pageMessage(event.data);
      if (!message) return;
      if (message.type === "panel.ready") {
        setState("ready");
        setUnframed(!message.shell);
        if (!message.shell) console.warn(`Maxitor: the page ${address.path} of ${owner} has no Maxitor frame: it does not render the shell of @maxitor/panel`);
      }
      else if (message.type === "panel.title") onTitle(message.text);
      else if (message.type === "panel.hidden") {
        hiddenAnchors.current = new Set(message.anchors);
        setHidden(message.anchors.length);
      }
      else if (message.type === "panel.navigate") {
        const refused = refusedNames(message.query, address.query, pathNames);
        if (refused.length) {
          console.error(`Maxitor: the page of ${owner} may not write ${refused.map((name) => JSON.stringify(name)).join(", ")}; the address is unchanged`);
          return;
        }
        shown.current = keyOf(message.path, message.query, address.at);
        const href = windowAddress(code, owner, message.path, message.query, address.at);
        if (message.mode === "push") router.push(href, { scroll: false });
        else router.replace(href, { scroll: false });
      } else if (message.type === "panel.open" && canOpen(message.owner) && changedReserved(message.query, {}).length === 0) {
        router.push(windowAddress(code, message.owner, message.path, message.query, address.at));
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [address.at, address.path, address.query, canOpen, code, onTitle, owner, pathNames, router]);

  // A page that never says it is ready is shown as not answering.
  useEffect(() => {
    if (state !== "waiting") return;
    const timer = window.setTimeout(() => setState("silent"), READY_MS);
    return () => window.clearTimeout(timer);
  }, [state, attempt]);

  // "Now" moved: a page without a moment reads its data again.
  useEffect(() => {
    if (state !== "ready" || address.at) return;
    let stopped = false;
    const ask = async () => {
      try {
        const answer = await fetch(`/api/v1/organizations/${encodeURIComponent(code)}/watermark`, { cache: "no-store" });
        if (!answer.ok || stopped) return;
        const { at } = (await answer.json()) as { at: string | null };
        if (at && watermark.current !== null && at !== watermark.current) tell({ type: "panel.watermark", at });
        watermark.current = at ?? watermark.current ?? "";
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
  }, [address.at, code, state, tell]);

  return (
    <>
      <iframe
        key={attempt}
        ref={frame}
        className={`mx-panel-frame${state === "ready" ? "" : " waiting"}`}
        title={title}
        src={src}
        data-hidden={hidden}
      />
      {unframed && MARK_UNFRAMED ? (
        <div className="mx-unframed" role="alert">This page has no Maxitor frame</div>
      ) : null}
      {state === "silent" ? (
        <div className="mx-panel-note" role="alert">
          <b>This page does not answer</b>
          It did not open in time. The rest of Maxitor works.
          <br />
          <button type="button" onClick={() => { setState("waiting"); setAttempt((n) => n + 1); }}>Try again</button>
        </div>
      ) : null}
    </>
  );
}
