import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { invitationLists, snapshotUser, snapshotInvitation } from "../components/administration/compare.ts";
const require = createRequire(import.meta.url);
const ts = require("typescript");
function compile(path: URL, imports: Record<string, unknown>) {
  const exports: Record<string, any> = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: (id: string) => id.endsWith(".css") ? {} : imports[id] ?? require(id) });
  return exports;
}
const { Button } = compile(new URL("../../../../maxitor-panel/src/content/Button.tsx", import.meta.url), {});
function nodes(node: any): any[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
for (const historical of [false, true]) for (const tab of ["invitations", "history"]) test(`${historical ? "A/B" : "Now"} ${tab}: native email button opens the matching invitation and closes without mutation`, () => {
  const state: any[] = [];
  let cursor = 0, stopped = false;
  const mutations = new Proxy({}, { get: () => () => { throw new Error("Opening a card must not mutate data"); } });
  const Page = compile(new URL("../components/UsersPage.tsx", import.meta.url), {
    react: { useState: (initial: any) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: any) => { state[index] = value; }]; }, useEffect: () => {}, useContext: (context: any) => context ? () => {} : { historical, compared: historical, entries: [{kind:"changed",row:{id:"target",title:"person@example.com",fields:[{name:"status",value:tab === "history" ? "accepted" : "sent"}]}}] } },
    "@maxitor/panel": { Button, usePanelQuery: () => ({ tab }), usePanelRouter: () => ({}) },
    "next/navigation": { useRouter: () => ({}) },
    "@/app/users": mutations,
    "./administration/AdministrationPanel": { AdministrationActions: {} },
    "./administration/DirectoryToolbar": { DirectoryToolbar: "directory-toolbar" },
    "./administration/UserTable": { UserTable: "user-table" },
    "./administration/compare": { invitationLists, snapshotUser, snapshotInvitation },
    "@/components/marks": { Icon: { search: "svg", mail: "svg" } },
    "@/components/InvitationCard": { InvitationCard: "invitation-card" },
    "@/components/InviteDialog": { InviteDialog: "invite-dialog", STATE_WORDS: {}, day: () => "today", when: () => "today" },
    "@/components/UserCard": { UserCard: "user-card", USER_STATES: {} },
  }).UsersPage;
  const invitation = { id: "target", email: "person@example.com", state: tab === "history" ? "accepted" : "sent", invited_by: { name: "Admin" } };
  const render = () => { cursor = 0; return nodes(Page({ code: "org", organization: "Org", me: "admin", open: null, initial: { users: [], invitations: [invitation] } })); };
  const before = render();
  const toolbar = before.find(n => n.type === "directory-toolbar");
  assert.ok(toolbar, "Directory navigation must remain grouped above the table");
  assert.equal(nodes(toolbar).filter(n => n.props?.role === "tab").length,3);
  assert.ok(nodes(toolbar).some(n => n.type === "input" && n.props.type === "search"));
  assert.ok(before.some(n => n.type === "user-table"), "Invitations and history must use the pinned table");
  assert.ok(before.some(n => n.type === "th" && n.props.children === "Invited role"));
  assert.equal(before.some(n => n.type === "th" && n.props.children === "Will be"), false);
  assert.equal(before.some(n => n.type === "invitation-card"), false);
  const trigger = before.find(n => n.type === Button && n.props["aria-label"] === "Open invitation person@example.com");
  assert.ok(trigger, "Email must be an interactive button, not canvas text");
  const native = Button(trigger.props);
  assert.equal(native.type, "button");
  assert.equal(native.props.type, "button");
  native.props.onClick({ stopPropagation: () => { stopped = true; } });
  assert.equal(stopped, true);
  const card = render().find(n => n.type === "invitation-card");
  assert.equal(card.props.invitation.email, invitation.email);
  assert.equal(card.props.readOnly,historical);
  if (historical) {
    assert.ok(before.some(n => n.type === "tr" && n.props["data-change"] === "changed"));
    assert.equal(before.some(n => n.type === Button && ["Send again", "Withdraw"].includes(n.props.children)),false);
  }
  card.props.onClose();
  assert.equal(render().some(n => n.type === "invitation-card"), false);
});

