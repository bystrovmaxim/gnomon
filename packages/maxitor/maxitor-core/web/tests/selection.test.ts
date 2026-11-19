import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { insideScale, nearestHandle, grabbedHandle, handleAt, intervalShift, overInterval } from "../components/scale/selection.ts";

test("upper clicks choose A and lower clicks B, including the midpoint and chips", () => {
  for (const [top, base] of [[41, 177], [41, 91], [41, 77]]) {
    for (const y of [0, top, (top + base) / 2 - 0.1]) assert.equal(handleAt(y, top, base, true), "a");
    for (const y of [(top + base) / 2, base, base + 40]) assert.equal(handleAt(y, top, base, true), "b");
    for (const y of [0, top, base, base + 40]) assert.equal(handleAt(y, top, base, false), "one");
  }
});

test("the top edge chooses A even beside B's line, and the axis chooses B beside A's line", () => {
  assert.equal(grabbedHandle(358, 41, 41, 177, 334, 359), "a");
  assert.equal(grabbedHandle(335, 177, 41, 177, 334, 359), "b");
  assert.equal(grabbedHandle(358, 41, 41, 177, -100, 359), "a");
  assert.equal(grabbedHandle(335, 177, 41, 177, 334, 900), "b");
});

test("overlapping handles remain independently draggable in their own halves", () => {
  for (const b of [334, 339]) {
    assert.equal(grabbedHandle(335, 75, 41, 177, 334, b), "a");
    assert.equal(grabbedHandle(335, 145, 41, 177, 334, b), "b");
  }
});

test("the body preserves brushing and phone panning without grabbing the opposite handle", () => {
  assert.equal(grabbedHandle(359, 75, 41, 177, 200, 359), null);
  assert.equal(grabbedHandle(200, 145, 41, 177, 200, 359), null);
  assert.equal(grabbedHandle(280, 100, 41, 177, 200, 359), null);
  assert.equal(grabbedHandle(358, 75, 22, 158, null, 359), "one");
  assert.equal(grabbedHandle(100, 22, 22, 158, null, 359), null);
});

test("moving an interval keeps its duration and stops as a whole at the first moment and now", () => {
  for (const [wanted, expected] of [[20, 20], [-20, -20], [-200, -100], [400, 200]]) {
    const shift = intervalShift(wanted, 100, 200, 0, 400);
    assert.equal(shift, expected);
    assert.equal((200 + shift) - (100 + shift), 100);
    assert.ok(100 + shift >= 0 && 200 + shift <= 400);
  }
});

test("the move grip appears only over the shaded interval, not above, below, outside or at an empty range", () => {
  assert.equal(overInterval(300, 100, 41, 177, 200, 400), true);
  assert.equal(overInterval(300, 100, 41, 177, 400, 200), true);
  for (const [x, y] of [[199, 100], [401, 100], [300, 40], [300, 178]]) assert.equal(overInterval(x, y, 41, 177, 200, 400), false);
  assert.equal(overInterval(300, 100, 41, 177, 300, 300), false);
});

for (const name of ["074-notes-history", "084-notes-draft-published"]) {
  test(`${name}: the real mockup pointer handlers select the same upper and lower boundaries`, () => {
    const html = readFileSync(new URL(`../../../../../specs/${name}/mockup/index.html`, import.meta.url), "utf8");
    const source = html.slice(html.indexOf("function mountHist()"), html.indexOf("\n  redraw();\n}", html.indexOf("function mountHist()")) + "\n  redraw();\n}".length);
    const calls: [string, number][] = [];
    const ranges: { from: number; at: number }[] = [];
    const el: any = { clientWidth: 720, getBoundingClientRect: () => ({ left: 0, top: 0, width: 720 }), classList: { add() {}, remove() {} }, setPointerCapture() {}, addEventListener() {}, style: {} };
    const document = { getElementById: () => el };
    const state = { phone: false };
    runInNewContext(`${source}; mountHist();`, {
      document, CD: () => document, HV: { v0: 0, v1: 720, g0: 0, g1: 720, drag: null }, S: state,
      HT: 22, handles: () => ({ a: 200, b: 400 }), cmp: () => true, variant: () => "bars",
      localX: (_el: unknown, e: any) => e.clientX, domain: () => [0, 1000000], WM: () => 1000000, ms: (n: number) => n, iso: (n: number) => n,
      go: (range: { from: number; at: number }) => ranges.push(range),
      drawHist() {}, redraw() {}, setView() {}, commitMoment: (h: string, t: number) => calls.push([h, t]),
    });
    for (const phone of [false, true]) {
      state.phone = phone;
      for (const [x, y, expected] of [[399, 22, "a"], [201, 108, "b"], [399, 50, "a"], [201, 85, "b"]] as const) {
        const event = { clientX: x, clientY: y, pointerId: 1 };
        el.onpointerdown(event);
        el.onpointerup(event);
        assert.deepEqual(calls.pop(), [expected, x]);
      }
      const event = { clientX: 399, clientY: 22, pointerId: 1, shiftKey: !phone, target: { closest: () => phone } };
      el.onpointerdown(event);
      el.onpointermove({ ...event, clientX: 459 });
      el.onpointerup({ ...event, clientX: 459 });
      const moved = ranges.pop()!;
      assert.ok(Math.abs(moved.from - 260) < 1e-9 && Math.abs(moved.at - 460) < 1e-9);
      assert.equal(moved.at - moved.from, 200);
    }
  });
}

