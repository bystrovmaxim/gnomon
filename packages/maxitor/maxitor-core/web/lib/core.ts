// packages/maxitor/maxitor-core/web/lib/core.ts
// The core's backend as the application's server calls it: the session cookie and the client's address go with
// every call, the answer comes back as data or as the backend's refusal.
import { cookies, headers } from "next/headers";

export const SESSION_COOKIE = "__Host-maxitor_session";
export const CONSENT_COOKIE = "__Host-maxitor_consent";
export const OAUTH_COOKIE = "__Host-maxitor_oauth";

/** A session token lives eight hours; the cookie lives as long. */
export const SESSION_SECONDS = 8 * 60 * 60;

const API = process.env.MAXITOR_CORE_API ?? "http://127.0.0.1:8020";

/** What the backend says when it refuses: its reason and the details it names. */
export type Refusal = { error: string; [detail: string]: unknown };

export type Answer<T> = { ok: true; status: number; data: T } | { ok: false; status: number; refusal: Refusal };

/** Call the backend from the application's server. */
export async function core<T>(method: "GET" | "POST", path: string, body?: unknown, token?: string): Promise<Answer<T>> {
  const incoming = await headers();
  const session = token ?? (await cookies()).get(SESSION_COOKIE)?.value;
  const sent: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) sent["content-type"] = "application/json";
  const forwarded = incoming.get("x-forwarded-for");
  if (forwarded) sent["x-forwarded-for"] = forwarded;
  if (session) sent.cookie = `${SESSION_COOKIE}=${session}`;
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers: sent,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 503, refusal: { error: "unavailable" } };
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.ok) return { ok: true, status: response.status, data: data as T };
  const refusal = typeof data.error === "string" ? (data as Refusal) : { error: response.status === 401 ? "unauthorized" : "unavailable" };
  return { ok: false, status: response.status, refusal };
}

/** The cookie options of everything the application keeps for the person: never readable by the page. */
export function hidden(maxAge: number) {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge };
}

/**
 * Forget a cookie of the application. A "__Host-" cookie is removed only by a Set-Cookie that carries Secure and
 * Path=/ again, so it is overwritten empty with its own attributes and no life left.
 */
export function forgotten(): ReturnType<typeof hidden> {
  return hidden(0);
}

/** Put a new session into the cookie. */
export async function keepSession(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, hidden(SESSION_SECONDS));
}

/** The claims of a token, read without checking it: only for showing, never for deciding. */
export function claims(token: string | undefined): Record<string, unknown> {
  if (!token) return {};
  try {
    const payload = token.split(".")[1] ?? "";
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** A return address of Maxitor itself: a path, never another site; anything else is dropped. */
export function ownPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

export type Options = { region: "russia" | "abroad"; email: boolean; providers: string[] };

export type Me = {
  account_id: string;
  name: string;
  email: string;
  policy_current: boolean;
  organizations: { code: string; name: string; is_admin: boolean }[];
};

/** The signed-in account, or null without a valid session. */
export async function me(): Promise<Me | null> {
  if (!(await cookies()).get(SESSION_COOKIE)) return null;
  const answer = await core<Me>("GET", "/api/v1/me");
  return answer.ok ? answer.data : null;
}

/** The ways in the request's region allows; Russia's when the backend cannot say. */
export async function signInOptions(): Promise<Options> {
  const answer = await core<Options>("GET", "/api/v1/sign-in/options");
  return answer.ok ? answer.data : { region: "russia", email: true, providers: ["yandex", "mailru"] };
}
