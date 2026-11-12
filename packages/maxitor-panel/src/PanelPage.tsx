// @maxitor/panel — the shell of every page (spec 078): a page gives it what it offers now — filters, layer pills,
// the bottom bar's sections and its actions — as data, and the shell draws them in the same places and with the same
// look for every plugin, writing each value into the panel address. The page's content gets a field of its own;
// on a document page it is padded clear of the controls, on a canvas the fitted scene is kept clear of them.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { PHONE_MEDIA } from "@maxitor/tokens";

import { usePanelQuery, usePanelRouter } from "./hooks";
import { usePanel } from "./PanelProvider";
import { NO_HISTORY } from "./protocol";
import { Actions } from "./shell/Actions";
import { actionsShown, isMissing, LAYER, milestoneActions, withParam } from "./shell/address";
import { BottomBar } from "./shell/BottomBar";
import { Filters } from "./shell/Filters";
import { Layers } from "./shell/Layers";
import { ShellContext, type Reserve, type Shell, type Zoom } from "./shell/ShellContext";
import type { BarSection, FilterSection, Layers as LayersInput, PageAction } from "./shell/types";
import type { MilestoneAction, PageHistory } from "./protocol";
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
  history,
  stepper,
  onMilestoneAction,
  children,
}: {
  title: string;
  filters?: FilterSection[];
  layers?: LayersInput;
  bar?: BarSection[];
  actions?: PageAction[];
  /** How the page answers the core's time scale; without it the page is offered one moment only (spec 082). */
  history?: PageHistory;
  /** In a comparison, the page's ChangeStepper: it stands first in the row of actions (spec 079, FR-027). */
  stepper?: ReactNode;
  /** An action of the history's `actions` chosen on the milestone the moment stands on exactly. */
  onMilestoneAction?: (action: MilestoneAction, milestone: string) => void;
  children: ReactNode;
}) {
  const { send, markShell, context } = usePanel();
  // The provider sends panel.ready after its children mounted: it says then that this page renders the shell.
  markShell();
  useEffect(() => send({ type: "panel.title", text: title }), [send, title]);
  // The page gives its history when it opens and whenever it gives a new one; the core keeps only the last. A page
  // without one says so — no comparison —, or the core would keep a comparison the address carried from another page.
  const historyKey = JSON.stringify(history ?? null);
  useEffect(() => {
    send({ type: "panel.history", history: history ?? NO_HISTORY });
  }, [historyKey, send]);

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
        const filters = root?.querySelector('[data-shell="filters"]') ?? null;
        // On a phone the filters fold into one button at the top: they take the top, not the left.
        const phone = window.matchMedia(PHONE_MEDIA).matches;
        // On a phone the page's actions stand at the bottom, beside the bar: they take the bottom, not the top.
        const actions = root?.querySelector('[data-shell="actions"]') ?? null;
        return {
          left: phone ? 0 : edge(filters, "right"),
          top: Math.max(
            phone ? edge(filters, "bottom") : 0,
            edge(root?.querySelector('[data-shell="layers"]') ?? null, "bottom"),
            phone ? 0 : edge(actions, "bottom"),
          ),
          bottom: Math.max(edge(root?.querySelector('[data-shell="bar"]') ?? null, "top"), phone ? edge(actions, "top") : 0),
        };
      },
    }),
    [],
  );

  // At now the page's actions; exactly on a milestone, outside a comparison, the actions it offers there — "Roll back to
  // v3" —; in a comparison the stepper alone.
  const onMilestone: PageAction[] = onMilestoneAction
    ? milestoneActions(history?.actions ?? [], context).map(({ title, action, milestone }) => ({ title, onClick: () => onMilestoneAction(action, milestone) }))
    : [];
  const shownActions = [...(actionsShown(own, at) ? actions : []), ...onMilestone];
  const comparing = context.against !== null;
  const showActions = shownActions.length > 0 || (comparing && Boolean(stepper));
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
        {showActions ? <Actions actions={comparing ? [] : shownActions} stepper={comparing ? stepper : undefined} /> : null}
      </div>
    </ShellContext.Provider>
  );
}
