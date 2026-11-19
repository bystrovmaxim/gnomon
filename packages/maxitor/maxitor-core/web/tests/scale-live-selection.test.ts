import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as geometry from "../components/scale/geometry.ts";
import * as cache from "../components/scale/cache.ts";
import * as moment from "../lib/moment.ts";
import * as selection from "../components/scale/selection.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(readFileSync(new URL("../components/scale/Scale.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Render the real Scale and run its effects across prop changes; inspect the actual Track props.
function mount(phone: boolean, mode: string) {
  const hooks: any[] = [];
  let cursor = 0, dirty = false, pending: Array<() => void> = [], tree: any;
  const writes: unknown[] = [];
  const Track = () => null, Pill = () => null;
  const useMemo = (read: () => unknown, dependencies: unknown[]) => {
    const i = cursor++, old = hooks[i];
    if (!old || dependencies.some((value, index) => !Object.is(value, old.dependencies[index]))) {
      hooks[i] = { value: read(), dependencies };
    }
    return hooks[i].value;
  };
  const useEffect = (effect: () => void, dependencies: unknown[]) => {
    const i = cursor++, old = hooks[i];
    if (!old || dependencies.some((value, index) => !Object.is(value, old[index]))) pending.push(effect);
    hooks[i] = dependencies;
  };
  const imports: Record<string, any> = {
    react: {
      useState: (initial: any) => {
        const i = cursor++;
        if (!(i in hooks)) hooks[i] = initial;
        return [hooks[i], (update: any) => {
          const value = typeof update === "function" ? update(hooks[i]) : update;
          if (!Object.is(value, hooks[i])) { hooks[i] = value; dirty = true; }
        }];
      },
      useRef: (value: any) => { const i = cursor++; return hooks[i] ??= { current: value }; },
      useMemo, useCallback: (callback: unknown, dependencies: unknown[]) => useMemo(() => callback, dependencies),
      useEffect, useLayoutEffect: useEffect,
    },
    "./scale.css": {}, "./selection": selection,
    "@maxitor/tokens": { PHONE_MEDIA: "(max-width: 640px)" },
    "@maxitor/panel/history": { inForce: () => null },
    "@/components/scale/cache": cache, "@/components/scale/geometry": geometry,
    "@/components/scale/legendRows": { legendOf: () => [] },
    "@/components/scale/Pill": { Pill }, "@/components/scale/ScaleCard": { ScaleCard: () => null },
    "@/components/scale/Track": { Track }, "@/lib/moment": moment,
  };
  const exports: any = {};
  runInNewContext(compiled, { exports, require: (id: string) => imports[id] ?? require(id),
    window: { localStorage: { getItem: () => null }, addEventListener() {}, removeEventListener() {},
      matchMedia: () => ({ matches: phone, addEventListener() {}, removeEventListener() {} }) },
    document: { addEventListener() {}, removeEventListener() {} },
    ResizeObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  });
  const props: any = {
    watermark: "2026-11-19T10:00:00.123456Z", from: "2026-11-19T09:00:00.000000Z", at: null,
    mode, history: { compare: ["diff", "side_by_side"] }, source: null, title: "Published", page: "/published",
    counts: null, canStep: { older: true, newer: false },
    onChoose: (...args: unknown[]) => writes.push(args), onRange: (...args: unknown[]) => writes.push(args),
    onChanges() {}, onMilestones() {}, onStep() {}, onMode() {}, onMilestone() {},
  };
  const walk = (node: any, visit: (node: any) => void) => {
    if (Array.isArray(node)) { node.forEach(child => walk(child, visit)); return; }
    if (!node?.props) return;
    visit(node); walk(node.props.children, visit);
  };
  const find = (type: unknown) => { let found: any; walk(tree, node => { if (node.type === type) found = node; }); return found; };
  const render = () => {
    let rounds = 0;
    do {
      dirty = false; cursor = 0; pending = [];
      tree = exports.Scale(props);
      walk(tree, node => {
        if (node.props.className === "mx-card-body") node.props.ref.current = { clientWidth: phone ? 343 : 720 };
      });
      pending.forEach(effect => effect());
      assert.ok(++rounds < 12, "Scale effects did not settle");
    } while (dirty);
    return find(Track)?.props;
  };
  render(); find(Pill).props.onOpen(); render();
  return { props, writes, render, toggle: () => { find(Pill).props.onOpen(); return render(); } };
}

