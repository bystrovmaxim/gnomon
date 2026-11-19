import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as geometry from "../components/scale/geometry.ts";
import * as selection from "../components/scale/selection.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = ts.transpileModule(readFileSync(new URL("../components/scale/Track.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const initial = { from: 500_000, to: 1_500_000 };

/** Run the mounted Track's native listener, including bursts before React's next render. */
function track(against: number | null = null) {
  const hooks: any[] = [], effects: (() => void | (() => void))[] = [];
  let cursor = 0, mounted = false, listener: ((e: any) => void) | undefined;
  let view = { ...initial }, prevented = 0, selected = 0;
  const calls: { view: geometry.View; smooth: boolean }[] = [];
  const element = {
    clientWidth: 1000,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000 }),
    addEventListener: (name: string, fn: any, options: any) => {
      assert.equal(name, "wheel"); assert.equal(options.passive, false);
      assert.equal(listener, undefined); listener = fn;
    },
    removeEventListener: (_name: string, fn: any) => { assert.equal(listener, fn); listener = undefined; },
  };
  const exports: any = {};
  const imports: Record<string, any> = {
    react: {
      useId: () => "track",
      useRef: (value: any) => { const i = cursor++; return hooks[i] ??= { current: value }; },
      useState: (value: any) => { const i = cursor++; if (!(i in hooks)) hooks[i] = value; return [hooks[i], (v: any) => { hooks[i] = v; }]; },
      useEffect: (effect: any) => { if (!mounted) effects.push(effect); },
    },
    "@/components/scale/geometry": geometry,
    "@/components/scale/selection": selection,
    "@/components/scale/Point": {}, "@/components/scale/Tip": {},
    "@/lib/moment": { startsDay: () => false, momentText: String, dayText: String, clockText: String },
  };
  runInNewContext(source, { exports, require: (id: string) => imports[id] ?? require(id) });
  const onView = (next: geometry.View, smooth: boolean) => { view = next; calls.push({ view, smooth }); };
  const select = () => { selected++; };
  function render() {
    cursor = 0;
    const tree = exports.Track({ view, domain: { from: 0, to: 3_000_000 }, width: 1000, now: 2_900_000,
      shown: 1_000_000, against, phone: false, bars: null, milestones: null, kinds: {}, step: 60_000,
      cardOf: () => undefined, onView, onChoose: select, onRange: select, onMilestone: select });
    tree.props.ref.current = element;
  }
  render();
  const cleanups = effects.map(effect => effect()); mounted = true;
  return {
    render, calls,
    get view() { return view; },
    get selected() { return selected; },
    wheel(deltaX: number, deltaY = 0, timeStamp = 0, keys: Record<string, any> = {}) {
      assert.ok(listener, "The real Track must register a wheel listener");
      const before = prevented;
      listener({ deltaX, deltaY, timeStamp, deltaMode: 0, clientX: 250, ctrlKey: false, shiftKey: false,
        preventDefault: () => { prevented++; }, stopPropagation() {}, ...keys });
      assert.equal(prevented, before + 1, "Wheel input must not scroll the surrounding page");
    },
    unmount() { for (const cleanup of cleanups) cleanup?.(); assert.equal(listener, undefined); },
  };
}

for (const against of [null, 800_000, 1_000_000]) {
  test(`horizontal burst accumulates every delta without selecting One/A/B (A=${against})`, () => {
    const t = track(against);
    for (let i = 0; i < 20; i++) t.wheel(10, 0, i * 4);
    assert.equal(t.view.from, 700_000, "Events before the next frame must not overwrite one another");
    assert.equal(t.view.to - t.view.from, 1_000_000);
    assert.equal(t.selected, 0);
    assert.ok(t.calls.every(c => !c.smooth), "A trackpad gesture must follow input without a trailing animation");
    t.unmount();
  });
}

test("horizontal momentum ignores vertical jitter and reverses without zooming", () => {
  const t = track();
  for (const [dx, dy, time] of [[40, 1, 0], [1, 6, 10], [0, 4, 20], [-10, 1, 30]]) {
    t.wheel(dx, dy, time); t.render();
  }
  assert.equal(t.view.from, 531_000);
  assert.equal(t.view.to - t.view.from, 1_000_000);
  t.unmount();
});

test("a new vertical gesture zooms at the pointer after a horizontal swipe", () => {
  const t = track();
  t.wheel(40); t.render();
  const anchor = t.view.from + (t.view.to - t.view.from) * 0.25;
  t.wheel(0, -100, 300);
  assert.ok(t.view.to - t.view.from < 1_000_000);
  assert.ok(Math.abs(t.view.from + (t.view.to - t.view.from) * 0.25 - anchor) < 1e-6);
  t.unmount();
});

test("Shift-wheel pans and Ctrl-pinch still zooms even with horizontal noise", () => {
  const t = track();
  t.wheel(0, 20, 0, { shiftKey: true }); t.render();
  assert.equal(t.view.from, 520_000);
  assert.equal(t.view.to - t.view.from, 1_000_000);
  t.wheel(20, -10, 10, { ctrlKey: true });
  assert.ok(t.view.to - t.view.from < 1_000_000);
  t.unmount();
});

test("panning stops at history edges and reverses immediately", () => {
  const t = track();
  t.wheel(-1000); t.wheel(-1000, 0, 10); t.wheel(20, 0, 20);
  assert.equal(t.view.from, 20_000);
  assert.equal(t.view.to - t.view.from, 1_000_000);
  t.wheel(5000, 0, 30); t.wheel(-20, 0, 40);
  assert.equal(t.view.from, 1_980_000);
  t.unmount();
});

for (const name of ["074-notes-history", "084-notes-draft-published"]) {
  test(`${name}: the mounted mockup preserves horizontal momentum, reversal and pinch`, () => {
    const html = readFileSync(new URL(`../../../../../specs/${name}/mockup/index.html`, import.meta.url), "utf8");
    const start = html.indexOf("function mountHist()");
    const mount = html.slice(start, html.indexOf("\n  redraw();\n}", start) + "\n  redraw();\n}".length);
    const HV = { v0: initial.from, v1: initial.to, g0: initial.from, g1: initial.to, drag: null };
    let wheel: (e: any) => void;
    const element = { clientWidth: 1000, addEventListener: (type: string, handler: any) => { assert.equal(type, "wheel"); wheel = handler; } };
    const document = { getElementById: () => element };
    runInNewContext(`${mount}; mountHist();`, {
      document, CD: () => document, HV,
      redraw() {}, localX: (_el: any, e: any) => e.clientX,
      setView: (from: number, to: number, smooth: boolean) => {
        assert.equal(smooth, false);
        HV.g0 = HV.v0 = from; HV.g1 = HV.v1 = to;
      },
    });
    const dispatch = (deltaX: number, deltaY: number, timeStamp: number, ctrlKey = false) => wheel!({
      deltaX, deltaY, timeStamp, ctrlKey, shiftKey: false, clientX: 250, preventDefault() {},
    });
    for (let i = 0; i < 20; i++) dispatch(10, 0, i * 4);
    assert.equal(HV.g0, 700_000);
    dispatch(1, 6, 90); dispatch(0, 4, 100); dispatch(-10, 1, 110);
    assert.equal(HV.g0, 691_000);
    assert.equal(HV.g1 - HV.g0, 1_000_000);
    dispatch(20, -10, 120, true);
    assert.ok(HV.g1 - HV.g0 < 1_000_000);
  });
}
