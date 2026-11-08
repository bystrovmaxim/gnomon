// web/scripts/copy-build.mjs — puts the standalone build where the wheel carries it: src/maxitor_notes/_web.
// The standalone server needs .next/static and public beside it; Next.js leaves copying them to the caller.
import { cpSync, existsSync, rmSync } from "node:fs";

const target = "../src/maxitor_notes/_web";
rmSync(target, { recursive: true, force: true });
cpSync(".next/standalone", target, { recursive: true });
cpSync(".next/static", `${target}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${target}/public`, { recursive: true });
