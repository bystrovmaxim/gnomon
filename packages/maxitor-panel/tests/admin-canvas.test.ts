import { readFileSync, globSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAdminHistory } from "../../../scripts/sync-admin-history.mjs";
import { checkAdminCanvas } from "../../../scripts/sync-admin-canvas.mjs";

test("all mockup documents keep the common administration typography", () => {
  assert.deepEqual(checkAdminCanvas(), []);
});

test("administration prototypes offer historical and comparison views", () => { assert.deepEqual(checkAdminHistory(), []); });

test("administration content omits duplicate section titles", () => {
  for (const name of ["OrganizationPage", "UsersPage", "PluginsPage", "administration/AdministrationPanel"]) {
    const source = readFileSync(new URL(`../../maxitor/maxitor-core/web/components/${name}.tsx`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /<h2>(?:Organization|Users|Plugins|\{title\})<\/h2>/, name);
  }
  for (const name of globSync("specs/**/mockup/**/*.html")) {
    assert.doesNotMatch(readFileSync(name, "utf8"), /<h2>(?:Organization|Users|Plugins|\$\{title\})<\/h2>/, name);
  }
});

test("mockup invitation history does not describe the role in future tense", () => {
 for (const name of globSync("specs/**/mockup/**/*.html")) {
  assert.doesNotMatch(readFileSync(name, "utf8"), /<th>Will be<\/th>|will be an ordinary user|will be an administrator/, name);
 }
});
