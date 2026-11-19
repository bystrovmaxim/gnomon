import assert from "node:assert/strict";
import { test } from "node:test";
import { compareAdministration } from "../components/administration/compare.ts";

const row = (id: string, value: string, changed_at = "2026-11-17T00:00:00Z") => ({ id, title: id, fields: [{name:"who_may_invite",value}], changed_at, author:"Anna" });
test("comparison keeps identity and ignores metadata-only changes", () => {
  const before = [row("same","any_user"),row("change","any_user"),row("gone","any_user")];
  const after = [row("same","any_user","2026-11-17T01:00:00Z"),row("change","administrators"),row("new","any_user")];
  assert.deepEqual(compareAdministration(after,before).map(r=>[r.row.id,r.kind]), [["same","unchanged"],["change","changed"],["new","added"],["gone","removed"]]);
  assert.equal(compareAdministration(after,null).every(r=>r.kind==="unchanged"),true);
});

test("side by side preserves each snapshot and classifies both halves from A to B", async () => {
  const { administrationView } = await import("../components/administration/compare.ts");
  const a = [row("change","any_user"), row("gone","any_user")];
  const b = [row("change","administrators"), row("new","any_user")];
  const left = administrationView(a,b,"a","changed,removed");
  const right = administrationView(b,a,"b","changed,removed");
  assert.deepEqual(left.visible.map(x=>[x.row.id,x.kind,x.row.fields[0].value]), [["change","changed","any_user"],["gone","removed","any_user"]]);
  assert.deepEqual(right.visible.map(x=>[x.row.id,x.kind,x.row.fields[0].value]), [["change","changed","administrators"]]);
  assert.deepEqual(right.hidden,["new"]);
  assert.equal(administrationView(a,b,"a","added").visible.length,0);
});

test("invitation tabs and counts use the same filtered records", async () => {
  const { invitationLists } = await import("../components/administration/compare.ts");
  const items = [{state:"sent",email:"a@demo.example"},{state:"accepted",email:"b@demo.example",accepted_user:{id:"user-1"}},{state:"withdrawn",email:"c@demo.example"},{state:"expired",email:"d@demo.example"},{state:"declined",email:"e@demo.example"}];
  const lists = invitationLists(items);
  assert.equal(lists.pending.length,1);
  assert.equal(lists.history.length,4);
  assert.equal(lists.history[0], items[1]);
  assert.equal(lists.history[0].accepted_user?.id,"user-1");
  assert.deepEqual(invitationLists(items,"B@demo").history,[items[1]]);
  assert.equal(invitationLists(items,"B@demo").pending.length,0);
});

test("coincident sides are unchanged and empty filters hide all rows", async () => {
  const { administrationView } = await import("../components/administration/compare.ts");
  const same = [row("one", "any_user")];
  for (const side of ["a", "b"] as const) {
    assert.equal(administrationView(same,same,side).visible[0].kind,"unchanged");
    assert.equal(administrationView(same,same,side,"changed").visible.length,0);
    assert.deepEqual(administrationView(same,same,side,"changed").hidden,["one"]);
  }
});

test("the bare Plugins URL and reloaded explicit tabs select the intended list", async () => {
  const { pluginTab } = await import("../components/administration/compare.ts");
  for (const query of ["", "?tab=market", "?tab=installed"]) {
    const stored = new URLSearchParams(query).toString();
    assert.equal(pluginTab(new URLSearchParams(stored).get("tab") ?? undefined), query === "?tab=installed" ? "installed" : "market");
  }
});
