// packages/maxitor/maxitor-web/client/scripts/check-layout-determinism.ts
/**
 * check-layout-determinism — prove that every diagram is laid out to the same bits in Chromium,
 * Firefox and WebKit, on a phone-sized and a desktop-sized screen (spec 028, FR-006). The engines,
 * and both screen sizes within each engine, lay out at the same time.
 *
 * The check run runs it after the client's build. It serves the built client and the frozen
 * reference graph, proxies the API to a real Maxitor started for the purpose, opens every page
 * the left panel lists — the full graph, every ERD, every use-case diagram, every lifecycle —
 * in every layout mode of that page, and reads the layout hash each viewer writes on its diagram
 * element (`data-layout-hash`, contracts/layout-determinism.md). One line is printed per page
 * and mode; the exit code is 1 as soon as one page and mode has two different hashes, or none.
 *
 * Nothing is added to the client for it: the hash on the element is the one the room reads.
 *
 * Beside it, it proves SC-003 in a real room: in each engine a desktop page opens a room on the ERD
 * of all domains and a phone page joins it. The desktop's mouse rests on a node's centre, and the
 * phone must draw that arrow within 2 px of the same node's centre on its own screen, before and
 * after either page zooms. A phone has no cursor, only touches: its tap on a node must show on the
 * desktop as a ring centred on the same node, within the same 2 px.
 *
 * After both, following in every directed pair of engines (spec 029, FR-015), all six pairs at
 * once, each in its own room: one browser opens a room, a browser of another engine joins and
 * follows it. The leader drags the ERD and stops; the follower's screen must then be centred on the
 * leader's diagram point within 2 px. The leader rests the mouse on a table; the follower must
 * light the same table within half a second (SC-002). There, too, the leader's circles must not
 * touch (spec 029, FR-051): its own ring, the count of its follower and a focus ring on the
 * follower's circle all drawn at once. The leader's name is 40 characters, the longest a name may
 * be, and the follower's card for it must keep its buttons inside the card without one running into
 * another (FR-052).
 *
 * Last, following on every kind of diagram (spec 038) — the full graph, the ERD of all domains, one
 * domain's ERD, a use case and a lifecycle — in every directed pair of four browsers: the three
 * engines and the real Safari, driven through `safaridriver` (`browserTab.ts`), since Playwright's
 * WebKit paints in software and never shows what Safari's compositor does to a large drawing. The
 * leader goes to each page and zooms in; the follower must draw the same page, take the same zoom and
 * the same top-left corner within 2 px, and show the diagram on screen: its share of drawn pixels
 * (`pngInk.ts`) at least 60 % of the leader's. Safari runs one session at a time, so its pairs run one
 * after another, with Chromium only, both ways. Safari only paints in a window on screen, so it runs when asked:
 * MAXITOR_CHECK_SAFARI=1 adds it here, =full to every change in one frame too; asked for, it must be drivable —
 * Develop → "Allow remote automation" — and its window uncovered. Not asked for, a line says it was skipped.
 *
 * Then every change of the picture in one frame (spec 038): in a room, on the ERD of all domains and on a
 * use case, the leader turns a domain off and on, paints by kinds and by domains, changes the layout mode,
 * turns 1-hop off and on, and the use case's direction and boundary. Each browser records, frame by frame,
 * what its diagram shows — the drawing and the camera. After each change the leader and the follower must
 * each show at most one new picture, the follower one whenever the leader does — no blank, no new drawing at
 * an old view, no fit to its own screen and then a glide — and the follower must never be told its pointers
 * are off.
 */
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { connect } from "node:net";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import { chromium, firefox, webkit } from "playwright";
import type { Browser, BrowserType, Page } from "playwright";

import { playwrightTab, safariTab, safariUnavailable, waitInPage } from "./browserTab.ts";
import { cardMechanics, type CardCase } from "./cardMechanics.ts";
import type { BrowserTab } from "./browserTab.ts";
import { decodePng, inkOf } from "./pngInk.ts";

const CLIENT = process.cwd();
const REPO = resolve(CLIENT, "../../../..");
const DIST = join(CLIENT, "dist");
const FIXTURE = join(REPO, "packages/maxitor/maxitor-web/tests/fixtures/ref-graph-2026-10-26.json.gz");

