// @maxitor/panel — the canvas's camera: every gesture and key, the limits, fit, and screen ↔ canvas both ways.
import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_ZOOM, MIN_ZOOM, fit, key, pinch, toCanvas, toScreen, wheel, zoomAround, type Camera } from "../src/canvas/camera.ts";

const start: Camera = { x: 100, y: 50, zoom: 1 };
const still = { deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, shiftKey: false };

test("a point goes to the canvas and back unchanged", () => {
  const camera = { x: 37, y: -12, zoom: 1.7 };
  const point = toCanvas(camera, { x: 400, y: 300 });
  const back = toScreen(camera, point);
  assert.ok(Math.abs(back.x - 400) < 1e-9 && Math.abs(back.y - 300) < 1e-9);
});

test("a wheel or a swipe moves the picture; Shift moves it sideways", () => {
  assert.deepEqual(wheel(start, { ...still, deltaX: 10, deltaY: 20 }, { x: 0, y: 0 }, 600), { x: 90, y: 30, zoom: 1 });
  assert.deepEqual(wheel(start, { ...still, deltaY: 20, shiftKey: true }, { x: 0, y: 0 }, 600), { x: 80, y: 50, zoom: 1 });
  assert.deepEqual(wheel(start, { ...still, deltaY: 1, deltaMode: 1 }, { x: 0, y: 0 }, 600), { x: 100, y: 34, zoom: 1 });
});

test("Ctrl or ⌘ with the wheel zooms around the pointer", () => {
  const pointer = { x: 300, y: 200 };
  const before = toCanvas(start, pointer);
  for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
    const zoomed = wheel(start, { ...still, ...modifier, deltaY: -100 }, pointer, 600);
    assert.ok(zoomed.zoom > 1);
    const after = toCanvas(zoomed, pointer);
    assert.ok(Math.abs(after.x - before.x) < 1e-9 && Math.abs(after.y - before.y) < 1e-9);
  }
});

test("the zoom stops at its limits", () => {
  assert.equal(zoomAround(start, { x: 0, y: 0 }, 1000).zoom, MAX_ZOOM);
  assert.equal(zoomAround(start, { x: 0, y: 0 }, 0.0001).zoom, MIN_ZOOM);
});

test("fit shows the whole scene in the middle", () => {
  const camera = fit({ x: 0, y: 0, width: 1000, height: 500 }, 600, 400, 50);
  assert.equal(camera.zoom, 0.5);
  const topLeft = toScreen(camera, { x: 0, y: 0 });
  const bottomRight = toScreen(camera, { x: 1000, y: 500 });
  assert.deepEqual([topLeft.x, bottomRight.x], [50, 550]);
  assert.equal((topLeft.y + bottomRight.y) / 2, 200);
});

test("keys zoom, fit and move; any other key is left alone", () => {
  const middle = { x: 300, y: 200 };
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  assert.ok(key(start, "+", middle, bounds, 600, 400)!.zoom > 1);
  assert.ok(key(start, "-", middle, bounds, 600, 400)!.zoom < 1);
  assert.deepEqual(key(start, "0", middle, bounds, 600, 400), fit(bounds, 600, 400));
  assert.deepEqual(key(start, "ArrowRight", middle, bounds, 600, 400), { x: 52, y: 50, zoom: 1 });
  assert.equal(key(start, "a", middle, bounds, 600, 400), null);
});

test("a pinch keeps the fingers on their points", () => {
  const from: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 100, y: 100 }, { x: 200, y: 100 }];
  const to: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 50, y: 100 }, { x: 250, y: 100 }];
  const camera = pinch(start, from, to);
  assert.equal(camera.zoom, 2);
  const left = toScreen(camera, toCanvas(start, from[0]));
  assert.ok(Math.abs(left.x - to[0].x) < 1e-9);
});
