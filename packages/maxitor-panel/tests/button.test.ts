import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(new URL("../../maxitor/maxitor-core/web/package.json",import.meta.url));
const ts = require("typescript");
const source = readFileSync(new URL("../src/content/Button.tsx",import.meta.url),"utf8");
const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const exports: Record<string, any> = {};
vm.runInNewContext(code,{exports,require:(id:string)=>id.endsWith('.css')?{}:require(id)});
const Button=exports.Button;
const render=require("react-dom/server").renderToStaticMarkup;
test("core button is non-submitting by default and forwards native semantics",()=>{
 const onClick=()=>{};
 const element=Button({children:'Save',onClick,disabled:true,'aria-label':'Save policy'});
 assert.equal(element.type,'button'); assert.equal(element.props.type,'button');
 assert.equal(element.props.onClick,onClick); assert.equal(element.props.disabled,true);
 assert.match(render(element), /disabled=""/); assert.match(render(element), /aria-label="Save policy"/);
 assert.equal(Button({type:'submit',children:'Submit'}).props.type,'submit');
});
test("variants share the core class and preserve caller placement classes",()=>{
 for(const variant of ['secondary','primary','danger','link','icon']) {
  const element=Button({variant,className:'slot',children:'Action'});
  assert.equal(element.props['data-variant'],variant); assert.equal(element.props.className,'mx-button slot');
 }
});
test("administration actions no longer use the legacy button skin",()=>{
 for(const name of ['OrganizationPage','UsersPage','UserCard','InvitationCard','InviteDialog','PluginsPage']) {
  const body=readFileSync(new URL(`../../maxitor/maxitor-core/web/components/${name}.tsx`,import.meta.url),'utf8');
  assert.doesNotMatch(body,/\bbtn2\b/,name);
  assert.match(body,/<Button\b/,name);
 }
});

test("policy Edit uses the same primary variant as Install", () => {
 const body=readFileSync(new URL("../../maxitor/maxitor-core/web/components/OrganizationPage.tsx",import.meta.url),"utf8");
 assert.match(body, /<Button[^>]*variant="primary"[^>]*onClick=\{\(\) => \{ setDraft/);
});

test("record actions use primary buttons and choices have no heavy frames", () => {
 for (const name of ["UserCard", "UsersPage", "InvitationCard", "InviteDialog", "PluginsPage"]) {
  const body=readFileSync(new URL(`../../maxitor/maxitor-core/web/components/${name}.tsx`,import.meta.url),"utf8");
  for(const match of body.matchAll(/<Button[^\n]*?<\/Button>/g)) {
   if(/>(?:<Icon.mail \/>)?(?:Block|Enable|Disable|Send again|Send the letter again|Add again)<\/Button>/.test(match[0])) assert.match(match[0], /variant="primary"/, name);
  }
 }
 const css=readFileSync(new URL("../../maxitor/maxitor-core/web/components/administration/administration.css",import.meta.url),"utf8");
 assert.match(css, /\.mx-administration \.choice\.on \{[^}]*border: 0; box-shadow: none;/);
});
