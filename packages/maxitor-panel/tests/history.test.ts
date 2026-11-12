// @maxitor/panel — a page's history, given by the page and checked by the core (spec 082, FR-001 – FR-005).
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkHistory, historyOf, NO_HISTORY, pageMessage } from "../src/protocol.ts";

const ALLOWED = { actions: ["list_item_notes", "list_note_history", "note_milestone_card"], compare: ["diff", "side_by_side"] };

test("a page's history travels in panel.history; a shape the protocol does not know is dropped", () => {
  const history = { read: "list_item_notes", milestones: "list_note_history", compare: ["diff"], legend: { added: "New" } };
  assert.deepEqual(pageMessage({ type: "panel.history", history }), { type: "panel.history", history });
  assert.equal(pageMessage({ type: "panel.history", history: { read: "List Notes" } }), null);
  assert.equal(pageMessage({ type: "panel.history", history: { compare: ["overlay"] } }), null);
  assert.equal(historyOf([]), null);
});

test("panel.ready carries no surface: pointers travel on the canvas only", () => {
  assert.deepEqual(pageMessage({ type: "panel.ready", build: "0.4.0", shell: true, shellVersion: "0.4.0", surface: "document" }), {
    type: "panel.ready",
    build: "0.4.0",
    shell: true,
    shellVersion: "0.4.0",
  });
});

test("every name a page gives must be an action of the plugin; the rest of its history is kept", () => {
  const { kept, refused } = checkHistory({ read: "list_item_notes", milestones: "list_things", card: "note_milestone_card" }, ALLOWED);
  assert.deepEqual(refused, ['milestones names "list_things", which is no action of the plugin']);
  assert.deepEqual(kept, { read: "list_item_notes", card: "note_milestone_card", compare: ["diff", "side_by_side"] });
});

test("a page's comparisons narrow the passport's and never widen them", () => {
  assert.deepEqual(checkHistory({ compare: [] }, ALLOWED), { kept: { compare: [] }, refused: [] });
  const wider = checkHistory({ compare: ["diff", "side_by_side"] }, { actions: [], compare: ["diff"] });
  assert.deepEqual(wider.kept.compare, ["diff"]);
  assert.deepEqual(wider.refused, [`compare offers "side_by_side", which the passport's history does not`]);
});

test("a page that gives no history is offered one moment only", () => {
  assert.deepEqual(NO_HISTORY, { compare: [] });
});
