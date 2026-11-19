import assert from 'node:assert/strict';

/** Compare rendered SVG boxes, so an empty fold gutter or padding regression fails visibly. */
export async function checkRootTreeAlignment(tree, { rows = '.mx-tree-root .mx-node.top', icon = '.mx-node-icon svg', toggle = '.mx-tree-head .mx-pict', minimum = 2 } = {}) {
  assert.ok(await tree.isVisible(), 'The root tree must be visible');
  const result = await tree.evaluate((el, selectors) => {
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const collapse = el.querySelector(selectors.toggle)?.getBoundingClientRect();
    const entries = [...el.querySelectorAll(selectors.rows)].map(row => {
      const svg = row.querySelector(selectors.icon).getBoundingClientRect();
      return { title: row.textContent.trim(), right: svg.right, width: svg.width, font: getComputedStyle(row).fontSize };
    });
    // The phone drawer omits collapse; retain the same icon column inside its border.
    const right = collapse?.right ?? box.left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.getPropertyValue('--mx-tree-slot')) / 2 + entries[0]?.width / 2;
    return { right, entries };
  }, { rows, icon, toggle });
  assert.ok(result.entries.length >= minimum, 'The expected root entries must be present');
  for (const row of result.entries) assert.ok(Math.abs(row.right - result.right) < 0.1,
    `${row.title}: icon right edge ${row.right} differs from collapse ${result.right}`);
  return result;
}

/** Enter and leave the first section twice: its icon and title must not jump in either direction. */
export async function checkEnteredTreePosition(tree, {
  entry = '.mx-tree-scroll .mx-node.top', entryIcon = '.mx-node-icon svg', entryTitle = '.mx-node-title',
  heading = '.mx-level-head', headingIcon = '.mx-level-icon svg', headingTitle = '.mx-level-title',
  afterEnter = async () => {},
} = {}) {
  const measure = (row, icon, title) => row.evaluate((el, selectors) => {
    const box = selector => {
      const node = el.querySelector(selector);
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y + rect.height / 2, width: rect.width, height: rect.height, font: getComputedStyle(node).fontSize };
    };
    return { icon: box(selectors.icon), title: box(selectors.title) };
  }, { icon, title });
  const stationary = (before, after, phase) => {
    for (const part of ['icon', 'title']) {
      for (const axis of ['x', 'y']) assert.ok(Math.abs(after[part][axis] - before[part][axis]) < 0.1,
        `${phase}: ${part} ${axis} moved from ${before[part][axis]} to ${after[part][axis]}`);
    }
    assert.equal(after.icon.width, before.icon.width, `${phase}: the section icon changed size`);
  };
  const root = tree.locator(entry).first();
  const before = await measure(root, entryIcon, entryTitle);
  const visits = [];
  for (let visit = 0; visit < 2; visit++) {
    await root.click();
    await afterEnter();
    const head = tree.locator(heading);
    await head.waitFor({ state: 'visible' });
    const entered = await measure(head, headingIcon, headingTitle);
    stationary(before, entered, 'Enter');
    await tree.getByRole('button', { name: 'Back', exact: true }).click();
    await root.waitFor({ state: 'visible' });
    const restored = await measure(root, entryIcon, entryTitle);
    stationary(before, restored, 'Back');
    assert.equal(restored.title.font, before.title.font, 'Back changed the root font size');
    visits.push({ entered, restored });
  }
  return { before, visits };
}
