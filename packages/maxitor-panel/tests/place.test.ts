// @maxitor/panel — a change's card stands beside the element the stepper is on, as the graph viewer places it
// (spec 079, FR-025): right of it, else left, else under it, level with its top and inside the panel.
import assert from "node:assert/strict";
import { test } from "node:test";

import { besideBox } from "../src/compare/place.ts";

const panel = { left: 0, top: 0, right: 1000, bottom: 700 };

test("the card stands right of its element, level with its top", () => {
  assert.deepEqual(besideBox(panel, { left: 100, top: 200, right: 300, bottom: 320 }, 300, 160), { x: 308, y: 200 });
});

test("with no room on the right it stands on the left, and with neither under the element", () => {
  assert.deepEqual(besideBox(panel, { left: 650, top: 200, right: 900, bottom: 320 }, 300, 160), { x: 342, y: 200 });
  assert.deepEqual(besideBox(panel, { left: 200, top: 100, right: 800, bottom: 220 }, 300, 160), { x: 200, y: 228 });
});

test("the card never leaves the panel: an element near the bottom keeps it above the edge", () => {
  assert.deepEqual(besideBox(panel, { left: 100, top: 650, right: 300, bottom: 690 }, 300, 160), { x: 308, y: 532 });
});
