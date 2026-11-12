// @maxitor/panel — anchors (spec 079, FR-021 – FR-024): the chain under the pointer, the deepest first; the deepest
// anchor a panel holds; whether it is in view.
import assert from "node:assert/strict";
import { test } from "node:test";

import { chainOf as chainWithin, deepestHeld, inView, sameChain } from "../src/canvas/anchors.ts";
import { MAX_ANCHOR, MAX_CHAIN } from "../src/protocol.ts";

const chainOf = (element: Parameters<typeof chainWithin>[0]) => chainWithin(element, { chain: MAX_CHAIN, anchor: MAX_ANCHOR });

type El = { getAttribute(name: string): string | null; parentElement: El | null };
const element = (anchor: string | null, parent: El | null): El => ({ getAttribute: (name) => (name === "data-room-anchor" ? anchor : null), parentElement: parent });

test("the chain runs from the deepest anchored element out, skipping elements without one", () => {
  const table = element("table:Account", element(null, null));
  const field = element("field:Account.email", element(null, table));
  assert.deepEqual(chainOf(element(null, field)), ["field:Account.email", "table:Account"]);
  assert.deepEqual(chainOf(element(null, null)), []);
});

test("a chain holds at most 8 anchors", () => {
  let node: El | null = null;
  for (let index = 0; index < 12; index += 1) node = element(`n:${index}`, node);
  assert.equal(chainOf(node).length, 8);
});

test("the deepest anchor held is the panel's answer: the field itself, or its table when the field is not there", () => {
  const chain = ["field:Account.email", "table:Account"];
  assert.deepEqual(deepestHeld(chain, () => true), { anchor: "field:Account.email", deepest: true });
  assert.deepEqual(deepestHeld(chain, (anchor) => anchor === "table:Account"), { anchor: "table:Account", deepest: false });
  assert.deepEqual(deepestHeld(chain, () => false), { anchor: null, deepest: false });
});

test("an element is in view only when it lies wholly inside it", () => {
  const view = { x: 0, y: 0, width: 100, height: 100 };
  assert.equal(inView({ x: 10, y: 10, width: 20, height: 20 }, view), true);
  assert.equal(inView({ x: 90, y: 10, width: 20, height: 20 }, view), false);
});

test("two chains are the same when they name the same anchors in order", () => {
  assert.equal(sameChain(["a", "b"], ["a", "b"]), true);
  assert.equal(sameChain(["a"], null), false);
  assert.equal(sameChain(null, null), true);
});
