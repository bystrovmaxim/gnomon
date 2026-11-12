// packages/maxitor/maxitor-core/web/components/frame/PageFrame.tsx
// A page in the right panel's transparent frame, and the core's side of the panel protocol (spec 077, FR-019 –
// FR-026). The window's address is the only state: a change the page asks for becomes one history entry there and
// is not sent back; a change the page did not ask for reaches it as panel.location. The frame's own address changes
// only when another owner's page opens.
"use client";

import { changedReserved } from "@maxitor/panel/address";
import { checkHistory, NO_HISTORY, pageMessage, trusted, type CoreMessage, type HistoryAllowed, type MomentContext, type PageHistory, type PageMessage, type Query } from "@maxitor/panel/protocol";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useScale } from "@/components/scale/bridge";
import { queryString, windowAddress, type PanelAddress } from "@/lib/address";

/** How long a page may take to say panel.ready before the panel says it does not answer. */
const READY_MS = 15000;

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

/** The core's names of a page's context in its frame's address, so a reload keeps it. */
function contextQuery(query: Record<string, string>, context: MomentContext): Record<string, string> {
  return {
    ...query,
    ...(context.against ? { _against: context.against } : {}),
    ...(context.side ? { _side: context.side } : {}),
    ...(context.milestone ? { _milestone: context.milestone } : {}),
  };
}

/** The key of what a page shows: its path, parameters, moment and context. */
function keyOf(path: string, query: Record<string, string>, context: MomentContext): string {
  return `${path}${queryString(contextQuery(query, context), context.at)}`;
}

export function PageFrame({
  code,
  address,
  owner,
  base,
  title,
  canOpen,
  pathNames = [],
  historyAllowed = { actions: [], compare: [] },
  onTitle,
  context: given,
  onMessage,
  connect,
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
  /** The plugin version's actions and its passport's comparisons: what a page's history is checked against. */
  historyAllowed?: HistoryAllowed;
  onTitle: (title: string | null) => void;
  /** The page's moment and what it is compared with; the window's moment alone when absent. */
  context?: MomentContext;
  /** The page's messages of anchors and counts, for the panels around it. */
  onMessage?: (message: PageMessage) => void;
  /** Lets the panels around send the page the core's messages of anchors and steps. */
  connect?: (tell: (message: CoreMessage) => void) => () => void;
}) {
  const context = useMemo<MomentContext>(() => given ?? { at: address.at, against: null, side: null, milestone: null }, [address.at, given]);
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<State>("waiting");
  const [attempt, setAttempt] = useState(0);
  const [unframed, setUnframed] = useState(false);
  // The address the frame was opened at: it changes only when the owner does, or on Try again.
  const [src] = useState(() => `${base}${address.path === "/" ? "" : address.path}${queryString(contextQuery(address.query, context), context.at)}`);
  // What the page shows now: what it asked for, or what it was last told.
  const shown = useRef(keyOf(address.path, address.query, context));
  const scale = useScale();
  // The watermark the page last read at: a page at now is told when it moves past it.
  const told = useRef<string | null>(null);
  // What the page holds but its filters leave out: a pointer at one of them is shown as hidden (spec 081, FR-013).
  const hiddenAnchors = useRef<ReadonlySet<string>>(new Set());
  const [hidden, setHidden] = useState(0);
  // The open page's history, as the page last gave it and the core's check kept it; one moment only until it gives one.
  const [history, setHistory] = useState<PageHistory>(NO_HISTORY);
  // The frame enters the document only after the core's page is hydrated: a frame in the server's HTML starts loading
  // before the core listens, and a fast page's panel.ready would reach nobody.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const tell = useCallback((message: CoreMessage) => {
    frame.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  // The window's address or the page's context changed: tell the page, unless it is what the page itself asked for.
  const current = useMemo(() => keyOf(address.path, address.query, context), [address, context]);
  useEffect(() => {
    if (state !== "ready" || current === shown.current) return;
    shown.current = current;
    tell({ type: "panel.location", path: address.path, query: address.query, ...context });
  }, [address, context, current, state, tell]);

  // The panels around send the page the core's messages of anchors and steps once it is ready.
  useEffect(() => {
    if (state !== "ready" || !connect) return;
    return connect(tell);
  }, [connect, state, tell]);

  // The page's messages: only from this origin and this frame, and only of a known shape. The listener is set in the
  // same commit that puts the frame in the document — a layout effect, before any task can run — so a page that loads
  // fast says panel.ready to a listener already there, never to nobody while a busy screen still renders.
  useLayoutEffect(() => {
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
      else if (message.type === "panel.history") {
        const { kept, refused } = checkHistory(message.history, historyAllowed);
        for (const reason of refused) {
          const text = `Maxitor: the page ${address.path} of ${owner}: its history ${reason}; the rest is kept`;
          if (process.env.NODE_ENV === "production") console.warn(text);
          else console.error(text);
        }
        setHistory(kept);
        scale.giveHistory(kept);
      } else if (message.type === "panel.keys") scale.pressed(message.key);
      else if (message.type === "panel.pointer" || message.type === "panel.choose" || message.type === "panel.shown" || message.type === "panel.counts") onMessage?.(message);
      else if (message.type === "panel.now") {
        // Now, one moment: the moment and a comparison's names leave the address; the page's own parameters stay.
        const { mode: _mode, from: _from, ...rest } = address.query;
        router.push(windowAddress(code, owner, address.path, rest, null), { scroll: false });
      }
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
        shown.current = keyOf(message.path, message.query, context);
        const href = windowAddress(code, owner, message.path, message.query, address.at);
        if (message.mode === "push") router.push(href, { scroll: false });
        else router.replace(href, { scroll: false });
      } else if (message.type === "panel.open" && canOpen(message.owner) && changedReserved(message.query, {}).length === 0) {
        router.push(windowAddress(code, message.owner, message.path, message.query, address.at));
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [address.at, address.path, address.query, canOpen, code, context, historyAllowed, onMessage, onTitle, owner, pathNames, router, scale]);

  // A page that never says it is ready is shown as not answering.
  useEffect(() => {
    if (state !== "waiting") return;
    const timer = window.setTimeout(() => setState("silent"), READY_MS);
    return () => window.clearTimeout(timer);
  }, [state, attempt]);

  // "Now" moved: a page without a moment reads its data again; a page in the past is not told.
  const { watermark } = scale;
  useEffect(() => {
    if (state !== "ready" || context.at || !watermark) return;
    if (told.current !== null && watermark !== told.current) tell({ type: "panel.watermark", at: watermark });
    told.current = watermark;
  }, [context.at, state, tell, watermark]);

  return (
    <>
      {hydrated ? <iframe
        key={attempt}
        ref={frame}
        className={`mx-panel-frame${state === "ready" ? "" : " waiting"}`}
        title={title}
        src={src}
        data-hidden={hidden}
        data-history={JSON.stringify(history)}
      /> : null}
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
