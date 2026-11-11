// @maxitor/panel — the shell of every page (spec 078): a page gives it what it offers now — filters, layer pills,
// the bottom bar's sections and its actions — as data, and the shell draws them in the same places and with the same
// look for every plugin, writing each value into the panel address. The page's content gets a field of its own;
// on a document page it is padded clear of the controls, on a canvas the fitted scene is kept clear of them.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { usePanelQuery, usePanelRouter } from "./hooks";
import { usePanel } from "./PanelProvider";
import { Actions } from "./shell/Actions";
import { actionsShown, isMissing, LAYER, withParam } from "./shell/address";
import { BottomBar } from "./shell/BottomBar";
import { Filters } from "./shell/Filters";
import { Layers } from "./shell/Layers";
import { ShellContext, type Reserve, type Shell, type Zoom } from "./shell/ShellContext";
import type { BarSection, FilterSection, Layers as LayersInput, PageAction } from "./shell/types";
import "./shell/shell.css";

/** The edge an element takes from the panel's side, or 0 when it is not drawn. */
function edge(element: Element | null, side: "right" | "bottom" | "top"): number {
  if (!element) return 0;
  const box = element.getBoundingClientRect();
  if (side === "right") return box.right;
  if (side === "bottom") return box.bottom;
  return window.innerHeight - box.top;
}

export function PanelPage({
  title,
  filters = [],
  layers,
  bar = [],
  actions = [],
  children,
}: {
  title: string;
  filters?: FilterSection[];
  layers?: LayersInput;
  bar?: BarSection[];
  actions?: PageAction[];
  children: ReactNode;
}) {
  const { send, markShell } = usePanel();
  // The provider sends panel.ready after its children mounted: it says then that this page renders the shell.
  markShell();
  useEffect(() => send({ type: "panel.title", text: title }), [send, title]);

  const query = usePanelQuery();
  const { at, ...own } = query;
  const router = usePanelRouter();
  const write = useCallback((name: string, value: string | null) => router.push({ query: withParam(own, name, value) }), [own, router]);

  // A layer or a choice the page no longer offers gives way to its default, once and in place, so Back does not
  // return to a value that is gone.
  const choices = useMemo(() => {
    const found: { param: string; options: string[] }[] = bar.flatMap((section) => (section.kind === "choice" ? [{ param: section.param, options: section.options.map((o) => o.value) }] : []));
    if (layers) found.push({ param: LAYER, options: layers.options.map((o) => o.value) });
    return found;
  }, [bar, layers]);
  const gone = choices.filter((choice) => isMissing(own[choice.param], choice.options)).map((choice) => choice.param);
  useEffect(() => {
    if (gone.length === 0) return;
    let next = own;
    for (const param of gone) next = withParam(next, param, null);
    router.replace({ query: next });
  }, [gone.join(",")]);

  const [zoom, setZoom] = useState<Zoom | null>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const shell = useMemo<Shell>(
    () => ({
      setZoom,
      reserve: (): Reserve => {
        const root = filtersRef.current;
        return {
          left: edge(root?.querySelector('[data-shell="filters"]') ?? null, "right"),
          top: Math.max(edge(root?.querySelector('[data-shell="layers"]') ?? null, "bottom"), edge(root?.querySelector('[data-shell="actions"]') ?? null, "bottom")),
          bottom: edge(root?.querySelector('[data-shell="bar"]') ?? null, "top"),
        };
      },
    }),
    [],
  );

  const showActions = actions.length > 0 && actionsShown(own, at);
  const content = [
    "mx-shell-content",
    zoom ? "canvas" : "document",
    filters.length ? "with-filters" : "",
    layers || showActions ? "with-top" : "",
    zoom || bar.length ? "with-bar" : "",
  ].filter(Boolean).join(" ");

  return (
    <ShellContext.Provider value={shell}>
      <div className="mx-shell" ref={filtersRef}>
        <div className={content}>{children}</div>
        {filters.length ? <Filters sections={filters} query={own} write={write} /> : null}
        {layers ? <Layers layers={layers} query={own} write={write} /> : null}
        <BottomBar zoom={zoom} sections={bar} query={own} write={write} />
        {showActions ? <Actions actions={actions} /> : null}
      </div>
    </ShellContext.Provider>
  );
}
