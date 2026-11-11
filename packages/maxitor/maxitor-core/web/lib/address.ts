// packages/maxitor/maxitor-core/web/lib/address.ts
// The panel address (the plugin concept, 7.5): /w/<organization>/<owner>/<path>?<parameters>&at=<moment>. It is the
// only source of what the right panel shows, so it is read and written here and nowhere else.

/** What an address names. `path` is the page's path inside its owner, starting with "/". */
export type PanelAddress = {
  code: string;
  owner: string | null;
  path: string;
  query: Record<string, string>;
  at: string | null;
};

/** The parameter of the moment; it and every name starting with "_" belong to the core. */
export const MOMENT = "at";

/** Read a window address: `/w/acme/notes/items/4f1c?view=table&at=…`. */
export function readAddress(pathname: string, search: string | URLSearchParams): PanelAddress | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "w" || !segments[1]) return null;
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const query: Record<string, string> = {};
  let at: string | null = null;
  params.forEach((value, name) => {
    if (name === MOMENT) at = value;
    else query[name] = value;
  });
  const [code, owner, ...rest] = segments.slice(1).map(decodeURIComponent);
  return { code, owner: owner ?? null, path: `/${rest.map(encodeURIComponent).join("/")}`, query, at };
}

/** The query string of parameters and a moment; parameters keep their order, the moment comes last. */
export function queryString(query: Record<string, string>, at: string | null): string {
  const params = new URLSearchParams(query);
  if (at) params.set(MOMENT, at);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The window address of a page: the organization first, then its owner and its path. */
export function windowAddress(code: string, owner: string, path: string, query: Record<string, string> = {}, at: string | null = null): string {
  const inner = path === "/" ? "" : path;
  return `/w/${encodeURIComponent(code)}/${encodeURIComponent(owner)}${inner}${queryString(query, at)}`;
}

/** Put the scope's values into a page template: /items/{item_id} → /items/4f1c; each value is one path segment. */
export function fillPage(template: string, scope: Record<string, string>): string | null {
  let missing = false;
  const path = template.replace(/\{([a-z][a-z0-9_]*)\}/g, (_match, name: string) => {
    const value = scope[name];
    if (value === undefined) missing = true;
    return encodeURIComponent(value ?? "");
  });
  return missing ? null : path;
}

/** Match a path against a page template, backwards: the scope's values it holds, or null when it does not fit. */
export function matchPage(template: string, path: string): Record<string, string> | null {
  const want = template.split("/").filter(Boolean);
  const have = path.split("/").filter(Boolean);
  if (want.length !== have.length) return null;
  const scope: Record<string, string> = {};
  for (let i = 0; i < want.length; i += 1) {
    const name = /^\{([a-z][a-z0-9_]*)\}$/.exec(want[i])?.[1];
    if (name) scope[name] = decodeURIComponent(have[i]);
    else if (want[i] !== have[i]) return null;
  }
  return scope;
}
