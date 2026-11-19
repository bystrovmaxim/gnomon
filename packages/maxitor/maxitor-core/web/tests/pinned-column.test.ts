import assert from "node:assert/strict";
import { test } from "node:test";
import { pinnedColumnOffset } from "../components/administration/pinnedColumn.ts";

test("identity stays at the inset throughout horizontal panning without changing zoom", () => {
  for (const zoom of [0.5, 1, 2]) for (let left of [-20, -310, -650]) {
    left *= zoom;
    const offset = pinnedColumnOffset(left, 1150 * zoom, 180 * zoom, zoom);
    assert.equal(left + offset * zoom, 0);
  }
  assert.equal(pinnedColumnOffset(37, 1150, 180, 1), 0);
});
test("pinning stops at the table end and never translates vertically", () => {
  assert.equal(pinnedColumnOffset(-2000, 1150, 180, 1), 970);
  assert.equal(pinnedColumnOffset(-10, 180, 180, 1), 0);
  assert.equal(pinnedColumnOffset(-10, 1150, 180, 0), 0);
});
