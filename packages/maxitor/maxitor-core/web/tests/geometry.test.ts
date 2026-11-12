// packages/maxitor/maxitor-core/web/tests/geometry.test.ts
// The scale's geometry (spec 079, FR-003, FR-012): time to x and back, the presets, the bar from a day to a minute,
// the axis's steps, and the hatched future right of now.
import assert from "node:assert/strict";
import { test } from "node:test";

import { barStep, clampView, DAY, domainOf, hatchFrom, HOUR, MIN_SPAN, MINUTE, moveView, presetView, SECOND, ticksOf, tickStep, timeAt, xOf, zoomView } from "../components/scale/geometry.ts";

const NOW = Date.parse("2026-11-12T12:00:00Z");

test("time and x are each other's inverse over the stretch in view", () => {
  const view = { from: NOW - DAY, to: NOW };
  assert.equal(xOf(NOW - DAY, view, 720), 0);
  assert.equal(xOf(NOW, view, 720), 720);
  assert.equal(timeAt(360, view, 720), NOW - DAY / 2);
});

test("a bar gets finer as one zooms in, from a week to a second", () => {
  assert.equal(barStep(60 * DAY, 720), DAY);
  assert.equal(barStep(30 * DAY, 720), 12 * HOUR);
  assert.equal(barStep(DAY, 720), 30 * MINUTE);
  assert.equal(barStep(HOUR, 720), MINUTE);
  assert.equal(barStep(MINUTE, 720), SECOND);
  assert.equal(barStep(10 * MINUTE, 720), 10 * SECOND);
  assert.equal(barStep(365 * DAY, 720), 7 * DAY);
});

test("the axis keeps its dates 78 px apart, and says seconds below a minute apart", () => {
  const ticks = ticksOf({ from: NOW, to: NOW + MINUTE }, 720, () => false);
  assert.equal(ticks[1].time - ticks[0].time, 10 * SECOND);
  assert.equal(ticks[0].seconds, true);
  assert.equal(ticksOf({ from: NOW, to: NOW + DAY }, 720, () => false)[0].seconds, false);
  assert.equal(tickStep(DAY, 720), 3 * HOUR);
  assert.equal(tickStep(30 * DAY, 720), 7 * DAY);
});

test("the whole history runs from a day before its first change to a little past now", () => {
  const whole = domainOf(NOW - 10 * DAY, NOW);
  assert.equal(whole.from, NOW - 11 * DAY);
  assert.ok(whole.to > NOW);
  assert.equal(domainOf(null, NOW).from, NOW - 8 * DAY);
});

test("a preset at now leaves now near the right edge; at a moment, the moment in the middle; All is the history", () => {
  const whole = domainOf(NOW - 60 * DAY, NOW);
  const atNow = presetView(DAY, null, NOW, whole);
  assert.ok(Math.abs(atNow.to - (NOW + 0.08 * DAY)) < 1);
  const moment = NOW - 20 * DAY;
  const atMoment = presetView(DAY, moment, NOW, whole);
  assert.equal((atMoment.from + atMoment.to) / 2, moment);
  assert.deepEqual(presetView(null, moment, NOW, whole), whole);
});

test("the stretch stays inside the history, keeps its width against an edge, and is never narrower than a minute", () => {
  const whole = domainOf(NOW - 10 * DAY, NOW);
  const moved = moveView({ from: whole.from, to: whole.from + DAY }, -5 * DAY, whole);
  assert.equal(moved.from, whole.from);
  assert.equal(moved.to - moved.from, DAY);
  const tight = zoomView({ from: NOW - HOUR, to: NOW }, NOW - HOUR / 2, 0.0001, whole);
  assert.equal(tight.to - tight.from, MIN_SPAN);
  assert.equal(MIN_SPAN, MINUTE);
  // A drag across a few pixels asks for seconds: the stretch is kept at a minute.
  assert.equal(clampView({ from: NOW - 2 * SECOND, to: NOW }, whole).to - clampView({ from: NOW - 2 * SECOND, to: NOW }, whole).from, MINUTE);
  assert.deepEqual(clampView({ from: whole.from - DAY, to: whole.to + DAY }, whole), whole);
});

test("the hatch starts at now, never left of the view, and is absent when now is right of it", () => {
  const view = { from: NOW - DAY, to: NOW + DAY };
  assert.equal(hatchFrom(NOW, view, 720), 360);
  assert.equal(hatchFrom(NOW, { from: NOW + HOUR, to: NOW + DAY }, 720), 0);
  assert.equal(hatchFrom(NOW, { from: NOW - DAY, to: NOW - HOUR }, 720), null);
});
