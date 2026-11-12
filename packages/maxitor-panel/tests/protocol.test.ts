// @maxitor/panel — the panel protocol's shape checks: a known message passes, anything else is dropped.
import assert from "node:assert/strict";
import { test } from "node:test";

import { coreMessage, pageMessage } from "../src/protocol.ts";

test("every message of the page passes in its shape", () => {
  assert.ok(pageMessage({ type: "panel.ready", build: "0.8.0", shell: true, shellVersion: "0.2.0" }));
  assert.ok(pageMessage({ type: "panel.navigate", path: "/items/4f1c", query: { view: "table" }, mode: "push" }));
  assert.ok(pageMessage({ type: "panel.title", text: "Notes" }));
  assert.ok(pageMessage({ type: "panel.open", owner: "core", path: "/settings/plugins", query: {} }));
});

test("a page's message of another shape is dropped", () => {
  for (const data of [
    null,
    "panel.ready",
    { type: "panel.ready", build: "1", shell: "yes" },
    { type: "panel.ready", build: "1", shell: true, shellVersion: 2 },
    { type: "panel.navigate", path: "items", query: {}, mode: "push" },
    { type: "panel.navigate", path: "//evil.example/x", query: {}, mode: "push" },
    { type: "panel.navigate", path: "/x", query: { n: 1 }, mode: "push" },
    { type: "panel.navigate", path: "/x", query: {}, mode: "jump" },
    { type: "panel.location", path: "/x", query: {}, at: null },
    { type: "panel.unknown" },
  ]) {
    assert.equal(pageMessage(data), null, JSON.stringify(data));
  }
});

test("the core's messages pass in their shape and nothing else does", () => {
  assert.ok(coreMessage({ type: "panel.location", path: "/", query: {}, at: "2026-11-08T10:15:00.123456Z" }));
  assert.ok(coreMessage({ type: "panel.watermark", at: "2026-11-08T10:15:00.123456Z" }));
  assert.equal(coreMessage({ type: "panel.location", path: "/", query: {}, at: 7 }), null);
  assert.equal(coreMessage({ type: "panel.navigate", path: "/", query: {}, mode: "push" }), null);
});

test("a moment passes as the string it is, to the microsecond", () => {
  const at = "2026-11-08T10:15:00.123456Z";
  assert.equal(coreMessage({ type: "panel.location", path: "/", query: {}, at })?.type === "panel.location" && (coreMessage({ type: "panel.location", path: "/", query: {}, at }) as { at: string }).at, at);
});

test("a page's ready says whether it renders the shell; a page built before the shell is one without it", () => {
  assert.deepEqual(pageMessage({ type: "panel.ready", build: "1", shell: true, shellVersion: "0.2.0" }), {
    type: "panel.ready", build: "1", shell: true, shellVersion: "0.2.0",
  });
  assert.deepEqual(pageMessage({ type: "panel.ready", build: "1" }), {
    type: "panel.ready", build: "1", shell: false, shellVersion: "",
  });
});

test("Shift and an arrow pressed in the page pass as panel.keys; another key does not", () => {
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) assert.deepEqual(pageMessage({ type: "panel.keys", key }), { type: "panel.keys", key });
  assert.equal(pageMessage({ type: "panel.keys", key: "Enter" }), null);
  assert.equal(pageMessage({ type: "panel.keys" }), null);
});

test("the context travels with panel.location; a core without it means one moment", () => {
  const at = "2026-11-08T10:15:00.123456Z";
  assert.deepEqual(coreMessage({ type: "panel.location", path: "/", query: {}, at, against: "2026-11-01T00:00:00.000000Z", side: "a", milestone: "v3" }), {
    type: "panel.location", path: "/", query: {}, at, against: "2026-11-01T00:00:00.000000Z", side: "a", milestone: "v3",
  });
  assert.deepEqual(coreMessage({ type: "panel.location", path: "/", query: {}, at }), { type: "panel.location", path: "/", query: {}, at, against: null, side: null, milestone: null });
  assert.equal(coreMessage({ type: "panel.location", path: "/", query: {}, at, side: "c" }), null);
});

test("anchors travel in chains of at most 8 anchors of at most 200 characters", () => {
  assert.ok(pageMessage({ type: "panel.pointer", chain: ["field:Account.email", "table:Account"] }));
  assert.ok(pageMessage({ type: "panel.pointer", chain: null }));
  assert.equal(pageMessage({ type: "panel.pointer", chain: Array.from({ length: 9 }, (_, index) => `n:${index}`) }), null);
  assert.equal(pageMessage({ type: "panel.choose", chain: ["x".repeat(201)] }), null);
  assert.equal(pageMessage({ type: "panel.choose", chain: [] }), null);
  assert.ok(coreMessage({ type: "panel.mark", chain: null }));
  assert.ok(coreMessage({ type: "panel.bring", chain: ["row:acc-06213"] }));
  assert.equal(coreMessage({ type: "panel.bring", chain: null }), null);
  assert.ok(coreMessage({ type: "panel.step", delta: -1 }));
  assert.equal(coreMessage({ type: "panel.step", delta: 2 }), null);
});

test("panel.shown names an anchor of its chain; the counts are whole numbers", () => {
  const chain = ["field:Account.email", "table:Account"];
  assert.ok(pageMessage({ type: "panel.shown", chain, anchor: "table:Account", held: false, hidden: false, brought: false }));
  assert.equal(pageMessage({ type: "panel.shown", chain, anchor: "table:Other", held: false, hidden: false, brought: false }), null);
  assert.ok(pageMessage({ type: "panel.counts", added: 2, removed: 1, changed: 0 }));
  assert.equal(pageMessage({ type: "panel.counts", added: -1, removed: 1, changed: 0 }), null);
});
