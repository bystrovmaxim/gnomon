// @maxitor/panel — the moment of an address, for a server component as well as a client one.

/** The moment an address names, as an opaque string; null for now. Never pass it through Date. */
export function momentFrom(query: Record<string, string | undefined>): string | null {
  return query.at ?? null;
}
