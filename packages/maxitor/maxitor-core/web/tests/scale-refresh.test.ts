import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { domainOf, refreshedView, clampView, HOUR, DAY } from "../components/scale/geometry.ts";
import { BarCache, chunksOf, historyEnd } from "../components/scale/cache.ts";
import { momentOf } from "../lib/moment.ts";

const source = readFileSync(new URL("../components/scale/Scale.tsx", import.meta.url), "utf8");
const start = source.indexOf("  useEffect(() => {", source.indexOf("const viewedHistory ="));
const end = source.indexOf("  // The glide", start);
const effect = source.slice(start, end);
const now = Date.parse("2026-11-19T10:00:00Z");

function scale(view: { from: number; to: number }, at: string | null = null) {
  const domain = domainOf(now - DAY, now);
  const context: any = { open: true, domain, now, at, refreshedView, clampView,
    viewedHistory: { current: { domain, now } }, view, target: { ...view },
    useEffect: (run: () => void) => run(),
    setView: (update: any) => { context.view = update(context.view); },
    setTarget: (update: any) => { context.target = update(context.target); },
  };
  return {
    context,
    refresh(next: number, open = true) {
      context.now = next; context.open = open; context.domain = domainOf(now - DAY, next);
      runInNewContext(effect, context);
    },
  };
}

test("the real Scale effect reveals a new publication in All, including after reopening", () => {
  const s = scale(domainOf(now - DAY, now));
  s.refresh(now + HOUR);
  assert.deepEqual(s.context.view, s.context.domain);
  assert.deepEqual(s.context.target, s.context.domain);
  s.refresh(now + 3 * HOUR, false);
  assert.ok(s.context.view.to < now + 3 * HOUR);
  s.refresh(now + 3 * HOUR);
  assert.deepEqual(s.context.view, s.context.domain);
  assert.deepEqual(s.context.target, s.context.domain);
});

test("a zoomed live viewport follows Now without changing its duration", () => {
  const s = scale({ from: now - HOUR, to: now + HOUR / 10 });
  const span = s.context.view.to - s.context.view.from;
  s.refresh(now + 2 * HOUR);
  assert.equal(s.context.view.from, now + HOUR);
  assert.equal(s.context.view.to - s.context.view.from, span);
  assert.deepEqual(s.context.view, s.context.target);
});

test("new publications do not move a historical selection or a viewport panned into the past", () => {
  for (const at of [null, new Date(now - HOUR).toISOString()]) {
    const view = { from: now - 3 * HOUR, to: now - HOUR };
    const s = scale(view, at);
    s.refresh(now + HOUR);
    assert.deepEqual(s.context.view, view);
    assert.deepEqual(s.context.target, view);
  }
  const view = { from: now - HOUR, to: now + HOUR / 10 };
  const s = scale(view, new Date(now).toISOString());
  s.refresh(now + HOUR);
  assert.deepEqual(s.context.view, view);
});

test("the real Scale bar effect reads the publication at the full watermark and rereads the live chunk", async () => {
  const begin = source.indexOf('  useEffect(() => {', source.indexOf('const chunks ='));
  const effect = source.slice(begin, source.indexOf('  const bars:', begin));
  const calls: string[] = [];
  const context: any = { open: true, step: 1000, cache: { current: new BarCache() }, asking: { current: new Set() },
    historyEnd, momentOf, useEffect: (run: () => void) => run(), setRead() {},
    source: { key: 'published', bars: async (_from: string, to: string) => {
      calls.push(to);
      return to === context.watermark ? [{ start: momentOf(context.now), added: 1, changed: calls.length - 1, removed: 0 }] : [];
    } },
  };
  for (const watermark of ['2026-11-19T10:24:43.421267Z', '2026-11-19T10:24:43.421268Z']) {
    context.watermark = watermark; context.now = Date.parse(watermark);
    context.chunks = chunksOf(context.now - 5000, context.now + 1000, watermark, context.step);
    runInNewContext(effect, context);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.at(-1), watermark, 'The bar request must not round a publication down to its minute or millisecond');
    const bars = context.cache.current.bars('published', context.step, context.chunks);
    assert.equal(bars.length, 1);
    assert.equal(bars[0].changed, calls.length - 1);
  }
  assert.equal(calls.length, 2, 'Two changes in the same millisecond must refresh the open chunk twice');
});

