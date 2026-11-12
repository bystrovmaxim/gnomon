// packages/maxitor/maxitor-core/web/tests/legend.test.ts
// The legend built from the page's setup (spec 079, FR-010): the page's kinds in order, Bars only with bars, Size,
// Flag and Three points only with what the page promised, Now and the chosen moment always.
import assert from "node:assert/strict";
import { test } from "node:test";

import { legendOf } from "../components/scale/legendRows.ts";

const published = { tone: "purple", look: "filled", lead: "solid", term: "Published", def: "The notes as published." } as const;
const rollback = { tone: "red", look: "filled", lead: "solid", term: "Rolled back", def: "An earlier publication brought back." } as const;
const terms = (sections: ReturnType<typeof legendOf>) => sections.map((section) => `${section.title}: ${section.items.map((item) => item.term).join(", ")}`);

test("Published's legend: its two kinds, its bars, and the core's marks — no size, no flag", () => {
  assert.deepEqual(terms(legendOf({ read: "list_published_notes", kinds: { published, rollback } }, false)), [
    "Points: Published, Rolled back",
    "Bars: Changes",
    "Marks: Now, The chosen moment",
  ]);
});

test("the graph's legend carries Size, Flag and Three points with the page's own sentences", () => {
  const sections = legendOf({ kinds: { merged: published }, small: "A smaller one changed only the version.", flag: "That version was released." }, false);
  assert.deepEqual(terms(sections), ["Points: Published", "Marks: Size, Flag, Three points, Now, The chosen moment"]);
  assert.match(sections[1].items[0].def, /^A smaller one changed only the version\./);
  assert.match(sections[1].items[1].def, /^That version was released\./);
});

test("a page with no history has the core's marks alone", () => {
  assert.deepEqual(terms(legendOf({ compare: [] }, false)), ["Marks: Now, The chosen moment"]);
});
