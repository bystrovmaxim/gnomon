import assert from "node:assert/strict";

/** One continuous browser regression on history/both in Diff; never reload between gestures. */
export async function checkScaleGestureSequence({ track, pill, preset, url, click, drag, swipe, observe, mobile = false }) {
  const evidence = [];
  const range = async () => {
    const query = new URL(await url()).searchParams;
    assert.equal(query.get("mode"), "diff", "A gesture left comparison mode");
    const a = Date.parse(query.get("from")), b = Date.parse(query.get("at"));
    assert.ok(Number.isFinite(a) && Number.isFinite(b), "Both dates must remain in the URL");
    return { a, b };
  };
  const geometry = () => track.evaluate(el => {
    const box = el.getBoundingClientRect();
    const a = el.querySelector(".mx-track-knob.hollow"), b = el.querySelector(".mx-track-knob:not(.hollow)");
    const mark = [...el.querySelectorAll(".mx-point-ref")].find(point => point.textContent === "v3");
    const lane = el.querySelector(".mx-lane");
    if (!a || !b || !mark || !lane) throw new Error("The comparison handles and v3 must stay visible");
    return { x: box.x, y: box.y, width: box.width, touchAction: el.ownerDocument.defaultView.getComputedStyle(el).touchAction, a: +a.getAttribute("cx"), b: +b.getAttribute("cx"),
      top: +a.getAttribute("cy"), base: +b.getAttribute("cy"), mark: +mark.getAttribute("x"), lane: +lane.getAttribute("y1") };
  });
  const read = async (step) => {
    await observe();
    assert.equal(await track.count(), 1, `${step}: the scale closed or duplicated`);
    const state = await range();
    assert.ok(state.a <= state.b, `${step}: A must be the earlier date after crossing`);
    evidence.push({ step, ...state });
    return state;
  };
  const minute = time => Math.floor(time / 60_000) * 60_000;
  const closeTo = (a, b, message) => assert.ok(Math.abs(a - b) < 0.5, `${message}: ${a} / ${b}`);

  // Setup is the only preset change. All subsequent gestures share this viewport and URL state.
  await preset.click();
  let previous;
  let before;
  let settled = false;
  const deadline = Date.now() + 5000;
  do {
    await observe();
    before = await geometry();
    if (previous && Math.abs(previous.a - before.a) + Math.abs(previous.b - before.b) < 0.01) { settled = true; break; }
    previous = before;
  } while (Date.now() < deadline);
  assert.ok(settled, "The preset did not settle");
  if (mobile) {
    assert.ok(before.width < 400, "The mobile sequence must use a phone-width scale");
    assert.equal(before.touchAction, "none", "The browser must not steal the scale's touch drag");
  }
  const initial = await read("ready");

  // Start away from both handles and the interval grip: a finger there must pan the viewport.
  await swipe([before.x + before.width * 0.8, before.y + before.base - 20], "left");
  assert.deepEqual(await read("horizontal swipe"), initial, "Panning changed the selected dates");
  let g = await geometry();
  assert.ok(g.a > before.a + 2, "Horizontal input did not move the viewport");
  closeTo(g.b - g.a, before.b - before.a, "Horizontal input changed the zoom");
  closeTo(g.mark - before.mark, g.a - before.a, "The milestone did not move with the viewport");

  const nearest = Math.abs(g.mark - g.a) < Math.abs(g.mark - g.b) ? "a" : "b";
  const markTime = initial.a + (g.mark - g.a) * (initial.b - initial.a) / (g.b - g.a);
  assert.ok(Math.min(Math.abs(g.mark - g.a), Math.abs(g.mark - g.b)) > 12, "The marker must not be hidden by a handle");
  await click(g.x + g.mark, g.y + g.lane);
  const picked = await read("milestone click");
  assert.equal(picked[nearest === "a" ? "b" : "a"], initial[nearest === "a" ? "b" : "a"], "A marker changed the farther bound");
  assert.ok(Math.abs(picked[nearest] - markTime) < 2, "The marker did not select its exact timestamp");

  g = await geometry();
  assert.ok(g.b + 48 < g.width, "Leave room to cross B inside the plot");
  await drag([g.x + g.a, g.y + g.top], [g.x + g.b + 48, g.y + g.top]);
  const crossedA = await read("drag A past B");
  assert.equal(crossedA.a, minute(picked.b), "Crossing A lost the old B instead of exchanging bounds");
  assert.ok(crossedA.b > picked.b, "A was clamped at B");

  g = await geometry();
  assert.ok(g.a > 48, "Leave room to cross A inside the plot");
  await drag([g.x + g.b, g.y + g.base], [g.x + g.a - 48, g.y + g.base]);
  const crossedB = await read("drag B past A");
  assert.equal(crossedB.b, crossedA.a, "Crossing B lost the old A instead of exchanging bounds");
  assert.ok(crossedB.a < crossedA.a, "B was clamped at A");

  // The upper edge must still choose A directly beside B, then the lower handle must remain draggable.
  g = await geometry();
  // Native input rounds screen coordinates. Approach from the left so rounding cannot cross B.
  await click(Math.floor(g.x + g.b), g.y + g.top);
  const touching = await read("overlapping bounds");
  assert.equal(touching.b, crossedB.b, "The upper edge moved B");
  g = await geometry();
  assert.ok(Math.abs(g.a - g.b) < 1.1, "The upper edge did not bring A onto B");
  await drag([g.x + g.b, g.y + g.base], [g.x + g.a - 48, g.y + g.base]);
  const separated = await read("drag lower handle out of overlap");
  assert.equal(separated.b, touching.a, "The lower handle did not exchange bounds when crossing out of overlap");
  assert.ok(separated.a < touching.a);

  const beforeClose = await geometry();
  await pill.click(); await observe();
  assert.equal(await track.count(), 0, "The pill did not close the scale");
  assert.deepEqual(await range(), separated, "Closing changed the selected dates");
  await pill.click();
  assert.deepEqual(await read("reopened"), separated, "Reopening reset A/B");
  g = await geometry();
  closeTo(g.a, beforeClose.a, "Reopening lost the viewport");
  closeTo(g.b, beforeClose.b, "Reopening changed the zoom");

  await swipe([g.x + g.width * 0.8, g.y + g.base - 20], "right");
  assert.deepEqual(await read("swipe after reopening"), separated);
  const after = await geometry();
  assert.ok(after.a < g.a - 2, "Panning does not work after reopening");
  closeTo(after.b - after.a, g.b - g.a, "Panning after reopening changes the zoom");
  return evidence;
}