test("committing a crossing click or milestone swaps A and B without losing the selected time", () => {
  const source = readFileSync(new URL("../components/scale/Scale.tsx", import.meta.url), "utf8");
  for (const name of ["choose", "pick"]) {
    const start = source.indexOf(`const ${name} = (`);
    const handler = source.slice(start, source.indexOf("\n  };", start) + 5)
      .replace(": number", "").replace(": Handle", "").replace(": Milestone", "").replaceAll(" as string", "");
    const calls: any[] = [];
    const context: any = { watermark: 1000, now: 1000, step: 1, comparing: true, from: "200", at: "400", unitOf: () => 1, msOf: Number, momentOf: String, chosenMoment: String, onRange: (r: any) => calls.push(r), onChoose() {}, onMilestone() {} };
    runInNewContext(`${handler}; this.invoke = ${name};`, context);
    for (const [handle, time, expected] of [["a", 500, ["400", "500"]], ["b", 100, ["100", "200"]], ["a", 300, ["300", "400"]], ["b", 300, ["200", "300"]]] as const) {
      context.invoke(name === "pick" ? { at: String(time) } : time, handle);
      const result = calls.pop();
      assert.deepEqual([result.from, result.at], expected, `${name} ${handle}`);
    }
  }
});

for (const name of ["074-notes-history", "084-notes-draft-published"]) {
  test(`${name}: committing a crossed boundary preserves both times in chronological order`, () => {
    const html = readFileSync(new URL(`../../../../../specs/${name}/mockup/index.html`, import.meta.url), "utf8");
    const start = html.indexOf("function commitMoment(");
    const source = html.slice(start, html.indexOf("\nfunction mountHist", start));
    const calls: any[] = [];
    const context: any = { S: { from: 200000, at: 400000 }, WM: () => 1000000, ms: Number, iso: Number, go: (r: any) => calls.push(r) };
    runInNewContext(source, context);
    context.commitMoment("a", 500000);
    assert.deepEqual([calls[0].from, calls[0].at], [400000, 500000]);
    context.commitMoment("b", 100000);
    assert.deepEqual([calls[1].from, calls[1].at], [100000, 200000]);
  });
}

test("plot clicks choose the closest horizontal bound, with deterministic ties and fixed edges", () => {
 for (const y of [60,100,150]) {
  assert.equal(nearestHandle(210,y,41,177,200,400),"a");
  assert.equal(nearestHandle(390,y,41,177,200,400),"b");
  assert.equal(nearestHandle(390,y,41,177,400,200),"a");
  assert.equal(nearestHandle(210,y,41,177,null,400),"one");
 }
 assert.equal(nearestHandle(390,41,41,177,200,400),"a");
 assert.equal(nearestHandle(210,177,41,177,200,400),"b");
 for(const x of [200,300,400]) {
  assert.equal(nearestHandle(x,60,41,177,300,300),"a");
  assert.equal(nearestHandle(x,150,41,177,300,300),"b");
 }
});
test("a removed hover line still belongs to the scale's original pointer event", () => {
 const holder=new EventTarget(), hoverLine=new EventTarget(), outside=new EventTarget();
 assert.equal(insideScale({composedPath:()=>[hoverLine,holder]},holder),true);
 assert.equal(insideScale({composedPath:()=>[outside]},holder),false);
});

test("the scale outside handler does not close for a detached SVG target from its own event path", () => {
  const source=readFileSync(new URL("../components/scale/Scale.tsx",import.meta.url),"utf8");
  const start=source.indexOf("const outside = (");
  const handler=source.slice(start,source.indexOf("\n    };",start)+7).replace(": PointerEvent","");
  class FakeNode {}
  const holder={current:{contains:()=>false}};
  let closed=false;
  const context:any={holder,Node:FakeNode,insideScale,setOpen:()=>{closed=true;}};
  runInNewContext(`${handler}; this.invoke=outside;`,context);
  context.invoke({target:new FakeNode(),composedPath:()=>[new FakeNode(),holder.current]});
  assert.equal(closed,false,"The hover line may be removed before the document listener runs");
  context.invoke({target:new FakeNode(),composedPath:()=>[new FakeNode()]});
  assert.equal(closed,true,"Actual outside clicks must still dismiss the scale");
});

test("Track dispatches body clicks by horizontal distance in One and Diff", () => {
  const source=readFileSync(new URL("../components/scale/Track.tsx",import.meta.url),"utf8");
  const line=source.split("\n").find(l=>l.includes("const clicked ="))!.replaceAll(": number","").replace(": Handle","");
  const context:any={nearestHandle,handleAt,top:41,base:177,against:200,shown:400,X:(n:number)=>n};
  runInNewContext(`${line}; this.invoke=clicked;`,context);
  assert.equal(context.invoke(230,150),"a");
  assert.equal(context.invoke(370,60),"b");
  context.against=null;
  assert.equal(context.invoke(370,60),"one");
});
