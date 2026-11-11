// @maxitor/panel — the version panel.ready carries is the package's.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { SHELL_VERSION } from "../src/version.ts";

test("the shell's version is package.json's", () => {
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(SHELL_VERSION, version);
});