test("invitation card shows only the current status and no repeated date footer", () => {
  const words = { sent: "Sent", accepted: "Accepted", declined: "Declined", withdrawn: "Withdrawn", expired: "Expired" };
  const Card = compile(new URL("../components/InvitationCard.tsx", import.meta.url), {
    "@maxitor/panel": { Button },
    "./administration/AdminDialog": { AdminDialog: "dialog" },
    "@/components/InviteDialog": { STATE_WORDS: words, day: (s: string) => s, when: (s: string) => s },
    "@/components/marks": { Icon: { mail: "svg" } },
  }).InvitationCard;
  let openedUser: string | null = null;
  for (const state of Object.keys(words)) for (const is_admin of [false, true]) {
    const tree = nodes(Card({ invitation: { state, is_admin, email: "person@example.com", sent_at: "sent-date", letter_sent_at: "sent-date", invited_by: { name: "Admin" }, accepted_user: { id: "accepted-user", name: "Accepted Person" } }, organization: "Org", onOpenUser: (id: string) => { openedUser = id; } }));
    if (state === "accepted") {
      const link = tree.find(n => n.type === Button && n.props.children === "Accepted Person");
      assert.ok(link, "Accepted user must be a keyboard-accessible core button");
      const native = Button(link.props);
      assert.equal(native.type, "button");
      native.props.onClick();
      assert.equal(openedUser, "accepted-user");
    }
    const subtitle = tree.find(n => n.props?.className === "dt");
    const expectedPrefix = state === "sent" ? "Will join as" : state === "accepted" ? "Joined as" : "Invited as";
    assert.equal(subtitle.props.children.join(""), `${expectedPrefix} ${is_admin ? "an administrator" : "an ordinary user"}`);
    const statuses = tree.filter(n => n.props?.className?.startsWith("stt st-"));
    assert.equal(statuses.length, 1);
    assert.equal(statuses[0].props.children, words[state as keyof typeof words]);
    assert.equal(tree.some(n => n.props?.className === "life" || n.props?.className === "df"), false);
    assert.equal(tree.filter(n => n.type === "dd" && n.props.children?.[0] === "sent-date").length, 1);
  }
});

test("A/B keeps the directory and opens its own read-only user card", () => {
  const state: any[] = []; let cursor = 0;
  const row = { id:"past",title:"Past Person",changed_at:"2026-11-18",author:null,fields:[{name:"status",value:"active"},{name:"email",value:"past@example.com"},{name:"job_title",value:"Engineer"}] };
  const comparison={historical:true,compared:true,entries:[{row,kind:"changed"}]};
  const actions={};
  const Page=compile(new URL("../components/UsersPage.tsx",import.meta.url),{
    react:{useState:(initial:any)=>{const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],(v:any)=>{state[i]=v;}];},useEffect:()=>{},useContext:(c:any)=>c===actions?()=>{}:comparison},
    "@maxitor/panel":{Button,usePanelQuery:()=>({tab:"users",at:"past",mode:"side_by_side",from:"past",_side:"a"}),usePanelRouter:()=>({push:({query}:any)=>{assert.equal(query.mode,"side_by_side"); assert.equal(query.from,"past"); assert.ok(Object.keys(query).every(k=>k!=="at"&&!k.startsWith("_")));}})},
    "next/navigation":{useRouter:()=>({})},"@/app/users":{},
    "./administration/AdministrationPanel":{AdministrationActions:actions,AdministrationComparison:{}},
    "./administration/DirectoryToolbar": { DirectoryToolbar: "directory-toolbar" },
    "./administration/UserTable": { UserTable: "user-table" },
    "./administration/compare":{invitationLists,snapshotUser,snapshotInvitation},"@/components/marks":{Icon:{search:"svg"}},
    "@/components/InvitationCard":{InvitationCard:"invitation-card"},
    "@/components/InviteDialog":{InviteDialog:"invite-dialog",STATE_WORDS:{},day:()=>"today",when:()=>"today"},
    "@/components/UserCard":{UserCard:"user-card",USER_STATES:{active:"Active"}},
  }).UsersPage;
  const render=()=>{cursor=0;return nodes(Page({code:"org",organization:"Org",me:"",open:null,initial:{users:[{id:"future",name:"Future Person"}],invitations:[]}}));};
  const tree=render();
  assert.ok(tree.some(n=>n.type==="directory-toolbar"));
  tree.find(n=>n.type==="button" && n.props.role==="tab" && n.props.children[0]==="Invitations").props.onClick();
  assert.ok(tree.some(n=>n.type==="th" && n.props.children==="Job title"));
  assert.ok(tree.some(n=>n.type==="td" && n.props.children==="Engineer"));
  assert.ok(tree.some(n=>n.type==="user-table"));
  assert.ok(tree.some(n=>n.type==="tr" && n.props["data-user"]==="past@example.com" && n.props["data-change"]==="changed"));
  assert.equal(tree.some(n=>n.props?.children==="Future Person"),false);
  tree.find(n=>n.type===Button && n.props["aria-label"]==="Open user Past Person").props.onClick({stopPropagation(){}});
  const card=render().find(n=>n.type==="user-card");
  assert.equal(card.props.user.job_title,"Engineer");assert.equal(card.props.readOnly,true);
  card.props.onClose();assert.equal(render().some(n=>n.type==="user-card"),false);
});