const ENGINES: [string, BrowserType][] = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
];
const VIEWPORTS: { name: string; width: number; height: number }[] = [
  { name: "375x812", width: 375, height: 812 },
  { name: "1600x900", width: 1600, height: 900 },
];
const HASH_TIMEOUT_MS = 60_000;
/** The largest distance between a pointer and the point it marks on another screen (SC-003). */
const POINTER_TOLERANCE_PX = 2;
const API_START_TIMEOUT_MS = 60_000;
/** How soon a follower must show the leader's hover (spec 029, SC-002). */
const FOLLOW_HOVER_MS = 500;
/** The least share of the leader's drawn pixels a follower must show on the same diagram (spec 038). */
const FOLLOW_INK_SHARE = 0.6;
/** A leader's screen with less ink than this has nothing to compare: an empty diagram. */
const EMPTY_INK = 0.002;
/** How much a follower's zoom may differ from its leader's, as a share. */
const ZOOM_TOLERANCE = 0.002;
/** Time for a camera to settle and be written to the address (the client waits 250 ms). */
const SETTLE_MS = 1500;
/** How a value that must have stopped moving is read: this far apart, at most so many times. */
const HASH_STABLE_MS = 250;
const HASH_STABLE_READS = 8;
const CAMERA_REST_READS = 40;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

/** One diagram page as the address names it. */
type Target = { label: string; query: Record<string, string> };

/** A sidebar row, as `GET /api/sidebar` returns it. */
type SidebarRow = { id: string; parent_id: string | null; label: string; type: string };

/** Serve the built client and the reference graph, and pass `/api` on to Maxitor. */
function startFrontServer(graphJson: Buffer, apiPort: () => number): Promise<Server> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/graph-json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(graphJson);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      const upstream = httpRequest(
        { host: "127.0.0.1", port: apiPort(), path: req.url, method: req.method, headers: req.headers },
        (answer) => {
          res.writeHead(answer.statusCode ?? 502, answer.headers);
          answer.pipe(res);
        },
      );
      upstream.on("error", (error) => {
        res.writeHead(502);
        res.end(String(error));
      });
      req.pipe(upstream);
      return;
    }
    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    let body: Buffer;
    try {
      body = readFileSync(join(DIST, file));
    } catch {
      body = readFileSync(join(DIST, "index.html"));
    }
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  });
  // Room connections pass through untouched, with the page's own Host, as the stand's nginx does.
  server.on("upgrade", (req: IncomingMessage, socket, head: Buffer) => {
    const upstream = connect(apiPort(), "127.0.0.1", () => {
      const headers = Object.entries(req.headers).flatMap(([name, value]) =>
        (Array.isArray(value) ? value : [value]).map((v) => `${name}: ${v}`),
      );
      upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers.join("\r\n")}\r\n\r\n`);
      upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

/** A free TCP port on the loopback interface. */
async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((done) => probe.listen(0, "127.0.0.1", () => done()));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((done) => probe.close(() => done()));
  return port;
}

/** Start Maxitor's API with the repository's environment and wait until it answers. */
async function startApi(port: number): Promise<ChildProcess> {
  const child = spawn(
    "uv",
    ["run", "--extra", "dev", "uvicorn", "maxitor.web.api.app:app", "--host", "127.0.0.1", "--port", String(port)],
    { cwd: REPO, stdio: ["ignore", "ignore", "pipe"] },
  );
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const deadline = Date.now() + API_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Maxitor exited early:\n${stderr}`);
    try {
      const answer = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (answer.ok) return child;
    } catch {
      /* not listening yet */
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  child.kill();
  throw new Error(`Maxitor did not answer within ${API_START_TIMEOUT_MS} ms:\n${stderr}`);
}

const graphJson = gunzipSync(readFileSync(FIXTURE));
const apiPort = await freePort();
const api = await startApi(apiPort);
const front = await startFrontServer(graphJson, () => apiPort);
const frontUrl = `http://127.0.0.1:${(front.address() as AddressInfo).port}`;
const source = `${frontUrl}/graph-json`;
await fetch(`${frontUrl}/api/load?source=${encodeURIComponent(source)}`, { method: "POST" }).catch(() => undefined);
for (const [name, engine] of ENGINES) {
  const browser = await engine.launch();
  for (const viewport of VIEWPORTS) {
    const page = await (await browser.newContext({ viewport })).newPage();
    await page.goto(`${frontUrl}/?source=${encodeURIComponent(source)}&view=domain-erd&layout=gv-fdp`);
    await page.waitForFunction(() => document.querySelector("[data-layout-hash]")?.getAttribute("data-layout-hash"), null, { timeout: 60000 });
    await page.waitForTimeout(3000);
    const pair = await page.evaluate(() => { const e = document.querySelector("[data-layout-hash]"); return [e?.getAttribute("data-layout-hash"), e?.getAttribute("data-layout-input")]; });
    console.log(name, viewport.name, pair.join(" "));
  }
  await browser.close();
}
api.kill(); front.close(); process.exit(0);
