// web/tests/notes.test.ts — what the template's pages decide without a browser (spec 083, FR-001, FR-007 – FR-011):
// a colleague's note marked new after reading again, the note written first, and every refusal said in words.
import assert from "node:assert/strict";
import { test } from "node:test";

import { cardsBounds, latestFirst, newSince, refusalText, revisionLine, when } from "../app/[org]/notes/notes.ts";

test("reading again marks the notes the page did not hold; the first reading marks none", () => {
  assert.deepEqual([...newSince(null, ["a", "b"])], []);
  assert.deepEqual([...newSince(new Set(["a", "b"]), ["c", "a", "b"])], ["c"]);
});

test("the note changed last stands first, so a note just written is the first card", () => {
  const notes = [
    { id: "old", updated_at: "2026-11-10T09:00:00.000000Z" },
    { id: "new", updated_at: "2026-11-12T10:15:00.123456Z" },
  ];
  assert.deepEqual(latestFirst(notes).map((note) => note.id), ["new", "old"]);
});

test("every refusal of the template's actions is said in words", () => {
  assert.match(refusalText({ error: "changed_since", changed_by: "Olga", changed_at: "2026-11-12T10:15:00.000000Z" }), /^Olga changed this note on 12 Nov 2026, 10:15 after you opened it\. Your text is kept/);
  assert.match(refusalText({ error: "deleted", deleted_by: "Boris", deleted_at: "2026-11-12T11:00:00.000000Z" }), /^Boris deleted this note on 12 Nov 2026, 11:00\. Your text is kept/);
  assert.equal(refusalText({ error: "nothing_to_publish", revision: 3 }), "Nothing changed since revision 3: there is nothing to publish.");
  assert.equal(refusalText({ error: "no_such_note" }), "This note no longer exists.");
  assert.equal(refusalText(null, 0), "The notes could not be reached. Try again in a moment.");
  for (const reason of ["no_such_item", "moment_not_come", "title_taken", "forbidden", "not_found"]) {
    assert.notEqual(refusalText({ error: reason }, 409), "This could not be done.", reason);
  }
});

test("the cards' grid takes three columns and as many rows as the notes need", () => {
  assert.deepEqual(cardsBounds(7), { x: 0, y: 0, width: 872, height: 3 * 180 + 2 * 16 });
  assert.equal(when("2026-03-05T08:30:00.000000Z"), "5 Mar 2026, 08:30");
  assert.equal(revisionLine({ ref: "v3", title: "First release", release: "2026.11" }), "v3 · First release · 2026.11");
});

// ── Published's head as the accepted mockup of #121 writes it (spec 079, FR-042)

import { publishedLine } from "../app/[org]/notes/notes.ts";

test("Published's head line says who published it, when, the release and how many notes by how many authors", () => {
  const revision = { publisher_name: "Anna Kovaleva", at: "2026-11-10T09:40:00.000000Z", release: "handbook 2026.11" };
  const notes = [{ writer_id: "a" }, { writer_id: "b" }, { writer_id: "a" }];
  assert.equal(publishedLine(revision, notes), "Anna Kovaleva published it 10 Nov 2026, 09:40 · release handbook 2026.11 · 3 notes by 2 authors · read only");
  assert.equal(publishedLine({ ...revision, release: null }, [{ writer_id: "a" }]), "Anna Kovaleva published it 10 Nov 2026, 09:40 · 1 note by 1 author · read only");
});
