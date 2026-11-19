// Browser regression: run through a CUA frame locator at desktop, medium and phone widths.
export async function auditPluginGrid(scope) {
  return scope.locator('.marketplace-page').evaluate(page => {
    const win = page.ownerDocument.defaultView;
    const inner = page.querySelector('.inner');
    const width = inner.getBoundingClientRect().width;
    const grid = page.querySelector('.grid');
    const columns = win.getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const expected = width >= 1150 ? 3 : width >= 601 ? 2 : 1;
    const problems = [];
    if (columns !== expected) problems.push(`expected ${expected} columns at ${width}px, got ${columns}`);
    if (width < win.innerWidth - 49) problems.push('plugin content leaves unused horizontal panel space');
    const fonts = {};
    for (const selector of ['h2','.sub','.ptitle','.ver','.by','.desc','.req','.mx-button:not([data-variant=link])']) {
      const el = page.querySelector(selector);
      if (el) fonts[selector] = win.getComputedStyle(el).fontSize;
    }
    return { width, columns, fonts, problems };
  });
}
