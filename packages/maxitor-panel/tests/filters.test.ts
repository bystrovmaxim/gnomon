// @maxitor/panel — the shell's filters and the list on the canvas (spec 081, FR-002, FR-003, FR-007 – FR-010).
import assert from "node:assert/strict";
import { test } from "node:test";

import { headOffset, listHeight, LIST_HEAD, LIST_ROW, rowBounds, rowsInView } from "../src/content/list.ts";
import { filtersOn, numberIn, readNumbers, visibleRows, writeNumbers } from "../src/shell/address.ts";

const rows = Array.from({ length: 46 }, (_, index) => ({ label: `Manager ${index}` }));

test("a long choice shows its first eight and how many more; a search keeps the values that hold it", () => {
  assert.deepEqual(visibleRows(rows, "", false).more, 38);
  assert.equal(visibleRows(rows, "", false).rows.length, 8);
  assert.equal(visibleRows(rows, "", true).rows.length, 46);
  assert.deepEqual(visibleRows(rows, "ger 4", false).rows.map((row) => row.label), ["Manager 4", "Manager 40", "Manager 41", "Manager 42", "Manager 43", "Manager 44", "Manager 45"]);
  assert.equal(visibleRows(rows.slice(0, 8), "", false).more, 0);
});

test("a range of numbers keeps its bounds as written, either side open; a bound that is not a number stays out", () => {
  assert.equal(writeNumbers("100", "250"), "100..250");
  assert.equal(writeNumbers("", "250"), "..250");
  assert.equal(writeNumbers("1o0", ""), null);
  assert.deepEqual(readNumbers("100..250"), { from: 100, to: 250 });
  assert.equal(numberIn(120, "100..250"), true);
  assert.equal(numberIn(99.99, "100.."), false);
  assert.equal(numberIn(null, "100.."), false);
  assert.equal(numberIn(5, undefined), true);
});

test("the Filters button counts every section the address filters by, a choice of one switched off among them", () => {
  assert.equal(filtersOn(["status", "q", "blocked"], { status: "active", blocked: "" }), 2);
});

test("only the rows in the view are drawn, the head sticking to its top", () => {
  const view = { x: 0, y: LIST_HEAD + 5000 * LIST_ROW, width: 800, height: 20 * LIST_ROW };
  const { start, end } = rowsInView(10_000, 0, view, 0);
  assert.deepEqual([start, end], [5000, 5020]);
  assert.ok(end - start <= 40);
  assert.equal(headOffset(10_000, 0, view), view.y);
  assert.equal(headOffset(10_000, 0, { ...view, y: -100 }), 0);
  assert.equal(headOffset(3, 0, { ...view, y: 10_000 }), listHeight(3) - LIST_HEAD);
  assert.deepEqual(rowBounds(2, 10, 20), { x: 10, y: 20 + LIST_HEAD + 2 * LIST_ROW, width: 820, height: LIST_ROW });
});
