// web/tests/draft.test.ts — what the draft's and the published notes' pages decide without a browser (spec 084,
// FR-004, FR-005, FR-010, FR-014, FR-018, FR-019, FR-025 – FR-027).
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  baseLine,
  baseRevisionOf,
  choiceLabel,
  conflictLine,
  conflictsOf,
  counts,
  draftOrder,
  marksInDraft,
  raceLine,
  stateRows,
  visibleChanges,
  visibleStates,
  waitingLine,
  type Change,
} from "../app/[org]/notes/draft.ts";

function change(over: Partial<Change> = {}): Change {
  return {
    note_id: "n1",
    state: "changed",
    body: "Mine",
    base_body: "Old",
    base_revision: 6,
    writer_id: "a",
    writer_name: "Anna",
    changed_at: "2026-11-10T10:20:00.000000Z",
    conflict: false,
    published_body: null,
    published_by_name: "",
    published_at: "",
    ...over,
  };
}

test("the State filter starts with every state on and keeps only the states chosen", () => {
  assert.deepEqual([...visibleStates(undefined)], ["new", "changed", "deleted"]);
  assert.deepEqual([...visibleStates("new,deleted")], ["new", "deleted"]);
  const changes = [change({ state: "new" }), change({ state: "changed", note_id: "n2" }), change({ state: "deleted", note_id: "n3" })];
  assert.deepEqual(visibleChanges(changes, "new,deleted").map((one) => one.note_id), ["n1", "n3"]);
});

test("a state with no change behind it is faint in the filter", () => {
  const rows = stateRows([change({ state: "changed" })]);
  assert.deepEqual(rows.map((row) => [row.key, row.label, row.absent]), [
    ["new", "New", true],
    ["changed", "Changed", false],
    ["deleted", "Deleted", true],
  ]);
  assert.deepEqual(rows.map((row) => row.mark), ["+", "~", "−"]);
});

test("the change made last stands first and the head counts each state", () => {
  const changes = [change({ changed_at: "2026-11-10T09:00:00.000000Z" }), change({ note_id: "n2", changed_at: "2026-11-11T09:00:00.000000Z" })];
  assert.deepEqual(draftOrder(changes).map((one) => one.note_id), ["n2", "n1"]);
  assert.deepEqual(counts([...changes, change({ state: "deleted", note_id: "n3" })]), { new: 0, changed: 2, deleted: 1 });
});

test("only a change that meets someone else's publication is a conflict, and the notice names them and their moment", () => {
  const changes = [
    change(),
    change({ note_id: "n2", conflict: true, published_body: "Olga's", published_by_name: "Olga", published_at: "2026-11-10T11:05:00.000000Z" }),
  ];
  assert.deepEqual(conflictsOf(changes).map((one) => one.note_id), ["n2"]);
  assert.match(raceLine(changes) ?? "", /^Olga published on 10 Nov 2026, 11:05, after v6 your draft was made over\. 1 of your changes meet theirs/);
  assert.equal(raceLine([change()]), null);
});

test("a conflict where the note was deleted says so and offers the restoration", () => {
  const deleted = change({ conflict: true, published_body: null, published_by_name: "Olga", published_at: "2026-11-10T11:05:00.000000Z" });
  assert.match(raceLine([deleted]) ?? "", /deleted one of them/);
  assert.equal(conflictLine(deleted), "You changed it; Olga deleted it.");
  assert.equal(choiceLabel(deleted, "overwrite"), "Restore it with mine");
  assert.equal(choiceLabel(deleted, "give_up"), "Give up mine");
});

test("a deletion that meets a change offers to delete anyway or keep theirs", () => {
  const deleted = change({ state: "deleted", conflict: true, published_body: "Olga's", published_by_name: "Olga", published_at: "2026-11-10T11:05:00.000000Z" });
  assert.equal(conflictLine(deleted), "You deleted it; Olga changed it.");
  assert.equal(choiceLabel(deleted, "overwrite"), "Delete it anyway");
  assert.equal(choiceLabel(deleted, "give_up"), "Keep theirs");
});

test("the draft counts from the smallest base and says what waits", () => {
  assert.equal(baseRevisionOf([change({ base_revision: 6 }), change({ note_id: "n2", base_revision: 4 })]), 4);
  assert.equal(baseRevisionOf([change({ state: "new", base_revision: null })]), null);
  assert.equal(waitingLine([change(), change({ note_id: "n2" })]), "2 changes");
  assert.equal(waitingLine([change()]), "1 change");
});

test("Published marks each note with the state it waits in", () => {
  const marks = marksInDraft([change({ note_id: "n1", state: "changed" }), change({ note_id: "n2", state: "deleted" })]);
  assert.equal(marks.get("n1"), "changed");
  assert.equal(marks.get("n2"), "deleted");
  assert.equal(marks.get("n3"), undefined);
});

test("a card's foot names whose note it is and the revision it was made over", () => {
  assert.equal(baseLine(change()), "Anna's note as v6 has it · you changed it");
  assert.equal(baseLine(change({ state: "deleted" })), "Anna's note as v6 has it · you deleted it");
  assert.equal(baseLine(change({ state: "new", base_revision: null })), "Written by you; not published yet");
});
