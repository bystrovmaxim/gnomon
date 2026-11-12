// @maxitor/panel — a page's history, given by the page and checked by the core (spec 082, FR-001 – FR-005).
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkHistory, historyOf, NO_HISTORY, pageMessage } from "../src/protocol.ts";

const ALLOWED = { actions: ["list_item_notes", "list_note_history", "note_milestone_card"], compare: ["diff", "side_by_side"] };

test("a page's history travels in panel.history; a shape the protocol does not know is dropped", () => {
  const history = { read: "list_item_notes", milestones: "list_note_history", compare: ["diff"] };
  assert.deepEqual(pageMessage({ type: "panel.history", history }), { type: "panel.history", history });
  // Format 1's words of the legend left with format 2: the legend is the page's kinds now.
  assert.deepEqual(pageMessage({ type: "panel.history", history: { ...history, legend: { added: "New" } } }), { type: "panel.history", history });
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

const KINDS = {
  published: { tone: "purple", look: "filled", lead: "solid", term: "Published", def: "The notes as they were published." },
  rollback: { tone: "red", look: "filled", lead: "solid", term: "Rolled back", def: "A publication that brought back an earlier one." },
} as const;

test("format 2 carries the page's kinds, its promises and its actions on a milestone", () => {
  const history = {
    milestones: "list_note_history",
    kinds: KINDS,
    small: "A small point did not change the graph.",
    actions: [{ on: "milestone", kinds: ["published", "rollback"], title: "Roll back to {ref}", action: "note_milestone_card", ask: true }],
  };
  assert.deepEqual(historyOf(history), history);
  assert.equal(historyOf({ kinds: { published: { tone: "purple" } } }), null);
  assert.equal(historyOf({ actions: [{ on: "milestone", kinds: "published", title: "x", action: "y", ask: true }] }), null);
  const { kept, refused } = checkHistory(history as never, ALLOWED);
  assert.deepEqual(refused, []);
  assert.deepEqual(kept.kinds, KINDS);
});

test("the core drops a kind of words it does not draw, names it, and keeps the rest", () => {
  const { kept, refused } = checkHistory(
    {
      kinds: {
        published: KINDS.published,
        Shiny: KINDS.published,
        pink: { ...KINDS.published, tone: "pink" as never },
        ring: { ...KINDS.published, look: "ring" as never },
      },
      flag: "x".repeat(161),
      actions: [
        { on: "milestone", kinds: ["rollback"], title: "Roll back to {ref}", action: "note_milestone_card", ask: true },
        { on: "milestone", kinds: ["published"], title: "Roll back to {ref}", action: "rollback_publication", ask: true },
      ],
    },
    ALLOWED,
  );
  assert.deepEqual(Object.keys(kept.kinds ?? {}), ["published"]);
  assert.equal(kept.flag, undefined);
  assert.deepEqual(kept.actions, []);
  assert.deepEqual(refused, [
    'the kind "Shiny" is no name of a kind',
    `the kind "pink" has the tone "pink", which is not of the core's palette`,
    'the kind "ring" has the look "ring", which the core does not draw',
    "flag is longer than 160 characters",
    'the action "note_milestone_card" names a kind the page did not declare',
    'an action names "rollback_publication", which is no action of the plugin',
  ]);
});

test("a page declares at most 12 kinds", () => {
  const kinds = Object.fromEntries(Array.from({ length: 13 }, (_, index) => [`kind_${index}`, KINDS.published]));
  const { kept, refused } = checkHistory({ kinds }, ALLOWED);
  assert.equal(Object.keys(kept.kinds ?? {}).length, 12);
  assert.deepEqual(refused, ['the kind "kind_12" is past the 12 a page may declare']);
});
