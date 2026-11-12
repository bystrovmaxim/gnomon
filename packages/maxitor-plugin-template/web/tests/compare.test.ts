// web/tests/compare.test.ts — the published notes at two moments compared (spec 079, FR-048 – FR-050).
import assert from "node:assert/strict";
import { test } from "node:test";

import { compareNotes, snippet } from "../app/[org]/notes/compare.ts";

const note = (id: string, body: string, writer = "Anna") => ({ id, writer_name: writer, body });
const a = [note("n1", "Retry three times"), note("n2", "Import by 06:00"), note("n3", "Tokens rotate", "Olga")];
const b = [note("n1", "Retry five times"), note("n2", "Import by 06:00"), note("n4", "Payouts twice a day", "Olga")];

test("Diff marks B against A and draws what B lost as removed ghosts", () => {
  const { status, ghosts, steps } = compareNotes(b, a, null);
  assert.deepEqual([...status], [["n1", "changed"], ["n2", "unchanged"], ["n4", "added"], ["n3", "removed"]]);
  assert.deepEqual(ghosts.map((each) => each.id), ["n3"]);
  assert.deepEqual(steps.map((step) => `${step.group}: ${step.status} ${step.key}`), ["Anna: changed note:n1", "Olga: added note:n4", "Olga: removed note:n3"]);
});

test("Side by side: A marks what B does not have as removed, B what A did not have as added; no ghosts", () => {
  assert.equal(compareNotes(a, b, "a").status.get("n3"), "removed");
  assert.equal(compareNotes(b, a, "b").status.get("n4"), "added");
  assert.deepEqual(compareNotes(b, a, "b").ghosts, []);
});

test("one moment compares nothing; a long note is named by its first words", () => {
  assert.equal(compareNotes(b, null, null).status.size, 0);
  assert.equal(snippet("a ".repeat(50), 10), "a a a a a…");
});
