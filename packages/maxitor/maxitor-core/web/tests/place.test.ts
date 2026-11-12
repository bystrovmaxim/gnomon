// packages/maxitor/maxitor-core/web/tests/place.test.ts
// The last place keeps the page in the present: the time scale's names are dropped, the page's own stay.
import assert from "node:assert/strict";
import { test } from "node:test";

import { placeOf } from "../lib/place.ts";

test("the moment and the comparison are dropped, the page's own parameters stay", () => {
  assert.equal(placeOf("/w/acme/notes/items/4f1c", "?view=table&at=2026-11-10T12:00:00Z&mode=diff&from=2026-11-09T12:00:00Z"), "/w/acme/notes/items/4f1c?view=table");
  assert.equal(placeOf("/w/acme/core/settings/users", "?at=2026-11-10T12:00:00Z"), "/w/acme/core/settings/users");
  assert.equal(placeOf("/w/acme", ""), "/w/acme");
});

test("an address outside the organizations' pages is no place", () => {
  assert.equal(placeOf("/w", ""), null);
  assert.equal(placeOf("/new", ""), null);
  assert.equal(placeOf("/sign-in", "?next=/w/acme"), null);
});
