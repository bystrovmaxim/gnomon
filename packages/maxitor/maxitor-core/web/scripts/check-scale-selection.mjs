import assert from "node:assert/strict";

/** Run against an open, settled comparison with A and B visible and at least 20 px apart. */
export async function checkScaleSelection({ track, url, click, observe }) {
  const geometry = () => track.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const a = el.querySelector(".mx-track-knob.hollow");
    const b = el.querySelector(".mx-track-knob:not(.hollow)");
    if (!a || !b) throw new Error("Both comparison knobs must be visible");
    return { x: box.x, y: box.y, a: +a.getAttribute("cx"), b: +b.getAttribute("cx"), top: +a.getAttribute("cy"), base: +b.getAttribute("cy") };
  });
  const range = async () => {
    const query = new URL(await url()).searchParams;
    return { from: query.get("from"), at: query.get("at") };
  };
  let g = await geometry();
  const before = await range();
  assert.ok(g.b - g.a >= 20, "Separate the comparison knobs before checking the edge regression");
  // Reproduce the reported error: the upper edge immediately beside B must move A.
  await click(g.x + g.b - 7, g.y + g.top);
  await observe();
  const upper = await range();
  assert.equal(upper.at, before.at, "An upper-edge click moved B instead of A");
  assert.notEqual(upper.from, before.from, "An upper-edge click did not move A");
  g = await geometry();
  // The converse remains true even when the handles are only a second apart.
  await click(g.x + g.a + 1, g.y + g.base);
  await observe();
  const lower = await range();
  assert.equal(lower.from, upper.from, "An axis click moved A instead of B");
  assert.notEqual(lower.at, upper.at, "An axis click did not move B");
  return { before, upper, lower };
}

/** Check the actual SVG and pointer gesture, not just the interval arithmetic. */
export async function checkIntervalMove({ track, url, drag, observe, leave }) {
  const before = new URL(await url()).searchParams;
  const rect = await track.evaluate((el) => {
    const range = el.querySelector(".mx-track-range");
    const axis = el.querySelector(".mx-track-axis");
    const grip = el.querySelector(".mx-track-move-range");
    if (!range || !axis || !grip) throw new Error("The interval needs its shading, axis and visible move control");
    const box = grip.getBoundingClientRect();
    return { bottom: +range.getAttribute("y") + +range.getAttribute("height"), axis: +axis.getAttribute("y1"), x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  assert.equal(rect.bottom, rect.axis, "Range shading partly covers the time labels");
  await drag([rect.x, rect.y], [rect.x - 30, rect.y]);
  await observe();
  const after = new URL(await url()).searchParams;
  const a0 = Date.parse(before.get("from")), b0 = Date.parse(before.get("at"));
  const a1 = Date.parse(after.get("from")), b1 = Date.parse(after.get("at"));
  assert.ok(a1 < a0 && b1 < b0, "Dragging Move interval must move both bounds");
  assert.equal(b1 - a1, b0 - a0, "Moving the interval changed its duration");
  const opacity = () => track.evaluate((el) => el.ownerDocument.defaultView.getComputedStyle(el.querySelector(".mx-track-move-range")).opacity);
  assert.equal(await opacity(), "1", "The move grip disappeared while the pointer is over the interval");
  await leave();
  await observe();
  assert.equal(await opacity(), "0", "The move grip remains visible outside the shaded interval");
  return { before: { from: before.get("from"), at: before.get("at") }, after: { from: after.get("from"), at: after.get("at") } };
}
