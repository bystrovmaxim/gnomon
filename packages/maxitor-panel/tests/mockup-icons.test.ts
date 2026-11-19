import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMockupIcons, productionMockupIcon } from "../../../scripts/sync-mockup-icons.mjs";

test("all standalone mockups use the production tree icons, without old redraws", () => {
  assert.deepEqual(checkMockupIcons(), []);
});

test("sync preserves SVG dimensions without mistaking stroke width or child geometry for icon size", () => {
  const old = '\'<svg class="ico" stroke-width="1.4"><rect width="12" height="10"/></svg>\'';
  assert.doesNotMatch(productionMockupIcon("note", old, "mockup.html"), /\s(?:width|height)=/);
  const sized = old.replace('class="ico"', 'class="ico" width="24" height="24"');
  assert.match(productionMockupIcon("note", sized, "mockup.html"), /width="24" height="24"/);
});
