// packages/maxitor/maxitor-core/web/tests/moment.test.ts
// The moment of the screen (spec 079, FR-002 – FR-005): kept as chosen to the minute, now at the watermark's minute,
// refused past the watermark, and stepped through the page's changes by the pill's arrows.
import assert from "node:assert/strict";
import { test } from "node:test";

import { canStep, chosenMoment, laterThan, momentOf, momentText, msOf, spanText, startsDay, stepMoment, unitOf } from "../lib/moment.ts";

const WATERMARK = "2026-11-12T12:00:30.123456Z";

test("a chosen moment is kept to the minute and written to the microsecond", () => {
  assert.equal(chosenMoment(Date.parse("2026-11-10T09:41:17.900Z"), WATERMARK), "2026-11-10T09:41:00.000000Z");
  assert.equal(momentOf(Date.parse("2026-11-10T09:41:59.999Z")), "2026-11-10T09:41:00.000000Z");
});

test("a moment at the watermark's minute or later is now, never a moment past it", () => {
  assert.equal(chosenMoment(Date.parse("2026-11-12T12:00:01Z"), WATERMARK), null);
  assert.equal(chosenMoment(Date.parse("2026-11-13T00:00:00Z"), WATERMARK), null);
  assert.equal(chosenMoment(Date.parse("2026-11-12T11:59:59Z"), WATERMARK), "2026-11-12T11:59:00.000000Z");
});

test("a moment later than the watermark is refused, whatever its fraction says", () => {
  assert.equal(laterThan("2026-11-12T12:00:30.2Z", WATERMARK), true);
  assert.equal(laterThan("2026-11-12T12:00:30.123456Z", WATERMARK), false);
  assert.equal(laterThan("2026-11-12T12:00:30Z", WATERMARK), false);
  assert.equal(msOf("2026-11-12T12:00:30.123456Z"), Date.parse("2026-11-12T12:00:30.123Z"));
});

test("the arrows step to the previous and the next change, and past the last one to now", () => {
  const changes = ["2026-11-10T09:00:00.000000Z", "2026-11-11T09:00:00.000000Z", "2026-11-12T09:00:00.000000Z"];
  assert.equal(stepMoment(changes, null, WATERMARK, -1), "2026-11-12T09:00:00.000000Z");
  assert.equal(stepMoment(changes, "2026-11-11T09:00:00.000000Z", WATERMARK, -1), "2026-11-10T09:00:00.000000Z");
  assert.equal(stepMoment(changes, "2026-11-10T09:00:00.000000Z", WATERMARK, -1), undefined);
  assert.equal(stepMoment(changes, "2026-11-10T09:00:00.000000Z", WATERMARK, 1), "2026-11-11T09:00:00.000000Z");
  assert.equal(stepMoment(changes, "2026-11-12T09:00:00.000000Z", WATERMARK, 1), null);
  assert.equal(stepMoment(changes, null, WATERMARK, 1), undefined);
});

test("a page without changes has no older step; the newer arrow leads back to now from the past", () => {
  assert.deepEqual(canStep([], null, WATERMARK), { older: false, newer: false });
  assert.deepEqual(canStep([], "2026-11-01T00:00:00.000000Z", WATERMARK), { older: false, newer: true });
});

test("zoomed below a minute, a choice is kept to the second, and a moment off a minute's start says its seconds", () => {
  assert.equal(unitOf(10_000), 1000);
  assert.equal(unitOf(60_000), 60_000);
  assert.equal(chosenMoment(Date.parse("2026-11-10T09:41:17.900Z"), WATERMARK, unitOf(1000)), "2026-11-10T09:41:17.000000Z");
  assert.equal(chosenMoment(Date.parse("2026-11-12T12:00:30.500Z"), WATERMARK, 1000), null);
  assert.equal(chosenMoment(Date.parse("2026-11-12T12:00:29.500Z"), WATERMARK, 1000), "2026-11-12T12:00:29.000000Z");
  assert.equal(momentText(Date.parse("2026-11-12T16:47:28.120Z"), Date.parse(WATERMARK)), "12 Nov, 16:47:28");
});

test("a stretch is said in seconds, minutes, hours or days", () => {
  assert.equal(spanText(45 * 1000), "45 s");
  assert.equal(spanText(45 * 60_000), "45 min");
  assert.equal(spanText(6 * 3_600_000), "6 h");
  assert.equal(spanText(12 * 86_400_000), "12 days");
});

test("a moment reads in UTC, as the address and every plugin's page write it, whatever the reader's zone", () => {
  const at = Date.parse("2026-11-12T17:04:00Z");
  assert.equal(momentText(at, at), "12 Nov, 17:04");
  assert.equal(startsDay(Date.parse("2026-11-12T00:00:00Z")), true);
  assert.equal(startsDay(Date.parse("2026-11-12T21:00:00Z")), false);
});
