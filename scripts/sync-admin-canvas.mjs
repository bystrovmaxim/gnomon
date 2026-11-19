// Synchronize the common administration typography into standalone mockup documents.
import { globSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const begin = "/* BEGIN shared administration canvas */";
const end = "/* END shared administration canvas */";
const block = /\/\* BEGIN shared administration canvas \*\/[\s\S]*?\/\* END shared administration canvas \*\/\n?/g;
export function adminCanvasStyles() {
  const css = readFileSync(resolve(root,"packages/maxitor/maxitor-core/web/components/administration/administration.css"),"utf8");
  // Prototype documents use .device for the panel document; their viewport height remains controlled by the harness.
  const body = css.split("\n").filter(line => !line.startsWith("body.") && !line.startsWith(".mx-administration {")).join("\n").replaceAll(".mx-administration", ".device");
  const shell = readFileSync(resolve(root,"packages/maxitor-panel/src/shell/shell.css"),"utf8");
  const action = shell.split("\n").find(line => line.startsWith(".mx-action {"));
  const prototypeActions = `.device .mx-actions { position: absolute; top: 64px; right: 16px; z-index: 10; display: flex; gap: 8px; }
.device.phone .mx-actions { position: absolute; top: auto; bottom: 56px; }
${action}
.device .mx-action svg { width: 16px; height: 16px; }`;
  const buttons = readFileSync(resolve(root,"packages/maxitor-panel/src/content/button.css"),"utf8");
  const tokens = readFileSync(resolve(root,"packages/maxitor-tokens/tokens.css"),"utf8");
  return `${begin}\n${tokens}\n${body}\n${prototypeActions}\n${buttons}\n${end}`;
}
export function checkAdminCanvas(write = false) {
  const expected = adminCanvasStyles(), problems = [];
  for (const name of globSync("specs/**/mockup/**/*.html",{cwd:root})) {
    const path = resolve(root,name);
    let source=readFileSync(path,"utf8");
    if(write) {
      source=source.replace(block, "").replaceAll("/* Shared disk frame:",`${expected}\n/* Shared disk frame:`);
      writeFileSync(path,source);
    }
    for(const [,style] of source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)) {
      if(!style.includes(expected)) problems.push(`${name}: administration canvas styles differ`);
    }
  }
  return problems;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const problems=checkAdminCanvas(process.argv.includes("--write"));
 if(problems.length) { console.error(problems.join("\n")); process.exitCode=1; }
 else console.log("All mockup style scopes use the common administration typography.");
}
