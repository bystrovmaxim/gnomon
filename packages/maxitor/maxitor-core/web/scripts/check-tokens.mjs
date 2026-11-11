// packages/maxitor/maxitor-core/web/scripts/check-tokens.mjs
// The frame, its controls and @maxitor/panel draw only with @maxitor/tokens (spec 077, FR-002, SC-007): no colour
// code and no size in px or rem in their styles and components. A value must be a var(--mx-…) of the tokens.
//
//   node scripts/check-tokens.mjs                 the folders of the frame and of @maxitor/panel
//   node scripts/check-tokens.mjs <path> …        the given files or folders
//
// Comments are skipped: a comment may speak of a size. So is a line of @media: a media query cannot read a custom
// property, and its width is the tokens' --mx-phone (PHONE_MEDIA of @maxitor/tokens). Exits 1 and lists every line found, 0 when there is none.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY = resolve(WEB, "../../../..");

/** What is checked when no path is given: everything the frame and the panel package draw. */
const DEFAULT_PATHS = [
  join(WEB, "components/frame"),
  join(WEB, "app/panel-test"),
  join(REPOSITORY, "packages/maxitor-panel/src"),
];

const CHECKED = /\.(css|tsx|ts)$/;
const FOUND = [
  { name: "a colour code", pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "a colour function", pattern: /\b(?:rgba?|hsla?)\(/ },
  { name: "a size number", pattern: /(?<![\w-])\d*\.?\d+(?:px|rem)\b/ },
];

/** The text with its comments blanked out, keeping line numbers. */
function withoutComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, (line, before) => before);
}

function files(path) {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return CHECKED.test(path) ? [path] : [];
  return readdirSync(path).flatMap((name) => (name === "node_modules" ? [] : files(join(path, name))));
}

export function problems(paths) {
  const found = [];
  for (const file of paths.flatMap(files)) {
    withoutComments(readFileSync(file, "utf8"))
      .split("\n")
      .forEach((line, index) => {
        if (line.trim().startsWith("@media")) return;
        for (const { name, pattern } of FOUND) {
          if (pattern.test(line)) found.push(`${relative(REPOSITORY, file)}:${index + 1}: ${name}: ${line.trim()}`);
        }
      });
  }
  return found;
}

const given = process.argv.slice(2).map((path) => resolve(path));
const found = problems(given.length ? given : DEFAULT_PATHS);
if (found.length) {
  console.error(`Colours and sizes must come from @maxitor/tokens (var(--mx-…)); found ${found.length}:`);
  for (const line of found) console.error(`  ${line}`);
  process.exit(1);
}
console.log("Every colour and size comes from @maxitor/tokens.");
