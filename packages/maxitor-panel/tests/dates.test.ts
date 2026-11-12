// @maxitor/panel — dates and bounds of the range filters and both date pickers (spec 081, FR-010, FR-014 – FR-018).
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  boundDate,
  daysIn,
  howSet,
  inRange,
  monthGrid,
  parseTyped,
  pickDay,
  readRange,
  resolve,
  toggleMoving,
  typeBound,
  viewMonth,
  writeRange,
} from "../src/pickers/dates.ts";

const NOW = "2026-11-10";

test("a typed bound takes a day, a moving bound or nothing; other text leaves the bound as it was", () => {
  assert.equal(parseTyped("5 Mar 2026"), "2026-03-05");
  assert.equal(parseTyped("2026-03-05"), "2026-03-05");
  assert.equal(parseTyped("today"), "now");
  assert.equal(parseTyped("30 days ago"), "now-30d");
  assert.equal(parseTyped("30d"), "now-30d");
  assert.equal(parseTyped("6 months ago"), "now-6M");
  assert.equal(parseTyped(""), "");
  assert.equal(parseTyped("next tuesday"), null);
  assert.equal(parseTyped("2026-02-30"), null);
});

test("a moving bound is counted from today; months give their first and last days", () => {
  assert.equal(resolve("now-90d", false, NOW), "2026-08-12");
  assert.equal(resolve("now/M", false, NOW), "2026-11-01");
  assert.equal(resolve("now-1y/y", true, NOW), "2025-12-31");
  assert.equal(resolve("now/Q", false, NOW), "2026-10-01");
  assert.equal(resolve("2019-01", false, NOW), "2019-01-01");
  assert.equal(resolve("2019-01", true, NOW), "2019-01-31");
  assert.equal(resolve("", false, NOW), "");
});

test("a bound shows its date first, the same for fixed and moving, and how it is set under it", () => {
  assert.equal(boundDate("now-30d", false, NOW), "11 Oct 2026");
  assert.equal(boundDate("2026-10-11", false, NOW), "11 Oct 2026");
  assert.equal(boundDate("", false, NOW), "the start");
  assert.equal(boundDate("", true, NOW), "the end");
  assert.equal(howSet("now-30d", false), "30 days ago");
  assert.equal(howSet("now/M", false), "this month, start");
  assert.equal(howSet("now-1y/y", true), "last year, end");
  assert.equal(howSet("2026-10-11", false), "");
});

test("the arrow fixes a moving bound and moves a fixed one", () => {
  assert.equal(toggleMoving("now-30d", false, NOW), "2026-10-11");
  assert.equal(toggleMoving("2026-10-11", false, NOW), "now-30d");
  assert.equal(toggleMoving("2026-11-10", false, NOW), "now");
});

test("the address keeps a range as written, either side open, and nothing when both are", () => {
  assert.equal(writeRange({ from: "now-90d", to: "now" }), "now-90d..now");
  assert.equal(writeRange({ from: "", to: "2026-03-01" }), "..2026-03-01");
  assert.equal(writeRange({ from: "", to: "" }), null);
  assert.deepEqual(readRange("now-90d..now"), { from: "now-90d", to: "now" });
  assert.deepEqual(readRange(undefined), { from: "", to: "" });
});

test("a row lies in a range read today; a row without a date only while both ends are open", () => {
  assert.equal(inRange("2026-09-01", readRange("now-90d..now"), NOW), true);
  assert.equal(inRange("2026-08-01", readRange("now-90d..now"), NOW), false);
  assert.equal(inRange(null, readRange("now-90d.."), NOW), false);
  assert.equal(inRange(null, readRange(undefined), NOW), true);
});

test("From moves on to To; a To before the start becomes the start", () => {
  const first = pickDay({ from: "", to: "" }, "from", "2026-03-05", NOW);
  assert.deepEqual(first, { range: { from: "2026-03-05", to: "" }, active: "to" });
  assert.deepEqual(pickDay(first.range, "to", "2026-03-20", NOW).range, { from: "2026-03-05", to: "2026-03-20" });
  assert.deepEqual(pickDay(first.range, "to", "2026-03-01", NOW).range, { from: "2026-03-01", to: "" });
  assert.deepEqual(pickDay({ from: "2026-03-05", to: "2026-03-20" }, "from", "2026-03-25", NOW).range, { from: "2026-03-25", to: "" });
});

test("a typed day is held inside the bounds, and a start after the end swaps them", () => {
  assert.deepEqual(typeBound({ from: "", to: "" }, "from", "2010-01-01", "2019-01-01", "2026-11-30", NOW), { from: "2019-01-01", to: "" });
  assert.deepEqual(typeBound({ from: "", to: "2026-01-01" }, "from", "2026-05-01", "", "", NOW), { from: "2026-01-01", to: "2026-05-01" });
});

test("the months shown stay inside the bounds; a month's grid starts on Monday", () => {
  assert.equal(viewMonth("2026-11", "2019-01-01", "2026-11-30", 2), "2026-10");
  assert.equal(viewMonth("2018-05", "2019-01-01", "2026-11-30", 2), "2019-01");
  const grid = monthGrid("2026-11");
  assert.equal(grid.length, 42);
  assert.equal(grid.findIndex((cell) => cell.inMonth), 6);
  assert.equal(daysIn({ from: "2026-03-05", to: "2026-03-20" }, NOW), 16);
});
