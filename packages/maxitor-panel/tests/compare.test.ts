// @maxitor/panel — what a comparison steps through (spec 079, FR-025 – FR-027): the list grouped by its groups, one step
// round the end, what the stepper says, the counts, and the actions on a milestone.
import assert from "node:assert/strict";
import { test } from "node:test";

import { changeLines, countsOf, nextChange, stepperText } from "../src/compare/changes.ts";
import { milestoneActions } from "../src/shell/address.ts";

const entries = [
  { key: "table:Account", title: "Account", status: "changed" as const, group: "Billing" },
  { key: "table:Refund", title: "Refund", status: "added" as const, group: "Billing" },
  { key: "table:Ledger", title: "Ledger", status: "removed" as const, group: "Ledger" },
];

test("the list names each group above its changes, in the order of the steps", () => {
  assert.deepEqual(changeLines(entries).map((line) => ("group" in line ? `# ${line.group}` : line.entry.title)), ["# Billing", "Account", "Refund", "# Ledger", "Ledger"]);
});

test("a step goes round the end; from no change, forwards is the first and backwards the last", () => {
  assert.equal(nextChange(null, 1, 3), 0);
  assert.equal(nextChange(null, -1, 3), 2);
  assert.equal(nextChange(2, 1, 3), 0);
  assert.equal(nextChange(0, -1, 3), 2);
});

test("the stepper says how many changes, or where one stands", () => {
  assert.equal(stepperText(null, 3), "3 changes");
  assert.equal(stepperText(null, 1), "1 change");
  assert.equal(stepperText(1, 3), "2 of 3");
  assert.equal(stepperText(1, 3, true), "2/3");
});

test("the counts the pill shows", () => {
  assert.deepEqual(countsOf(entries), { added: 1, removed: 1, changed: 1 });
});

test("an action on a milestone stands exactly on it, outside a comparison, titled with it", () => {
  const actions = [{ on: "milestone" as const, kinds: ["published"], title: "Roll back to {ref}", action: "rollback_publication", ask: true }];
  const on = { at: "2026-11-04T12:00:00.000000Z", against: null, side: null, milestone: "v3" };
  assert.deepEqual(milestoneActions(actions, on).map((each) => each.title), ["Roll back to v3"]);
  assert.deepEqual(milestoneActions(actions, { ...on, milestone: null }), []);
  assert.deepEqual(milestoneActions(actions, { ...on, against: "2026-11-01T00:00:00.000000Z" }), []);
  assert.deepEqual(milestoneActions(actions, { ...on, at: null }), []);
});
