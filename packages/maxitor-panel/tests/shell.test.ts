// @maxitor/panel — the shell's address rules (spec 078, FR-004, FR-008, FR-011, FR-012).
import assert from "node:assert/strict";
import { test } from "node:test";

import { actionsShown, chosen, filterOn, isMissing, isReserved, reservedIn, toggleFilter, withParam, writeChoice } from "../src/shell/address.ts";

const AUTHORS = ["anna", "ilya", "olga"];

test("a filter with every option on is absent from the address", () => {
  assert.deepEqual([...filterOn(undefined, AUTHORS)], AUTHORS);
  assert.equal(toggleFilter("anna,ilya", AUTHORS, "olga"), null);
});

test("a filter lists the options still on, in the page's order", () => {
  assert.equal(toggleFilter(undefined, AUTHORS, "ilya"), "anna,olga");
  assert.equal(toggleFilter("olga,anna", AUTHORS, "anna"), "olga");
  assert.equal(toggleFilter("olga", AUTHORS, "anna"), "anna,olga");
});

test("a listed value the page no longer gives is ignored", () => {
  assert.deepEqual([...filterOn("anna,gone", AUTHORS)], ["anna"]);
});

test("a choice never writes its default and shows the default for a value it does not offer", () => {
  assert.equal(writeChoice("list", "list"), null);
  assert.equal(writeChoice("table", "list"), "table");
  assert.equal(chosen("table", "list", ["list", "table"]), "table");
  assert.equal(chosen("graph", "list", ["list", "table"]), "list");
  assert.equal(chosen(undefined, "list", ["list", "table"]), "list");
});

test("a value missing from the page's new options is found, an absent one is not", () => {
  assert.equal(isMissing("events", ["domains", "actions"]), true);
  assert.equal(isMissing("domains", ["domains", "actions"]), false);
  assert.equal(isMissing(undefined, ["domains"]), false);
});

test("the core's names are reserved, case ignored, and every other name is the page's", () => {
  for (const name of ["at", "mode", "from", "_x", "AT", "Mode", "_"]) assert.equal(isReserved(name), true, name);
  for (const name of ["layer", "view", "author", "paint", "modes", "fromage"]) assert.equal(isReserved(name), false, name);
  assert.deepEqual(reservedIn({ view: "table", mode: "diff", _room: "1" }), ["mode", "_room"]);
});

test("a parameter is set and removed without touching the others", () => {
  assert.deepEqual(withParam({ a: "1", b: "2" }, "b", null), { a: "1" });
  assert.deepEqual(withParam({ a: "1" }, "b", "3"), { a: "1", b: "3" });
});

test("the page's actions show only at now", () => {
  assert.equal(actionsShown({}, null), true);
  assert.equal(actionsShown({}, "2026-11-01T10:00:00Z"), false);
  assert.equal(actionsShown({ mode: "diff" }, null), false);
});
