import assert from "node:assert/strict";

/** Read the actual SVG counts: the highest grid label is the full bar height (78 px). */
export async function scaleSnapshot(track) {
  assert.equal(await track.count(), 1, "The observer's scale must stay open");
  return track.evaluate(el => {
    const max = Math.max(1, ...[...el.querySelectorAll('.mx-track-count')].map(x => Number(x.textContent)));
    const counts = {};
    for (const kind of ['added', 'changed', 'removed']) {
      const height = [...el.querySelectorAll(`.mx-bar-${kind}`)].reduce((sum, rect) => sum + Number(rect.getAttribute('height')), 0);
      counts[kind] = Math.round(height * max / 78);
    }
    const marks = [...el.querySelectorAll('.mx-point-ref')];
    const pointX = mark => Number(mark.parentElement.querySelector('circle[cx]')?.getAttribute('cx') ?? mark.getAttribute('x'));
    const card = el.closest('.mx-card');
    return { marks: marks.map(x => x.textContent), counts, url: el.ownerDocument.URL,
      width: el.getBoundingClientRect().width,
      points: marks.map(x => ({ ref: x.textContent, x: pointX(x) })),
      messages: [...(card?.querySelectorAll('.mx-message > b') ?? [])].map(x => x.textContent),
      aX: Number(el.querySelector('.mx-track-knob.hollow')?.getAttribute('cx')),
      aLabel: el.querySelector('.mx-track-chip-text.hollow')?.textContent,
      nowX: Number(el.querySelector('.mx-track-now')?.getAttribute('x1')),
      barsRight: Math.max(0, ...[...el.querySelectorAll('rect[class*="mx-bar-"]')].map(x => Number(x.getAttribute('x')) + Number(x.getAttribute('width')))),
      latestX: marks.length ? pointX(marks.at(-1)) : null,
      boundaryX: Number(el.querySelector('.mx-track-knob:not(.hollow)')?.getAttribute('cx')),
      boundaryLabel: el.querySelector('.mx-track-chip-text:not(.hollow)')?.textContent };
  });
}

/** Publish in another tab; never interact with, reload, or reopen the observing scale. */
export async function checkScaleLivePublication({ track, publish, observe, delta, budget = 5000, navigationStamp, mobile = false, fixed = false, readContent, expectedContent }) {
  const before = await scaleSnapshot(track);
  if (readContent) before.content = await readContent();
  const query = new URL(before.url).searchParams;
  const comparing = ['diff', 'side_by_side'].includes(query.get('mode'));
  if (mobile) assert.ok(before.width <= 375, 'The observer must use a phone-width scale');
  assert.equal(query.has('at'), fixed, 'Prepare either a fixed date or Now before publishing');
  if (comparing) assert.ok(query.get('from'), 'A must be an explicitly selected date');
  const navigation = navigationStamp?.();
  const expected = Object.fromEntries(['added', 'changed', 'removed'].map(kind => [kind, before.counts[kind] + (delta[kind] ?? 0)]));
  const start = Date.now();
  await publish();
  let after, elapsedMs;
  do {
    await observe();
    after = await scaleSnapshot(track);
    if (readContent) after.content = await readContent();
    elapsedMs = Date.now() - start;
    assert.equal(after.url, before.url, "The observer navigated during publication");
    if (navigationStamp) assert.equal(navigationStamp(), navigation, "The observer reloaded during publication");
    const messageReady = fixed || after.messages.at(-1)?.includes(after.marks.at(-1));
    const contentReady = !readContent || after.content === (fixed ? before.content : expectedContent);
    if (after.marks.length === before.marks.length + 1 && Object.keys(expected).every(kind => after.counts[kind] === expected[kind]) && messageReady && contentReady) break;
  } while (elapsedMs < budget);
  const evidence = { elapsedMs, budget, before, after, expected };
  assert.equal(after.marks.length, before.marks.length + 1, `The publication marker did not arrive: ${JSON.stringify(evidence)}`);
  for (const kind of Object.keys(expected)) {
    assert.equal(after.counts[kind], expected[kind], `The publication's ${kind} bars did not arrive: ${JSON.stringify(evidence)}`);
  }
  if (readContent) assert.equal(after.content, fixed ? before.content : expectedContent, 'The panel did not preserve its historical snapshot or follow live B');
  // Check times against two unchanged milestones, independent of viewport translation or zoom.
  const retainedPosition = (property) => {
    const first = before.points[0], last = before.points.at(-1);
    assert.ok(first && last && Math.abs(last.x - first.x) > 0.001, 'Two distinct baseline milestones are required');
    const firstAfter = after.points.find(x => x.ref === first.ref), lastAfter = after.points.find(x => x.ref === last.ref);
    assert.ok(firstAfter && lastAfter, 'Baseline milestones left the viewport');
    const expectedX = firstAfter.x + (before[property] - first.x) * (lastAfter.x - firstAfter.x) / (last.x - first.x);
    assert.ok(Math.abs(after[property] - expectedX) < 0.05, `The manually chosen ${property} moved in time`);
  };
  if (comparing) {
    assert.equal(after.messages[0], before.messages[0], 'A changed its selected publication');
    retainedPosition('aX');
  }
  if (fixed) {
    assert.equal(after.boundaryLabel, before.boundaryLabel, 'The fixed B date became Now');
    assert.equal(after.messages.at(-1), before.messages.at(-1), 'B changed its selected publication');
    retainedPosition('boundaryX');
  } else {
    assert.equal(after.boundaryLabel, comparing ? 'B Now' : 'Now', 'The live boundary became a fixed historical moment');
    assert.ok(Math.abs(after.boundaryX - after.nowX) < 0.01, 'The live boundary no longer follows Now');
    assert.ok(after.boundaryX >= after.latestX - 0.5, 'The live boundary stayed behind the new publication');
    assert.ok(after.messages.at(-1)?.includes(after.marks.at(-1)), 'B did not adopt the new publication');
  }
  assert.ok(after.barsRight <= after.nowX + 0.01, 'The bars extend into the future beyond Now');
  assert.ok(elapsedMs <= budget, `The scale needed ${elapsedMs} ms, over the ${budget} ms budget`);
  return evidence;
}
