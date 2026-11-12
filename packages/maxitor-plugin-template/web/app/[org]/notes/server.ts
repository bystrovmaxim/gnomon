// web/app/[org]/notes/server.ts — what a page's server part reads from its own backend: the backend's inner address
// and the token Maxitor's gateway put on the request, passed on and never kept.
import { headers } from "next/headers";

/** One reading action of the template at the panel's moment; null when it refused. */
export async function read<Data>(org: string, path: string, params: Record<string, string | undefined>): Promise<Data | null> {
  const authorization = (await headers()).get("authorization") ?? "";
  const url = new URL(`${process.env.MAXITOR_PLUGIN_API}/p/notes/api/${encodeURIComponent(org)}${path}`);
  // The moment stays an opaque string: it never passes through Date, which would cut it to milliseconds.
  for (const [name, value] of Object.entries(params)) if (value) url.searchParams.set(name, value);
  const answer = await fetch(url, { headers: { authorization }, cache: "no-store" });
  return answer.ok ? ((await answer.json()) as Data) : null;
}
