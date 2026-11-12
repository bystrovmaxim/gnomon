// packages/maxitor/maxitor-core/web/components/frame/Frame.tsx
// The frame every plugin lives in (specs 077 and 085): the top row, the tree on the left and the right panel. It stays
// mounted while the address changes, so the tree keeps what was expanded and its scroll; what the panel shows comes
// from the address alone. The left panel shows one level at a time — the children of the entered node at its head, or
// the tree's root — and the address decides the levels it arrives at: every entered node on the line of the open page.
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import "./frame.css";
import { Panel } from "@/components/frame/Panel";
import { TopRow } from "@/components/frame/TopRow";
import { Tree, type Level } from "@/components/frame/Tree";
import { TreeHead } from "@/components/frame/TreeHead";
import { ScaleContext, useWatermark, type Mode, type ScaleBridge } from "@/components/scale/bridge";
import { fixtureSource } from "@/components/scale/fixtures";
import { Scale } from "@/components/scale/Scale";
import { gatewaySource } from "@/components/scale/source";
import { queryString, readAddress, windowAddress } from "@/lib/address";
import { canStep, momentOf, MOMENT_TEXT, msOf, stepMoment } from "@/lib/moment";
import { changeStepOfKey, stepOfKey } from "@maxitor/panel/keys";
import type { Milestone } from "@maxitor/panel/history";
import type { HistoryAllowed, PageHistory, StepKeyName } from "@maxitor/panel/protocol";

import type { Me } from "@/lib/core";
import { crumbsOf, levelAbove } from "@/lib/levels";
import { enteredLine, nodeOf, pathOf, type TreeNode } from "@/lib/tree";

