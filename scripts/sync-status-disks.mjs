// Keep standalone mockups on the graph viewer's production SVG, without a server or a build to open them.
// node scripts/sync-status-disks.mjs [--write]
import { globSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const BEGIN = "// BEGIN shared production status disks";
const END = "// END shared production status disks";
const BLOCK = /\/\/ BEGIN shared production status disks[\s\S]*?\/\/ END shared production status disks/;

export function sharedDisks() {
  const source = readFileSync(resolve(ROOT, "packages/maxitor-tokens/status-disks.js"), "utf8").replaceAll("export function", "function");
  return `${BEGIN}\n${source.trim()}\n${END}`;
}

const FRAME = /\/\* Shared disk frame:[^*]*\*\/[\s\S]*?(?=<\/style>)/g;

export function sharedDiskFrames() {
  return readFileSync(resolve(ROOT, "packages/maxitor-tokens/disk-frames.css"), "utf8").trim();
}

export function checkMockupDiskFrames(source) {
  const frames = sharedDiskFrames();
  return [...source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)]
    .flatMap(([, css], index) => css.trimEnd().endsWith(frames)
      ? [] : [`style ${index + 1}: missing or outdated disk frame`]);
}

export function checkStatusDisks(write = false) {
  const problems = [];
  const shared = sharedDisks();
  for (const name of globSync("specs/**/mockup/**/*.html", { cwd: ROOT })) {
    const path = resolve(ROOT, name);
    let source = readFileSync(path, "utf8");
    if (source.includes(BEGIN)) {
      if (write) {
        source = source.replace(BLOCK, () => shared);
        writeFileSync(path, source);
      }
      if (source.match(BLOCK)?.[0] !== shared) problems.push(`${name}: production disks are out of date`);
    }
    if (write) {
      source = source.replace(FRAME, "").replaceAll("</style>", `${sharedDiskFrames()}\n</style>`);
      writeFileSync(path, source);
    }
    problems.push(...checkMockupDiskFrames(source).map(problem => `${name}: ${problem}`));
    const outside = source.replace(BLOCK, "");
    if (/function statusDisk(?:Svg|Uri)\s*\(/.test(outside)) problems.push(`${name}: a private disk renderer`);
    if (/<circle[^\n]*<text[^\n]*\$\{SIGN\[/.test(outside)) problems.push(`${name}: a hand-drawn status badge`);
    if (source.includes("statusDiskUri(") && !source.includes(BEGIN)) problems.push(`${name}: missing production disks`);
  }
  const paths = ["packages/maxitor-panel/src", "packages/maxitor-plugin-template/web", "packages/maxitor/maxitor-core/web", "packages/maxitor/maxitor-web/client/src", "specs"];
  for (const folder of paths) {
    for (const name of globSync(`${folder}/**/*.{css,tsx,ts,js,html}`, { cwd: ROOT, exclude: ["**/node_modules/**", "**/.next/**"] })) {
      const source = readFileSync(resolve(ROOT, name), "utf8");
      if (!name.endsWith(".html") && /function statusDisk(?:Svg|Uri)\s*\(/.test(source)) problems.push(`${name}: a private disk renderer`);
      if (/\.mx-disk\.sign\s*\{|\.mx-status\[data-status=/.test(source)) problems.push(`${name}: a CSS/text status disk`);
      if (/className=[^\n]*mx-disk[^\n]*SIGNS\.has/.test(source)) problems.push(`${name}: a text status disk in a filter`);
      if (/<circle/.test(source.match(/function StateDisk[\s\S]*?\n\}/)?.[0] ?? "")) problems.push(`${name}: a private state disk`);
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkStatusDisks(process.argv.includes("--write"));
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
  } else console.log("All status disks use the graph viewer's production SVG.");
}
