import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as geometry from "../components/scale/geometry.ts";
import * as selection from "../components/scale/selection.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const compile = (source: string) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const trackSource = compile(readFileSync(new URL("../components/scale/Track.tsx", import.meta.url), "utf8"));
const scaleSource = readFileSync(new URL("../components/scale/Scale.tsx", import.meta.url), "utf8");

test("one touch sequence pans, selects a milestone, crosses and overlaps A/B, then pans after remount", () => {
  const width = 343, top = 41, base = 177;
  let view = { from: 500_000, to: 2_000_000 }, a = 800_000, b = 1_600_000;
  const milestone = { id: "release", at: "1200000", ref: "v3", kind: "release" };
  const chosen: string[] = [];
  const commit: any = {
    watermark: "2900000", now: 2_900_000, step: 1, comparing: true,
    msOf: Number, momentOf: String, chosenMoment: String, unitOf: () => 1,
    onRange: (range: any) => { a = Number(range.from); b = Number(range.at); },
    onChoose: () => assert.fail("Touch left comparison mode"),
    onMilestone: () => assert.fail("The comparison must choose its nearest bound"),
  };
  for (const name of ["choose", "pick"]) {
    const start = scaleSource.indexOf(`const ${name} = (`);
    const handler = scaleSource.slice(start, scaleSource.indexOf("\n  };", start) + 5);
    runInNewContext(compile(`${handler}; this.${name} = ${name};`), commit);
  }
  class Target { closest() { return null; } }
  const element = { clientWidth: width, clientHeight: 220, getBoundingClientRect: () => ({ left: 0, top: 0, width, height: 220 }),
    setPointerCapture() {}, addEventListener() {}, removeEventListener() {} };
  let tree: any, render: () => void, unmount: () => void;
  const mount = () => {
    const hooks: any[] = [], effects: any[] = [];
    let cursor = 0, mounted = false;
    const exports: any = {};
    const imports: Record<string, any> = {
      react: {
        useId: () => "touch",
        useRef: (value: any) => { const i = cursor++; return hooks[i] ??= { current: value }; },
        useState: (value: any) => { const i = cursor++; if (!(i in hooks)) hooks[i] = value; return [hooks[i], (v: any) => { hooks[i] = v; }]; },
        useEffect: (effect: any) => { if (!mounted) effects.push(effect); },
      },
      "@/components/scale/geometry": geometry, "@/components/scale/selection": selection,
      "@/components/scale/Point": {}, "@/components/scale/Tip": {},
      "@/lib/moment": { msOf: Number, startsDay: () => false, momentText: String, dayText: String, clockText: String },
    };
    runInNewContext(trackSource, { exports, Element: Target, require: (id: string) => imports[id] ?? require(id) });
    render = () => {
      cursor = 0; commit.from = String(a); commit.at = String(b);
      tree = exports.Track({ view, domain: { from: 0, to: 3_000_000 }, width, now: 2_900_000,
        shown: b, against: a, phone: true, bars: [], milestones: [milestone], kinds: {}, step: 60_000,
        cardOf: () => undefined, onView: (next: geometry.View) => { view = next; },
        onChoose: (time: number, handle: string) => { chosen.push(handle); commit.choose(time, handle); },
        onMilestone: (mark: any, handle: string) => { chosen.push(`milestone:${handle}`); commit.pick(mark, handle); },
        onRange: () => assert.fail("A plain touch must not grab the interval grip"),
      });
      tree.props.ref.current = element;
    };
    render();
    const cleanup = effects.map(effect => effect()); mounted = true;
    unmount = () => { for (const stop of cleanup) stop?.(); tree = null; };
  };
  const event = (name: string, x: number, y: number) => {
    assert.ok(tree, "The scale must be mounted");
    tree.props[name]({ clientX: x, clientY: y, pointerId: 1, pointerType: "touch", isPrimary: true,
      currentTarget: element, target: new Target(), shiftKey: false });
    render();
  };
  const drag = (x0: number, y: number, x1 = x0) => {
    event("onPointerDown", x0, y);
    for (let i = 1; i <= 8; i++) event("onPointerMove", x0 + (x1 - x0) * i / 8, y);
    event("onPointerUp", x1, y);
  };
  const x = (time: number) => geometry.xOf(time, view, width);
  mount();
  const initial = { ...view };
  drag(width * 0.8, base - 20, width * 0.8 + 24);
  assert.ok(view.from < initial.from, "A touch swipe must pan, not brush or select");
  assert.equal(view.to - view.from, initial.to - initial.from);
  assert.deepEqual([a, b, chosen.length], [800_000, 1_600_000, 0]);
  drag(x(Number(milestone.at)), top + 28);
  assert.deepEqual([a, b, chosen.at(-1)], [800_000, 1_200_000, "milestone:b"]);
  drag(x(a), top, x(b) + 48);
  assert.equal(a, 1_200_000); assert.ok(b > a); assert.equal(chosen.at(-1), "a");
  const crossed = a;
  drag(x(b), base, x(a) - 48);
  assert.equal(b, crossed); assert.ok(a < crossed); assert.equal(chosen.at(-1), "b");
  drag(x(b), top);
  assert.ok(Math.abs(a - b) < 1e-6); assert.equal(chosen.at(-1), "a");
  const overlap = a;
  drag(x(b), base, x(a) - 48);
  assert.equal(b, overlap); assert.ok(a < overlap); assert.equal(chosen.at(-1), "b");
  const kept = [a, b], beforeClose = { ...view };
  unmount!(); mount();
  assert.deepEqual([a, b], kept); assert.deepEqual(view, beforeClose);
  drag(width * 0.8, base - 20, width * 0.8 - 24);
  assert.ok(view.from > beforeClose.from, "Reopened Track must still pan");
  assert.equal(view.to - view.from, beforeClose.to - beforeClose.from);
  assert.deepEqual([a, b], kept);
  unmount!();
});