test("historical user card keeps normal details without mutation controls",()=>{
  const Card=compile(new URL("../components/UserCard.tsx",import.meta.url),{
    react:{useState:(v:any)=>[v,()=>{}],useEffect:()=>{}},"@maxitor/panel":{Button},
    "./administration/AdminDialog":{AdminDialog:"dialog"},"@/components/fields":{Alert:"alert"},
    "@/components/InviteDialog":{day:(v:string)=>v,when:(v:string)=>v},
  }).UserCard;
  const user=snapshotUser({id:"u",title:"Person",changed_at:"2026-11-18",author:null,fields:[{name:"status",value:"active"},{name:"job_title",value:"Engineer"}]});
  const tree=nodes(Card({user,readOnly:true,organization:"Org",onJobTitle:async()=>{}}));
  assert.ok(tree.some(n=>n.props?.className==="drawer admin-user-card"));
  assert.ok(tree.some(n=>n.props?.children==="Engineer"));
  assert.equal(tree.some(n=>n.type===Button && ["Edit","Save","Block","Unblock"].includes(n.props.children)),false);
  assert.equal(tree.find(n=>n.props?.["aria-label"]==="Administrator").props.disabled,true);
});

for (const status of ["sent", "accepted", "declined", "expired", "withdrawn"]) test(`snapshot invitation preserves ${status} identity without current values`, () => {
  const i = snapshotInvitation({id:"i",title:"past@example.com",changed_at:"2026-11-18",author:null,fields:[
    {name:"status",value:status},{name:"is_admin",value:"No"},{name:"sent_at",value:"2026-11-16"},
    {name:"accepted_user_id",value:status === "accepted" ? "u" : "—"},
    {name:"accepted_user_id_name",value:"Historical Person"}
  ]});
  assert.equal(i.email,"past@example.com"); assert.equal(i.state,status);
  assert.equal(i.accepted_user?.name,status === "accepted" ? "Historical Person" : undefined);
  assert.equal(i.invited_by.name,"Not recorded");
});

test("directory controls remain inline like Plugins instead of using a fixed portal", () => {
  const Toolbar=compile(new URL("../components/administration/DirectoryToolbar.tsx",import.meta.url),{}).DirectoryToolbar;
  const tree=Toolbar({children:"controls"});
  assert.equal(tree.type,"div");
  assert.equal(tree.props.className,"directory-toolbar");
  assert.equal(tree.props.children,"controls");
  const page=readFileSync(new URL("../components/UsersPage.tsx",import.meta.url),"utf8");
  assert.ok(page.indexOf("</DirectoryToolbar>") < page.indexOf('<section className="admin-surface admin-people"'));
});
