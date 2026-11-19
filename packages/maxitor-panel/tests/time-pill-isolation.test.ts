import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, globSync } from "node:fs";
const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
test("page layers never style the core time pill", () => {
 const shell = read("../src/shell/shell.css");
 const layers = read("../src/shell/Layers.tsx");
 assert.doesNotMatch(shell, /\.mx-pill\b/);
 assert.match(layers, /className="mx-layer-pill"/);
 assert.match(shell, /\.mx-layer-pill \{ top:.*left: 50%; transform: translateX\(-50%\)/);
 const scale = read("../../maxitor/maxitor-core/web/components/scale/scale.css");
 assert.match(scale, /\.mx-scale \{ position: relative;/);
 assert.match(scale, /\.mx-pill \{ height:/);
});
test("standalone mockups cannot fix the core time pill to the viewport", () => {
 for (const name of globSync("specs/**/mockup/**/*.html")) {
  const source = readFileSync(name, "utf8");
  for (const match of source.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
   if (/\.mx-pill(?![\w-])/.test(match[1])) assert.doesNotMatch(match[2], /position:\s*fixed|left:\s*50%|translateX\(-50%\)/, name);
  }
 }
});

test("header bounds long organization and comparison labels without shrinking the avatar", () => {
 const css = read("../../maxitor/maxitor-core/web/components/frame/frame.css");
 assert.match(css, /\.mx-org \{ min-width: 0; max-width: 25%;/);
 assert.match(css, /\.mx-org-name \{ overflow: hidden; text-overflow: ellipsis;/);
 assert.match(css, /\.mx-slot-moment \{[^}]*min-width: calc\(6 \* var\(--mx-pill-arrow-width\)\); max-width: 55%;/);
 assert.match(css, /\.mx-avatar \{ flex-shrink: 0;/);
 assert.match(css, /\.mx-slot-moment \{ flex: 1; min-width: 0; max-width: none;/);
});
