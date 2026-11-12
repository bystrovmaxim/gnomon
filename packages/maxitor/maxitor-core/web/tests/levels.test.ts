// packages/maxitor/maxitor-core/web/tests/levels.test.ts
// The levels of the left panel (spec 085, FR-011 – FR-013): the line of a node, and the entered nodes on it that an
// address gives the panel. Back and a crumb step out of exactly these levels, the deepest last.
import assert from "node:assert/strict";
import { test } from "node:test";

import { enteredInLine, lineOf } from "../lib/levels.ts";

type Node = { name: string; parent: string; opens: "expand" | "enter" };

const settings: Node = { name: "settings", parent: "root", opens: "enter" };
const plugins: Node = { name: "settings.plugins", parent: "settings", opens: "expand" };
const notes: Node = { name: "notes", parent: "root", opens: "enter" };
const item: Node = { name: "notes:item", parent: "notes", opens: "expand" };
const page: Node = { name: "notes:item-notes", parent: "notes:item", opens: "expand" };
const tree = [settings, plugins, notes, item, page];

test("the line runs from the root to the node, the node last, and stops at a parent the tree does not hold", () => {
  assert.deepEqual(
    lineOf(tree, page).map((node) => node.name),
    ["notes", "notes:item", "notes:item-notes"],
  );
  assert.deepEqual(
    lineOf(tree, { name: "lost", parent: "nowhere", opens: "expand" }).map((node) => node.name),
    ["lost"],
  );
});

test("a page inside an entered node gives the panel that node, and nothing that only expands", () => {
  assert.deepEqual(
    enteredInLine(tree, page).map((node) => node.name),
    ["notes"],
  );
});

test("a page of an entered node itself gives the panel that node too: its level, not the one above", () => {
  const ownPage: Node = { name: "notes:own", parent: "notes", opens: "expand" };
  assert.deepEqual(
    enteredInLine([...tree, ownPage], notes).map((node) => node.name),
    ["notes"],
  );
});

test("entered nodes nest, the deepest last, which is the head of the panel", () => {
  const inner: Node = { name: "notes:inner", parent: "notes", opens: "enter" };
  const deep: Node = { name: "notes:inner:page", parent: "notes:inner", opens: "expand" };
  assert.deepEqual(
    enteredInLine([...tree, inner, deep], deep).map((node) => node.name),
    ["notes", "notes:inner"],
  );
});

test("a tree with no entered node gives no level at all: the panel shows its root", () => {
  const plain = [
    { name: "notes", parent: "root", opens: "expand" as const },
    { name: "notes:item", parent: "notes", opens: "expand" as const },
  ];
  assert.deepEqual(enteredInLine(plain, plain[1]), []);
});
