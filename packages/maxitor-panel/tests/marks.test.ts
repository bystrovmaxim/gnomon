// @maxitor/panel — a comparison's marks and the filters' disks drawn as the graph viewer draws them (spec 079,
// FR-022, FR-035, FR-037): the values come from @maxitor/tokens, the rules from the panel's styles.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = read("../../maxitor-tokens/tokens.css");
const marks = read("../src/compare/marks.css");
const shell = read("../src/shell/shell.css");
const canvas = read("../src/canvas/canvas.css");

test("the canvas lies on the graph viewer's surface with its dots", () => {
  assert.match(tokens, /--mx-canvas: #f4f5f7;/);
  assert.match(tokens, /--mx-dot: rgba\(160, 168, 180, 0\.42\);/);
  assert.match(tokens, /--mx-dot-step: 20px;/);
  assert.match(canvas, /\.mx-canvas \{[^}]*background-color: var\(--mx-canvas\)/);
});

test("what changed wears its colour and a halo of it; what did not is faded while the changes paint", () => {
  assert.match(tokens, /--mx-halo-blur: 44px;/);
  assert.match(tokens, /--mx-halo-spread: 34px;/);
  assert.match(tokens, /--mx-halo-strength: 16%;/);
  assert.match(tokens, /--mx-faded: 0\.32;/);
  for (const change of ["added", "changed", "removed"]) assert.match(marks, new RegExp(`\\[data-change="${change}"\\] \\{ --mx-change: var\\(--mx-change-${change}\\); \\}`));
  assert.match(marks, /box-shadow: 0 0 var\(--mx-halo-blur\) var\(--mx-halo-spread\) color-mix\(in srgb, var\(--mx-change\) var\(--mx-halo-strength\), transparent\)/);
  assert.match(marks, /\[data-paint="changes"\] \[data-change="unchanged"\] \{ opacity: var\(--mx-faded\); \}/);
});

test("a row with nothing of its kind keeps its disk and fades its label only; a row switched off fades whole", () => {
  assert.match(shell, /\.mx-filter-row\.absent \.mx-filter-label \{ opacity: var\(--mx-absent\); \}/);
  assert.match(shell, /\.mx-filter-row\.off \{ opacity: 0\.42; \}/);
  assert.doesNotMatch(shell, /\.mx-filter-row\.absent \{/);
});
