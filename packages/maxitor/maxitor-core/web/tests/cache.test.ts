// packages/maxitor/maxitor-core/web/tests/cache.test.ts
// The scale's answers kept in the page's memory (spec 079, FR-017): a zoom asks only for the chunks it does not have;
// a chunk at or before the watermark is kept, the one holding now is asked again.
import assert from "node:assert/strict";
import { test } from "node:test";

import { BarCache, CHUNK, chunksOf } from "../components/scale/cache.ts";

const HOUR = 3_600_000;
const NOW = 1000 * CHUNK * HOUR + 30 * HOUR;
const bar = (start: number) => ({ start: new Date(start).toISOString().replace("Z", "000Z"), added: 1, changed: 0, removed: 0 });

test("the chunks of a stretch are aligned to the epoch and stop at now", () => {
  const chunks = chunksOf(NOW - 100 * HOUR, NOW + 50 * HOUR, NOW, HOUR);
  assert.deepEqual(chunks.map((chunk) => chunk.index), [998, 999, 1000]);
  assert.equal(chunks[2].to, 1001 * CHUNK * HOUR);
});

test("a chunk before the watermark is kept; the chunk holding now is asked again", () => {
  const cache = new BarCache();
  const key = BarCache.keyOf("notes", "demo", "list_published_notes", { item_id: "a" });
  const [past, current] = chunksOf(NOW - 40 * HOUR, NOW, NOW, HOUR);
  assert.equal(cache.missing(key, HOUR, past), true);
  cache.put(key, HOUR, past, [bar(past.from)], NOW);
  cache.put(key, HOUR, current, [bar(current.from)], NOW);
  assert.equal(cache.missing(key, HOUR, past), false);
  assert.equal(cache.missing(key, HOUR, current), true);
  assert.equal(cache.bars(key, HOUR, [past, current]).length, 2);
});

test("another width, other parameters or another page ask anew", () => {
  const cache = new BarCache();
  const [past] = chunksOf(NOW - 100 * HOUR, NOW, NOW, HOUR);
  const key = BarCache.keyOf("notes", "demo", "list_published_notes", { item_id: "a" });
  cache.put(key, HOUR, past, [], NOW);
  assert.equal(cache.missing(key, 2 * HOUR, past), true);
  assert.equal(cache.missing(BarCache.keyOf("notes", "demo", "list_published_notes", { item_id: "b" }), HOUR, past), true);
  assert.equal(BarCache.keyOf("n", "d", "a", { b: "1", a: "2" }), BarCache.keyOf("n", "d", "a", { a: "2", b: "1" }));
});
