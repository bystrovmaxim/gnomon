// @maxitor/panel — the panel router refuses a change of the core's names (spec 078, FR-012).
import assert from "node:assert/strict";
import { test } from "node:test";

import { changedReserved, checkWrite } from "../src/shell/address.ts";

test("a write of the page's own names goes on", () => {
  assert.equal(checkWrite({ view: "table", layer: "events" }, {}, false), true);
  assert.equal(checkWrite({}, {}, true), true);
});

test("a write that carries the core's names as they are goes on", () => {
  assert.equal(checkWrite({ mode: "diff", from: "2026-11-01T00:00:00Z", author: "anna" }, { mode: "diff", from: "2026-11-01T00:00:00Z" }, false), true);
});

test("under development a write that adds, alters or drops a core's name throws, naming it", () => {
  for (const name of ["at", "mode", "from", "_room", "Mode"]) {
    assert.throws(() => checkWrite({ view: "table", [name]: "x" }, {}, false), new RegExp(`"${name}"`));
  }
  assert.throws(() => checkWrite({ mode: "side_by_side" }, { mode: "diff" }, false), /"mode"/);
  assert.throws(() => checkWrite({}, { mode: "diff" }, false), /"mode"/);
  assert.deepEqual(changedReserved({ view: "table" }, { view: "list", from: "x" }), ["from"]);
});

test("in production a change of a core's name is refused with one line, and does not throw", () => {
  const lines: string[] = [];
  assert.equal(checkWrite({ mode: "diff" }, {}, true, (text) => lines.push(text)), false);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /"mode"/);
});
