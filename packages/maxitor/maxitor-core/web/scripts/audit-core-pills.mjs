import assert from "node:assert/strict";

/** Exercise the real camera; fixed CSS inside a transformed scene is not sufficient. */
export async function auditStationaryPills(page, frame, phone) {
  const pills = frame.locator('[data-shell="layers"]');
  const scene = frame.locator('.mx-canvas-scene');
  const canvas = frame.locator('.mx-canvas');
  const before = await pills.boundingBox();
  const camera = await scene.getAttribute('style');
  const field = await canvas.boundingBox();
  const start = { x: field.x + 10, y: field.y + Math.min(330, field.height - 110) };
  let touch;
  async function swipe(reverse = false) {
    const from = reverse ? {x:start.x+110,y:start.y-60} : start;
    const to = reverse ? start : {x:start.x+110,y:start.y-60};
    await touch.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{...from,id:1}]});
    for (let i=1;i<=6;i++) await touch.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/6,y:from.y+(to.y-from.y)*i/6,id:1}]});
    await touch.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  }
  async function changed(previous) {
    for (let i=0;i<60;i++) {
      if (await scene.getAttribute('style') !== previous) return;
      await page.waitForTimeout(25);
    }
    assert.fail('The canvas did not move; the fixed-position regression must exercise a real gesture');
  }
  async function stationary(gesture) {
    const after = await pills.boundingBox();
    for (const key of ['x','y','width','height']) assert(Math.abs(after[key]-before[key])<1, `Core pills ${key} changed during ${gesture}: ${before[key]} → ${after[key]}`);
    assert.equal(await pills.locator('button').first().evaluate(el=>getComputedStyle(el).fontSize),'14px');
  }
  try {
    if (phone) { touch = await page.context().newCDPSession(page); await swipe(); }
    else { await page.mouse.move(start.x,start.y); await page.mouse.wheel(110,60); }
    await changed(camera);
    await stationary(phone ? 'touch swipe' : 'horizontal/vertical wheel');
    const moved = await scene.getAttribute('style');
    await frame.getByRole('button',{name:'Zoom in',exact:true}).click();
    await changed(moved);
    await stationary('canvas zoom');
    assert.equal(await pills.evaluate(el=>Boolean(el.closest('.mx-canvas,.admin-scene,.page'))),false,'The core shell must own the pills outside the canvas');
    const enlarged = await scene.getAttribute('style');
    await frame.getByRole('button',{name:'Zoom out',exact:true}).click();
    await changed(enlarged);
    if (phone) await swipe(true);
    else { await page.mouse.move(start.x,start.y); await page.mouse.wheel(-110,-60); }
    await page.waitForTimeout(60);
    return {pan:phone?'native touch':'wheel',zoom:true,fixed:true};
  } finally { await touch?.detach(); }
}
