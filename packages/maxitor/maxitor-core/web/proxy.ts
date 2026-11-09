// packages/maxitor/maxitor-core/web/proxy.ts
// Keeps an active session alive: when less than half of the token's eight hours is left, the backend's
// RenewSessionAction signs a new one, up to 30 days from signing in; a refused renewal ends the session.
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "__Host-maxitor_session";
const SESSION_SECONDS = 8 * 60 * 60;
const API = process.env.MAXITOR_CORE_API ?? "http://127.0.0.1:8020";

function expiresAt(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.next();
  const left = expiresAt(token) - Date.now() / 1000;
  if (left > SESSION_SECONDS / 2) return NextResponse.next();
  const forwarded = request.headers.get("x-forwarded-for");
  let renewed: string | null = null;
  let refused = false;
  try {
    const answer = await fetch(`${API}/api/v1/session/renew`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(forwarded ? { "x-forwarded-for": forwarded } : {}) },
      body: JSON.stringify({ session_token: token }),
      cache: "no-store",
    });
    if (answer.ok) renewed = ((await answer.json()) as { session_token: string }).session_token;
    else refused = answer.status === 401;
  } catch {
    return NextResponse.next();
  }
  if (renewed) {
    // The pages of this request already read the new token; the browser keeps it from the answer.
    request.cookies.set(SESSION_COOKIE, renewed);
    const response = NextResponse.next({ request });
    response.cookies.set(SESSION_COOKIE, renewed, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
    return response;
  }
  if (refused) {
    request.cookies.delete(SESSION_COOKIE);
    const response = NextResponse.next({ request });
    // A "__Host-" cookie goes only with Secure and Path=/ again.
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: not the backend's addresses, not Next.js's own files.
  matcher: ["/((?!api|_next|favicon.ico).*)"],
};