test("desktop and phone comparisons follow live B and retain manual A/B through refresh and reopen", () => {
  for (const phone of [false, true]) {
    for (const mode of ["diff", "side_by_side"]) {
      const screen = mount(phone, mode);
      const initial = screen.render(), a = initial.against;
      assert.equal(initial.shown, Date.parse(screen.props.watermark));
      assert.equal(initial.phone, phone);
      assert.equal(initial.live, true);
      assert.equal(initial.width, phone ? 343 : 720);
      screen.props.watermark = "2026-11-19T10:05:00.654321Z";
      let track = screen.render();
      assert.equal(track.shown, Date.parse(screen.props.watermark), "Live B stayed at the old publication");
      assert.equal(track.against, a, "Refreshing live B moved manually selected A");
      screen.props.at = "2026-11-19T10:00:00.123456Z";
      const chosen = screen.render();
      assert.equal(chosen.live, false, "A manually selected date must not be labelled Now");
      screen.props.watermark = "2026-11-19T10:10:00.999999Z";
      track = screen.render();
      assert.equal(track.shown, chosen.shown, "The fixed B was replaced by Now");
      assert.equal(track.against, a, "The fixed A moved");
      assert.equal(track.now, Date.parse(screen.props.watermark), "History did not receive the new watermark");
      assert.equal(screen.toggle(), undefined, "Closing must unmount the track");
      screen.props.watermark = "2026-11-19T10:15:00.000001Z";
      screen.render();
      track = screen.toggle();
      assert.equal(track.shown, chosen.shown, "Reopening lost the fixed B");
      assert.equal(track.against, a, "Reopening lost the fixed A");
      screen.props.at = null;
      track = screen.render();
      assert.equal(track.shown, track.now, "Returning B to Now must resume following");
      assert.equal(screen.writes.length, 0, "An automatic refresh wrote selected dates into navigation");
    }
  }
});

test("Track labels explicit dates as dates even when both handles coincide with Now", () => {
  const exports: any = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/scale/Track.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const imports: Record<string, any> = {
    react: { useId: () => "refresh", useRef: (current: unknown) => ({ current }),
      useState: (value: unknown) => [value, () => {}], useEffect() {} },
    "@/components/scale/geometry": geometry, "@/components/scale/selection": selection,
    "@/components/scale/Point": {}, "@/components/scale/Tip": {}, "@/lib/moment": moment,
  };
  runInNewContext(code, { exports, require: (id: string) => imports[id] ?? require(id) });
  const now = Date.parse("2026-11-19T10:00:00.123456Z");
  for (const live of [true, false]) for (const against of [null, now]) {
    const labels: string[] = [];
    const tree = exports.Track({ view: { from: now - geometry.HOUR, to: now + 60_000 }, domain: { from: now - geometry.DAY, to: now + geometry.HOUR },
      width: 343, now, shown: now, live, against, phone: true, bars: [], step: 60_000, milestones: null, kinds: {} });
    const walk = (node: any) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node?.props) return;
      if (node.type?.name === "HandleMark") labels.push(node.props.text);
      walk(node.props.children);
    };
    walk(tree);
    const date = moment.momentText(now, now);
    assert.deepEqual(labels, against === null ? [live ? "Now" : date] : [`A ${date}`, `B ${live ? "Now" : date}`]);
  }
});

test("moving one handle preserves the other's exact timestamp and its fixed or live state", () => {
  const screen = mount(true, "diff");
  screen.props.from = "2026-11-19T09:00:23.234567Z";
  for (const at of [screen.props.watermark, null]) {
    screen.props.at = at;
    const track = screen.render();
    track.onChoose(Date.parse("2026-11-19T09:30:00Z"), "a");
    assert.equal((screen.writes.at(-1) as any)[0].at, at, "Moving A changed whether B follows Now");
    track.onChoose(Date.parse("2026-11-19T09:45:00Z"), "b");
    assert.equal((screen.writes.at(-1) as any)[0].from, screen.props.from, "Moving B rounded A's exact publication time");
    track.onChoose(Date.parse("2026-11-19T08:45:00Z"), "b");
    assert.equal((screen.writes.at(-1) as any)[0].at, screen.props.from, "Crossing lost the untouched endpoint's precision");
  }
});

for (const name of ["074-notes-history", "084-notes-draft-published"]) {
  test(`${name}: explicit timestamps at Now keep their date labels`, () => {
    const html = readFileSync(new URL(`../../../../../specs/${name}/mockup/index.html`, import.meta.url), "utf8");
    const start = html.indexOf("  const lab =", html.indexOf("  const handle ="));
    const code = html.slice(start, html.indexOf("\n  if (HV.drag", start));
    for (const at of [null, "1000000"]) for (const h of [{ one: 1000000 }, { a: 1000000, b: 1000000 }]) {
      const labels: string[] = [];
      runInNewContext(code, { h, S: { at }, wm: 1000000, fmt: (s: string) => `date ${s}`, iso: String,
        HT: 41, chipY: 210, s: "", handle: (_time: number, label: string) => { labels.push(label); return ""; } });
      const date = "date 1000000";
      assert.deepEqual(labels, "one" in h ? [at === null ? "Now" : date] : [`A ${date}`, `B ${at === null ? "Now" : date}`]);
    }
  });
  test(`${name}: moving A preserves an explicit B at the watermark`, () => {
    const html = readFileSync(new URL(`../../../../../specs/${name}/mockup/index.html`, import.meta.url), "utf8");
    const start = html.indexOf("function commitMoment(");
    const calls: any[] = [];
    const context: any = { S: { from: "200000.125", at: "1000000.125" }, WM: () => "1000000.125",
      ms: Number, iso: String, go: (value: unknown) => calls.push(value) };
    runInNewContext(html.slice(start, html.indexOf("\nfunction mountHist", start)), context);
    context.commitMoment("a", 500000);
    assert.equal(calls.at(-1).at, context.S.at);
    context.commitMoment("b", 700000);
    assert.equal(calls.at(-1).from, context.S.from);
    context.S.at = null;
    context.commitMoment("a", 500000);
    assert.equal(calls.at(-1).at, null);
  });
}