for (const name of ['074-notes-history', '084-notes-draft-published']) {
  test(`${name}: the real bar renderer stops at Now rather than painting into the future`, () => {
    const html = readFileSync(new URL(`../../../../../specs/${name}/mockup/index.html`, import.meta.url), 'utf8');
    const start = html.indexOf('  if (bars) B.forEach(');
    const loop = html.slice(start, html.indexOf('\n  });', start) + 6);
    for (const now of [0, 15, 30]) {
      const context: any = { bars: true, B: [{ n: 1, add: 1 }], b0: 0, step: 60, bw: 600, gap: 1.5,
        base: 100, W: 720, WM: () => now, X: (time: number) => 100 + time * 10, Y: () => 20,
        KIND_COL: { add: 'green' }, hb: -1, s: '' };
      runInNewContext(loop, context);
      const rect = context.s.match(/<rect x="([^"]+)"[^>]*width="([^"]+)"/);
      assert.ok(rect, 'The change at Now must remain visible');
      assert.ok(Number(rect[1]) + Number(rect[2]) <= context.X(now), 'No bar may cross the Now boundary');
    }
  });
}
test("a fast page's history survives the previous page's deferred effects", () => {
  const frame = readFileSync(new URL("../components/frame/Frame.tsx", import.meta.url), "utf8");
  const start = frame.indexOf("  const pageKey =");
  const reset = frame.slice(start, frame.indexOf("  const go =", start));
  const layout: Array<() => void> = [], passive: Array<() => void> = [];
  let history: unknown = { read: "list_note_draft" };
  const published = { read: "list_published_notes", milestones: "list_note_history" };
  runInNewContext(reset, {
    address: { owner: "notes", path: "/items/one/published" },
    setHistory: (next: unknown) => { history = next; },
    useLayoutEffect: (effect: () => void) => layout.push(effect),
    useEffect: (effect: () => void) => passive.push(effect),
  });
  layout.forEach(effect => effect());
  // The new iframe page posts its setup after commit, before deferred effects are flushed.
  history = published;
  passive.forEach(effect => effect());
  assert.equal(history, published, "The shell erased Published's setup after accepting its history message");
});

test("a publication just after a poll leaves time to fetch and render within five seconds", async () => {
  const ts = createRequire(import.meta.url)("typescript");
  const compiled = ts.transpileModule(readFileSync(new URL("../components/scale/bridge.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  let elapsed = 0, interval = 0, tick: () => Promise<void> = async () => {};
  let mount: () => void = () => {}, shown: string | null = null;
  let published = "2026-11-19T10:00:00.000000Z";
  const exports: any = {};
  runInNewContext(compiled, {
    exports, encodeURIComponent,
    require: () => ({
      createContext: () => ({}),
      useEffect: (effect: () => void) => { mount = effect; },
      useState: () => [null, (update: (old: string | null) => string) => {
        shown = update(shown);
        elapsed += 900; // The page and the scale read their updated content and render it.
      }],
    }),
    fetch: async () => {
      elapsed += 600; // The watermark request takes time too.
      return { ok: true, json: async () => ({ at: published }) };
    },
    window: { setInterval: (callback: () => Promise<void>, ms: number) => { tick = callback; interval = ms; return 1; }, clearInterval() {} },
  });
  exports.useWatermark("test-organization");
  mount();
  await new Promise(resolve => setImmediate(resolve));
  published = "2026-11-19T10:01:00.000000Z";
  elapsed = interval - 1; // The change narrowly misses the previous poll.
  await tick();
  assert.equal(shown, published);
  assert.ok(elapsed <= 5000, `The next poll plus requests and rendering took ${elapsed} ms`);
});
