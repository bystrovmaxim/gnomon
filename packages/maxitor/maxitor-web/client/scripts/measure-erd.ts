// scripts/measure-erd.ts
/**
 * The ERD's measured session (spec 071, SC-007 – SC-009): opens the whole system's ERD of a large model and prints each
 * number beside its threshold — the first picture, the longest task that blocked the page, a hover's work, a repaint, a
 * fold, a filter change, and the worst frame while panning and zooming. Thresholds depend on the machine, so this runs
 * by hand and not in the check run. Measure a production build: the development server is about twice as slow.
 *
 *   node scripts/generate-large-graph.ts <stand graph> <folder> --tables=1000,5000
 *   node scripts/measure-erd.ts <graph-json URL> [front URL] [layout] [--headless]
 *
 * The browser is shown, on the machine's GPU; ``--headless`` measures without a window, where a hidden window would
 * stop the browser's frames and the run would wait for a picture forever.
 */
import { chromium } from "playwright";
import type { Page } from "playwright";

const headless = process.argv.includes("--headless");
const [source, front = "http://localhost:4173", layout = "gv-dot-lr"] = process.argv.slice(2).filter((arg) => arg !== "--headless");
if (!source) throw new Error("usage: measure-erd.ts <graph-json URL> [front URL] [layout]");
const WIDTH = 1600;
const HEIGHT = 900;
/** The model is measured in its default layout against the thresholds; other layouts are recorded without them. */
const THRESHOLDS = layout === "gv-dot-lr";

function line(name: string, value: number, threshold: number | null): void {
  const verdict = threshold === null || !THRESHOLDS ? "    " : value <= threshold ? "ok  " : "MISS";
  console.log(`${verdict}  ${name.padEnd(46)} ${String(Math.round(value)).padStart(7)} ms${threshold !== null && THRESHOLDS ? `   threshold ${threshold} ms` : ""}`);
}

/** The worst frame while ``act`` runs, as the time between two animation frames. */
async function worstFrame(page: Page, act: () => Promise<void>): Promise<number> {
  await page.evaluate(() => {
    const seen = window as unknown as { frames_: number[]; going_: boolean };
    seen.frames_ = [];
    seen.going_ = true;
    let last = performance.now();
    const tick = (now: number) => {
      seen.frames_.push(now - last);
      last = now;
      if (seen.going_) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await act();
  return page.evaluate(() => {
    const seen = window as unknown as { frames_: number[]; going_: boolean };
    seen.going_ = false;
    return Math.max(...seen.frames_.slice(1));
  });
}

/**
 * The time from a click on ``label`` until the drawing on the page first changes — a table leaves, a colour is set, a
 * new picture is placed — measured in the page itself, from the click to the change.
 */
async function untilShown(page: Page, label: string): Promise<number> {
  return page.evaluate(async (aria) => {
    const panner = document.querySelector(".erd-svg-panner")!;
    const button = document.querySelector<HTMLElement>(`[aria-label="${aria}"]`)!;
    let changed = 0;
    const seen = new Promise<void>((done) => {
      const watch = new MutationObserver(() => {
        changed = performance.now();
        watch.disconnect();
        done();
      });
      watch.observe(panner, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "fill", "stroke", "href"] });
    });
    const start = performance.now();
    button.click();
    await seen;
    return changed - start;
  }, label);
}

/** ``label``'s button clicked: the time until its change shows, and until the drawing settles into its new picture. */
async function shownAndSettled(page: Page, name: string, label: string, settledThreshold: number | null): Promise<void> {
  const before = await page.evaluate(() => document.querySelector("[data-layout-hash]")?.getAttribute("data-layout-hash") ?? "");
  const start = Date.now();
  line(`${name}, shown`, await untilShown(page, label), 100);
  await page.waitForFunction((old) => {
    const now = document.querySelector("[data-layout-hash]")?.getAttribute("data-layout-hash");
    return now && now !== old;
  }, before, { timeout: 120_000, polling: 16 });
  line(`${name}, settled`, Date.now() - start, settledThreshold);
  await page.waitForTimeout(800);
}

const browser = await chromium.launch({ headless, args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
await page.addInitScript(() => {
  const seen = window as unknown as { longest_: number };
  seen.longest_ = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) seen.longest_ = Math.max(seen.longest_, entry.duration);
  }).observe({ type: "longtask", buffered: true });
});
const address = `${front}/?${new URLSearchParams({ source, view: "domain-erd", layout }).toString()}`;
const opened = () => page.waitForFunction(() => document.querySelector("[data-layout-hash]")?.getAttribute("data-layout-hash"), null, { timeout: 300_000, polling: 50 });

// A first load warms the server's cache of the graph; the second is the one a reader waits for.
await page.goto(address);
await opened();
await page.waitForTimeout(1500);
const started = Date.now();
await page.goto(address);
await opened();
line("first picture", Date.now() - started, 3000);
line("longest task while it was drawn", await page.evaluate(() => (window as unknown as { longest_: number }).longest_), null);
await page.waitForTimeout(1500);
await page.evaluate(() => void ((window as unknown as { longest_: number }).longest_ = 0));

// A hover's own work: the event the page acts on at once (a synthetic one skips the 100 ms intent a pointer waits).
line(
  "hover, the work after the intent",
  await page.evaluate(async () => {
    const node = [...document.querySelectorAll("g.graph g.node")].find((each) => each.querySelector('g[id^="a_hd"]'))!;
    const start = performance.now();
    node.dispatchEvent(new MouseEvent("mouseenter"));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const took = performance.now() - start;
    node.dispatchEvent(new MouseEvent("mouseleave"));
    return took;
  }),
  100,
);

const stage = await page.locator("svg").first().boundingBox();
await page.mouse.move(WIDTH * 0.6, HEIGHT * 0.5);
line(
  "worst frame, zooming",
  await worstFrame(page, async () => {
    await page.keyboard.down("Control");
    for (let step = 0; step < 30; step += 1) {
      await page.mouse.wheel(0, -60);
      await page.waitForTimeout(40);
    }
    await page.keyboard.up("Control");
  }),
  33,
);
await page.waitForTimeout(800);
line(
  "worst frame, panning",
  await worstFrame(page, async () => {
    for (let step = 0; step < 60; step += 1) {
      await page.mouse.wheel(30, 20);
      await page.waitForTimeout(16);
    }
  }),
  33,
);
void stage;
await page.waitForTimeout(800);

// SC-007: a repaint shows in 100 ms; a fold and a filter change show in 100 ms and settle within 1 s.
await shownAndSettled(page, "repaint (paint by kinds)", "Paint by Kinds", null);
await shownAndSettled(page, "fold every frame", "Collapse all boundaries", 1000);
await shownAndSettled(page, "unfold every frame", "Expand all boundaries", 1000);
const domainLabel = await page.locator("[data-testid=erd-filter-panel] button[aria-label]").nth(1).getAttribute("aria-label");
await shownAndSettled(page, "filter a domain off", domainLabel!, 1000);
line("longest task during the interactions", await page.evaluate(() => (window as unknown as { longest_: number }).longest_), 100);
console.log(`      ${(await page.evaluate(() => document.querySelectorAll("g.graph g.node").length))} tables and boxes drawn at the end`);
await browser.close();
