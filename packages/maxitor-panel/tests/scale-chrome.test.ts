import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));

test("all standalone mockups omit the retired intermediate-version block", () => {
  const files = [...globSync("specs/**/mockup/**/*.html", { cwd: root })];
  assert.equal(files.length, 9);
  for (const file of files) {
    const source = readFileSync(root + file, "utf8");
    assert.doesNotMatch(source, /Between A and B|class="(?:betw|vbetween|mx-between)"/, file);
    for (const line of source.split("\n").filter(line => line.includes('class="hhint"'))) {
      assert.ok(line.includes('class="lgpop" role="tooltip"'), `${file}: scale instructions escaped the information panel`);
    }
  }
});
