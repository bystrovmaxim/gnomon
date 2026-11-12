// @maxitor/panel — the scale's keys (spec 079, FR-005): Shift + an arrow, never while one types or on a handle.
import assert from "node:assert/strict";
import { test } from "node:test";

import { changeStepOfKey, stepOfKey } from "../src/keys.ts";

const press = (key: string, more: Partial<KeyboardEvent> = {}) =>
  ({ key, shiftKey: true, altKey: false, ctrlKey: false, metaKey: false, target: null, ...more }) as KeyboardEvent;
const inside = (selector: string) => ({ closest: (asked: string) => (asked.includes(selector) ? {} : null) }) as unknown as EventTarget;

test("Shift + ← → step the moment and Shift + ↑ ↓ the changes", () => {
  assert.equal(stepOfKey(press("ArrowLeft")), -1);
  assert.equal(stepOfKey(press("ArrowRight")), 1);
  assert.equal(changeStepOfKey(press("ArrowUp")), -1);
  assert.equal(changeStepOfKey(press("ArrowDown")), 1);
  assert.equal(stepOfKey(press("ArrowUp")), null);
});

test("an arrow without Shift, or with another modifier, steps nothing", () => {
  assert.equal(stepOfKey(press("ArrowLeft", { shiftKey: false })), null);
  assert.equal(stepOfKey(press("ArrowLeft", { metaKey: true })), null);
});

test("nothing steps while one types or on a handle of the scale", () => {
  assert.equal(stepOfKey(press("ArrowLeft", { target: inside("input") })), null);
  assert.equal(stepOfKey(press("ArrowLeft", { target: inside('[role="slider"]') })), null);
});
