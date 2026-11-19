// Browser regression for live administration and the matching standalone scenarios.
export async function auditAdminSurfaces(scope) {
  return scope.locator('.page').evaluate(page => {
    const win = page.ownerDocument.defaultView;
    const problems = [];
    const organization = page.classList.contains('organization-page');
    const people = page.classList.contains('people-page');
    if (!organization && !people) problems.push('missing administration surface');
    if (organization) {
      if (page.querySelectorAll('.admin-surface').length !== 3) problems.push('organization must have three semantic cards');
      const cards = [...page.querySelectorAll('.admin-surface')].slice(1);
      if (cards.length === 2) {
        const [a,b] = cards.map(card => card.getBoundingClientRect());
        if (Math.abs(a.top-b.top)<1) {
          if (Math.abs(a.height-b.height)>1) problems.push('neighboring cards differ in height');
          for (const selector of ['h3','.admin-facts']) {
            if (Math.abs(cards[0].querySelector(selector).getBoundingClientRect().top-cards[1].querySelector(selector).getBoundingClientRect().top)>1) problems.push(`misaligned ${selector}`);
          }
        }
      }
      if (page.querySelector('.choice')) problems.push('policy choices exposed outside editing');
      if (!page.querySelector('[aria-label="Invitation policy"] button')) problems.push('policy edit is missing');
    }
    if (page.querySelector('.ph .sub')) problems.push('redundant page subtitle');
    if (people && page.querySelector('.ph button')) problems.push('page action bypasses the core shell');
    if (people && (page.querySelector('[data-shell=layers],.admin-tabs') || !page.ownerDocument.querySelector('[data-shell=layers]'))) problems.push('people choices must be owned by the core shell outside page content');
    for (const card of page.querySelectorAll('.admin-surface')) {
      if (card.scrollWidth > card.clientWidth + 1) problems.push('card content overflows');
    }
    const fonts = {};
    for (const [selector, expected] of [['h2',20],['h3',16],['.sub',14],['.mx-button:not([data-variant=link])',14],['.nm',14],['.em',12]]) {
      const el = page.querySelector(selector);
      if (el) {
        fonts[selector] = win.getComputedStyle(el).fontSize;
        if (fonts[selector] !== `${expected}px`) problems.push(`${selector} changed type size`);
      }
    }
    return { organization, people, fonts, problems };
  });
}
