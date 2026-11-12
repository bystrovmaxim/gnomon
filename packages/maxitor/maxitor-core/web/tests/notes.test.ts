// packages/maxitor/maxitor-core/web/tests/notes.test.ts
// The notes of Side by side (spec 079, FR-023): what a panel says when it cannot show what the other points at.
import assert from "node:assert/strict";
import { test } from "node:test";

import { anchorName, noteOf } from "../lib/notes.ts";

const chain = ["field:Account.email", "table:Account"];

test("a panel that holds and shows the element says nothing; one that brought it says so briefly", () => {
  assert.equal(noteOf({ chain, anchor: chain[0], held: true, hidden: false, brought: false }, "A"), null);
  assert.deepEqual(noteOf({ chain, anchor: chain[0], held: true, hidden: false, brought: true }, "A"), { name: null, text: "Brought to the centre", brief: true });
});

test("a panel that holds only a parent names the missing element and the parent shown", () => {
  assert.deepEqual(noteOf({ chain, anchor: "table:Account", held: false, hidden: false, brought: false }, "A"), { name: "email", text: "is not in A · showing Account", brief: false });
});

test("a panel that holds nothing of the chain says so, or that its filters hide it", () => {
  assert.deepEqual(noteOf({ chain: ["table:Refund"], anchor: null, held: false, hidden: false, brought: false }, "A"), { name: null, text: "Not in A", brief: false });
  assert.deepEqual(noteOf({ chain: ["table:Ledger"], anchor: null, held: false, hidden: true, brought: false }, "B"), { name: null, text: "Hidden by the filters", brief: false });
});

test("an anchor's name is the last part after its kind", () => {
  assert.equal(anchorName("row:acc-00007"), "acc-00007");
  assert.equal(anchorName("link:Payment.account_id->Account.id"), "id");
});
