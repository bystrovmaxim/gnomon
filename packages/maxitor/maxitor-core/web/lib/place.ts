// packages/maxitor/maxitor-core/web/lib/place.ts
// The account's last place (spec 086, FR-022): the window's address in the present — its path and the page's own
// parameters, without the time scale's `at`, `mode` and `from`. The server keeps the same, so a change of the moment
// alone sends nothing. The names are those of lib/address.ts (MOMENT, COMPARISON), written here so that Node's test
// runner reads this file without the application's import alias.

/** The time scale's names in an address: the moment and the comparison; the core's, never a page's. */
const TIME_SCALE = ["at", "mode", "from"] as const;

/** The place an address names, or null for an address outside the organizations' pages. */
export function placeOf(pathname: string, search: string): string | null {
  if (!/^\/w\/[a-z0-9][a-z0-9-]{0,62}(?:\/|$)/.test(pathname)) return null;
  const params = new URLSearchParams(search);
  for (const name of TIME_SCALE) params.delete(name);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