export function Frame({
  account,
  current,
  nodes,
  owners,
  dependencies,
  histories,
  children,
}: {
  account: Me;
  current: { code: string; name: string };
  nodes: TreeNode[];
  /** The organization's enabled plugins in dependency order. */
  owners: string[];
  /** Each enabled plugin's direct dependencies. */
  dependencies: Record<string, string[]>;
  /** Each enabled plugin's history actions and comparisons: what its pages' histories are checked against. */
  histories: Record<string, HistoryAllowed>;
  /** The core's own page for the address, drawn in the panel; nothing for a plugin's page. */
  children: ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  // Collapsed lives only in this visit: a new visit opens the tree expanded.
  const [collapsed, setCollapsed] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const keepTitles = useCallback((found: Record<string, string>) => setTitles((was) => ({ ...was, ...found })), []);
  // The levels of the left panel, the root first and the deepest last (spec 085). Back pops one, a crumb pops to its
  // own, entering pushes one; the address rebuilds them whenever it changes.
  const [levels, setLevels] = useState<Level[]>([]);
  // What was expanded lives here, in the page's memory: a level keeps it, Back keeps it, a reload does not.
  const [arrived, setArrived] = useState<string | null>(null);
  // After linking a way in, the address asks to open the sign-in methods dialog with its notice.
  const methods = search.get("methods");

  const address = useMemo(() => readAddress(pathname, search), [pathname, search]);
  const opened = useMemo(() => (address?.owner ? nodeOf(nodes, address.owner, address.path) : null), [address, nodes]);
  // A page's title belongs to the page it came from.
  useEffect(() => setTitle(null), [opened?.node.name]);

  // An address arrives: the panel enters every entered node on the line of its page, the deepest last (spec 085,
  // FR-013). What was expanded in them is not rebuilt — it was never in the address.
  const arrival = `${pathname}?${search.toString()}`;
  useEffect(() => {
    if (arrived === arrival) return;
    if (!opened) {
      setArrived(arrival);
      setLevels([]);
      return;
    }
    const scope = opened.scope;
    setLevels(
      enteredLine(nodes, opened.node).map((node) => ({
        node,
        scope,
        title: levelTitle(node, scope, titles),
      })),
    );
    setArrived(arrival);
  }, [arrival, arrived, nodes, opened, titles]);

  const enter = useCallback(
    (node: TreeNode, scope: Record<string, string>, label: string) => {
      setLevels((was) => {
        const at = was.findIndex((level) => level.node.name === node.name);
        return at >= 0 ? was.slice(0, at + 1) : [...was, { node, scope, title: label || node.title || node.name }];
      });
    },
    [],
  );


  // The entered levels on the line of the open page, the deepest last: what the crumbs name. They follow the page,
  // not where the panel stands, so entering Settings while a note's page is open never names Settings over it.
  const pageLevels = useMemo<Level[]>(
    () => (opened ? enteredLine(nodes, opened.node).map((node) => ({ node, scope: opened.scope, title: levelTitle(node, opened.scope, titles) })) : []),
    [nodes, opened, titles],
  );
  // The address of a level (spec 079, FR-041): the page of its entered node, or the organization's home for the root.
  // A level whose node has no page has no address of its own: stepping to it changes the panel alone.
  const home = `/w/${encodeURIComponent(current.code)}`;
  const levelAddress = useCallback(
    (level: Level | null): string | null => {
      if (!level) return home;
      const path = pathOf(level.node, level.scope);
      return path === null ? null : windowAddress(current.code, level.node.owner, path, {}, address?.at ?? null);
    },
    [address?.at, current.code, home],
  );

  // Back steps out of the deepest section entered, through the address, so the tree, the crumbs, the address and the
  // page show the same place; at the root there is no level above, and Back is not drawn.
  const back = levels.length
    ? () => {
        const target = levelAddress(levelAbove(levels));
        setLevels((was) => was.slice(0, -1));
        if (target) router.push(target);
      }
    : null;

  // A crumb steps out to its section the same way: the panel to that level, the address to its page.
  const stepTo = useCallback(
    (index: number) => {
      const line = opened ? pageLevels : levels;
      setLevels(line.slice(0, index + 1));
      const target = levelAddress(line[index] ?? null);
      if (target) router.push(target);
    },
    [levelAddress, levels, opened, pageLevels, router],
  );

  // The crumbs of the top row (spec 079, FR-040): the sections entered, the deepest last, after the organization at the
  // head of the row. A page opened inside a section adds nothing; only a node that opens a section of its own does.
  const path = useMemo(() => crumbsOf(opened ? pageLevels : levels), [levels, opened, pageLevels]);

  // Another organization opens the same page, or its root when the page is not there: the tree decides there.
  const switchTo = (code: string) => (address?.owner ? windowAddress(code, address.owner, address.path, address.query, address.at) : `/w/${code}`);

  // The moment of the whole screen (spec 079, FR-002): the address's `at`, "now" the organization's watermark. A choice
  // on the scale is one history entry of the window's address; the open page is told by panel.location.
  const watermark = useWatermark(current.code);
  const [history, setHistory] = useState<PageHistory | null>(null);
  const at = address?.at ?? null;
  // The moments of the page's changes the arrows step through: its milestones, or its bars (spec 079, FR-005).
  const [changes, setChanges] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  // A comparison (spec 079, FR-018): `mode` and `from` beside `at` in the address; a mode the page does not offer opens
  // `at` as one moment.
  const offered = useMemo(() => (history?.compare ?? []) as Mode[], [history]);
  const asked = address?.query.mode;
  const from = address?.query.from && MOMENT_TEXT.test(address.query.from) ? address.query.from : null;
  // Until the page says what it offers, the address's mode is taken as it is; the page's answer then narrows it.
  const mode: Mode = (asked === "diff" || asked === "side_by_side") && from && (history === null || offered.includes(asked)) ? asked : "one";
  // Another page gives its own history: the last one leaves the scale when the page changes, not when a panel closes.
  const pageKey = `${address?.owner ?? ""}${address?.path ?? ""}`;
  useEffect(() => setHistory(null), [pageKey]);
  const go = useCallback(
    (query: Record<string, string>, moment: string | null) => {
      if (address?.owner) router.push(windowAddress(current.code, address.owner, address.path, query, moment), { scroll: false });
      else router.push(`${home}${queryString(query, moment)}`, { scroll: false });
    },
    [address, current.code, home, router],
  );
  const choose = useCallback((moment: string | null) => go(address?.query ?? {}, moment), [address?.query, go]);
  const chooseRange = useCallback(
    (range: { from: string; at: string | null }) => go({ ...(address?.query ?? {}), from: range.from }, range.at),
    [address?.query, go],
  );
  const changeMode = useCallback(
    (next: Mode) => {
      const { mode: _mode, from: _from, ...rest } = address?.query ?? {};
      if (next === "one" || !watermark) return go(rest, at);
      // A starts at the change before B, or a day before it.
      const before = stepMoment(changes, at, watermark, -1);
      const a = from ?? (typeof before === "string" ? before : momentOf(msOf(at ?? watermark) - 24 * 3600_000));
      go({ ...rest, mode: next, from: a }, at);
    },
    [address?.query, at, changes, from, go, watermark],
  );
  const step = useCallback(
    (delta: -1 | 1) => {
      if (!watermark) return;
      const next = stepMoment(changes, at, watermark, delta);
      if (next === undefined) return;
      if (mode === "one" || !from) return choose(next);
      // With two compared, both move and keep their distance.
      const shift = msOf(next ?? watermark) - msOf(at ?? watermark);
      chooseRange({ from: momentOf(msOf(from) + shift), at: next });
    },
    [at, changes, choose, chooseRange, from, mode, watermark],
  );
  // Shift + ↑ ↓ step a comparison's changes: the panels pass them to the page that draws them.
  const stepper = useRef<((delta: -1 | 1) => void) | null>(null);
  const connectStepper = useCallback((next: (delta: -1 | 1) => void) => {
    stepper.current = next;
    return () => {
      if (stepper.current === next) stepper.current = null;
    };
  }, []);
  // Shift + arrows with the focus in the frame; pressed in the page, they come by panel.keys.
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      const delta = stepOfKey(event);
      const change = changeStepOfKey(event);
      if (delta !== null) step(delta);
      else if (change !== null && mode !== "one") stepper.current?.(change);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, [mode, step]);
  const [counts, setCounts] = useState<{ added: number; removed: number; changed: number } | null>(null);
  const milestoneOn = useCallback((moment: string | null) => (moment ? milestones.find((each) => each.at === moment)?.id ?? null : null), [milestones]);
  const bridge = useMemo<ScaleBridge>(
    () => ({
      watermark,
      giveHistory: setHistory,
      pressed: (key: StepKeyName) => {
        if (key === "ArrowLeft") step(-1);
        else if (key === "ArrowRight") step(1);
        else if (mode !== "one") stepper.current?.(key === "ArrowUp" ? -1 : 1);
      },
      moment: { at, mode, from },
      milestoneOn,
      counts: setCounts,
      connectStepper,
    }),
    [at, connectStepper, from, milestoneOn, mode, step, watermark],
  );
  // Where the scale reads the open page's history: the plugin's history actions through the gateway, with the node's
  // path parameters and the page's own; the core's test page from its fixtures. The page's filters are part of it.
  // The test page's fixtures are laid back from the watermark, so they follow it; a plugin's source needs only to know
  // that the watermark was read, so its cards and bars are kept while "now" moves.
  const queryKey = JSON.stringify(address?.query ?? {});
  const sourceNow = address?.owner === "core" ? watermark : watermark === null ? null : "read";
  const source = useMemo(() => {
    if (!history || !address?.owner || !watermark) return null;
    if (address.owner === "core") return fixtureSource(history, watermark);
    return gatewaySource(address.owner, current.code, history, opened?.scope ?? {}, JSON.parse(queryKey) as Record<string, string>);
  }, [address?.owner, current.code, history, opened?.scope, queryKey, sourceNow]);
  const milestone = useCallback(
    (chosen: Milestone) => {
      const opens = chosen.opens ?? chosen.link;
      if (opens && address?.owner) router.push(windowAddress(current.code, address.owner, opens, {}, at), { scroll: false });
      else choose(chosen.at);
    },
    [address?.owner, at, choose, current.code, router],
  );
  const scaleTitle = title || opened?.node.title || opened?.node.name || current.name;
  const moment = (
    <Scale
      at={at}
      watermark={watermark}
      title={scaleTitle}
      page={address?.path ?? "/"}
      history={history}
      source={source}
      mode={mode}
      from={from}
      counts={mode === "one" ? null : counts}
      canStep={watermark ? canStep(changes, at, watermark) : { older: false, newer: at !== null }}
      onStep={step}
      onChoose={choose}
      onRange={chooseRange}
      onMode={offered.length ? changeMode : null}
      onMilestone={milestone}
      onChanges={setChanges}
      onMilestones={setMilestones}
    />
  );

  const level = levels.length ? levels[levels.length - 1] : null;
  const tree = (
    <Tree
      code={current.code}
      nodes={nodes}
      owners={owners}
      at={address?.at ?? null}
      level={level}
      selected={opened}
      onEnter={enter}
      onChosen={() => setDrawer(false)}
      onTitles={keepTitles}
    />
  );

  return (
    <ScaleContext.Provider value={bridge}>
    <div className="mx-frame">
      <TopRow account={account} current={current} path={path} onCrumb={stepTo} methods={methods} switchTo={switchTo} onMenu={() => setDrawer(true)} moment={moment} />
      <div className="mx-body">
        <aside className={`mx-tree${collapsed ? " collapsed" : ""}`}>
          <TreeHead collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} onBack={back} />
          {collapsed ? null : tree}
        </aside>
        <Panel code={current.code} address={address} opened={opened} dependencies={dependencies} histories={histories} onTitle={setTitle}>
          {children}
        </Panel>
        {drawer ? (
          <>
            <div className="mx-scrim" onClick={() => setDrawer(false)} />
            <aside className="mx-tree drawer">
              <TreeHead collapsed={null} onCollapse={() => undefined} onBack={back} />
              {tree}
            </aside>
          </>
        ) : null}
      </div>
    </div>
    </ScaleContext.Provider>
  );
}

/** The title of a level: a node's own, an instance's from the list it came from, or its name when it has none. */
function levelTitle(node: TreeNode, scope: Record<string, string>, titles: Record<string, string>): string {
  if (!node.each) return node.title || node.name;
  const key = scope[node.each.key] ?? "";
  return titles[`${node.name}=${key}`] || key || node.name;
}
