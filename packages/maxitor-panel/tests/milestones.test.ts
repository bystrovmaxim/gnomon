// @maxitor/panel — the milestones the core keeps (spec 079, FR-008, FR-009): only of declared kinds, small only with
// small, a flag only with flag, each refusal named; a card is the blocks of a known shape.
import assert from "node:assert/strict";
import { test } from "node:test";

import { acceptMilestones, barsOf, blocksOf, inForce } from "../src/history.ts";

const KIND = { tone: "purple", look: "filled", lead: "solid", term: "Published", def: "Published notes." } as const;
const SETUP = { kinds: { published: KIND, rollback: { ...KIND, tone: "red" as const } } };
const at = (day: number) => `2026-11-${String(day).padStart(2, "0")}T12:00:00.000000Z`;

test("a milestone of an undeclared kind, a small point without small and a flag without flag are dropped and named", () => {
  const { kept, refused } = acceptMilestones(
    {
      milestones: [
        { id: "v2", at: at(5), ref: "v2", title: "Second", kind: "published" },
        { id: "v1", at: at(3), ref: "v1", title: "First", kind: "published", comment: "Agreed" },
        { id: "pr7", at: at(4), ref: "#7", title: "Merged", kind: "merged" },
        { id: "v3", at: at(6), ref: "v3", title: "Wording", kind: "published", small: true },
        { id: "v4", at: at(7), ref: "v4", title: "Release", kind: "rollback", flag: "2026.11" },
      ],
    },
    SETUP,
  );
  assert.deepEqual(kept.map((m) => m.id), ["v1", "v2"]);
  assert.equal(kept[0].comment, "Agreed");
  assert.deepEqual(refused, [
    'the milestone "pr7" is of the kind "merged", which the page did not declare',
    'the milestone "v3" is small, and the page did not declare small',
    'the milestone "v4" carries a flag, and the page did not declare flag',
  ]);
});

test("with small and flag declared, small points and flags are kept", () => {
  const { kept, refused } = acceptMilestones(
    { milestones: [{ id: "v3", at: at(6), ref: "v3", title: "Wording", kind: "published", small: true, flag: "2026.11" }] },
    { ...SETUP, small: "A small point only edited.", flag: "A release." },
  );
  assert.deepEqual(refused, []);
  assert.deepEqual(kept[0], { id: "v3", at: at(6), ref: "v3", title: "Wording", kind: "published", small: true, flag: "2026.11" });
});

test("the milestone in force is the latest not later than the moment; one that is no state never is", () => {
  const milestones = [
    { id: "v1", at: at(3), ref: "v1", title: "First", kind: "published" },
    { id: "pr", at: at(4), ref: "#8", title: "Open", kind: "published", opens: "/pulls/8" },
  ];
  assert.equal(inForce(milestones, at(2)), null);
  assert.equal(inForce(milestones, at(5))?.id, "v1");
});

test("bars and blocks pass only in their shape", () => {
  assert.deepEqual(barsOf({ bars: [{ start: at(3), added: 1, changed: 0, removed: 2 }] }), [{ start: at(3), added: 1, changed: 0, removed: 2 }]);
  assert.equal(barsOf({ bars: [{ start: "yesterday", added: 1, changed: 0, removed: 0 }] }), null);
  assert.deepEqual(blocksOf({ blocks: [{ title: "Refunds" }, { script: "alert(1)" }, { person: { id: "a", name: "Anna" } }] }), [{ title: "Refunds" }, { person: { id: "a", name: "Anna" } }]);
});
