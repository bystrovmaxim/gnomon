// web/app/[org]/notes/api.ts — the page calls its own backend through Maxitor's gateway, as the person: the gateway
// adds the token for this plugin, and the page keeps nothing. A refusal comes back as its reason, never thrown.
import type { Refusal } from "./notes";

export type Answer<Data> = { ok: true; data: Data } | { ok: false; status: number; refusal: Refusal | null };

/** One call of an action under /p/notes/api/<organization>. */
export async function call<Data>(org: string, method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<Answer<Data>> {
  try {
    const answer = await fetch(`/p/notes/api/${encodeURIComponent(org)}${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    const read = await answer.json().catch(() => null);
    if (answer.ok) return { ok: true, data: read as Data };
    return { ok: false, status: answer.status, refusal: read && typeof read.error === "string" ? (read as Refusal) : null };
  } catch {
    return { ok: false, status: 0, refusal: null };
  }
}
