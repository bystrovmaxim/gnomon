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
