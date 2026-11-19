// Standalone mockups reuse the core tree's production SVG instead of retaining older redraws.
import { globSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const source = readFileSync(resolve(ROOT, "packages/maxitor/maxitor-core/web/components/frame/treeMarks.tsx"), "utf8");
const material = Object.fromEntries([...source.matchAll(/\b(\w+):\s*\(\)\s*=>\s*(?:\(\s*)?<Material d="([^"]+)"/g)].map((m) => [m[1], m[2]]));
const sidebar = source.slice(source.indexOf("sidebar: ()"), source.indexOf("back: ()"));
const sidebarPaths = [...sidebar.matchAll(/<path d="([^"]+)"/g)].map((m) => `<path d="${m[1]}"/>`).join("");
const aliases = { panel: "sidebar", back: "back", note: "page", file: "page", page: "page", gear: "settings", settings: "settings", puzzle: "plugins", plugins: "plugins", people: "users", users: "users", chevD: "fold", chev: "fold", chevron: "fold" };

export function productionMockupIcon(alias, old, filename) {
  const name = aliases[alias];
  const className = old.match(/class="([^"]+)"/)?.[1] ?? (old.startsWith("P(") ? old.match(/,\s*"([^"]+)"\)/)?.[1] ?? "ico" : "");
  const dimensions = [...(old.match(/^'<svg([^>]*)>/)?.[1] ?? "").matchAll(/\s(width|height)="([\d.]+)"/g)].map((m) => ` ${m[1]}="${m[2]}"`).join("");
  const base = `<svg${className ? ` class="${className}"` : ""}${dimensions} viewBox="0 0 24 24"`;
  if (name === "sidebar") return `'${base} fill="none" stroke="currentColor" stroke-width="1.38" stroke-linecap="round" stroke-linejoin="round">${sidebarPaths}</svg>'`;
  if (!material[name]) throw new Error(`The core tree has no ${name} icon`);
  const turn = alias === "chevron" && filename.includes("085-entered-tree-node") ? ' transform="rotate(-90 12 12)"' : "";
  return `'${base} fill="currentColor"><path${turn} d="${material[name]}"/></svg>'`;
}

export function checkMockupIcons(write = false) {
  const problems = [];
  for (const filename of globSync("specs/**/mockup/**/*.html", { cwd: ROOT })) {
    const path = resolve(ROOT, filename), text = readFileSync(path, "utf8");
    const next = text.replace(/const I = \{[\s\S]*?\n\};/g, (icons) => icons.replace(/\b(\w+):\s*(P\('[^']*'(?:,\s*"[^"]*")?\)|'<svg[^']*')/g, (whole, alias, old) => {
      if (!aliases[alias]) return whole;
      const value = productionMockupIcon(alias, old, filename);
      if (old !== value) problems.push(`${filename}: ${alias} differs from the production ${aliases[alias]} icon`);
      return `${alias}: ${value}`;
    }));
    if (write && next !== text) writeFileSync(path, next);
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes("--write"), problems = checkMockupIcons(write);
  if (write) console.log(`Updated ${problems.length} production tree icons.`);
  else if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
  else console.log("Every mockup tree icon matches the production component.");
}
