import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
export function checkAdminHistory(write=false) {
  const source=readFileSync(resolve(root,"scripts/admin-mockup-history.js"),"utf8").trim();
  const block=`// BEGIN shared administration history\n${source}\n// END shared administration history`;
  const problems=[];
  for(const spec of ["072-maxitor-core","073-plugin-marketplace"]) {
    const name=`specs/${spec}/mockup/index.html`,path=resolve(root,name);
    let html=readFileSync(path,"utf8");
    const pattern=/\/\/ BEGIN shared administration history[\s\S]*?\/\/ END shared administration history/;
    if(write) { html=pattern.test(html)?html.replace(pattern,()=>block):html.replace("function render() {",`${block}\nfunction render() {`); writeFileSync(path,html); }
    if(html.match(pattern)?.[0]!==block) problems.push(`${name}: administration history fixtures are out of date`);
    if(/Settings gives no history/.test(html)) problems.push(`${name}: obsolete administration history rule`);
  }
  return problems;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const errors=checkAdminHistory(process.argv.includes("--write"));
 if(errors.length){console.error(errors.join("\n"));process.exitCode=1;} else console.log("Administration history fixtures are synchronized.");
}
