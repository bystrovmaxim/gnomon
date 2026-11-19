// Read computed typography in a CUA frame locator after each form/state transition.
export async function auditAdministration(scope) {
  return scope.locator('.mx-administration').evaluateAll(roots => {
    const problems = [];
    const seen = [];
    const rules = [['h2',20], ['h3',16], ['.sub',14], ['.mx-button:not([data-variant=link])',14], ['input:not([type="checkbox"])',16]];
    for (const root of roots) for (const [selector, expected] of rules) {
      for (const node of root.querySelectorAll(selector)) {
        if (!node.getBoundingClientRect().width) continue;
        const size = node.ownerDocument.defaultView.getComputedStyle(node).fontSize;
        seen.push({ selector, size });
        if (size !== `${expected}px`) problems.push(`${selector}: ${size}, expected ${expected}px`);
      }
    }
    return { seen, problems };
  });
}

/** Run on the live People page after navigation/search has settled. */
export async function auditInvitationTabs(scope) {
  return scope.locator('.page').evaluate(root => {
    const selected = root.ownerDocument.querySelector('[data-shell="layers"] [role="radio"][aria-checked="true"]');
    const count = selected?.querySelector('.mx-count')?.textContent;
    const rows = root.querySelectorAll('.utbl tbody tr');
    const label = selected?.textContent ?? '';
    const problems = [];
    if (count !== String(rows.length)) problems.push(`badge ${count}, rows ${rows.length}`);
    const states = [...rows].map(row => row.querySelector('.stt')?.textContent);
    if (label.startsWith('Invitations') && states.some(state => state !== 'Sent')) problems.push('completed invitation in pending list');
    if (label.startsWith('History') && states.some(state => state === 'Sent')) problems.push('pending invitation in history');
    return { label, rows: rows.length, states, problems };
  });
}
