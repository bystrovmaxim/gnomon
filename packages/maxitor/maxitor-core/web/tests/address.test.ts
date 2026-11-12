// packages/maxitor/maxitor-core/web/tests/address.test.ts
// The screen keeps its moment and its comparison from page to page, whatever the page's owner (spec 079, FR-018).
import assert from "node:assert/strict";
import { test } from "node:test";

import { carried, windowAddress } from "../lib/address.ts";

test("the comparison is carried from page to page, and nothing of a page's own", () => {
  assert.deepEqual(carried({ mode: "diff", from: "2026-11-12T18:00:00.000000Z", view: "table", author: "a1" }), { mode: "diff", from: "2026-11-12T18:00:00.000000Z" });
  assert.deepEqual(carried({ view: "table" }), {});
});

test("another owner's page opens at the same moment in the same comparison", () => {
  const carry = carried({ mode: "side_by_side", from: "2026-11-12T18:00:00.000000Z", view: "table" });
  assert.equal(
    windowAddress("demo", "graphs", "/erd", carry, "2026-11-12T18:27:14.000000Z"),
    "/w/demo/graphs/erd?mode=side_by_side&from=2026-11-12T18%3A00%3A00.000000Z&at=2026-11-12T18%3A27%3A14.000000Z",
  );
});
